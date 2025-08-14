# Customer DocType Wizard Configuration Example

## Wizard Configuration Settings

**Wizard Name**: `Customer DocType Assistant`
**Target DocType**: `Customer`
**AI Model**: `gpt-5`
**Is Active**: ✓ (checked)

## System Prompt (Optional - Additional Instructions)

The system now automatically generates most of the AI prompt based on the target DocType. You only need to provide additional, specific instructions for your use case. The base prompt already includes:

- Complete DocType schema understanding
- All available tools and their usage
- JSON format requirements
- Duplicate checking logic
- Create/Update mode handling
- Field validation and data collection strategies

**Example Additional Instructions:**
```
Focus on B2B customers and emphasize collecting:
- Company registration details
- Primary contact information
- Credit terms and payment preferences
- Territory assignment for sales team routing

For individual customers, prioritize:
- Personal contact details
- Preferred communication methods
- Customer segmentation for marketing

Always validate email addresses and phone numbers before saving.
```

**Or leave blank** - the system will work perfectly with just the auto-generated prompt!

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
