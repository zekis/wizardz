# Copyright (c) 2025, TierneyMorris Pty Ltd and contributors
# For license information, please see license.txt

"""
Simplified API for React app integration with wizardz
Provides clean endpoints optimized for frappe-react-sdk usage
"""

import frappe
from frappe import _
from wizardz.api import (
    get_available_wizards, get_wizard_for_doctype, start_wizard_session,
    send_message, get_draft_data, create_document_from_draft, get_user_drafts
)


@frappe.whitelist()
def create_wizard_session(doctype, session_name=None, existing_doc=None):
    """Simplified session creation for React apps"""
    try:
        # Auto-find wizard for doctype
        wizard = get_wizard_for_doctype(doctype)
        if not wizard:
            return {
                "success": False,
                "error": f"No wizard configured for {doctype}",
                "available_wizards": get_available_wizards()
            }
        
        # Create session
        session = start_wizard_session(
            wizard_config=wizard["name"],
            draft_name=session_name or f"New {doctype}",
            target_doctype=doctype,
            existing_doc=existing_doc,
            mode="update" if existing_doc else "create"
        )
        
        if session.get("success"):
            # Get initial AI greeting
            initial_response = send_message(
                session["draft_id"], 
                "Hello, I'm ready to help you create this document. What would you like to start with?"
            )
            
            return {
                "success": True,
                "session_id": session["draft_id"],
                "doctype": doctype,
                "wizard_name": wizard["wizard_name"],
                "initial_message": initial_response.get("response"),
                "mode": "update" if existing_doc else "create"
            }
        
        return session
        
    except Exception as e:
        frappe.log_error(f"Error creating wizard session", f"DocType: {doctype}, Error: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def chat(session_id, message):
    """Simplified chat endpoint"""
    try:
        response = send_message(session_id, message)
        
        return {
            "success": response.get("success", False),
            "message": response.get("response"),
            "draft_data": response.get("draft_data"),
            "status": response.get("draft_status"),
            "error": response.get("error"),
            "session_id": session_id
        }
        
    except Exception as e:
        frappe.log_error(f"Error in chat", f"Session: {session_id}, Error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "session_id": session_id
        }


@frappe.whitelist()
def get_session_state(session_id):
    """Get complete session state for React apps"""
    try:
        data = get_draft_data(session_id)
        
        if data.get("success"):
            return {
                "success": True,
                "session_id": session_id,
                "conversation": data.get("conversation", []),
                "draft_data": data.get("draft_data", {}),
                "status": data.get("status"),
                "can_finalize": data.get("status") in ["In Progress", "Update Mode"]
            }
        
        return data
        
    except Exception as e:
        frappe.log_error(f"Error getting session state", f"Session: {session_id}, Error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "session_id": session_id
        }


@frappe.whitelist()
def finalize_session(session_id):
    """Create final document from session"""
    try:
        result = create_document_from_draft(session_id)
        
        return {
            "success": result.get("success", False),
            "document_name": result.get("document_name"),
            "doctype": result.get("doctype"),
            "error": result.get("error"),
            "session_id": session_id
        }
        
    except Exception as e:
        frappe.log_error(f"Error finalizing session", f"Session: {session_id}, Error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "session_id": session_id
        }


@frappe.whitelist()
def get_wizard_info(doctype):
    """Get wizard capabilities for a doctype"""
    try:
        wizard = get_wizard_for_doctype(doctype)
        if not wizard:
            return {
                "success": False,
                "error": f"No wizard available for {doctype}",
                "available_doctypes": [w["target_doctype"] for w in get_available_wizards()]
            }
        
        return {
            "success": True,
            "wizard_name": wizard["wizard_name"],
            "ai_model": wizard["ai_model"],
            "target_doctype": doctype,
            "supports_update": True,
            "supports_create": True
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting wizard info", f"DocType: {doctype}, Error: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def get_available_doctypes():
    """Get all doctypes that have wizards configured"""
    try:
        wizards = get_available_wizards()
        return {
            "success": True,
            "doctypes": [
                {
                    "doctype": w["target_doctype"],
                    "wizard_name": w["wizard_name"],
                    "ai_model": w["ai_model"]
                }
                for w in wizards
            ]
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting available doctypes", f"Error: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def check_wizard_availability(doctypes):
    """Check which doctypes from a list have wizards available"""
    try:
        if isinstance(doctypes, str):
            doctypes = [doctypes]
        
        available_wizards = {w["target_doctype"]: w for w in get_available_wizards()}
        
        return {
            "success": True,
            "results": [
                {
                    "doctype": dt,
                    "has_wizard": dt in available_wizards,
                    "wizard_name": available_wizards.get(dt, {}).get("wizard_name")
                }
                for dt in doctypes
            ]
        }
        
    except Exception as e:
        frappe.log_error(f"Error checking wizard availability", f"Error: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def get_user_sessions():
    """Get user's wizard sessions with enhanced info for React apps"""
    try:
        drafts = get_user_drafts()
        
        # Enhance with additional info
        enhanced_sessions = []
        for draft in drafts:
            enhanced_sessions.append({
                "session_id": draft["name"],
                "name": draft["draft_name"],
                "doctype": draft["target_doctype"],
                "status": draft["status"],
                "last_modified": draft["modified"],
                "can_resume": draft["status"] in ["Draft", "In Progress", "Update Mode"],
                "is_completed": draft["status"] == "Completed"
            })
        
        return {
            "success": True,
            "sessions": enhanced_sessions
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting user sessions", f"Error: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def resume_session(session_id):
    """Resume an existing session with conversation history"""
    try:
        data = get_draft_data(session_id)
        
        if data.get("success"):
            return {
                "success": True,
                "session_id": session_id,
                "conversation": data.get("conversation", []),
                "draft_data": data.get("draft_data", {}),
                "status": data.get("status"),
                "can_continue": data.get("status") in ["Draft", "In Progress", "Update Mode"],
                "can_finalize": data.get("status") in ["In Progress", "Update Mode"]
            }
        
        return data
        
    except Exception as e:
        frappe.log_error(f"Error resuming session", f"Session: {session_id}, Error: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "session_id": session_id
        }
