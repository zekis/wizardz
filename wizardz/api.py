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
        
        # Reload draft to avoid modification conflicts
        draft.reload()
        
        # Add user message to conversation
        draft.add_message_to_conversation(message_type, message)
        draft.save()
        
        # Get AI response (this handles the tool execution loop)
        ai_response = get_ai_response(draft, wizard_config, message)
        
        # Reload again before adding AI response
        draft.reload()
        
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
        frappe.log_error(f"Error in send_message",f"{str(e)}")
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
        frappe.log_error(f"Error getting AI response",f"{str(e)}")
        return f"Error getting AI response: {str(e)}"


def build_base_messages(draft, wizard_config):
    """Build base messages for AI conversation"""
    conversation = draft.get_conversation_history_list()
    
    # Generate dynamic system prompt
    base_system_prompt = generate_base_system_prompt(draft.target_doctype)
    messages = [{"role": "system", "content": base_system_prompt}]
    
    # Add wizard-specific instructions if provided
    if wizard_config.system_prompt and wizard_config.system_prompt.strip():
        messages.append({
            "role": "system",
            "content": f"Additional Instructions: {wizard_config.system_prompt}"
        })
    
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
                "example": "{\"tool\": \"ask_user\", \"parameters\": {\"draft_id\": \"DRAFT-001\", \"question\": \"What is the customer name?\", \"context\": \"collecting_basic_info\"}}"
            },
            {
                "name": "update_draft_field",
                "description": "Update or add a specific field in the draft data",
                "parameters": "field_name (string), field_value (any), action (optional: 'add', 'update', 'remove')",
                "example": "{\"tool\": \"update_draft_field\", \"parameters\": {\"field_name\": \"customer_name\", \"field_value\": \"Test Customer 2\", \"action\": \"add\"}}"
            },
            {
                "name": "update_multiple_fields",
                "description": "Update multiple specific fields in the draft data without overwriting existing data",
                "parameters": "field_updates (object with field names and values)",
                "example": "{\"tool\": \"update_multiple_fields\", \"parameters\": {\"field_updates\": {\"customer_name\": \"Test Customer 2\", \"customer_type\": \"Company\"}}}"
            },
            {
                "name": "get_draft_data", 
                "description": "Retrieve current draft data",
                "parameters": "draft_id",
                "example": "{\"tool\": \"get_draft_data\", \"parameters\": {\"draft_id\": \"DRAFT-001\"}}"
            },
            {
                "name": "get_doctype_schema",
                "description": "Get detailed schema information for any DocType",
                "parameters": "doctype_name",
                "example": "{\"tool\": \"get_doctype_schema\", \"parameters\": {\"doctype_name\": \"Customer\"}}"
            },
            {
                "name": "search_documents",
                "description": "Search for existing documents to check for duplicates before creating new ones",
                "parameters": "doctype (string), search_fields (array of field names), search_term (string), limit (optional, default 10)",
                "example": "{\"tool\": \"search_documents\", \"parameters\": {\"doctype\": \"Customer\", \"search_fields\": [\"customer_name\", \"email_id\"], \"search_term\": \"EAC Systems\", \"limit\": 5}}"
            },
            {
                "name": "set_update_mode",
                "description": "Switch wizard from create mode to update mode for an existing document",
                "parameters": "document_name (string), reason (optional string explaining why switching to update)",
                "example": "{\"tool\": \"set_update_mode\", \"parameters\": {\"document_name\": \"Bob Smith\", \"reason\": \"Customer already exists, user wants to update\"}}"
            },
            {
                "name": "add_dependent_doctype",
                "description": "Add a dependent DocType that needs to be created before the main document",
                "parameters": "doctype (string), dependency_reason (string), priority (optional int, default 1)",
                "example": "{\"tool\": \"add_dependent_doctype\", \"parameters\": {\"doctype\": \"Customer\", \"dependency_reason\": \"Customer 'TechStart Solutions' does not exist and is required for Project\", \"priority\": 1}}"
            },
            {
                "name": "update_doctype_field",
                "description": "Update a field for a specific DocType in the multi-doctype draft",
                "parameters": "doctype (string), field_name (string), field_value (any), action (optional: 'add', 'update', 'remove')",
                "example": "{\"tool\": \"update_doctype_field\", \"parameters\": {\"doctype\": \"Customer\", \"field_name\": \"customer_name\", \"field_value\": \"TechStart Solutions\", \"action\": \"add\"}}"
            },
            {
                "name": "get_creation_order",
                "description": "Get the order in which DocTypes should be created based on dependencies",
                "parameters": "draft_id (string)",
                "example": "{\"tool\": \"get_creation_order\", \"parameters\": {\"draft_id\": \"DRAFT-001\"}}"
            },
            {
                "name": "add_child_table_row",
                "description": "Add a row to a child table field",
                "parameters": "table_field_name (string), row_data (object with field names and values)",
                "example": "{\"tool\": \"add_child_table_row\", \"parameters\": {\"table_field_name\": \"items\", \"row_data\": {\"item_code\": \"ITEM-001\", \"qty\": 5, \"rate\": 100}}}"
            },
            {
                "name": "update_child_table_row",
                "description": "Update a specific row in a child table field",
                "parameters": "table_field_name (string), row_index (int), row_data (object with field names and values)",
                "example": "{\"tool\": \"update_child_table_row\", \"parameters\": {\"table_field_name\": \"items\", \"row_index\": 0, \"row_data\": {\"qty\": 10, \"rate\": 120}}}"
            },
            {
                "name": "remove_child_table_row",
                "description": "Remove a row from a child table field",
                "parameters": "table_field_name (string), row_index (int)",
                "example": "{\"tool\": \"remove_child_table_row\", \"parameters\": {\"table_field_name\": \"items\", \"row_index\": 1}}"
            },
            {
                "name": "get_child_table_schema",
                "description": "Get the schema of a child table (Table fieldtype)",
                "parameters": "child_doctype_name (string)",
                "example": "{\"tool\": \"get_child_table_schema\", \"parameters\": {\"child_doctype_name\": \"Sales Order Item\"}}"
            }
        ],
        "critical_rules": [
            "You MUST use a tool in every response - no exceptions",
            "To ask questions, use ask_user tool",
            "To search for duplicates, use search_documents tool", 
            "To save data, use update_draft_field or update_multiple_fields tools ONLY",
            "When you have sufficient information, tell the user to click the 'Create [DocType]' or 'Update [DocType]' button to finalize the document",
            "Never respond without using a tool"
        ],
        "instructions": "MANDATORY: Every response must be valid JSON with a tool call. Use this exact format: {\"tool\": \"ask_user\", \"parameters\": {\"draft_id\": \"...\", \"question\": \"...\"}}. Never provide plain text responses."
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
    
    # Add current draft data so AI knows what's already been saved
    current_draft_data = draft.get_draft_data_dict()
    messages.append({
        "role": "system",
        "content": f"Current Draft Data: {json.dumps(current_draft_data, indent=2, cls=DateTimeEncoder)}"
    })
    
    # Add conversation history - send ALL messages to maintain context
    for msg in conversation:  # Send full conversation history
        role = "user" if msg["type"] == "user" else "assistant"
        messages.append({"role": role, "content": msg["content"]})
    
    return messages


def generate_base_system_prompt(target_doctype):
    """Generate the base system prompt dynamically"""
    # Get current user context
    current_user = frappe.session.user
    user_full_name = frappe.db.get_value("User", current_user, "full_name") or current_user
    current_datetime = frappe.utils.now_datetime().strftime("%Y-%m-%d %H:%M:%S")
    current_date = frappe.utils.today()
    
    return f"""You are an AI assistant specialized in helping users create and update {target_doctype} records in Frappe/ERPNext systems. You have access to the actual {target_doctype} DocType schema with field metadata and tools to manage draft data.

## Current Session Context:
- **Current User**: {user_full_name} (Email: {current_user})
- **Current Date**: {current_date}
- **Current DateTime**: {current_datetime}
- **System Timezone**: {frappe.utils.get_system_timezone()}

## Important Context Rules:
- When the user says "me", "myself", or "I", they are referring to: {user_full_name}
- When the user says "today" or "now", use the current date: {current_date}
- When asking for dates, provide the current date as context or default suggestion
- When asking for user assignments, suggest the current user ({user_full_name}) as a default option
- Always use the user's full name ({user_full_name}) when creating records that reference the current user

## Your Role & Capabilities:
- Access to the complete {target_doctype} DocType schema including field metadata
- Tools to save and retrieve draft data incrementally
- Understanding of field dependencies and validation requirements
- Knowledge of linked DocTypes that may need to be created first
- Ability to switch between create and update modes

## Process Approach:
1. **Analyze Schema**: Use the provided {target_doctype} DocType schema to understand required fields and dependencies
2. **Check for Existing Records**: ALWAYS use search_documents to check if records already exist before proceeding
3. **Handle Duplicates**: If duplicates found, ask user whether to update existing or create new record
4. **Identify Prerequisites**: Check if any linked DocTypes need to be created first
5. **Collect Data Systematically**: Ask for information based on field requirements and dependencies
6. **Auto-Validate Links**: When user provides a value for a Link field, IMMEDIATELY use search_documents to check if the linked document exists
7. **Handle Missing Links**: If linked document doesn't exist, use add_dependent_doctype and start collecting data for the missing DocType
8. **Save Incrementally**: Use update_draft_field or update_multiple_fields tools to save information as you collect it
9. **Validate Data**: Ensure collected data meets field requirements before saving
10. **Complete Process**: When you have sufficient information, tell the user to click the "Create {target_doctype}" or "Update {target_doctype}" button to finalize the document

## Data Collection Strategy:
- Start with mandatory fields first
- Ask one question at a time to avoid overwhelming the user
- Use the schema to provide appropriate field options and validation
- Save data to draft after collecting each piece of information
- Provide helpful context based on field descriptions from schema

## Communication Style:
- Be conversational and helpful in your questions
- Reference actual field names and requirements from the schema
- Explain why information is needed
- Provide clear guidance on next steps
- Tell users when they're ready to finalize the document
- Always provide examples when asking for information to help users understand what's expected
- Use specific, relevant examples based on the field type and context

## Critical Requirements:
- EVERY response MUST be valid JSON with a tool call - no exceptions
- Use ask_user tool for ALL questions to the user
- Use search_documents before creating any new records to check for duplicates
- Use update_draft_field or update_multiple_fields after collecting each piece of information
- When duplicates are found, offer to switch to update mode using set_update_mode
- Never respond with plain text - always use JSON tool format

Start by greeting the user and asking for the primary information needed to create or update the {target_doctype} record."""


def parse_and_execute_tools(ai_response, draft_id):
    """Parse AI response for JSON tool calls and execute them"""
    result = {
        "has_tools": False,
        "results": {},
        "user_message": None
    }
    
    try:
        # Try to parse as JSON
        tool_call = json.loads(ai_response.strip())
        
        if not isinstance(tool_call, dict) or "tool" not in tool_call:
            raise ValueError("Invalid tool call format")
        
        tool_name = tool_call["tool"]
        parameters = tool_call.get("parameters", {})
        
        result["has_tools"] = True
        
        # Execute the appropriate tool
        if tool_name == "ask_user":
            question = parameters.get("question", "")
            context = parameters.get("context")
            
            tool_result = ask_user(draft_id, question, context)
            result["results"]["ask_user"] = tool_result
            result["user_message"] = question  # Return question to frontend
            return result
            
        elif tool_name == "search_documents":
            doctype = parameters.get("doctype", "")
            search_fields = parameters.get("search_fields", [])
            search_term = parameters.get("search_term", "")
            limit = parameters.get("limit", 10)
            
            tool_result = search_documents(doctype, search_fields, search_term, limit)
            result["results"]["search_documents"] = tool_result
            return result
            
        elif tool_name == "update_draft_field":
            field_name = parameters.get("field_name", "")
            field_value = parameters.get("field_value", "")
            action = parameters.get("action", "update")
            
            tool_result = update_draft_field(draft_id, field_name, field_value, action)
            result["results"]["update_draft_field"] = tool_result
            return result
            
        elif tool_name == "update_multiple_fields":
            field_updates = parameters.get("field_updates", {})
            
            tool_result = update_multiple_fields(draft_id, field_updates)
            result["results"]["update_multiple_fields"] = tool_result
            return result
            
            
        elif tool_name == "get_draft_data":
            tool_result = get_draft_data(draft_id)
            result["results"]["get_draft_data"] = tool_result
            return result
            
        elif tool_name == "get_doctype_schema":
            doctype_name = parameters.get("doctype_name", "")
            
            tool_result = get_doctype_schema(doctype_name)
            result["results"]["get_doctype_schema"] = tool_result
            return result
            
        elif tool_name == "set_update_mode":
            document_name = parameters.get("document_name", "")
            reason = parameters.get("reason", "")
            
            tool_result = set_update_mode(draft_id, document_name, reason)
            result["results"]["set_update_mode"] = tool_result
            return result
            
        elif tool_name == "add_dependent_doctype":
            doctype = parameters.get("doctype", "")
            dependency_reason = parameters.get("dependency_reason", "")
            priority = parameters.get("priority", 1)
            
            tool_result = add_dependent_doctype(draft_id, doctype, dependency_reason, priority)
            result["results"]["add_dependent_doctype"] = tool_result
            return result
            
        elif tool_name == "update_doctype_field":
            doctype = parameters.get("doctype", "")
            field_name = parameters.get("field_name", "")
            field_value = parameters.get("field_value", "")
            action = parameters.get("action", "update")
            
            tool_result = update_doctype_field(draft_id, doctype, field_name, field_value, action)
            result["results"]["update_doctype_field"] = tool_result
            return result
            
        elif tool_name == "get_creation_order":
            tool_result = get_creation_order(draft_id)
            result["results"]["get_creation_order"] = tool_result
            return result
            
        else:
            raise ValueError(f"Unknown tool: {tool_name}")
            
    except (json.JSONDecodeError, ValueError, KeyError) as e:
        # If JSON parsing fails, return as no tools found so the loop exits
        frappe.log_error(f"JSON parsing failed for AI response",f"{ai_response[:200]}... Error: {str(e)}")
        
        # Return has_tools = False to exit the loop and return the raw response
        result["has_tools"] = False
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
        
        # Separate link fields for special attention
        link_fields = []
        regular_fields = []
        
        for field in meta.fields:
            field_info = {
                "fieldname": field.fieldname,
                "fieldtype": field.fieldtype,
                "label": field.label,
                "options": field.options,
                "reqd": field.reqd,
                "description": field.description,
                "default": field.default,
                "in_list_view": field.in_list_view
            }
            
            if field.fieldtype == "Link":
                # Add additional context for Link fields
                field_info["is_link_field"] = True
                field_info["linked_doctype"] = field.options
                field_info["dependency_note"] = f"This field links to {field.options} DocType. If the specified {field.options} doesn't exist, it must be created first."
                link_fields.append(field_info)
            else:
                regular_fields.append(field_info)
        
        # Combine with link fields first to highlight them
        schema["fields"] = link_fields + regular_fields
        schema["link_fields_summary"] = {
            "count": len(link_fields),
            "fields": [{"fieldname": f["fieldname"], "linked_doctype": f["linked_doctype"], "required": f["reqd"]} for f in link_fields]
        }
        
        return schema
        
    except Exception as e:
        frappe.log_error(f"Error getting doctype schema",f"{str(e)}")
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
        frappe.log_error(f"Error saving draft data",f"{str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def create_document_from_draft(draft_id):
    """Create a document from a draft"""
    try:
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        
        # Parse the draft data
        draft_data = json.loads(draft.draft_data) if draft.draft_data else {}
        
        if not draft_data:
            return {"success": False, "error": "No draft data found"}
        
        # Create the document
        doc = frappe.new_doc(draft.target_doctype)
        
        # Handle multi-doctype data
        if "_multi_doctype" in draft_data:
            multi_data = draft_data["_multi_doctype"]
            
            # Set main doctype fields
            for field, value in draft_data.items():
                if field != "_multi_doctype" and hasattr(doc, field):
                    setattr(doc, field, value)
            
            # Save main document first
            doc.insert()
            
            # Create dependent documents
            if "doctypes" in multi_data:
                for doctype_name, doctype_data in multi_data["doctypes"].items():
                    if doctype_data:
                        dependent_doc = frappe.new_doc(doctype_name)
                        
                        # Link to main document if there's a reference field
                        for field in dependent_doc.meta.fields:
                            if field.fieldtype == "Link" and field.options == draft.target_doctype:
                                setattr(dependent_doc, field.fieldname, doc.name)
                                break
                        
                        # Set other fields
                        for field, value in doctype_data.items():
                            if hasattr(dependent_doc, field):
                                setattr(dependent_doc, field, value)
                        
                        dependent_doc.insert()
        else:
            # Single doctype mode
            for field, value in draft_data.items():
                if hasattr(doc, field):
                    setattr(doc, field, value)
            
            doc.insert()
        
        # Update draft status
        draft.status = "Completed"
        draft.save()
        
        return {
            "success": True,
            "document_name": doc.name,
            "doctype": doc.doctype
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating document from draft: {str(e)}")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def update_document_from_draft(draft_id, existing_doc_name):
    """Update an existing document from a draft"""
    try:
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        
        # Parse the draft data
        draft_data = json.loads(draft.draft_data) if draft.draft_data else {}
        
        if not draft_data:
            return {"success": False, "error": "No draft data found"}
        
        # Get the existing document
        doc = frappe.get_doc(draft.target_doctype, existing_doc_name)
        
        # Update the document fields
        for field, value in draft_data.items():
            if field != "_multi_doctype" and hasattr(doc, field):
                setattr(doc, field, value)
        
        # Save the updated document
        doc.save()
        
        # Update draft status
        draft.status = "Completed"
        draft.save()
        
        return {
            "success": True,
            "document_name": doc.name,
            "doctype": doc.doctype
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating document from draft: {str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def ask_user(draft_id, question, context=None):
    """Tool for AI to ask user a question - forces tool usage"""
    try:
        # Reload draft to avoid modification conflicts
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        draft.reload()
        
        wizard_config = frappe.get_doc("Wizardz Configuration", draft.wizard_config)
        
        if not wizard_config.has_permission_for_user():
            frappe.throw(_("You don't have permission to use this wizard"))
        
        # Log the question as metadata
        metadata = {"action": "ask_user", "context": context} if context else {"action": "ask_user"}
        draft.add_message_to_conversation("system", f"AI asked: {question}", metadata)
        
        # Use db_set to avoid modification conflicts
        frappe.db.commit()
        
        return {
            "success": True,
            "question": question,
            "message": question  # This will be returned as the AI response
        }
        
    except Exception as e:
        frappe.log_error(f"Error in ask_user",f"{str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def update_draft_field(draft_id, field_name, field_value, action="update"):
    """Update a specific field in the draft data without overwriting other fields"""
    try:
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        wizard_config = frappe.get_doc("Wizardz Configuration", draft.wizard_config)
        
        if not wizard_config.has_permission_for_user():
            frappe.throw(_("You don't have permission to modify this draft"))
        
        # Get current draft data
        current_data = draft.get_draft_data_dict()
        
        # Perform the requested action
        if action == "remove":
            if field_name in current_data:
                del current_data[field_name]
                message = f"Removed field '{field_name}'"
            else:
                message = f"Field '{field_name}' not found, nothing to remove"
        else:  # add or update
            current_data[field_name] = field_value
            action_word = "Added" if field_name not in current_data else "Updated"
            message = f"{action_word} field '{field_name}' = '{field_value}'"
        
        # Update draft with modified data
        draft.update_draft_data(current_data)
        # Only change status to "In Progress" if not already in "Update Mode"
        if draft.status != "Update Mode":
            draft.status = "In Progress"
        draft.save()
        
        return {
            "success": True,
            "message": message,
            "field_name": field_name,
            "field_value": field_value if action != "remove" else None,
            "action": action,
            "current_data": current_data
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating draft field",f"{str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def update_multiple_fields(draft_id, field_updates):
    """Update multiple specific fields in the draft data without overwriting existing data"""
    try:
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        wizard_config = frappe.get_doc("Wizardz Configuration", draft.wizard_config)
        
        if not wizard_config.has_permission_for_user():
            frappe.throw(_("You don't have permission to modify this draft"))
        
        # Get current draft data
        current_data = draft.get_draft_data_dict()
        
        # Update multiple fields
        updated_fields = []
        for field_name, field_value in field_updates.items():
            action_word = "Added" if field_name not in current_data else "Updated"
            current_data[field_name] = field_value
            updated_fields.append(f"{action_word} '{field_name}' = '{field_value}'")
        
        # Update draft with modified data
        draft.update_draft_data(current_data)
        # Only change status to "In Progress" if not already in "Update Mode"
        if draft.status != "Update Mode":
            draft.status = "In Progress"
        draft.save()
        
        return {
            "success": True,
            "message": f"Updated {len(field_updates)} fields: {', '.join(updated_fields)}",
            "updated_fields": field_updates,
            "current_data": current_data
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating multiple fields",f"{str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def create_document_from_draft(draft_id):
    """Create actual document from draft data with validation and error feedback"""
    try:
        # Get draft and validate permissions
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        wizard_config = frappe.get_doc("Wizardz Configuration", draft.wizard_config)
        
        if not wizard_config.has_permission_for_user():
            frappe.throw(_("You don't have permission to create documents with this wizard"))
        
        # Get draft data
        draft_data = draft.get_draft_data_dict()
        
        if not draft_data:
            return {
                "success": False,
                "error": "No draft data found. Please provide some information first."
            }
        
        # Parse and validate draft data for the target doctype
        parsed_data, validation_errors = parse_and_validate_draft_data(
            draft.target_doctype, 
            draft_data
        )
        
        if validation_errors:
            return {
                "success": False,
                "error": f"Validation errors: {'; '.join(validation_errors)}"
            }
        
        # Check if we're in update mode
        target_document = draft.get("target_document")
        
        if draft.status == "Update Mode" and target_document:
            # Update existing document
            existing_doc = frappe.get_doc(draft.target_doctype, target_document)
            
            # Update fields with parsed data
            for field_name, field_value in parsed_data.items():
                existing_doc.set(field_name, field_value)
            
            # Save the updated document
            existing_doc.save()
            
            # Update draft status
            draft.status = "Completed"
            draft.save()
            
            # Add success message to conversation
            draft.add_message_to_conversation(
                "system",
                f"Document updated successfully: {existing_doc.name}",
                {"action": "document_updated", "document_name": existing_doc.name}
            )
            draft.save()
            
            return {
                "success": True,
                "document_name": existing_doc.name,
                "message": f"{draft.target_doctype} '{existing_doc.name}' updated successfully"
            }
        else:
            # Create new document
            new_doc = frappe.get_doc({
                "doctype": draft.target_doctype,
                **parsed_data
            })
            
            # Insert the document
            new_doc.insert()
            
            # Update draft status
            draft.status = "Completed"
            draft.save()
            
            # Add success message to conversation
            draft.add_message_to_conversation(
                "system",
                f"Document created successfully: {new_doc.name}",
                {"action": "document_created", "document_name": new_doc.name}
            )
            draft.save()
            
            return {
                "success": True,
                "document_name": new_doc.name,
                "message": f"{draft.target_doctype} '{new_doc.name}' created successfully"
            }
        
    except frappe.ValidationError as e:
        # Frappe validation errors - these are user-fixable
        return {
            "success": False,
            "error": f"Validation Error: {str(e)}"
        }
    except frappe.DuplicateEntryError as e:
        # Duplicate entry errors
        return {
            "success": False,
            "error": f"Duplicate Entry: {str(e)}"
        }
    except Exception as e:
        # Log unexpected errors
        frappe.log_error(f"Error creating document from draft", f"Draft ID: {draft_id}, Error: {str(e)}")
        return {
            "success": False,
            "error": f"Unexpected error: {str(e)}"
        }


def parse_and_validate_draft_data(target_doctype, draft_data):
    """Parse draft data and validate against doctype schema"""
    try:
        # Get doctype metadata
        meta = frappe.get_meta(target_doctype)
        
        parsed_data = {}
        validation_errors = []
        
        # Get all valid field names for this doctype
        valid_fields = {field.fieldname: field for field in meta.fields}
        valid_fields.update({
            'name': type('Field', (), {'fieldname': 'name', 'fieldtype': 'Data', 'reqd': 0})(),
            'owner': type('Field', (), {'fieldname': 'owner', 'fieldtype': 'Data', 'reqd': 0})(),
            'creation': type('Field', (), {'fieldname': 'creation', 'fieldtype': 'Datetime', 'reqd': 0})(),
            'modified': type('Field', (), {'fieldname': 'modified', 'fieldtype': 'Datetime', 'reqd': 0})(),
            'modified_by': type('Field', (), {'fieldname': 'modified_by', 'fieldtype': 'Data', 'reqd': 0})(),
            'docstatus': type('Field', (), {'fieldname': 'docstatus', 'fieldtype': 'Int', 'reqd': 0})(),
        })
        
        # Process each field in draft data
        for field_name, field_value in draft_data.items():
            if field_name in valid_fields:
                field_meta = valid_fields[field_name]
                
                # Skip system fields that shouldn't be set manually
                if field_name in ['name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus', 'doctype']:
                    continue
                
                # Validate and convert field value
                try:
                    converted_value = validate_and_convert_field_value(
                        field_meta, field_value, field_name
                    )
                    if converted_value is not None:
                        parsed_data[field_name] = converted_value
                except ValueError as e:
                    validation_errors.append(f"Field '{field_name}': {str(e)}")
            else:
                # Field doesn't exist in doctype
                validation_errors.append(f"Field '{field_name}' does not exist in {target_doctype}")
        
        # Check for required fields
        for field in meta.fields:
            if field.reqd and field.fieldname not in parsed_data:
                # Check if field has a default value
                if not field.default:
                    validation_errors.append(f"Required field '{field.fieldname}' is missing")
        
        return parsed_data, validation_errors
        
    except Exception as e:
        return {}, [f"Error parsing draft data: {str(e)}"]


def validate_and_convert_field_value(field_meta, field_value, field_name):
    """Validate and convert field value based on field type"""
    if field_value is None or field_value == "":
        return None
    
    field_type = field_meta.fieldtype
    
    try:
        # Convert based on field type
        if field_type in ['Data', 'Text', 'Small Text', 'Long Text', 'Text Editor']:
            return str(field_value).strip()
        
        elif field_type == 'Int':
            return int(float(str(field_value)))  # Handle "123.0" -> 123
        
        elif field_type in ['Float', 'Currency', 'Percent']:
            return float(field_value)
        
        elif field_type == 'Check':
            if isinstance(field_value, bool):
                return field_value
            return str(field_value).lower() in ['1', 'true', 'yes', 'on']
        
        elif field_type in ['Date', 'Datetime', 'Time']:
            # For now, return as string - Frappe will handle conversion
            return str(field_value)
        
        elif field_type == 'Link':
            # Validate that linked document exists
            link_doctype = field_meta.options
            if link_doctype and not frappe.db.exists(link_doctype, field_value):
                raise ValueError(f"Linked document '{field_value}' does not exist in {link_doctype}")
            return str(field_value)
        
        elif field_type == 'Select':
            # Validate against options
            if hasattr(field_meta, 'options') and field_meta.options:
                valid_options = [opt.strip() for opt in field_meta.options.split('\n') if opt.strip()]
                if valid_options and str(field_value) not in valid_options:
                    raise ValueError(f"Invalid option '{field_value}'. Valid options: {', '.join(valid_options)}")
            return str(field_value)
        
        else:
            # Default: return as string
            return str(field_value)
    
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid value '{field_value}' for {field_type} field: {str(e)}")


@frappe.whitelist()
def set_update_mode(draft_id, document_name, reason=""):
    """Switch wizard from create mode to update mode for an existing document"""
    try:
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        wizard_config = frappe.get_doc("Wizardz Configuration", draft.wizard_config)
        
        if not wizard_config.has_permission_for_user():
            frappe.throw(_("You don't have permission to modify this draft"))
        
        # Validate that the document exists
        if not frappe.db.exists(draft.target_doctype, document_name):
            return {
                "success": False,
                "error": f"{draft.target_doctype} '{document_name}' does not exist"
            }
        
        # Get the existing document data to populate the draft
        existing_doc = frappe.get_doc(draft.target_doctype, document_name)
        existing_data = existing_doc.as_dict()
        
        # Remove system fields that shouldn't be in draft
        system_fields = ['name', 'owner', 'creation', 'modified', 'modified_by', 'docstatus', 'idx', 'doctype']
        for field in system_fields:
            existing_data.pop(field, None)
        
        # Update draft with existing document data
        draft.update_draft_data(existing_data)
        draft.status = "Update Mode"
        
        # Store the target document name for updates
        draft.db_set("target_document", document_name)
        draft.save()
        
        # Add system message about mode switch
        draft.add_message_to_conversation(
            "system",
            f"Switched to update mode for {draft.target_doctype} '{document_name}'. {reason}",
            {"action": "set_update_mode", "document_name": document_name, "reason": reason}
        )
        draft.save()
        
        return {
            "success": True,
            "message": f"Switched to update mode for {draft.target_doctype} '{document_name}'",
            "document_name": document_name,
            "mode": "update",
            "existing_data": existing_data
        }
        
    except Exception as e:
        frappe.log_error(f"Error setting update mode", f"Draft ID: {draft_id}, Error: {str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def add_dependent_doctype(draft_id, doctype, dependency_reason, priority=1):
    """Add a dependent DocType that needs to be created before the main document"""
    try:
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        wizard_config = frappe.get_doc("Wizardz Configuration", draft.wizard_config)
        
        if not wizard_config.has_permission_for_user():
            frappe.throw(_("You don't have permission to modify this draft"))
        
        # Get current draft data
        current_data = draft.get_draft_data_dict()
        
        # Initialize multi-doctype structure if not exists
        if "_multi_doctype" not in current_data:
            current_data["_multi_doctype"] = {
                "dependencies": [],
                "creation_order": [],
                "doctypes": {}
            }
        
        # Add dependency if not already exists
        dependency_exists = any(
            dep["doctype"] == doctype 
            for dep in current_data["_multi_doctype"]["dependencies"]
        )
        
        if not dependency_exists:
            current_data["_multi_doctype"]["dependencies"].append({
                "doctype": doctype,
                "reason": dependency_reason,
                "priority": priority,
                "status": "pending"
            })
            
            # Initialize doctype data structure
            current_data["_multi_doctype"]["doctypes"][doctype] = {}
            
            # Update creation order
            current_data["_multi_doctype"]["creation_order"] = sorted(
                current_data["_multi_doctype"]["dependencies"],
                key=lambda x: x["priority"]
            )
        
        # Update draft with modified data
        draft.update_draft_data(current_data)
        draft.save()
        
        return {
            "success": True,
            "message": f"Added {doctype} as dependency: {dependency_reason}",
            "doctype": doctype,
            "priority": priority,
            "dependencies": current_data["_multi_doctype"]["dependencies"]
        }
        
    except Exception as e:
        frappe.log_error(f"Error adding dependent doctype", f"Draft ID: {draft_id}, Error: {str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def update_doctype_field(draft_id, doctype, field_name, field_value, action="update"):
    """Update a field for a specific DocType in the multi-doctype draft"""
    try:
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        wizard_config = frappe.get_doc("Wizardz Configuration", draft.wizard_config)
        
        if not wizard_config.has_permission_for_user():
            frappe.throw(_("You don't have permission to modify this draft"))
        
        # Get current draft data
        current_data = draft.get_draft_data_dict()
        
        # Initialize multi-doctype structure if not exists
        if "_multi_doctype" not in current_data:
            current_data["_multi_doctype"] = {
                "dependencies": [],
                "creation_order": [],
                "doctypes": {}
            }
        
        # Initialize doctype data if not exists
        if doctype not in current_data["_multi_doctype"]["doctypes"]:
            current_data["_multi_doctype"]["doctypes"][doctype] = {}
        
        # Update the specific doctype field
        doctype_data = current_data["_multi_doctype"]["doctypes"][doctype]
        
        if action == "remove":
            if field_name in doctype_data:
                del doctype_data[field_name]
                message = f"Removed {doctype}.{field_name}"
            else:
                message = f"Field {doctype}.{field_name} not found, nothing to remove"
        else:  # add or update
            doctype_data[field_name] = field_value
            action_word = "Added" if field_name not in doctype_data else "Updated"
            message = f"{action_word} {doctype}.{field_name} = '{field_value}'"
        
        # Update draft with modified data
        draft.update_draft_data(current_data)
        draft.save()
        
        return {
            "success": True,
            "message": message,
            "doctype": doctype,
            "field_name": field_name,
            "field_value": field_value if action != "remove" else None,
            "action": action,
            "doctype_data": doctype_data
        }
        
    except Exception as e:
        frappe.log_error(f"Error updating doctype field", f"Draft ID: {draft_id}, Error: {str(e)}")
        return {"success": False, "error": str(e)}


@frappe.whitelist()
def get_creation_order(draft_id):
    """Get the order in which DocTypes should be created based on dependencies"""
    try:
        draft = frappe.get_doc("Wizardz Draft", draft_id)
        wizard_config = frappe.get_doc("Wizardz Configuration", draft.wizard_config)
        
        if not wizard_config.has_permission_for_user():
            frappe.throw(_("You don't have permission to view this draft"))
        
        # Get current draft data
        current_data = draft.get_draft_data_dict()
        
        # Check if multi-doctype structure exists
        if "_multi_doctype" not in current_data:
            # Single doctype mode
            return {
                "success": True,
                "creation_order": [draft.target_doctype],
                "dependencies": [],
                "mode": "single"
            }
        
        # Multi-doctype mode
        multi_data = current_data["_multi_doctype"]
        creation_order = [dep["doctype"] for dep in multi_data.get("creation_order", [])]
        
        # Add main doctype at the end if not already included
        if draft.target_doctype not in creation_order:
            creation_order.append(draft.target_doctype)
        
        return {
            "success": True,
            "creation_order": creation_order,
            "dependencies": multi_data.get("dependencies", []),
            "mode": "multi",
            "doctypes_data": multi_data.get("doctypes", {})
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting creation order", f"Draft ID: {draft_id}, Error: {str(e)}")
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


@frappe.whitelist()
def get_draft_data(draft_id):
    """Get draft data with conversation history for resuming sessions"""
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
        frappe.log_error(f"Error getting draft data for resumption", f"Draft ID: {draft_id}, Error: {str(e)}")
        return {"success": False, "error": str(e)}
