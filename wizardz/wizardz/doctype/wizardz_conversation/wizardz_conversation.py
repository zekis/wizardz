# Copyright (c) 2025, TierneyMorris Pty Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import json


class WizardzConversation(Document):
    def validate(self):
        """Validate the conversation message"""
        self.validate_metadata()
    
    def validate_metadata(self):
        """Validate that metadata is valid JSON if provided"""
        if self.metadata:
            try:
                json.loads(self.metadata)
            except json.JSONDecodeError:
                frappe.throw("Metadata must be valid JSON")
    
    def get_metadata_dict(self):
        """Return metadata as a dictionary"""
        if self.metadata:
            try:
                return json.loads(self.metadata)
            except json.JSONDecodeError:
                return {}
        return {}
    
    def set_metadata(self, metadata_dict):
        """Set metadata from a dictionary"""
        if isinstance(metadata_dict, dict):
            self.metadata = json.dumps(metadata_dict, indent=2)
        else:
            self.metadata = metadata_dict
    
    @staticmethod
    def create_message(wizard_draft, message_type, content, metadata=None):
        """Create a new conversation message"""
        doc = frappe.get_doc({
            "doctype": "Wizardz Conversation",
            "wizard_draft": wizard_draft,
            "message_type": message_type,
            "message_content": content,
            "timestamp": frappe.utils.now()
        })
        
        if metadata:
            doc.set_metadata(metadata)
        
        doc.insert()
        return doc
    
    @staticmethod
    def get_conversation_for_draft(wizard_draft, limit=50):
        """Get conversation messages for a draft"""
        return frappe.get_all(
            "Wizardz Conversation",
            filters={"wizard_draft": wizard_draft},
            fields=["name", "message_type", "message_content", "timestamp", "metadata"],
            order_by="timestamp asc",
            limit=limit
        )
