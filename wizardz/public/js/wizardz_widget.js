// Wizardz Widget - Injects AI assistant button into Frappe desk pages
// Copyright (c) 2025, TierneyMorris Pty Ltd

class WizardzWidget {
    constructor() {
        this.currentDoctype = null;
        this.wizardConfig = null;
        this.init();
    }

    init() {
        // Wait for Frappe to be ready
        if (typeof frappe === 'undefined') {
            setTimeout(() => this.init(), 100);
            return;
        }

        // Listen for page changes
        frappe.router.on('change', () => {
            this.onPageChange();
        });

        // Initial check
        this.onPageChange();
    }

    onPageChange() {
        // Small delay to ensure page is fully loaded
        setTimeout(() => {
            this.checkCurrentPage();
        }, 500);
    }

    checkCurrentPage() {
        // Check if we're on a DocType page
        const route = frappe.get_route();
        
        if (route[0] === 'Form' && route[1]) {
            this.currentDoctype = route[1];
            this.checkForWizard();
        } else if (route[0] === 'List' && route[1]) {
            this.currentDoctype = route[1];
            this.checkForWizard();
        } else {
            this.hideWidget();
        }
    }

    async checkForWizard() {
        try {
            // Check if there's a wizard for this doctype
            const response = await frappe.call({
                method: 'wizardz.api.get_wizard_for_doctype',
                args: { doctype: this.currentDoctype }
            });

            if (response.message) {
                this.wizardConfig = response.message;
                this.showWidget();
            } else {
                this.hideWidget();
            }
        } catch (error) {
            // Silently hide widget if no wizard is configured or there's an error
            // Don't log errors to avoid console spam on every page
            this.hideWidget();
        }
    }

    showWidget() {
        // Remove existing widget
        this.hideWidget();

        // Create widget button
        const widget = this.createWidget();
        
        // Find the best place to inject the widget based on page type
        let toolbar = null;
        
        // Try different toolbar locations for different page types
        const selectors = [
            '.page-head .standard-actions',  // Form view
            '.list-row-container .list-header-subject .list-header-meta', // List view header
            '.page-actions .standard-actions', // Alternative location
            '.page-head .page-actions', // Another alternative
            '.list-page-head .page-actions' // List page specific
        ];
        
        for (const selector of selectors) {
            toolbar = document.querySelector(selector);
            if (toolbar) {
                break;
            }
        }
        
        // If no standard toolbar found, try to inject after page title
        if (!toolbar) {
            const pageTitle = document.querySelector('.page-head .page-title');
            if (pageTitle) {
                // Create a container for our widget
                const widgetContainer = document.createElement('div');
                widgetContainer.style.display = 'inline-block';
                widgetContainer.style.marginLeft = '15px';
                widgetContainer.appendChild(widget);
                pageTitle.appendChild(widgetContainer);
                return;
            }
        }
        
        if (toolbar) {
            toolbar.appendChild(widget);
        }
    }

    createWidget() {
        const widget = document.createElement('div');
        widget.className = 'wizardz-widget';
        widget.innerHTML = `
            <button class="btn btn-primary btn-sm wizardz-btn" title="AI DocType Assistant">
                <i class="fa fa-magic"></i>
                <span class="hidden-xs">AI Assistant</span>
            </button>
        `;

        // Add click handler
        widget.querySelector('.wizardz-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.openWizardModal();
        });

        return widget;
    }

    hideWidget() {
        const existingWidget = document.querySelector('.wizardz-widget');
        if (existingWidget) {
            existingWidget.remove();
        }
    }

    openWizardModal() {
        // Create and show the wizard modal
        const modal = new WizardzModal(this.wizardConfig, this.currentDoctype);
        modal.show();
    }
}

class WizardzModal {
    constructor(wizardConfig, doctype) {
        this.wizardConfig = wizardConfig;
        this.doctype = doctype;
        this.draftId = null;
        this.conversation = [];
    }

    show() {
        // Create modal HTML
        const modalHtml = this.createModalHtml();
        
        // Add to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal using Bootstrap
        const modal = document.getElementById('wizardz-modal');
        
        // Add event listeners first
        this.attachEventListeners();
        
        // Show modal with Bootstrap if available, otherwise fallback
        if (typeof $ !== 'undefined' && $.fn.modal) {
            $(modal).modal('show');
        } else {
            // Fallback for non-Bootstrap environments
            modal.style.display = 'block';
            modal.classList.add('show');
            document.body.classList.add('modal-open');
            
            // Add backdrop
            const backdrop = document.createElement('div');
            backdrop.className = 'modal-backdrop fade show';
            backdrop.id = 'wizardz-modal-backdrop';
            document.body.appendChild(backdrop);
        }
        
        // Start wizard session
        this.startSession();
    }

    createModalHtml() {
        return `
            <div id="wizardz-modal" class="modal fade" style="display: none;">
                <div class="modal-dialog modal-lg" style="width: 90%; max-width: 1200px;">
                    <div class="modal-content">
                        <div class="modal-header" style="background: white; border-bottom: 1px solid #d1d8dd;">
                            <h4 class="modal-title" style="color: #36414c; font-weight: 500;">
                                <i class="fa fa-magic" style="margin-right: 8px;"></i>
                                AI DocType Assistant - ${this.wizardConfig.wizard_name}
                            </h4>
                            <button type="button" class="close" data-dismiss="modal" style="color: #6c7680;">
                                <span>&times;</span>
                            </button>
                        </div>
                        <div class="modal-body" style="height: 70vh; padding: 0; background: white;">
                            <div class="row" style="height: 100%; margin: 0;">
                                <!-- Preview Panel (Left) -->
                                <div class="col-md-6" style="height: 100%; border-right: 1px solid #d1d8dd; padding: 0;">
                                    <div class="wizardz-preview-panel" style="height: 100%; display: flex; flex-direction: column; background: white;">
                                        <div class="preview-header" style="padding: 15px; border-bottom: 1px solid #d1d8dd; background: white;">
                                            <h5 style="margin: 0; color: #36414c; font-weight: 500;">Customer Form Preview</h5>
                                            <small style="color: #6c7680;">Live preview of your ${this.doctype} record</small>
                                        </div>
                                        <div class="preview-content" style="flex: 1; overflow-y: auto; padding: 15px; background: white;">
                                            <div class="preview-placeholder text-center" style="padding: 50px; color: #6c7680;">
                                                <i class="fa fa-user fa-3x" style="color: #d1d8dd; margin-bottom: 15px;"></i>
                                                <p>Customer record preview will appear here as you provide information</p>
                                            </div>
                                        </div>
                                        <div class="preview-actions" style="padding: 15px; border-top: 1px solid #d1d8dd; background: white;">
                                            <button class="btn btn-success btn-sm" id="wizardz-deploy-btn" disabled
                                                    style="margin-right: 10px;">
                                                <i class="fa fa-save"></i> Save Customer
                                            </button>
                                            <button class="btn btn-default btn-sm" id="wizardz-save-draft-btn" disabled
                                                    style="border: 1px solid #d1d8dd; color: #36414c;">
                                                <i class="fa fa-edit"></i> Save Draft
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Chat Panel (Right) -->
                                <div class="col-md-6" style="height: 100%; padding: 0;">
                                    <div class="wizardz-chat-panel" style="height: 100%; display: flex; flex-direction: column; background: white;">
                                        <div class="chat-header" style="padding: 15px; border-bottom: 1px solid #d1d8dd; background: white;">
                                            <h5 style="margin: 0; color: #36414c; font-weight: 500;">Chat with AI Assistant</h5>
                                            <small style="color: #6c7680;">Creating new ${this.doctype} record</small>
                                        </div>
                                        <div class="chat-messages" style="flex: 1; overflow-y: auto; padding: 15px; background: white;">
                                            <div class="loading-message" style="color: #6c7680;">
                                                <i class="fa fa-spinner fa-spin"></i> Starting wizard session...
                                            </div>
                                        </div>
                                        <div class="chat-input" style="padding: 15px; border-top: 1px solid #d1d8dd; background: white;">
                                            <div class="input-group">
                                                <input type="text" class="form-control" id="wizardz-message-input" 
                                                       placeholder="Type your message..." disabled 
                                                       style="border: 1px solid #d1d8dd;">
                                                <span class="input-group-btn">
                                                    <button class="btn btn-default" id="wizardz-send-btn" disabled
                                                            style="border: 1px solid #d1d8dd; background: white; color: #36414c;">
                                                        <i class="fa fa-paper-plane"></i>
                                                    </button>
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        // Close modal
        document.querySelector('#wizardz-modal .close').addEventListener('click', () => {
            this.close();
        });

        // Send message on Enter
        document.getElementById('wizardz-message-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Send button
        document.getElementById('wizardz-send-btn').addEventListener('click', () => {
            this.sendMessage();
        });

        // Deploy button
        document.getElementById('wizardz-deploy-btn').addEventListener('click', () => {
            this.deployDocType();
        });

        // Save draft button
        document.getElementById('wizardz-save-draft-btn').addEventListener('click', () => {
            this.saveDraft();
        });
    }

    async startSession() {
        try {
            const response = await frappe.call({
                method: 'wizardz.api.start_wizard_session',
                args: {
                    wizard_config: this.wizardConfig.name,
                    draft_name: `${this.doctype} - ${new Date().toLocaleString()}`,
                    target_doctype: this.doctype
                }
            });

            if (response.message.success) {
                this.draftId = response.message.draft_id;
                this.addMessage('system', response.message.message);
                
                // Get initial AI greeting from OpenAI API
                this.getInitialGreeting();
            } else {
                this.addMessage('system', 'Error starting wizard session: ' + response.message.error);
            }
        } catch (error) {
            this.addMessage('system', 'Error starting wizard session: ' + error.message);
        }
    }

    async getInitialGreeting() {
        try {
            // Send an empty initial message to get AI's greeting
            const response = await frappe.call({
                method: 'wizardz.api.send_message',
                args: {
                    draft_id: this.draftId,
                    message: "Please start the conversation and introduce yourself.",
                    message_type: "system"
                }
            });

            if (response.message.success) {
                this.addMessage('assistant', response.message.response);
                this.enableInput();
            } else {
                this.addMessage('system', 'Error getting initial greeting: ' + response.message.error);
                this.enableInput();
            }
        } catch (error) {
            this.addMessage('system', 'Error getting initial greeting: ' + error.message);
            this.enableInput();
        }
    }

    async sendMessage() {
        const input = document.getElementById('wizardz-message-input');
        const message = input.value.trim();
        
        if (!message || !this.draftId) return;

        // Add user message to chat
        this.addMessage('user', message);
        input.value = '';
        this.disableInput();

        try {
            const response = await frappe.call({
                method: 'wizardz.api.send_message',
                args: {
                    draft_id: this.draftId,
                    message: message
                }
            });

            if (response.message.success) {
                this.addMessage('assistant', response.message.response);
                
                // Update preview with draft data
                if (response.message.draft_data) {
                    this.updatePreview(response.message.draft_data);
                }
                
                // Update preview if draft status changed
                if (response.message.draft_status === 'Ready to Deploy') {
                    this.enableDeployButton();
                }
            } else {
                this.addMessage('system', 'Error: ' + response.message.error);
            }
        } catch (error) {
            this.addMessage('system', 'Error sending message: ' + error.message);
        } finally {
            this.enableInput();
        }
    }

    addMessage(type, content) {
        const messagesContainer = document.querySelector('.chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        const icon = type === 'user' ? 'fa-user' : type === 'assistant' ? 'fa-robot' : 'fa-info-circle';
        
        // Clean Frappe-style message styling
        const messageStyle = type === 'user' 
            ? 'margin-bottom: 15px; padding: 10px; border-left: 3px solid #5e64ff; background: #f8f9fa;'
            : type === 'assistant'
            ? 'margin-bottom: 15px; padding: 10px; border-left: 3px solid #28a745; background: white; border: 1px solid #d1d8dd;'
            : 'margin-bottom: 15px; padding: 10px; border-left: 3px solid #6c7680; background: #f8f9fa;';
        
        messageDiv.style.cssText = messageStyle;
        
        messageDiv.innerHTML = `
            <div style="margin-bottom: 5px; color: #6c7680; font-size: 12px;">
                <i class="fa ${icon}" style="margin-right: 5px;"></i>
                <strong style="color: #36414c;">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                <span style="float: right;">${timestamp}</span>
            </div>
            <div style="color: #36414c; line-height: 1.4;">${content}</div>
        `;

        // Remove loading message if it exists
        const loadingMessage = messagesContainer.querySelector('.loading-message');
        if (loadingMessage) {
            loadingMessage.remove();
        }

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    enableInput() {
        document.getElementById('wizardz-message-input').disabled = false;
        document.getElementById('wizardz-send-btn').disabled = false;
        document.getElementById('wizardz-save-draft-btn').disabled = false;
    }

    disableInput() {
        document.getElementById('wizardz-message-input').disabled = true;
        document.getElementById('wizardz-send-btn').disabled = true;
    }

    enableDeployButton() {
        document.getElementById('wizardz-deploy-btn').disabled = false;
    }

    updatePreview(draftData) {
        const previewContent = document.querySelector('.preview-content');
        
        if (!draftData || Object.keys(draftData).length === 0) {
            // Show placeholder if no data
            previewContent.innerHTML = `
                <div class="preview-placeholder text-center" style="padding: 50px; color: #6c7680;">
                    <i class="fa fa-user fa-3x" style="color: #d1d8dd; margin-bottom: 15px;"></i>
                    <p>Customer record preview will appear here as you provide information</p>
                </div>
            `;
            return;
        }

        // Build preview HTML
        let previewHtml = '<div class="customer-preview">';
        previewHtml += '<h6 style="color: #36414c; margin-bottom: 15px; border-bottom: 1px solid #d1d8dd; padding-bottom: 5px;">Customer Record</h6>';
        
        // Display each field that has data
        for (const [fieldName, value] of Object.entries(draftData)) {
            if (value && value.toString().trim()) {
                const displayName = this.formatFieldName(fieldName);
                previewHtml += `
                    <div class="field-preview" style="margin-bottom: 10px;">
                        <strong style="color: #6c7680; font-size: 12px; text-transform: uppercase;">${displayName}:</strong>
                        <div style="color: #36414c; margin-top: 2px;">${this.escapeHtml(value)}</div>
                    </div>
                `;
            }
        }
        
        previewHtml += '</div>';
        previewContent.innerHTML = previewHtml;
    }

    formatFieldName(fieldName) {
        // Convert snake_case to Title Case
        return fieldName
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async deployDocType() {
        if (!this.draftId) return;

        try {
            const draft = await frappe.get_doc('Wizardz Draft', this.draftId);
            const response = await frappe.call({
                method: 'deploy_doctype',
                doc: draft
            });

            if (response.message.success) {
                this.addMessage('system', `✅ ${response.message.message}`);
                frappe.show_alert({
                    message: `DocType '${this.doctype}' deployed successfully!`,
                    indicator: 'green'
                });
                setTimeout(() => this.close(), 2000);
            } else {
                this.addMessage('system', '❌ Error deploying DocType: ' + response.message.error);
            }
        } catch (error) {
            this.addMessage('system', '❌ Error deploying DocType: ' + error.message);
        }
    }

    async saveDraft() {
        if (!this.draftId) return;

        try {
            frappe.show_alert({
                message: 'Draft saved successfully!',
                indicator: 'blue'
            });
        } catch (error) {
            frappe.show_alert({
                message: 'Error saving draft: ' + error.message,
                indicator: 'red'
            });
        }
    }

    close() {
        const modal = document.getElementById('wizardz-modal');
        const backdrop = document.getElementById('wizardz-modal-backdrop');
        
        if (modal) {
            // Use Bootstrap modal hide if available
            if (typeof $ !== 'undefined' && $.fn.modal) {
                $(modal).modal('hide');
                // Remove after animation
                setTimeout(() => {
                    modal.remove();
                }, 300);
            } else {
                // Fallback cleanup
                modal.remove();
                if (backdrop) {
                    backdrop.remove();
                }
                document.body.classList.remove('modal-open');
            }
        }
    }
}

// Initialize the widget when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new WizardzWidget();
});

// Also initialize if DOM is already ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new WizardzWidget();
    });
} else {
    new WizardzWidget();
}
