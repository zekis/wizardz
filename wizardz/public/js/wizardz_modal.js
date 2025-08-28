// Wizardz Modal Component - Shared modal for both list and form views
// Copyright (c) 2025, TierneyMorris Pty Ltd

// Shared modal class that handles both create and update modes
class WizardzModal {
    constructor(wizardConfig, doctype, doc = null, action = 'create') {
        console.log(`Wizardz: Modal constructor called with action: ${action}`);
        this.wizardConfig = wizardConfig;
        this.doctype = doctype;
        this.doc = doc || {};
        this.action = action; // 'create' or 'update'
        this.draftId = null;
        this.conversation = [];
        this.isExistingDraft = false;
        console.log(`Wizardz: Modal constructor completed - this.action: ${this.action}`);
    }

    async show() {
        // Create modal HTML
        const modalHtml = this.createModalHtml();
        
        // Add to page
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // Show modal using Bootstrap
        const modal = document.getElementById('wizardz-modal');
        
        // Add event listeners first
        this.attachEventListeners();
        
        // Load and display recent drafts
        await this.loadRecentDrafts();
        
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
                            <!-- Recent Drafts Section -->
                            <div id="wizardz-recent-drafts" style="display: none; padding: 10px; border-bottom: 1px solid #d1d8dd; background: #f8f9fa;">
                                <div style="margin-bottom: 8px;">
                                    <strong style="color: #36414c; font-size: 12px;">Recent ${this.doctype} Drafts:</strong>
                                </div>
                                <div id="wizardz-draft-buttons" style="display: flex; flex-wrap: wrap; gap: 5px;">
                                    <!-- Draft buttons will be inserted here -->
                                </div>
                            </div>
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
                // Create mode - always start fresh
                await this.startCreateSession();
            }
        } catch (error) {
            this.addMessage('system', 'Error starting wizard session: ' + error.message);
        }
    }

    async startCreateSession() {
        try {
            await this.startNewCreateSession();
        } catch (error) {
            this.addMessage('system', 'Error loading create session: ' + error.message);
            await this.startNewCreateSession();
        }
    }

    async startUpdateSession() {
        try {
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
                
                const loadingMessage = document.querySelector('.loading-message');
                if (loadingMessage) {
                    loadingMessage.remove();
                }
                
                // Don't update preview with raw doc data - let it load from draft data
                // The draft data is already populated in the backend during session start
                this.getInitialGreeting();
            } else {
                this.addMessage('system', 'Error starting update session: ' + response.message.error);
            }
        } catch (error) {
            this.addMessage('system', 'Error starting update session: ' + error.message);
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
                
                const loadingMessage = document.querySelector('.loading-message');
                if (loadingMessage) {
                    loadingMessage.remove();
                }
                
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
        if (this.draftId && this.isExistingDraft) {
            const confirmed = confirm('Are you sure you want to start a new conversation? This will create a new draft and you can return to your previous conversation later.');
            if (!confirmed) {
                return;
            }
        }

        const messagesContainer = document.querySelector('.chat-messages');
        messagesContainer.innerHTML = `
            <div class="loading-message" style="color: #6c7680;">
                <i class="fa fa-spinner fa-spin"></i> Starting new conversation...
            </div>
        `;

        if (this.action !== 'update') {
            this.updatePreview({});
        }

        const button = document.getElementById('wizardz-create-document-btn');
        if (button) {
            const actionText = this.action === 'update' ? 'Update' : 'Create';
            button.innerHTML = `<i class="fa fa-save"></i> ${actionText} ${this.doctype}`;
            button.className = 'btn btn-success btn-sm';
            button.style.marginRight = '10px';
            button.disabled = true;
        }

        this.disableInput();
        this.draftId = null;
        this.isExistingDraft = false;
        this.conversation = [];

        await this.startSession();
    }

    async sendMessage() {
        const input = document.getElementById('wizardz-message-input');
        const message = input.value.trim();
        
        if (!message || !this.draftId) return;

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
                
                if (response.message.draft_data) {
                    this.updatePreview(response.message.draft_data);
                }
                
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
        messageInput.focus();
        
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
            previewContent.innerHTML = `
                <div class="preview-placeholder text-center" style="padding: 50px; color: #6c7680;">
                    <i class="fa fa-file-text-o fa-3x" style="color: #d1d8dd; margin-bottom: 15px;"></i>
                    <p>${this.doctype} record preview will appear here as you provide information</p>
                </div>
            `;
            return;
        }

        let previewHtml = `<div class="${this.doctype.toLowerCase()}-preview">`;
        previewHtml += `<h6 style="color: #36414c; margin-bottom: 15px; border-bottom: 1px solid #d1d8dd; padding-bottom: 5px;">${this.doctype} Record</h6>`;
        
        for (const [fieldName, value] of Object.entries(draftData)) {
            if (this.shouldDisplayField(fieldName, value)) {
                const displayName = this.formatFieldName(fieldName);
                const formattedValue = this.formatFieldValue(value);
                
                previewHtml += `
                    <div class="field-preview" style="margin-bottom: 10px;">
                        <strong style="color: #6c7680; font-size: 12px; text-transform: uppercase;">${displayName}:</strong>
                        <div style="color: #36414c; margin-top: 2px;">${formattedValue}</div>
                    </div>
                `;
            }
        }
        
        previewHtml += '</div>';
        previewContent.innerHTML = previewHtml;
    }

    shouldDisplayField(fieldName, value) {
        // Skip system fields and empty values
        if (fieldName === '_multi_doctype') return false;
        if (value === null || value === undefined) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        if (Array.isArray(value) && value.length === 0) return false;
        if (typeof value === 'object' && Object.keys(value).length === 0) return false;
        
        return true;
    }

    formatFieldValue(value) {
        // Handle different data types for display
        if (value === null || value === undefined) {
            return '<em style="color: #999;">Not set</em>';
        }
        
        if (typeof value === 'string') {
            return this.escapeHtml(value);
        }
        
        if (typeof value === 'number' || typeof value === 'boolean') {
            return this.escapeHtml(String(value));
        }
        
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '<em style="color: #999;">Empty list</em>';
            }
            
            // Format array items
            const items = value.map(item => {
                if (typeof item === 'object' && item !== null) {
                    return this.formatObjectForDisplay(item);
                } else {
                    return this.escapeHtml(String(item));
                }
            });
            
            return `
                <div style="border-left: 2px solid #e9ecef; padding-left: 10px; margin-top: 5px;">
                    ${items.map(item => `<div style="margin-bottom: 5px;">• ${item}</div>`).join('')}
                </div>
            `;
        }
        
        if (typeof value === 'object' && value !== null) {
            return this.formatObjectForDisplay(value);
        }
        
        // Fallback for any other type
        return this.escapeHtml(String(value));
    }

    formatObjectForDisplay(obj) {
        if (!obj || typeof obj !== 'object') {
            return this.escapeHtml(String(obj));
        }
        
        const entries = Object.entries(obj);
        if (entries.length === 0) {
            return '<em style="color: #999;">Empty object</em>';
        }
        
        // Format object as key-value pairs
        const formattedEntries = entries.map(([key, value]) => {
            const displayKey = this.formatFieldName(key);
            let displayValue;
            
            if (typeof value === 'object' && value !== null) {
                if (Array.isArray(value)) {
                    displayValue = `[${value.length} items]`;
                } else {
                    displayValue = `{${Object.keys(value).length} fields}`;
                }
            } else {
                displayValue = this.escapeHtml(String(value));
            }
            
            return `<strong>${displayKey}:</strong> ${displayValue}`;
        });
        
        return `
            <div style="border-left: 2px solid #e9ecef; padding-left: 10px; margin-top: 5px; font-size: 12px;">
                ${formattedEntries.map(entry => `<div style="margin-bottom: 3px;">${entry}</div>`).join('')}
            </div>
        `;
    }

    formatFieldName(fieldName) {
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
            button.disabled = false;
            button.innerHTML = `<i class="fa fa-save"></i> Create ${this.doctype}`;
        }
    }

    async updateDocument() {
        if (!this.draftId) return;

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
                
                setTimeout(() => {
                    if (typeof cur_frm !== 'undefined' && cur_frm) {
                        cur_frm.reload_doc();
                    }
                    this.close();
                }, 2000);
            } else {
                this.handleDocumentError(response.message.error);
            }
        } catch (error) {
            this.addMessage('system', `❌ Error updating ${this.doctype}: ` + error.message);
        } finally {
            button.disabled = false;
            button.innerHTML = `<i class="fa fa-edit"></i> Update ${this.doctype}`;
        }
    }

    async handleDocumentError(error) {
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

    async loadRecentDrafts() {
        try {
            const response = await frappe.call({
                method: 'wizardz.api.get_user_drafts',
                args: {
                    target_doctype: this.doctype,
                    limit: 5
                }
            });

            if (response.message && response.message.length > 0) {
                this.displayRecentDrafts(response.message);
            }
        } catch (error) {
            console.log('Wizardz: Error loading recent drafts:', error.message);
        }
    }

    async displayRecentDrafts(drafts) {
        const draftSection = document.getElementById('wizardz-recent-drafts');
        const draftButtons = document.getElementById('wizardz-draft-buttons');
        
        if (!drafts || drafts.length === 0) {
            draftSection.style.display = 'none';
            return;
        }

        // Clear existing buttons
        draftButtons.innerHTML = '';

        // Create buttons for each draft with metrics
        for (const draft of drafts) {
            const button = document.createElement('button');
            button.className = 'btn btn-default btn-xs';
            button.style.cssText = 'margin-right: 5px; margin-bottom: 5px; font-size: 11px; padding: 4px 8px; min-width: 120px;';
            
            // Format the modified date
            const modifiedDate = new Date(draft.modified);
            const timeAgo = this.getTimeAgo(modifiedDate);
            
            // Get draft metrics
            const metrics = await this.getDraftMetrics(draft.name);
            
            button.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center;">
                        <i class="fa fa-file-text-o" style="margin-right: 4px; color: #5e64ff;"></i>
                        <span style="font-weight: 500;">${draft.target_doctype}</span>
                    </div>
                    <div style="font-size: 10px; color: #999; margin-left: 8px;">
                        ${timeAgo}
                    </div>
                </div>
                <div style="font-size: 10px; color: #666; margin-top: 2px; display: flex; gap: 8px;">
                    <span><i class="fa fa-list" style="margin-right: 2px;"></i>${metrics.fieldCount} fields</span>
                    <span><i class="fa fa-comments" style="margin-right: 2px;"></i>${metrics.messageCount} msgs</span>
                </div>
            `;
            
            button.title = `Resume ${draft.target_doctype} draft\nStatus: ${draft.status}\nFields: ${metrics.fieldCount}\nMessages: ${metrics.messageCount}\nLast modified: ${modifiedDate.toLocaleString()}`;
            
            button.addEventListener('click', () => {
                this.resumeDraft(draft);
            });
            
            draftButtons.appendChild(button);
        }

        // Show the draft section
        draftSection.style.display = 'block';
    }

    async getDraftMetrics(draftId) {
        try {
            const response = await frappe.call({
                method: 'wizardz.api.get_draft_data',
                args: {
                    draft_id: draftId
                }
            });

            if (response.message.success) {
                const draftData = response.message.draft_data || {};
                const conversation = response.message.conversation || [];
                
                // Count fields (excluding system fields)
                const fieldCount = Object.keys(draftData).filter(key => 
                    key !== '_multi_doctype' && 
                    draftData[key] !== null && 
                    draftData[key] !== undefined && 
                    draftData[key] !== ''
                ).length;
                
                // Count user and assistant messages (exclude system messages)
                const messageCount = conversation.filter(msg => 
                    msg.type === 'user' || msg.type === 'assistant'
                ).length;
                
                return {
                    fieldCount: fieldCount,
                    messageCount: messageCount
                };
            }
        } catch (error) {
            console.log('Wizardz: Error getting draft metrics:', error.message);
        }
        
        // Fallback metrics
        return {
            fieldCount: 0,
            messageCount: 0
        };
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }

    async resumeDraft(draft) {
        try {
            // Show loading message
            const messagesContainer = document.querySelector('.chat-messages');
            messagesContainer.innerHTML = `
                <div class="loading-message" style="color: #6c7680;">
                    <i class="fa fa-spinner fa-spin"></i> Loading draft conversation...
                </div>
            `;

            // Disable input while loading
            this.disableInput();

            // Get draft data and conversation history
            const response = await frappe.call({
                method: 'wizardz.api.get_draft_data',
                args: {
                    draft_id: draft.name
                }
            });

            if (response.message.success) {
                // Set draft ID and mark as existing
                this.draftId = draft.name;
                this.isExistingDraft = true;

                // Clear loading message
                const loadingMessage = document.querySelector('.loading-message');
                if (loadingMessage) {
                    loadingMessage.remove();
                }

                // Load conversation history
                const conversation = response.message.conversation || [];
                conversation.forEach(msg => {
                    if (msg.type === 'user' || msg.type === 'assistant') {
                        this.addMessage(msg.type, msg.content);
                    }
                });

                // Update preview with draft data
                if (response.message.draft_data) {
                    this.updatePreview(response.message.draft_data);
                }

                // Update button for current status
                this.updateButtonForMode(response.message.status);

                // Hide draft section after selection
                const draftSection = document.getElementById('wizardz-recent-drafts');
                draftSection.style.display = 'none';

                // Show success message
                this.addMessage('system', `✅ Resumed draft: ${draft.draft_name}`);

                // Put the ball back in AI's court - send a continuation message
                await this.continueConversation();

            } else {
                this.addMessage('system', 'Error loading draft: ' + response.message.error);
                // Fall back to starting a new session
                await this.startSession();
            }

        } catch (error) {
            this.addMessage('system', 'Error resuming draft: ' + error.message);
            // Fall back to starting a new session
            await this.startSession();
        }
    }

    async continueConversation() {
        try {
            // Send a continuation message to the AI to resume the conversation
            const response = await frappe.call({
                method: 'wizardz.api.send_message',
                args: {
                    draft_id: this.draftId,
                    message: "The user has resumed this conversation. Please continue where we left off. Review the current draft data and either ask for the next piece of information needed, or if all required information is complete, let the user know they can create the document.",
                    message_type: "system"
                }
            });

            if (response.message.success) {
                this.addMessage('assistant', response.message.response);
                
                if (response.message.draft_data) {
                    this.updatePreview(response.message.draft_data);
                }
                
                this.updateButtonForMode(response.message.draft_status);
                
                // Enable input after AI responds
                this.enableInput();
            } else {
                this.addMessage('system', 'Error continuing conversation: ' + response.message.error);
                this.enableInput();
            }
        } catch (error) {
            this.addMessage('system', 'Error continuing conversation: ' + error.message);
            this.enableInput();
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
