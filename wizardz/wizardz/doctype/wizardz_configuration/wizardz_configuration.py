# Copyright (c) 2025, TierneyMorris Pty Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import json


class WizardzConfiguration(Document):
    def validate(self):
        """Validate the wizard configuration"""
        self.validate_field_instructions()
    
    def validate_field_instructions(self):
        """Validate that field_instructions is valid JSON if provided"""
        if self.field_instructions:
            try:
                json.loads(self.field_instructions)
            except json.JSONDecodeError:
                frappe.throw("Field Instructions must be valid JSON")
    
    def get_field_instructions_dict(self):
        """Return field instructions as a dictionary"""
        if self.field_instructions:
            try:
                return json.loads(self.field_instructions)
            except json.JSONDecodeError:
                return {}
        return {}
    
    def has_permission_for_user(self, user=None):
        """Check if user has permission to use this wizard"""
        if not user:
            user = frappe.session.user
        
        # Check if user has create permission for the target doctype
        if self.target_doctype:
            return frappe.has_permission(self.target_doctype, "create", user=user)
        
        return False
    
    @frappe.whitelist()
    def get_target_doctype_schema(self):
        """Get the schema of the target doctype"""
        if not self.target_doctype:
            return {}
        
        try:
            doctype_meta = frappe.get_meta(self.target_doctype)
            schema = {
                "name": doctype_meta.name,
                "module": doctype_meta.module,
                "fields": [],
                "permissions": doctype_meta.permissions,
                "is_submittable": doctype_meta.is_submittable,
                "track_changes": doctype_meta.track_changes
            }
            
            for field in doctype_meta.fields:
                schema["fields"].append({
                    "fieldname": field.fieldname,
                    "fieldtype": field.fieldtype,
                    "label": field.label,
                    "options": field.options,
                    "reqd": field.reqd,
                    "description": field.description,
                    "default": field.default
                })
            
            return schema
        except Exception as e:
            frappe.log_error(f"Error getting doctype schema: {str(e)}")
            return {}
    
    @frappe.whitelist()
    def test_wizard(self):
        """Test the wizard by opening the modal directly"""
        return {
            "success": True,
            "message": "Opening wizard test modal...",
            "wizard_config": {
                "name": self.name,
                "wizard_name": self.wizard_name,
                "ai_model": self.ai_model,
                "system_prompt": self.system_prompt,
                "field_instructions": self.field_instructions
            },
            "target_doctype": self.target_doctype
        }
