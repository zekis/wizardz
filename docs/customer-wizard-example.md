# Customer DocType Wizard Configuration Example

## Wizard Configuration Settings

**Wizard Name**: `Customer DocType Assistant`
**Target DocType**: `Customer`
**AI Model**: `gpt-5`
**Is Active**: ✓ (checked)

## System Prompt

```
You are an AI assistant specialized in helping users create Customer records in Frappe/ERPNext systems. You have access to the actual Customer DocType schema with field metadata (required fields, field types, options, etc.) and tools to save draft data as you collect information.

## Your Role & Capabilities:
- Access to the complete Customer DocType schema including field metadata
- Tools to save and retrieve draft data incrementally
- Understanding of field dependencies and validation requirements
- Knowledge of linked DocTypes that may need to be created first

## Available Information:
- **DocType Schema**: Complete field definitions with metadata (required, field types, options, descriptions)
- **Field Dependencies**: Understanding of which fields depend on others or linked records
- **Validation Rules**: Built-in field validation requirements
- **Available Tools**: save_draft_data, get_draft_data, get_doctype_schema

## Process Approach:
1. **Analyze Schema**: Use the provided Customer DocType schema to understand required fields and dependencies
2. **Check for Existing Records**: ALWAYS use search_documents to check if customer already exists before proceeding
3. **Identify Prerequisites**: Check if any linked DocTypes (Customer Group, Territory, etc.) need to be created first
4. **Collect Data Systematically**: Ask for information based on field requirements and dependencies
5. **Save Incrementally**: Use save_draft_data tool to save information as you collect it
6. **Validate Data**: Ensure collected data meets field requirements before saving
7. **Handle Links**: Guide user through creating linked records if needed

## Data Collection Strategy:
- Start with mandatory fields first
- Ask one question at a time to avoid overwhelming the user
- Use the schema to provide appropriate field options and validation
- Save data to draft after collecting each piece of information
- Provide helpful context based on field descriptions from schema

## Tool Usage - MANDATORY:
- **EVERY response MUST use a tool - no exceptions**
- **To ask questions**: Use ask_user tool
- **To search for duplicates**: Use search_documents tool
- **To save data**: Use save_draft_data tool
- **To get current data**: Use get_draft_data tool
- **Never respond without calling a tool**

## Critical Rules:
1. **NEVER provide a response without using a tool**
2. **Use ask_user tool for ALL questions to the user**
3. **Use search_documents before creating any new records**
4. **Use save_draft_data after collecting each piece of information**
5. **If you want to say something, use ask_user tool to say it**

## Data Collection Process:
1. Use search_documents to check for existing customers
2. Use ask_user to ask for information
3. Use save_draft_data to save collected data
4. Use ask_user to ask the next question
5. Repeat until complete

## Communication Style:
- ALL communication must go through ask_user tool
- Be conversational and helpful in your ask_user questions
- Reference actual field names and requirements from the schema
- Explain why information is needed in your ask_user calls

## CRITICAL: 
Every single response must include a tool call. There are no exceptions. If you want to ask a question, use ask_user. If you want to search, use search_documents. If you want to save data, use save_draft_data. Never respond with plain text.

Start by using ask_user tool to greet the user and ask for the customer's name.
```

## Field Instructions (JSON)

```json
{
  "customer_name": {
    "description": "Primary identifier for the customer - company name or individual's full name",
    "fieldtype": "Data",
    "required": true,
    "suggestions": [
      "Make this a required field",
      "Consider adding validation for uniqueness",
      "Use proper naming convention for auto-naming"
    ],
    "validation": "Unique validation recommended",
    "relationships": "Used in all customer-related transactions"
  },
  "customer_type": {
    "description": "Classification of customer as Individual or Company",
    "fieldtype": "Select",
    "options": ["Individual", "Company"],
    "required": true,
    "suggestions": [
      "This drives different field requirements",
      "Affects tax calculations and reporting",
      "Determines contact information structure"
    ]
  },
  "customer_group": {
    "description": "Categorization for pricing, discounts, and reporting",
    "fieldtype": "Link",
    "options": "Customer Group",
    "suggestions": [
      "Essential for pricing rules",
      "Used in sales analytics",
      "Helps in customer segmentation"
    ],
    "relationships": "Links to Customer Group master for pricing and permissions"
  },
  "territory": {
    "description": "Geographical or organizational territory assignment",
    "fieldtype": "Link",
    "options": "Territory",
    "suggestions": [
      "Important for sales team assignment",
      "Used in territory-based reporting",
      "Affects commission calculations"
    ],
    "relationships": "Links to Territory master for sales organization"
  },
  "email_id": {
    "description": "Primary email contact for the customer",
    "fieldtype": "Data",
    "suggestions": [
      "Add email validation",
      "Consider making this unique if required",
      "Used for automated communications"
    ],
    "validation": "Email format validation recommended"
  },
  "mobile_no": {
    "description": "Primary mobile phone number",
    "fieldtype": "Data",
    "suggestions": [
      "Consider phone number format validation",
      "Important for SMS communications",
      "May need country code handling"
    ],
    "validation": "Phone number format validation"
  },
  "website": {
    "description": "Customer's website URL",
    "fieldtype": "Data",
    "suggestions": [
      "Add URL validation",
      "Useful for B2B customers",
      "Can be used in customer research"
    ],
    "validation": "URL format validation"
  },
  "customer_primary_contact": {
    "description": "Link to primary contact person",
    "fieldtype": "Link",
    "options": "Contact",
    "suggestions": [
      "Links to Contact DocType",
      "Allows multiple contacts per customer",
      "Separates contact info from customer master"
    ],
    "relationships": "One-to-many relationship with Contact DocType"
  },
  "customer_primary_address": {
    "description": "Link to primary address",
    "fieldtype": "Link",
    "options": "Address",
    "suggestions": [
      "Links to Address DocType",
      "Allows multiple addresses per customer",
      "Separates address info from customer master"
    ],
    "relationships": "One-to-many relationship with Address DocType"
  },
  "account_manager": {
    "description": "Sales person or account manager assigned",
    "fieldtype": "Link",
    "options": "Sales Person",
    "suggestions": [
      "Important for sales tracking",
      "Used in commission calculations",
      "Helps in customer relationship management"
    ],
    "relationships": "Links to Sales Person master"
  },
  "credit_limit": {
    "description": "Maximum credit amount allowed for this customer",
    "fieldtype": "Currency",
    "suggestions": [
      "Important for credit control",
      "Used in sales order validation",
      "Can be company-specific"
    ],
    "validation": "Should be positive number"
  },
  "payment_terms": {
    "description": "Default payment terms for this customer",
    "fieldtype": "Link",
    "options": "Payment Terms Template",
    "suggestions": [
      "Sets default payment terms in transactions",
      "Important for cash flow management",
      "Can be overridden in individual transactions"
    ],
    "relationships": "Links to Payment Terms Template"
  },
  "customer_details": {
    "description": "Additional notes or details about the customer",
    "fieldtype": "Text Editor",
    "suggestions": [
      "Useful for storing additional context",
      "Can include special instructions",
      "Helps sales team with customer history"
    ]
  },
  "is_frozen": {
    "description": "Freeze customer to prevent new transactions",
    "fieldtype": "Check",
    "suggestions": [
      "Used to temporarily disable customer",
      "Prevents new sales orders/invoices",
      "Useful for credit control"
    ]
  },
  "disabled": {
    "description": "Permanently disable this customer",
    "fieldtype": "Check",
    "suggestions": [
      "Marks customer as inactive",
      "Hides from active customer lists",
      "Maintains historical data"
    ]
  }
}
```

## Usage Instructions

1. **Copy the System Prompt** above into the System Prompt field of your Wizardz Configuration
2. **Copy the Field Instructions JSON** into the Field Instructions field
3. **Set the Target DocType** to "Customer"
4. **Choose AI Model** (gpt-5 recommended)
5. **Save and Test** by navigating to the Customer DocType page

## Expected Conversation Flow

The AI will start by asking about:
- Your business type (B2B, B2C, or both)
- Customer categorization needs
- Required contact information
- Integration requirements
- Specific business workflows

Then guide you through creating a comprehensive Customer DocType with all necessary fields, validations, and relationships.
