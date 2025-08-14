// Wizardz Form View Integration - Adds AI Assistant button to form views
// Copyright (c) 2025, TierneyMorris Pty Ltd

frappe.provide('wizardz');

// Global wizard configurations cache (shared with list view)
wizardz.configurations = wizardz.configurations || {};

// Reliable page change detection approach using Frappe's native router
$(document).ready(function() {
    // Wait for Frappe to be available
    function waitForFrappe() {
        if (typeof frappe !== 'undefined' && frappe.router) {
            // Use Frappe's native router event - much more reliable
            frappe.router.on("change", page_changed);
            
            // Also trigger on initial load
            page_changed();
            
            console.log('Wizardz: Router integration initialized');
        } else {
            // Retry after a short delay
            setTimeout(waitForFrappe, 100);
        }
    }
    
    waitForFrappe();
});

function page_changed(event) {
    // Wait for page to load completely
    frappe.after_ajax(function() {
        var route = frappe.get_route();
        
        // Check if route exists and has elements
        if (!route || !Array.isArray(route) || route.length === 0) {
            return;
        }
        
        // Handle Form views
        if (route[0] == "Form" && route[1]) {
            var doctype = route[1];
            
            // Set up form event handler for this specific doctype
            frappe.ui.form.on(doctype, {
                refresh: function(frm) {
                    // Only add to form views, not other views
                    if (!frm || !frm.doctype) return;
                    
                    // Check if this doctype has a wizard configuration
                    checkForWizardConfiguration(frm.doctype, function(hasWizard, config) {
                        console.log(`Wizardz: Wizard check for ${frm.doctype} - hasWizard: ${hasWizard}`);
                        if (hasWizard) {
                            try {
                                console.log(`Wizardz: About to call addAIAssistantButton for ${frm.doctype}`);
                                console.log(`Wizardz: frm object:`, frm);
                                console.log(`Wizardz: config object:`, config);
                                addAIAssistantButtonToForm(frm, config);
                                console.log(`Wizardz: addAIAssistantButton call completed`);
                            } catch (error) {
                                console.error(`Wizardz: Error calling addAIAssistantButton:`, error);
                                console.error(`Wizardz: Error stack:`, error.stack);
                            }
                        } else {
                            console.log(`Wizardz: No wizard configuration found for ${frm.doctype}`);
                        }
                    });
                }
            });
            
            console.log(`Wizardz: Form integration setup for ${doctype}`);
        }
        
        // List views are handled by wizardz_list.js
    });
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

function addAIAssistantButtonToForm(frm, wizard_config) {
    console.log(`Wizardz: addAIAssistantButton called for ${frm.doctype}`);
    
    // Remove any existing buttons first to ensure we get the right mode
    if (frm.custom_buttons) {
        if (frm.custom_buttons['AI Create']) {
            frm.custom_buttons['AI Create'].remove();
            delete frm.custom_buttons['AI Create'];
            console.log(`Wizardz: Removed existing AI Create button`);
        }
        if (frm.custom_buttons['AI Update']) {
            frm.custom_buttons['AI Update'].remove();
            delete frm.custom_buttons['AI Update'];
            console.log(`Wizardz: Removed existing AI Update button`);
        }
        // Also remove old button names for backward compatibility
        if (frm.custom_buttons['AI Assistant']) {
            frm.custom_buttons['AI Assistant'].remove();
            delete frm.custom_buttons['AI Assistant'];
            console.log(`Wizardz: Removed existing AI Assistant button`);
        }
    }
    
    // Determine button text based on document state
    let buttonText = 'AI Create';
    let buttonAction = 'create';
    
    console.log(`Wizardz: Document detection - name: "${frm.doc.name}", __islocal: ${frm.doc.__islocal}, doctype: ${frm.doctype}`);
    
    // Check if this is an existing document (not new)
    if (frm.doc.name && 
        !frm.doc.__islocal && 
        frm.doc.name !== '__islocal' && 
        !frm.doc.name.startsWith('new-') &&
        frm.doc.name !== 'New ' + frm.doctype &&
        frm.doc.name.length > 0) {
        // Existing document - update mode
        buttonText = 'AI Update';
        buttonAction = 'update';
        console.log(`Wizardz: Detected existing document "${frm.doc.name}" - using update mode`);
    } else {
        console.log(`Wizardz: Detected new document - using create mode`);
    }
    
    // Add AI Assistant button as primary button to the form toolbar
    frm.add_custom_button(
        __(buttonText),
        function() {
            console.log(`Wizardz: Button clicked - action: ${buttonAction}, doctype: ${frm.doctype}, doc:`, frm.doc);
            openWizardModalForForm(wizard_config, frm.doctype, frm.doc, buttonAction);
        }
        // No group parameter = primary button in toolbar
    );
    
    // Style the button with primary color and icon
    const button = frm.custom_buttons[buttonText];
    if (button) {
        button.addClass('btn-primary wizardz-ai-btn');
        button.prepend('<i class="fa fa-magic" style="margin-right: 5px;"></i>');
        
        if (buttonAction === 'update') {
            button.attr('title', `AI Assistant - Update this ${frm.doctype} record`);
        } else {
            button.attr('title', `AI Assistant - Create new ${frm.doctype} record`);
        }
    }
    
    console.log(`Wizardz: Added AI Assistant button to ${frm.doctype} form view (${buttonAction} mode)`);
}

function openWizardModalForForm(wizard_config, doctype, doc, action) {
    console.log(`Wizardz: openWizardModalForForm called with action: ${action}, doctype: ${doctype}`);
    // Create and show the wizard modal
    const modal = new WizardzFormModal(wizard_config, doctype, doc, action);
    console.log(`Wizardz: Modal created with action: ${modal.action}`);
    modal.show();
}

// Enhanced Modal class for form views (supports both create and update)
class WizardzFormModal {
    constructor(wizardConfig, doctype, doc, action) {
        console.log(`Wizardz: Modal constructor called with action: ${action}`);
        this.wizardConfig = wizardConfig;
        this.doctype = doctype;
        this.doc = doc || {};
        this.action = action || 'create'; // 'create' or 'update'
        this.draftId = null;
        this.conversation = [];
        this.isExistingDraft = false;
        console.log(`Wizardz: Modal constructor completed - this.action: ${this.action}`);
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
        const actionText = this.action === 'update' ? 'Update' : 'Create';
        const modeText = this.action === 'update' ? `Updating ${this.doc.name}` : `Creating new ${this.doctype} record`;
        
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
                                            <small style="color: #6c7680 !important; background: transparent !important;">${modeText}</small>
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
                                                <i class="fa fa-save"></i> ${actionText} ${this.doctype}
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
                                            <small style="color: #6c7680 !important; background: transparent !important;">${modeText}</small>
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

        // Create/Update Document button
        document.getElementById('wizardz-create-document-btn').addEventListener('click', () => {
            if (this.action === 'update') {
                this.updateDocument();
            } else {
                this.createDocument();
            }
        });

        // New Conversation button
        document.getElementById('wizardz-new-conversation-btn').addEventListener('click', () => {
            this.startNewConversation();
        });
    }

    async startSession() {
        try {
            if (this.action === 'update') {
                // Update mode - start a new update session directly
                await this.startUpdateSession();
            } else {
                // Create mode - check for existing drafts first
                await this.startCreateSession();
            }
        } catch (error) {
            this.addMessage('system', 'Error starting wizard session: ' + error.message);
        }
    }

    async startCreateSession() {
        try {
            // For create mode, always start fresh - don't resume old drafts
            // This prevents confusion between create and update modes
            await this.startNewCreateSession();
        } catch (error) {
            this.addMessage('system', 'Error loading create session: ' + error.message);
            await this.startNewCreateSession();
        }
    }

    async startUpdateSession() {
        try {
            // Always start a new update session - don't resume old ones
            const response = await frappe.call({
                method: 'wizardz.api.start_wizard_session',
                args: {
                    wizard_config: this.wizardConfig.name,
                    draft_name: `Update ${this.doctype} - ${this.doc.name}`,
                    target_doctype: this.doctype,
                    existing_doc: this.doc,
                    mode: 'update'
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
                
                // Pre-populate the preview with existing document data immediately
                this.updatePreview(this.doc);
                
                // Initialize draft data with existing document data to prevent data loss appearance
                await this.initializeDraftWithExistingData();
                
                // Get initial AI greeting for update mode
                this.getInitialGreeting();
            } else {
                this.addMessage('system', 'Error starting update session: ' + response.message.error);
            }
        } catch (error) {
            this.addMessage('system', 'Error starting update session: ' + error.message);
        }
    }

    async resumeExistingDraft(existingDraft) {
        try {
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
                await this.startNewCreateSession();
            }
        } catch (error) {
            this.addMessage('system', 'Error resuming draft: ' + error.message);
            await this.startNewCreateSession();
        }
    }

    async startNewCreateSession() {
        try {
            const response = await frappe.call({
                method: 'wizardz.api.start_wizard_session',
                args: {
                    wizard_config: this.wizardConfig.name,
                    draft_name: `${this.doctype} - ${new Date().toLocaleString()}`,
                    target_doctype: this.doctype,
                    mode: 'create'
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
                this.addMessage('system', 'Error starting create session: ' + response.message.error);
            }
        } catch (error) {
            this.addMessage('system', 'Error starting create session: ' + error.message);
        }
    }

    async initializeDraftWithExistingData() {
        try {
            // Send existing document data to initialize the draft
            const response = await frappe.call({
                method: 'wizardz.api.initialize_draft_data',
                args: {
                    draft_id: this.draftId,
                    initial_data: this.doc
                }
            });

            if (!response.message.success) {
                console.log('Wizardz: Warning - could not initialize draft with existing data:', response.message.error);
            }
        } catch (error) {
            console.log('Wizardz: Warning - error initializing draft with existing data:', error.message);
        }
    }

    async getInitialGreeting() {
        try {
            let initialMessage = "Please start the conversation and introduce yourself.";
            
            if (this.action === 'update') {
                initialMessage = `You are helping the user UPDATE an existing ${this.doctype} record named "${this.doc.name}". The current document data has been loaded for context. Please introduce yourself and ask what specific changes or updates the user would like to make to this existing record. Do not ask about creating a new record - this is an UPDATE session for an existing document.`;
            }

            const response = await frappe.call({
                method: 'wizardz.api.send_message',
                args: {
                    draft_id: this.draftId,
                    message: initialMessage,
                    message_type: "system"
                }
            });

            if (response.message.success) {
                this.addMessage('assistant', response.message.response);
                
                // If in update mode, show current document data in preview
                if (this.action === 'update') {
                    this.updatePreview(this.doc);
                }
                
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

        // Clear the preview (unless in update mode)
        if (this.action !== 'update') {
            this.updatePreview({});
        }

        // Reset button to default state
        const button = document.getElementById('wizardz-create-document-btn');
        if (button) {
            const actionText = this.action === 'update' ? 'Update' : 'Create';
            button.innerHTML = `<i class="fa fa-save"></i> ${actionText} ${this.doctype}`;
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
        await this.startSession();
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
        
        // Enable create/update document button if it exists
        const createBtn = document.getElementById('wizardz-create-document-btn');
        if (createBtn) {
            createBtn.disabled = false;
        }
    }

    disableInput() {
        document.getElementById('wizardz-message-input').disabled = true;
        document.getElementById('wizardz-send-btn').disabled = true;
    }

    updateButtonForMode(draftStatus) {
        const button = document.getElementById('wizardz-create-document-btn');
        if (!button) return;

        const actionText = this.action === 'update' ? 'Update' : 'Create';
        const iconClass = this.action === 'update' ? 'fa-edit' : 'fa-save';

        // Update button text and style based on draft status
        if (draftStatus === 'Update Mode' || this.action === 'update') {
            button.innerHTML = `<i class="fa ${iconClass}"></i> ${actionText} ${this.doctype}`;
            button.className = 'btn btn-warning btn-sm';
            button.style.marginRight = '10px';
        } else {
            button.innerHTML = `<i class="fa ${iconClass}"></i> ${actionText} ${this.doctype}`;
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
        
        // Display each field that has data
        for (const [fieldName, value] of Object.entries(draftData)) {
            if (value && value.toString().trim() && fieldName !== '_multi_doctype') {
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
                this.handleDocumentError(response.message.error);
            }
        } catch (error) {
            this.addMessage('system', `❌ Error creating ${this.doctype}: ` + error.message);
        } finally {
            // Re-enable button
            button.disabled = false;
            button.innerHTML = `<i class="fa fa-save"></i> Create ${this.doctype}`;
        }
    }

    async updateDocument() {
        if (!this.draftId) return;

        // Disable button and show loading
        const button = document.getElementById('wizardz-create-document-btn');
        button.disabled = true;
        button.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Updating ${this.doctype}...`;

        try {
            const response = await frappe.call({
                method: 'wizardz.api.update_document_from_draft',
                args: {
                    draft_id: this.draftId,
                    existing_doc_name: this.doc.name
                }
            });

            if (response.message.success) {
                this.addMessage('system', `✅ ${this.doctype} updated successfully: ${response.message.document_name}`);
                frappe.show_alert({
                    message: `${this.doctype} '${response.message.document_name}' updated successfully!`,
                    indicator: 'green'
                });
                
                // Refresh the current form
                setTimeout(() => {
                    cur_frm.reload_doc();
                    this.close();
                }, 2000);
            } else {
                this.handleDocumentError(response.message.error);
            }
        } catch (error) {
            this.addMessage('system', `❌ Error updating ${this.doctype}: ` + error.message);
        } finally {
            // Re-enable button
            button.disabled = false;
            button.innerHTML = `<i class="fa fa-edit"></i> Update ${this.doctype}`;
        }
    }

    async handleDocumentError(error) {
        // Show validation errors in chat first
        this.addMessage('system', `❌ Validation errors found:\n${error}`);
        this.addMessage('system', '🤖 Sending errors to AI for correction...');
        
        const aiResponse = await frappe.call({
            method: 'wizardz.api.send_message',
            args: {
                draft_id: this.draftId,
                message: `Document ${this.action} failed with validation errors: ${error}. Please fix these issues and ask the user for any missing required information.`,
                message_type: "system"
            }
        });

        if (aiResponse.message.success) {
            this.addMessage('assistant', aiResponse.message.response);
        } else {
            this.addMessage('system', '❌ Error getting AI correction: ' + aiResponse.message.error);
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
