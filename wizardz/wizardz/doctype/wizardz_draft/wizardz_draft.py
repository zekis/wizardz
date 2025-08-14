# Copyright (c) 2025, TierneyMorris Pty Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import json


class WizardzDraft(Document):
    def validate(self):
        """Validate the draft data"""
        self.validate_draft_data()
        self.validate_conversation_history()
    
    def validate_draft_data(self):
        """Validate that draft_data is valid JSON if provided"""
        if self.draft_data:
            try:
                json.loads(self.draft_data)
            except json.JSONDecodeError:
                frappe.throw("Draft Data must be valid JSON")
    
    def validate_conversation_history(self):
        """Validate that conversation_history is valid JSON if provided"""
        if self.conversation_history:
            try:
                json.loads(self.conversation_history)
            except json.JSONDecodeError:
                frappe.throw("Conversation History must be valid JSON")
    
    def get_draft_data_dict(self):
        """Return draft data as a dictionary"""
        if self.draft_data:
            try:
                return json.loads(self.draft_data)
            except json.JSONDecodeError:
                return {}
        return {}
    
    def get_conversation_history_list(self):
        """Return conversation history as a list"""
        if self.conversation_history:
            try:
                return json.loads(self.conversation_history)
            except json.JSONDecodeError:
                return []
        return []
    
    def add_message_to_conversation(self, message_type, content, metadata=None):
        """Add a message to the conversation history"""
        conversation = self.get_conversation_history_list()
        
        message = {
            "timestamp": frappe.utils.now(),
            "type": message_type,
            "content": content
        }
        
        if metadata:
            message["metadata"] = metadata
        
        conversation.append(message)
        self.conversation_history = json.dumps(conversation, indent=2)
    
    def update_draft_data(self, new_data):
        """Update the draft data with new structure"""
        if isinstance(new_data, dict):
            self.draft_data = json.dumps(new_data, indent=2)
        else:
            self.draft_data = new_data
    
    @frappe.whitelist()
    def deploy_doctype(self):
        """Convert draft to actual Frappe DocType"""
        if self.status != "Ready to Deploy":
            frappe.throw("Draft must be in 'Ready to Deploy' status")
        
        try:
            draft_data = self.get_draft_data_dict()
            if not draft_data:
                frappe.throw("No draft data to deploy")
            
            # Check if DocType already exists
            if frappe.db.exists("DocType", self.target_doctype):
                frappe.throw(f"DocType '{self.target_doctype}' already exists")
            
            # Create the DocType
            doctype_doc = frappe.get_doc({
                "doctype": "DocType",
                "name": self.target_doctype,
                **draft_data
            })
            
            doctype_doc.insert()
            
            # Update status
            self.status = "Deployed"
            self.add_message_to_conversation(
                "system", 
                f"DocType '{self.target_doctype}' successfully deployed",
                {"action": "deploy", "doctype": self.target_doctype}
            )
            self.save()
            
            return {
                "success": True,
                "message": f"DocType '{self.target_doctype}' deployed successfully",
                "doctype": self.target_doctype
            }
            
        except Exception as e:
            self.status = "Error"
            self.add_message_to_conversation(
                "system", 
                f"Error deploying DocType: {str(e)}",
                {"action": "deploy_error", "error": str(e)}
            )
            self.save()
            frappe.log_error(f"Error deploying DocType: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @frappe.whitelist()
    def get_wizard_configuration(self):
        """Get the associated wizard configuration"""
        if self.wizard_config:
            return frappe.get_doc("Wizardz Configuration", self.wizard_config)
        return None
