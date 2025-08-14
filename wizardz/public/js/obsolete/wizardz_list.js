// Wizardz List View Integration - Adds AI Assistant button to list views
// Copyright (c) 2025, TierneyMorris Pty Ltd

frappe.provide('wizardz');

// Global wizard configurations cache (shared with form view)
wizardz.configurations = wizardz.configurations || {};

// Reliable list view integration using the same approach as form views
$(document).ready(function() {
    // Wait for Frappe to be available
    function waitForFrappe() {
        if (typeof frappe !== 'undefined' && frappe.router) {
            // Set up list view integration
            setupListViewIntegration();
            
            console.log('Wizardz: List view integration initialized');
        } else {
            // Retry after a short delay
            setTimeout(waitForFrappe, 100);
        }
    }
    
    waitForFrappe();
});

function setupListViewIntegration() {
    // Method 1: Use the existing list_view_loaded event (primary method)
    $(document).on('list_view_loaded', function(e, list_view) {
        if (!list_view || !list_view.doctype) return;
        
        console.log(`Wizardz: List view loaded for ${list_view.doctype}`);
        
        checkForWizardConfiguration(list_view.doctype, function(hasWizard, config) {
            if (hasWizard) {
                addAIAssistantButton(list_view, config);
            }
        });
    });
    
    // Method 2: Periodic check for list views (backup method)
    let listViewCheckInterval = setInterval(function() {
        // Check if we're on a list view page
        if (frappe.get_route && frappe.get_route()[0] === 'List' && frappe.get_route()[1]) {
            const doctype = frappe.get_route()[1];
            
            // Check if list view exists and hasn't been processed
            if (cur_list && cur_list.doctype === doctype) {
                // Avoid duplicate processing
                if (!cur_list.wizardz_processed) {
                    cur_list.wizardz_processed = true;
                    
                    console.log(`Wizardz: Periodic check found ${doctype} list view`);
                    
                    checkForWizardConfiguration(doctype, function(hasWizard, config) {
                        if (hasWizard) {
                            addAIAssistantButton(cur_list, config);
                        }
                    });
                }
            }
        }
    }, 1000); // Check every second
    
    console.log('Wizardz: List view integration setup completed');
}

function checkForWizardConfiguration(doctype, callback) {
    // Check cache first
    if (wizardz.configurations[doctype] !== undefined) {
        const config = wizardz.configurations[doctype];
        callback(config !== null, config);
        return;
    }
    
    // Check for wizard configuration
    frappe.call({
        method: 'wizardz.api.get_wizard_for_doctype',
        args: { doctype: doctype },
        callback: function(response) {
            if (response.message) {
                wizardz.configurations[doctype] = response.message;
                callback(true, response.message);
            } else {
                wizardz.configurations[doctype] = null;
                callback(false, null);
            }
        },
        error: function() {
            wizardz.configurations[doctype] = null;
            callback(false, null);
        }
    });
}

function addAIAssistantButton(list_view, wizard_config) {
    // Check if list_view and required properties exist
    if (!list_view || !list_view.page || !list_view.page.add_inner_button) {
        console.log('Wizardz: List view or page object not ready yet');
        return;
    }
    
    // Check if button already exists
    if (list_view.page.$wrapper && list_view.page.$wrapper.find('.wizardz-ai-btn').length > 0) {
        return;
    }
    
    try {
        // Add AI Create button to the list view using the actual text
        list_view.page.add_inner_button(__('AI Create'), function() {
            openWizardModal(wizard_config, list_view.doctype);
        });
        
        // Find and style the button that was just added
        setTimeout(function() {
            // Find the button by the text
            let ai_button = null;
            
            // Method 1: Try page wrapper if available
            if (list_view.page && list_view.page.$wrapper) {
                ai_button = list_view.page.$wrapper.find('.btn:contains("AI Create")').first();
            }
            
            // Method 2: Try direct jQuery search on document if wrapper method failed
            if (!ai_button || ai_button.length === 0) {
                ai_button = $('.btn:contains("AI Create")').first();
            }
            
            if (ai_button && ai_button.length > 0) {
                // Add icon to the existing text
                ai_button.html('<i class="fa fa-magic" style="margin-right: 5px;"></i>AI Create');
                ai_button.addClass('btn-primary wizardz-ai-btn');
                ai_button.attr('title', `AI Create - Create new ${list_view.doctype}`);
                
                console.log(`Wizardz: Added AI Create button to ${list_view.doctype} list view`);
            } else {
                console.log(`Wizardz: Could not find AI Create button to style for ${list_view.doctype}`);
            }
        }, 300); // Increased delay to ensure button is fully rendered
        
    } catch (error) {
        console.log(`Wizardz: Error adding button to ${list_view.doctype} list view:`, error);
    }
}

function openWizardModal(wizard_config, doctype) {
    // Create and show the wizard modal
    const modal = new WizardzModal(wizard_config, doctype);
    modal.show();
}

// Modal class (reuse from the existing widget)
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
