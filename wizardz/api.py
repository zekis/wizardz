# Copyright (c) 2025, TierneyMorris Pty Ltd and contributors
# For license information, please see license.txt

import frappe
import json
import openai
from frappe import _
from datetime import datetime
from frappe.utils import get_datetime


class DateTimeEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle datetime objects"""
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)


@frappe.whitelist()
def get_available_wizards():
    """Get list of active wizards that the current user can access"""
    wizards = frappe.get_all(
        "Wizardz Configuration",
        filters={"is_active": 1},
        fields=["name", "wizard_name", "target_doctype", "ai_model"]
    )
    
    # Filter wizards based on user permissions
    accessible_wizards = []
    for wizard in wizards:
        wizard_doc = frappe.get_doc("Wizardz Configuration", wizard.name)
        if wizard_doc.has_permission_for_user():
            accessible_wizards.append(wizard)
    
    return accessible_wizards


@frappe.whitelist()
def get_wizard_for_doctype(doctype):
    """Get wizard configuration for a specific doctype"""
    wizard = frappe.db.get_value(
        "Wizardz Configuration",
        {"target_doctype": doctype, "is_active": 1},
        ["name", "wizard_name", "ai_model", "system_prompt", "field_instructions"]
    )
    
    if wizard:
        wizard_doc = frappe.get_doc("Wizardz Configuration", wizard[0])
        if wizard_doc.has_permission_for_user():
            return {
                "name": wizard[0],
                "wizard_name": wizard[1],
                "ai_model": wizard[2],
                "system_prompt": wizard[3],
                "field_instructions": wizard[4]
            }
    
    return None


@frappe.whitelist()
def start_wizard_session(wizard_config, draft_name, target_doctype):
    """Initialize a new wizard session"""
    # Validate permissions
    wizard_doc = frappe.get_doc("Wizardz Configuration", wizard_config)
    if not wizard_doc.has_permission_for_user():
        frappe.throw(_("You don't have permission to use this wizard"))
    
    # Create new draft
    draft = frappe.get_doc({
        "doctype": "Wizardz Draft",
        "draft_name": draft_name,
        "wizard_config": wizard_config,
        "target_doctype": target_doctype,
        "status": "Draft"
    })
    draft.insert()
    
    # Add initial system message
    draft.add_message_to_conversation(
        "system",
        f"Started wizard session for creating DocType: {target_doctype}",
        {"action": "session_start", "wizard": wizard_config}
    )
    draft.save()
    
    return {
        "success": True,
        "draft_id": draft.name,
        "message": f"Wizard session started for {target_doctype}"
    }


@frappe.whitelist()
def send_message(draft_id, message, message_type="user"):
    """Process user message and get AI response"""
    try:
        # Get draft and validate permissions
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        wizard_config = frappe.get_doc("Wizardz Configuration", draft.wizard_config)
        
        if not wizard_config.has_permission_for_user():
            frappe.throw(_("You don't have permission to use this wizard"))
        
        # Add user message to conversation
        draft.add_message_to_conversation(message_type, message)
        draft.save()
        
        # Get AI response (this handles the tool execution loop)
        ai_response = get_ai_response(draft, wizard_config, message)
        
        # Add AI response to conversation (this should be the final user-facing message)
        draft.add_message_to_conversation("assistant", ai_response)
        draft.save()
        
        return {
            "success": True,
            "response": ai_response,
            "draft_status": draft.status,
            "draft_data": draft.get_draft_data_dict()
        }
        
    except Exception as e:
        frappe.log_error(f"Error in send_message: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }


def get_ai_response(draft, wizard_config, user_message):
    """Get response from OpenAI with tool execution loop"""
    try:
        # Get AI configuration from Wizardz Settings
        from wizardz.wizardz.doctype.wizardz_settings.wizardz_settings import WizardzSettings
        ai_config = WizardzSettings.get_ai_config()
        
        if not ai_config["api_key"]:
            frappe.throw(_("OpenAI API key not configured in Wizardz Settings"))
        
        client = openai.OpenAI(api_key=ai_config["api_key"])
        
        # Build base messages
        messages = build_base_messages(draft, wizard_config)
        
        # AI-Tool execution loop
        max_iterations = 5  # Prevent infinite loops
        iteration = 0
        
        while iteration < max_iterations:
            iteration += 1
            
            # Get AI response
            response = client.chat.completions.create(
                model=wizard_config.ai_model,
                messages=messages,
                max_tokens=ai_config["max_tokens"],
                temperature=ai_config["temperature"]
            )
            
            ai_response = response.choices[0].message.content
            
            # Parse and execute tool calls
            tool_result = parse_and_execute_tools(ai_response, draft.name)
            
            if tool_result["has_tools"]:
                # Add AI response to conversation
                messages.append({"role": "assistant", "content": ai_response})
                
                # Add tool results back to AI
                messages.append({"role": "system", "content": f"Tool Results: {json.dumps(tool_result['results'], cls=DateTimeEncoder)}"})
                
                # If ask_user was called, return the question to frontend
                if tool_result.get("user_message"):
                    return tool_result["user_message"]
                
                # Continue loop to get next AI response
                continue
            else:
                # No tools found, return AI response directly
                return ai_response
        
        return "Maximum tool execution iterations reached. Please try again."
        
    except Exception as e:
        frappe.log_error(f"Error getting AI response: {str(e)}")
        return f"Error getting AI response: {str(e)}"


def build_base_messages(draft, wizard_config):
    """Build base messages for AI conversation"""
    conversation = draft.get_conversation_history_list()
    messages = [{"role": "system", "content": wizard_config.system_prompt}]
    
    # Add context about target doctype schema
    doctype_context = get_doctype_context(draft.target_doctype)
    if doctype_context:
        messages.append({
            "role": "system", 
            "content": f"DocType Schema for {draft.target_doctype}: {json.dumps(doctype_context, indent=2, cls=DateTimeEncoder)}"
        })
    
    # Add available tools information
    tools_info = {
        "available_tools": [
            {
                "name": "ask_user",
                "description": "Ask the user a question - REQUIRED for all user interactions",
                "parameters": "draft_id (string), question (string), context (optional string)",
                "example": "ask_user(draft_id, 'What is the customer name?', 'collecting_basic_info')"
            },
            {
                "name": "save_draft_data",
                "description": "Save the current customer record data to draft",
                "parameters": "draft_data (object with field values)"
            },
            {
                "name": "get_draft_data", 
                "description": "Retrieve current draft data",
                "parameters": "draft_id"
            },
            {
                "name": "get_doctype_schema",
                "description": "Get detailed schema information for any DocType",
                "parameters": "doctype_name"
            },
            {
                "name": "search_documents",
                "description": "Search for existing documents to check for duplicates before creating new ones",
                "parameters": "doctype (string), search_fields (array of field names), search_term (string), limit (optional, default 10)",
                "example": "search_documents('Customer', ['customer_name', 'email_id'], 'EAC Systems', 5)"
            }
        ],
        "critical_rules": [
            "You MUST use a tool in every response - no exceptions",
            "To ask questions, use ask_user tool",
            "To search for duplicates, use search_documents tool", 
            "To save data, use save_draft_data tool",
            "Never respond without using a tool"
        ],
        "instructions": "MANDATORY: Every response must include a tool call. Use ask_user to ask questions, search_documents to check duplicates, save_draft_data to save information. Never provide a response without calling a tool."
    }
    messages.append({
        "role": "system",
        "content": f"Available Tools: {json.dumps(tools_info, indent=2, cls=DateTimeEncoder)}"
    })
    
    # Add field instructions if available (optional context)
    field_instructions = wizard_config.get_field_instructions_dict()
    if field_instructions:
        messages.append({
            "role": "system",
            "content": f"Optional Field Guidance: {json.dumps(field_instructions, indent=2, cls=DateTimeEncoder)}"
        })
    
    # Add conversation history
    for msg in conversation[-10:]:  # Last 10 messages for context
        role = "user" if msg["type"] == "user" else "assistant"
        messages.append({"role": role, "content": msg["content"]})
    
    return messages


def parse_and_execute_tools(ai_response, draft_id):
    """Parse AI response for tool calls and execute them"""
    import re
    
    result = {
        "has_tools": False,
        "results": {},
        "user_message": None
    }
    
    # Look for tool calls in the format: tool_name(parameters)
    tool_patterns = [
        r'ask_user\s*\(\s*draft_id\s*=\s*["\']([^"\']*)["\'],\s*question\s*=\s*["\']([^"\']*)["\'](?:,\s*context\s*=\s*["\']([^"\']*)["\'])?\s*\)',
        r'search_documents\s*\(\s*doctype\s*=\s*["\']([^"\']*)["\'],\s*search_fields\s*=\s*\[([^\]]*)\],\s*search_term\s*=\s*["\']([^"\']*)["\'](?:,\s*limit\s*=\s*(\d+))?\s*\)',
        r'save_draft_data\s*\(\s*draft_id\s*=\s*["\']([^"\']*)["\'],\s*draft_data\s*=\s*(\{[^}]*\})\s*\)',
        r'get_draft_data\s*\(\s*draft_id\s*=\s*["\']([^"\']*)["\']\s*\)',
        r'get_doctype_schema\s*\(\s*doctype_name\s*=\s*["\']([^"\']*)["\']\s*\)'
    ]
    
    # Check for ask_user
    ask_user_match = re.search(tool_patterns[0], ai_response)
    if ask_user_match:
        result["has_tools"] = True
        question = ask_user_match.group(2)
        context = ask_user_match.group(3) if ask_user_match.group(3) else None
        
        tool_result = ask_user(draft_id, question, context)
        result["results"]["ask_user"] = tool_result
        result["user_message"] = question  # Return question to frontend
    # If no tools were found, return correction message to AI
    correction_message = f"""
TOOL CALL FORMAT ERROR: Your response did not contain a properly formatted tool call.

Your response was: {ai_response[:200]}...

You MUST use one of these exact formats:

1. ask_user(draft_id="{draft_id}", question="Your question here")
2. search_documents(doctype="Customer", search_fields=["customer_name"], search_term="search term")
3. save_draft_data(draft_id="{draft_id}", draft_data={{"field": "value"}})
4. get_draft_data(draft_id="{draft_id}")
5. get_doctype_schema(doctype_name="Customer")

Examples:
- ask_user(draft_id="{draft_id}", question="What is the customer name?")
- search_documents(doctype="Customer", search_fields=["customer_name", "email_id"], search_term="EAC Systems")
- save_draft_data(draft_id="{draft_id}", draft_data={{"customer_name": "EAC Systems", "customer_type": "Company"}})

Please provide your response again using the correct tool call format.
"""
    
    result["has_tools"] = True
    result["correction_needed"] = True
    result["correction_message"] = correction_message
    return result
    
    # Check for search_documents
    search_match = re.search(tool_patterns[1], ai_response)
    if search_match:
        result["has_tools"] = True
        doctype = search_match.group(1)
        search_fields_str = search_match.group(2)
        search_term = search_match.group(3)
        limit = int(search_match.group(4)) if search_match.group(4) else 10
        
        # Parse search_fields array
        search_fields = [field.strip().strip('"\'') for field in search_fields_str.split(',')]
        
        tool_result = search_documents(doctype, search_fields, search_term, limit)
        result["results"]["search_documents"] = tool_result
        return result
    
    # Check for save_draft_data
    save_match = re.search(tool_patterns[2], ai_response)
    if save_match:
        result["has_tools"] = True
        try:
            draft_data = json.loads(save_match.group(2))
            tool_result = save_draft_data(draft_id, draft_data)
            result["results"]["save_draft_data"] = tool_result
        except json.JSONDecodeError:
            result["results"]["save_draft_data"] = {"success": False, "error": "Invalid JSON in draft_data"}
        return result
    
    # Check for get_draft_data
    get_draft_match = re.search(tool_patterns[3], ai_response)
    if get_draft_match:
        result["has_tools"] = True
        tool_result = get_draft_data(draft_id)
        result["results"]["get_draft_data"] = tool_result
        return result
    
    # Check for get_doctype_schema
    schema_match = re.search(tool_patterns[4], ai_response)
    if schema_match:
        result["has_tools"] = True
        doctype_name = schema_match.group(1)
        tool_result = get_doctype_schema(doctype_name)
        result["results"]["get_doctype_schema"] = tool_result
        return result
    
    return result


@frappe.whitelist()
def get_doctype_schema(doctype):
    """Get the schema of an existing doctype"""
    try:
        if not frappe.db.exists("DocType", doctype):
            return {"error": "DocType not found"}
        
        meta = frappe.get_meta(doctype)
        schema = {
            "name": meta.name,
            "module": meta.module,
            "fields": [],
            "permissions": [p.as_dict() for p in meta.permissions],
            "is_submittable": meta.is_submittable,
            "track_changes": meta.track_changes,
            "autoname": meta.autoname
        }
        
        for field in meta.fields:
            schema["fields"].append({
                "fieldname": field.fieldname,
                "fieldtype": field.fieldtype,
                "label": field.label,
                "options": field.options,
                "reqd": field.reqd,
                "description": field.description,
                "default": field.default,
                "in_list_view": field.in_list_view
            })
        
        return schema
        
    except Exception as e:
        frappe.log_error(f"Error getting doctype schema: {str(e)}")
        return {"error": str(e)}


def get_doctype_context(doctype):
    """Get context about existing doctype if it exists"""
    if frappe.db.exists("DocType", doctype):
        return get_doctype_schema(doctype)
    return None


@frappe.whitelist()
def save_draft_data(draft_id, draft_data):
    """Save draft doctype data"""
    try:
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        wizard_config = frappe.get_doc("Wizardz Configuration", draft.wizard_config)
        
        if not wizard_config.has_permission_for_user():
            frappe.throw(_("You don't have permission to modify this draft"))
        
        draft.update_draft_data(draft_data)
        draft.status = "In Progress"
        draft.save()
        
        return {"success": True, "message": "Draft data saved"}
        
    except Exception as e:
        frappe.log_error(f"Error saving draft data: {str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_draft_data(draft_id):
    """Get draft doctype data"""
    try:
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        wizard_config = frappe.get_doc("Wizardz Configuration", draft.wizard_config)
        
        if not wizard_config.has_permission_for_user():
            frappe.throw(_("You don't have permission to view this draft"))
        
        return {
            "success": True,
            "draft_data": draft.get_draft_data_dict(),
            "conversation": draft.get_conversation_history_list(),
            "status": draft.status
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting draft data: {str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def search_documents(doctype, search_fields, search_term, limit=10):
    """Search for existing documents to check for duplicates"""
    try:
        if not frappe.db.exists("DocType", doctype):
            return {"error": "DocType not found"}
        
        # Validate search fields exist in the doctype
        meta = frappe.get_meta(doctype)
        valid_fields = [field.fieldname for field in meta.fields if field.fieldtype in ['Data', 'Text', 'Link']]
        
        # Filter search_fields to only include valid searchable fields
        if isinstance(search_fields, str):
            search_fields = [search_fields]
        
        search_fields = [field for field in search_fields if field in valid_fields]
        
        if not search_fields:
            return {"error": "No valid search fields provided"}
        
        # Build search filters
        filters = []
        for field in search_fields:
            filters.append([doctype, field, 'like', f'%{search_term}%'])
        
        # Search for documents
        results = frappe.get_all(
            doctype,
            or_filters=filters,
            fields=['name'] + search_fields,
            limit=limit
        )
        
        return {
            "success": True,
            "results": results,
            "count": len(results),
            "search_term": search_term,
            "searched_fields": search_fields
        }
        
    except Exception as e:
        frappe.log_error(f"Error searching documents: {str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def ask_user(draft_id, question, context=None):
    """Tool for AI to ask user a question - forces tool usage"""
    try:
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        wizard_config = frappe.get_doc("Wizardz Configuration", draft.wizard_config)
        
        if not wizard_config.has_permission_for_user():
            frappe.throw(_("You don't have permission to use this wizard"))
        
        # Log the question as metadata
        metadata = {"action": "ask_user", "context": context} if context else {"action": "ask_user"}
        draft.add_message_to_conversation("system", f"AI asked: {question}", metadata)
        draft.save()
        
        return {
            "success": True,
            "question": question,
            "message": question  # This will be returned as the AI response
        }
        
    except Exception as e:
        frappe.log_error(f"Error in ask_user: {str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_user_drafts():
    """Get drafts created by current user"""
    drafts = frappe.get_all(
        "Wizardz Draft",
        filters={"owner": frappe.session.user},
        fields=["name", "draft_name", "target_doctype", "status", "modified"],
        order_by="modified desc"
    )
    
    return drafts
