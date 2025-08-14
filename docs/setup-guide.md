# Wizardz Setup Guide

## Installation

1. **Install the Wizardz app in your Frappe site:**
   ```bash
   bench --site your-site install-app wizardz
   ```

2. **Configure OpenAI API Key:**
   - Go to **Wizardz Settings** in your Frappe desk
   - Add your OpenAI API key in the OpenAI API Key field
   - Configure other settings as needed (AI model, max tokens, temperature)
   - Save the settings

## Creating Your First Wizard

### Step 1: Create a Wizard Configuration

1. Go to **Wizardz Configuration** in your Frappe desk
2. Click **New**
3. Fill in the following details:

**Basic Information:**
- **Wizard Name**: `Customer DocType Assistant`
- **Target DocType**: `Customer` (or any DocType you want to create)
- **AI Model**: `gpt-5` (recommended, latest model)
- **Is Active**: ✓ (checked)

**AI Configuration:**
- **System Prompt**:
```
You are an AI assistant specialized in creating Frappe DocTypes. You help users design and create DocTypes by asking relevant questions about their business requirements and suggesting appropriate field types, validations, and relationships.

When helping create a DocType, always:
1. Ask about the business purpose and use case
2. Suggest appropriate field types (Data, Text, Link, Select, etc.)
3. Consider required fields and validations
4. Think about relationships with other DocTypes
5. Suggest appropriate permissions and workflows
6. Provide the final DocType structure in JSON format when ready

Be conversational, helpful, and ask clarifying questions to understand the user's needs.
```

- **Field Instructions** (JSON):
```json
{
  "customer_name": {
    "description": "Primary identifier for the customer",
    "required": true,
    "fieldtype": "Data",
    "suggestions": ["Make this a required field", "Consider adding validation for uniqueness"]
  },
  "customer_type": {
    "description": "Classification of customer (Individual/Company)",
    "fieldtype": "Select",
    "options": ["Individual", "Company"],
    "suggestions": ["This helps in different workflows and reporting"]
  },
  "email": {
    "description": "Primary email contact",
    "fieldtype": "Data",
    "suggestions": ["Add email validation", "Consider making this unique"]
  },
  "phone": {
    "description": "Primary phone contact",
    "fieldtype": "Data",
    "suggestions": ["Consider phone number format validation"]
  }
}
```

4. **Save** the configuration

### Step 2: Test the Wizard

1. Navigate to any DocType page in your Frappe desk (e.g., go to Customer list)
2. You should see an **AI Assistant** button in the toolbar
3. Click the button to open the wizard modal
4. Start chatting with the AI about creating your DocType

## Example Conversation Flow

**User**: "I want to create a DocType for managing projects in my company"

**AI**: "Great! I'd love to help you create a Project DocType. Let me ask a few questions to understand your requirements better:

1. What information do you need to track for each project?
2. Do projects have different statuses or stages?
3. Do you need to link projects to customers or other entities?
4. Will you be tracking team members or resources assigned to projects?"

**User**: "I need to track project name, description, start date, end date, status, assigned team members, and budget"

**AI**: "Perfect! Based on your requirements, I'll create a Project DocType with the following fields:
- Project Name (Data, Required)
- Description (Text Editor)
- Start Date (Date, Required)
- End Date (Date)
- Status (Select: Planning, In Progress, On Hold, Completed, Cancelled)
- Budget (Currency)
- Team Members (Table with links to User)

Would you like me to add any additional fields or modify these suggestions?"

## Advanced Configuration

### Custom Field Instructions

You can provide detailed instructions for specific fields in the Field Instructions JSON:

```json
{
  "field_name": {
    "description": "What this field represents",
    "fieldtype": "Suggested field type",
    "options": "For Select/Link fields",
    "required": true/false,
    "suggestions": ["Array of helpful suggestions"],
    "validation": "Validation rules to suggest",
    "relationships": "How this field relates to other DocTypes"
  }
}
```

### System Prompt Best Practices

1. **Be Specific**: Define the AI's role clearly
2. **Set Expectations**: Explain what the AI should do and how
3. **Include Context**: Mention Frappe-specific concepts and best practices
4. **Define Output Format**: Specify how the final DocType JSON should be structured

### Multiple Wizards

You can create multiple wizard configurations for different types of DocTypes:
- **Master Data Wizard**: For Customer, Supplier, Item, etc.
- **Transaction Wizard**: For Sales Order, Purchase Order, etc.
- **Configuration Wizard**: For settings and configuration DocTypes

## Troubleshooting

### Widget Not Appearing
1. Check if the wizard configuration is active
2. Verify the target DocType matches the current page
3. Ensure the user has create permissions for the target DocType
4. Check browser console for JavaScript errors

### AI Not Responding
1. Verify OpenAI API key is configured in System Settings
2. Check the Error Log for API-related errors
3. Ensure the selected AI model is available in your OpenAI account

### Permission Issues
1. Verify user has access to Wizardz Configuration DocType
2. Check if user has create permissions for the target DocType
3. Review role permissions for Wizardz Draft and Wizardz Conversation

## API Integration

For advanced users, you can integrate with the Wizardz API programmatically:

```javascript
// Get available wizards
const wizards = await frappe.call({
    method: 'wizardz.api.get_available_wizards'
});

// Start a wizard session
const session = await frappe.call({
    method: 'wizardz.api.start_wizard_session',
    args: {
        wizard_config: 'Customer DocType Assistant',
        draft_name: 'My Custom DocType',
        target_doctype: 'My DocType'
    }
});

// Send a message
const response = await frappe.call({
    method: 'wizardz.api.send_message',
    args: {
        draft_id: session.message.draft_id,
        message: 'Create a simple customer DocType'
    }
});
```

## Best Practices

1. **Start Simple**: Begin with basic DocTypes and gradually add complexity
2. **Test Thoroughly**: Always test the generated DocTypes before deploying to production
3. **Backup First**: Create backups before deploying new DocTypes
4. **User Training**: Train users on how to interact effectively with the AI
5. **Monitor Usage**: Keep track of wizard usage and success rates

## Support

For issues and questions:
1. Check the Error Log in Frappe
2. Review the API documentation in `docs/api-reference.md`
3. Examine the conversation history in Wizardz Draft documents
4. Contact support at support@sgcontrols.com.au
