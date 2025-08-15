no # Wizardz API Reference

## Overview
This document provides a complete reference for the Wizardz framework API endpoints and DocType structures.

## DocTypes

### Wizardz Configuration
**Purpose**: Store wizard configurations for different DocTypes

**Key Fields**:
- `wizard_name` (Data) - Unique name for the wizard
- `target_doctype` (Link to DocType) - The DocType this wizard assists with
- `ai_model` (Select) - OpenAI model to use (gpt-4, gpt-4-turbo, etc.)
- `is_active` (Check) - Enable/disable the wizard
- `system_prompt` (Long Text) - Base instructions for the AI agent
- `field_instructions` (Long Text) - JSON structure with field-specific guidance

**Methods**:
- `has_permission_for_user(user=None)` - Check if user can use this wizard
- `get_target_doctype_schema()` - Get schema of the target doctype
- `get_field_instructions_dict()` - Return field instructions as dictionary

### Wizardz Draft
**Purpose**: Store draft DocType data and conversation history

**Key Fields**:
- `draft_name` (Data) - User-friendly name for the draft
- `wizard_config` (Link) - Associated wizard configuration
- `target_doctype` (Data) - The DocType being created
- `draft_data` (Long Text) - JSON structure of the draft doctype
- `conversation_history` (Long Text) - Complete chat history
- `status` (Select) - Draft, In Progress, Ready to Deploy, Deployed, Error
- `created_by` (Link to User) - User who created the draft

**Methods**:
- `add_message_to_conversation(type, content, metadata=None)` - Add message to history
- `update_draft_data(new_data)` - Update the draft structure
- `deploy_doctype()` - Convert draft to actual Frappe DocType
- `get_wizard_configuration()` - Get associated wizard config

### Wizardz Conversation
**Purpose**: Store individual chat messages (alternative to embedded history)

**Key Fields**:
- `wizard_draft` (Link) - Associated draft
- `message_type` (Select) - user, assistant, system, function_call, function_response
- `message_content` (Long Text) - The actual message
- `timestamp` (Datetime) - When the message was sent
- `metadata` (Long Text) - Additional context (JSON format)

**Static Methods**:
- `create_message(draft, type, content, metadata=None)` - Create new message
- `get_conversation_for_draft(draft, limit=50)` - Get messages for a draft

## API Endpoints

### Authentication
All endpoints require valid Frappe session and appropriate permissions.

### GET /api/method/wizardz.api.get_available_wizards
**Purpose**: Get list of active wizards accessible to current user

**Parameters**: None

**Returns**:
```json
[
  {
    "name": "wizard-id",
    "wizard_name": "Customer DocType Wizard",
    "target_doctype": "Customer",
    "ai_model": "gpt-4"
  }
]
```

### GET /api/method/wizardz.api.get_wizard_for_doctype
**Purpose**: Get wizard configuration for a specific DocType

**Parameters**:
- `doctype` (string) - The DocType name

**Returns**:
```json
{
  "name": "wizard-id",
  "wizard_name": "Customer DocType Wizard",
  "ai_model": "gpt-4",
  "system_prompt": "You are an AI assistant...",
  "field_instructions": "{\"customer_name\": \"Always required field\"}"
}
```

### POST /api/method/wizardz.api.start_wizard_session
**Purpose**: Initialize a new wizard session

**Parameters**:
- `wizard_config` (string) - Wizard configuration ID
- `draft_name` (string) - User-friendly name for the draft
- `target_doctype` (string) - The DocType being created

**Returns**:
```json
{
  "success": true,
  "draft_id": "WZRD-DRAFT-2025-00001",
  "message": "Wizard session started for Customer"
}
```

### POST /api/method/wizardz.api.send_message
**Purpose**: Send message to AI and get response

**Parameters**:
- `draft_id` (string) - The draft ID
- `message` (string) - User message
- `message_type` (string, optional) - Default: "user"

**Returns**:
```json
{
  "success": true,
  "response": "I understand you want to create a Customer DocType...",
  "draft_status": "In Progress"
}
```

### GET /api/method/wizardz.api.get_doctype_schema
**Purpose**: Get the schema of an existing DocType

**Parameters**:
- `doctype` (string) - The DocType name

**Returns**:
```json
{
  "name": "Customer",
  "module": "Selling",
  "fields": [
    {
      "fieldname": "customer_name",
      "fieldtype": "Data",
      "label": "Customer Name",
      "reqd": 1
    }
  ],
  "permissions": [...],
  "is_submittable": 0,
  "track_changes": 1
}
```

### POST /api/method/wizardz.api.save_draft_data
**Purpose**: Save draft DocType structure

**Parameters**:
- `draft_id` (string) - The draft ID
- `draft_data` (object/string) - The draft DocType structure

**Returns**:
```json
{
  "success": true,
  "message": "Draft data saved"
}
```

### GET /api/method/wizardz.api.get_draft_data
**Purpose**: Get draft DocType data and conversation

**Parameters**:
- `draft_id` (string) - The draft ID

**Returns**:
```json
{
  "success": true,
  "draft_data": {...},
  "conversation": [...],
  "status": "In Progress"
}
```

### GET /api/method/wizardz.api.get_user_drafts
**Purpose**: Get drafts created by current user

**Parameters**: None

**Returns**:
```json
[
  {
    "name": "WZRD-DRAFT-2025-00001",
    "draft_name": "My Customer DocType",
    "target_doctype": "Customer",
    "status": "In Progress",
    "modified": "2025-08-14 09:00:00"
  }
]
```

## Error Handling

All endpoints return consistent error format:
```json
{
  "success": false,
  "error": "Error message description"
}
```

Common error scenarios:
- **Permission Denied**: User doesn't have access to wizard or target DocType
- **Invalid Draft**: Draft ID not found or not accessible
- **AI API Error**: OpenAI API key not configured or API error
- **Validation Error**: Invalid JSON data or missing required fields

## Usage Examples

### Starting a Wizard Session
```javascript
// 1. Get available wizards
const wizards = await frappe.call({
  method: 'wizardz.api.get_available_wizards'
});

// 2. Start session with first wizard
const session = await frappe.call({
  method: 'wizardz.api.start_wizard_session',
  args: {
    wizard_config: wizards.message[0].name,
    draft_name: 'My New DocType',
    target_doctype: 'My Custom DocType'
  }
});

// 3. Send message to AI
const response = await frappe.call({
  method: 'wizardz.api.send_message',
  args: {
    draft_id: session.message.draft_id,
    message: 'I want to create a DocType for managing projects'
  }
});
```

### Deploying a Draft
```javascript
// Get the draft document
const draft = await frappe.get_doc('Wizardz Draft', draft_id);

// Deploy the DocType
const result = await frappe.call({
  method: 'deploy_doctype',
  doc: draft
});
```

## Security Considerations

1. **Permission Validation**: All endpoints validate user permissions for target DocTypes
2. **Data Sanitization**: JSON data is validated before storage
3. **API Key Security**: OpenAI API key stored in system settings (encrypted)
4. **User Isolation**: Users can only access their own drafts
5. **Audit Trail**: All conversations and actions are logged

## Integration with MCP Tools

The API is designed to work with MCP (Model Context Protocol) tools for enhanced Frappe integration:

- Use `frappe-server` MCP tools for DocType operations
- Leverage existing Frappe API patterns
- Maintain compatibility with Frappe's permission system
