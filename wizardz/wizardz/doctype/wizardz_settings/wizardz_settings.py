# Copyright (c) 2025, TierneyMorris Pty Ltd and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class WizardzSettings(Document):
    def validate(self):
        """Validate the settings"""
        self.validate_temperature()
        self.validate_max_tokens()
        self.validate_api_key()
    
    def validate_temperature(self):
        """Validate temperature is between 0.0 and 1.0"""
        if self.temperature is not None:
            if self.temperature < 0.0 or self.temperature > 1.0:
                frappe.throw("Temperature must be between 0.0 and 1.0")
    
    def validate_max_tokens(self):
        """Validate max_tokens is reasonable"""
        if self.max_tokens is not None:
            if self.max_tokens < 100 or self.max_tokens > 8000:
                frappe.throw("Max Tokens must be between 100 and 8000")
    
    def validate_api_key(self):
        """Basic validation for OpenAI API key format"""
        if self.openai_api_key:
            if not self.openai_api_key.startswith('sk-'):
                frappe.throw("OpenAI API Key should start with 'sk-'")
            if len(self.openai_api_key) < 20:
                frappe.throw("OpenAI API Key appears to be too short")
    
    @staticmethod
    def get_settings():
        """Get Wizardz settings, creating default if doesn't exist"""
        if not frappe.db.exists("Wizardz Settings", "Wizardz Settings"):
            # Create default settings
            settings = frappe.get_doc({
                "doctype": "Wizardz Settings",
                "name": "Wizardz Settings",
                "default_ai_model": "gpt-5",
                "max_tokens": 2000,
                "temperature": 0.7,
                "enable_logging": 1,
                "log_conversations": 1,
                "max_conversation_history": 50,
                "auto_cleanup_days": 30
            })
            settings.insert(ignore_permissions=True)
            return settings
        
        return frappe.get_doc("Wizardz Settings", "Wizardz Settings")
    
    @staticmethod
    def get_openai_api_key():
        """Get the OpenAI API key"""
        settings = WizardzSettings.get_settings()
        return settings.get_password("openai_api_key")
    
    @staticmethod
    def get_ai_config():
        """Get AI configuration settings"""
        settings = WizardzSettings.get_settings()
        return {
            "api_key": settings.get_password("openai_api_key"),
            "default_model": settings.default_ai_model,
            "max_tokens": settings.max_tokens or 2000,
            "temperature": settings.temperature or 0.7
        }
    
    @staticmethod
    def get_logging_config():
        """Get logging configuration"""
        settings = WizardzSettings.get_settings()
        return {
            "enable_logging": settings.enable_logging,
            "log_conversations": settings.log_conversations,
            "max_conversation_history": settings.max_conversation_history or 50,
            "auto_cleanup_days": settings.auto_cleanup_days or 30
        }
    
    def on_update(self):
        """Clear cache when settings are updated"""
        frappe.cache().delete_key("wizardz_settings")
