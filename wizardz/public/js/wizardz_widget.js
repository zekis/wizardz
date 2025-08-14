// Wizardz Widget - Injects AI assistant button into Frappe desk pages
// Copyright (c) 2025, TierneyMorris Pty Ltd

class WizardzWidget {
    constructor() {
        this.currentDoctype = null;
        this.wizardConfig = null;
        this.widget = null;
        this.init();
    }

    init() {
        // Wait for Frappe to be ready
        if (typeof frappe === 'undefined') {
            setTimeout(() => this.init(), 100);
            return;
        }

        // Create the widget once and keep it in DOM
        this.createPersistentWidget();

        // Listen for page changes
        if (frappe.router) {
            frappe.router.on('change', () => {
                this.updateWidgetVisibility();
            });
        }

        // Initial check
        this.updateWidgetVisibility();
    }

    createPersistentWidget() {
        // Create widget container that stays in DOM
        this.widget = document.createElement('div');
        this.widget.className = 'wizardz-widget';
        this.widget.style.display = 'none'; // Hidden by default
        
        // Always show icon-only button
        this.widget.innerHTML = `
            <button class="btn btn-primary btn-sm wizardz-btn" title="AI DocType Assistant">
                <i class="fa fa-magic"></i>
            </button>
        `;

        // Add click handler
        this.widget.querySelector('.wizardz-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.openWizardModal();
        });

        // Inject into page - try to find a persistent location
        this.injectWidget();
    }

    injectWidget() {
        // Try to find a persistent container that exists across all pages
        const persistentContainers = [
            '.navbar-right',
            '.navbar .nav',
            '.navbar',
            'body'
        ];

        for (const selector of persistentContainers) {
            const container = document.querySelector(selector);
            if (container) {
                // Create a fixed position container
                const fixedContainer = document.createElement('div');
                fixedContainer.style.cssText = `
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    z-index: 1050;
                    pointer-events: none;
                `;
                fixedContainer.appendChild(this.widget);
                this.widget.style.pointerEvents = 'auto';
                
                container.appendChild(fixedContainer);
                break;
            }
        }
    }

    async updateWidgetVisibility() {
        // Check current page and show/hide widget accordingly
        const route = frappe.get_route();
        
        if ((route[0] === 'Form' || route[0] === 'List') && route[1]) {
            this.currentDoctype = route[1];
            await this.checkForWizard();
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
            this.hideWidget();
        }
    }

    showWidget() {
        if (this.widget) {
            this.widget.style.display = 'block';
            // Update tooltip with current doctype
            const button = this.widget.querySelector('.wizardz-btn');
            if (button) {
                button.title = `AI DocType Assistant - Create new ${this.currentDoctype}`;
            }
        }
    }

    hideWidget() {
        if (this.widget) {
            this.widget.style.display = 'none';
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
        this.isExistingDraft = false;
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
        
        // Start wizard session (check for existing drafts first)
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
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <button type="button" class="btn btn-default btn-sm" id="wizardz-new-conversation-btn" 
                                        title="Start a new conversation" style="color: #6c7680; border: 1px solid #d1d8dd;">
                                    <i class="fa fa-plus"></i> New
                                </button>
                                <button type="button" class="close" data-dismiss="modal" style="color: #6c7680;">
                                    <span>&times;</span>
                                </button>
                            </div>
                        </div>
                        <div class="modal-body" style="height: 70vh; padding: 0; background: white;">
                            <div class="row" style="height: 100%; margin: 0;">
                                <!-- Preview Panel (Left) -->
                                <div class="col-md-6" style="height: 100%; border-right: 1px solid #d1d8dd; padding: 0;">
                                    <div class="wizardz-preview-panel" style="height: 100%; display: flex; flex-direction: column; background: white;">
                                        <div class="preview-header" style="padding: 15px !important; border-bottom: 1px solid #d1d8dd !important; background: white !important; background-color: white !important;">
                                            <h5 style="margin: 0 !important; color: #36414c !important; font-weight: 500 !important; background: transparent !important;">${this.doctype} Form Preview</h5>
                                            <small style="color: #6c7680 !important; background: transparent !important;">Live preview of your ${this.doctype} record</small>
                                        </div>
                                        <div class="preview-content" style="flex: 1; overflow-y: auto; padding: 15px; background: white;">
                                            <div class="preview-placeholder text-center" style="padding: 50px; color: #6c7680;">
                                                <i class="fa fa-file-text-o fa-3x" style="color: #d1d8dd; margin-bottom: 15px;"></i>
                                                <p>${this.doctype} record preview will appear here as you provide information</p>
                                            </div>
                                        </div>
                                        <div class="preview-actions" style="padding: 15px; border-top: 1px solid #d1d8dd; background: white;">
                                            <button class="btn btn-success btn-sm" id="wizardz-create-document-btn" disabled
                                                    style="margin-right: 10px;">
                                                <i class="fa fa-save"></i> Create ${this.doctype}
                                            </button>
                                            <small style="color: #6c7680; font-style: italic;">Draft is saved automatically as you provide information</small>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Chat Panel (Right) -->
                                <div class="col-md-6" style="height: 100%; padding: 0; display: flex;">
                                    <div class="wizardz-chat-panel" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: white;">
                                        <div class="chat-header" style="padding: 15px !important; border-bottom: 1px solid #d1d8dd !important; background: white !important; background-color: white !important;">
                                            <h5 style="margin: 0 !important; color: #36414c !important; font-weight: 500 !important; background: transparent !important;">Chat with AI Assistant</h5>
                                            <small style="color: #6c7680 !important; background: transparent !important;">Creating new ${this.doctype} record</small>
                                        </div>
                                        <div class="chat-messages" style="flex: 1; overflow-y: auto; padding: 15px; background: white; min-height: 0;">
                                            <div class="loading-message" style="color: #6c7680;">
                                                <i class="fa fa-spinner fa-spin"></i> Loading conversation...
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

        // Create Document button
        document.getElementById('wizardz-create-document-btn').addEventListener('click', () => {
            this.createDocument();
        });

        // New Conversation button
        document.getElementById('wizardz-new-conversation-btn').addEventListener('click', () => {
            this.startNewConversation();
        });
    }

    async startSession() {
        try {
            // First, check for existing drafts for this doctype and user
            const existingDraftResponse = await frappe.call({
                method: 'wizardz.api.get_user_drafts'
            });

            let existingDraft = null;
            if (existingDraftResponse.message && existingDraftResponse.message.length > 0) {
                // Find the most recent draft for this doctype that's not completed
                existingDraft = existingDraftResponse.message.find(draft => 
                    draft.target_doctype === this.doctype && 
                    draft.status !== 'Completed'
                );
            }

            if (existingDraft) {
                // Resume existing draft
                this.draftId = existingDraft.name;
                this.isExistingDraft = true;
                
                // Load existing conversation and data
                const draftDataResponse = await frappe.call({
                    method: 'wizardz.api.get_draft_data',
                    args: { draft_id: this.draftId }
                });

                if (draftDataResponse.message.success) {
                    // Load conversation history
                    const conversation = draftDataResponse.message.conversation;
                    
                    // Clear loading message
                    const loadingMessage = document.querySelector('.loading-message');
                    if (loadingMessage) {
                        loadingMessage.remove();
                    }

                    // Display conversation history
                    if (conversation && conversation.length > 0) {
                        conversation.forEach(msg => {
                            if (msg.type !== 'system' || !msg.content.includes('Started wizard session')) {
                                this.addMessage(msg.type, msg.content);
                            }
                        });
                    }

                    // Update preview with existing data
                    if (draftDataResponse.message.draft_data) {
                        this.updatePreview(draftDataResponse.message.draft_data);
                    }

                    // Update button based on status
                    this.updateButtonForMode(draftDataResponse.message.status);

                    // Add resumption message
                    this.addMessage('system', `Resumed conversation for ${this.doctype} draft`);
                    
                    this.enableInput();
                } else {
                    // If we can't load the draft data, start fresh
                    this.startNewSession();
                }
            } else {
                // Start new session
                this.startNewSession();
            }
        } catch (error) {
            this.addMessage('system', 'Error loading conversation: ' + error.message);
            this.startNewSession();
        }
    }

    async startNewSession() {
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
                this.isExistingDraft = false;
                
                // Clear loading message
                const loadingMessage = document.querySelector('.loading-message');
                if (loadingMessage) {
                    loadingMessage.remove();
                }
                
                // Get initial AI greeting for new sessions only
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
            // Only send initial greeting for new sessions
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

    async startNewConversation() {
        // Confirm with user before starting new conversation
        if (this.draftId && this.isExistingDraft) {
            const confirmed = confirm('Are you sure you want to start a new conversation? This will create a new draft and you can return to your previous conversation later.');
            if (!confirmed) {
                return;
            }
        }

        // Clear the chat messages
        const messagesContainer = document.querySelector('.chat-messages');
        messagesContainer.innerHTML = `
            <div class="loading-message" style="color: #6c7680;">
                <i class="fa fa-spinner fa-spin"></i> Starting new conversation...
            </div>
        `;

        // Clear the preview
        this.updatePreview({});

        // Reset button to default state
        const button = document.getElementById('wizardz-create-document-btn');
        if (button) {
            button.innerHTML = `<i class="fa fa-save"></i> Create ${this.doctype}`;
            button.className = 'btn btn-success btn-sm';
            button.style.marginRight = '10px';
            button.disabled = true;
        }

        // Disable input while starting new session
        this.disableInput();

        // Reset state
        this.draftId = null;
        this.isExistingDraft = false;
        this.conversation = [];

        // Start a completely new session
        await this.startNewSession();
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
                
                // Update button text based on draft status
                this.updateButtonForMode(response.message.draft_status);
                
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

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    enableInput() {
        const messageInput = document.getElementById('wizardz-message-input');
        const sendBtn = document.getElementById('wizardz-send-btn');
        
        messageInput.disabled = false;
        sendBtn.disabled = false;
        
        // Auto-focus the input field for better UX
        messageInput.focus();
        
        // Enable create document button if it exists
        const createBtn = document.getElementById('wizardz-create-document-btn');
        if (createBtn) {
            createBtn.disabled = false;
        }
    }

    disableInput() {
        document.getElementById('wizardz-message-input').disabled = true;
        document.getElementById('wizardz-send-btn').disabled = true;
    }

    enableDeployButton() {
        document.getElementById('wizardz-deploy-btn').disabled = false;
    }

    updateButtonForMode(draftStatus) {
        const button = document.getElementById('wizardz-create-document-btn');
        if (!button) return;

        // Update button text and style based on draft status
        if (draftStatus === 'Update Mode') {
            button.innerHTML = `<i class="fa fa-edit"></i> Update ${this.doctype}`;
            button.className = 'btn btn-warning btn-sm';
            button.style.marginRight = '10px';
        } else {
            button.innerHTML = `<i class="fa fa-save"></i> Create ${this.doctype}`;
            button.className = 'btn btn-success btn-sm';
            button.style.marginRight = '10px';
        }
    }

    updatePreview(draftData) {
        const previewContent = document.querySelector('.preview-content');
        
        if (!draftData || Object.keys(draftData).length === 0) {
            // Show placeholder if no data
            previewContent.innerHTML = `
                <div class="preview-placeholder text-center" style="padding: 50px; color: #6c7680;">
                    <i class="fa fa-file-text-o fa-3x" style="color: #d1d8dd; margin-bottom: 15px;"></i>
                    <p>${this.doctype} record preview will appear here as you provide information</p>
                </div>
            `;
            return;
        }

        // Build preview HTML
        let previewHtml = `<div class="${this.doctype.toLowerCase()}-preview">`;
        previewHtml += `<h6 style="color: #36414c; margin-bottom: 15px; border-bottom: 1px solid #d1d8dd; padding-bottom: 5px;">${this.doctype} Record</h6>`;
        
        // Handle multi-doctype data specially
        if (draftData._multi_doctype) {
            // Show main doctype fields first
            for (const [fieldName, value] of Object.entries(draftData)) {
                if (fieldName !== '_multi_doctype' && value && value.toString().trim()) {
                    const displayName = this.formatFieldName(fieldName);
                    previewHtml += `
                        <div class="field-preview" style="margin-bottom: 10px;">
                            <strong style="color: #6c7680; font-size: 12px; text-transform: uppercase;">${displayName}:</strong>
                            <div style="color: #36414c; margin-top: 2px;">${this.escapeHtml(value)}</div>
                        </div>
                    `;
                }
            }

            // Show dependent doctypes
            const multiData = draftData._multi_doctype;
            if (multiData.doctypes && Object.keys(multiData.doctypes).length > 0) {
                previewHtml += `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #d1d8dd;">`;
                previewHtml += `<h6 style="color: #36414c; margin-bottom: 10px; font-size: 12px; text-transform: uppercase; color: #6c7680;">Dependent Records:</h6>`;
                
                for (const [doctype, doctypeData] of Object.entries(multiData.doctypes)) {
                    if (doctypeData && Object.keys(doctypeData).length > 0) {
                        previewHtml += `<div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 3px;">`;
                        previewHtml += `<strong style="color: #36414c; font-size: 13px;">${doctype}:</strong>`;
                        
                        for (const [fieldName, value] of Object.entries(doctypeData)) {
                            if (value && value.toString().trim()) {
                                const displayName = this.formatFieldName(fieldName);
                                previewHtml += `
                                    <div style="margin-left: 10px; margin-top: 5px;">
                                        <span style="color: #6c7680; font-size: 11px; text-transform: uppercase;">${displayName}:</span>
                                        <span style="color: #36414c; margin-left: 5px;">${this.escapeHtml(value)}</span>
                                    </div>
                                `;
                            }
                        }
                        previewHtml += `</div>`;
                    }
                }
                previewHtml += `</div>`;
            }
        } else {
            // Display each field that has data (single doctype mode)
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

    async createDocument() {
        if (!this.draftId) return;

        // Disable button and show loading
        const button = document.getElementById('wizardz-create-document-btn');
        button.disabled = true;
        button.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Creating ${this.doctype}...`;

        try {
            const response = await frappe.call({
                method: 'wizardz.api.create_document_from_draft',
                args: {
                    draft_id: this.draftId
                }
            });

            if (response.message.success) {
                this.addMessage('system', `✅ ${this.doctype} created successfully: ${response.message.document_name}`);
                frappe.show_alert({
                    message: `${this.doctype} '${response.message.document_name}' created successfully!`,
                    indicator: 'green'
                });
                
                // Navigate to the created document
                setTimeout(() => {
                    frappe.set_route('Form', this.doctype, response.message.document_name);
                    this.close();
                }, 2000);
            } else {
                // Show validation errors in chat first
                this.addMessage('system', `❌ Validation errors found:\n${response.message.error}`);
                this.addMessage('system', '🤖 Sending errors to AI for correction...');
                
                const aiResponse = await frappe.call({
                    method: 'wizardz.api.send_message',
                    args: {
                        draft_id: this.draftId,
                        message: `Document creation failed with validation errors: ${response.message.error}. Please fix these issues and ask the user for any missing required information.`,
                        message_type: "system"
                    }
                });

                if (aiResponse.message.success) {
                    this.addMessage('assistant', aiResponse.message.response);
                } else {
                    this.addMessage('system', '❌ Error getting AI correction: ' + aiResponse.message.error);
                }
            }
        } catch (error) {
            this.addMessage('system', `❌ Error creating ${this.doctype}: ` + error.message);
        } finally {
            // Re-enable button
            button.disabled = false;
            button.innerHTML = `<i class="fa fa-save"></i> Create ${this.doctype}`;
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
