# Wizardz - Frappe Document Wizard Framework

## Project Overview
AI-powered assistant framework for creating Frappe DocTypes. Embeds a widget on Frappe desk pages that provides an AI assistant for creating new doctypes with intelligent field suggestions and validation.

## Current Status
**Phase 1: Core DocTypes & Data Structure** - ✅ COMPLETED
**Phase 2: API Layer** - ✅ COMPLETED
**Phase 3: Frontend Widget System** - ✅ COMPLETED
**Ready for Testing** - Initial UI and backend complete

## Architecture

### Core Components
1. **Core DocTypes** - ✅ Store wizard configurations and AI conversation data
2. **AI Integration Layer** - ✅ OpenAI API with conversation management  
3. **Frontend Widget System** - 🔄 Overlays on Frappe desk pages
4. **Real-time Communication** - 🔄 Uses Frappe's socket system
5. **AI Agent Tools** - 🔄 Interact with Frappe's doctype system

### DocTypes Created ✅
- `Wizardz Configuration` - Main wizard configuration with AI model selection
- `Wizardz Draft` - Draft doctype storage with conversation history and deployment
- `Wizardz Conversation` - Individual chat messages with metadata
- `Wizardz Settings` - Centralized settings for OpenAI API key and AI configuration

### API Endpoints Created ✅
- `get_available_wizards()` - List accessible wizards for current user
- `get_wizard_for_doctype()` - Get wizard config for specific doctype
- `start_wizard_session()` - Initialize new wizard session
- `send_message()` - Process user messages and get AI responses
- `get_doctype_schema()` - Retrieve existing doctype structure
- `save_draft_data()` / `get_draft_data()` - Manage draft data
- `get_user_drafts()` - List user's draft sessions

### Technical Stack
- **Backend**: Frappe v15, Python
- **Frontend**: React (following existing React integration guide)
- **AI**: OpenAI with model selection
- **Real-time**: Frappe's built-in socket system
- **Permissions**: Standard Frappe permission system

### Key Features
- **Context-Aware AI**: Access to existing doctype schemas, linked doctypes, child tables
- **Live Preview**: Real-time preview of doctype being created
- **Draft System**: Save and resume wizard sessions
- **Permission Integration**: Respects Frappe's existing security model
- **Model Selection**: Choose between different OpenAI models

## Development Approach
- Incremental development with minimal blast radius
- Test each component before proceeding
- Start with backend/API, then frontend widget
- Follow Frappe best practices for DocType design

## File Structure
```
wizardz/
├── api.py                       # Custom API endpoints (FIXED LOCATION)
├── hooks.py                     # Frappe hooks
├── wizardz/
│   └── doctype/
│       ├── wizardz_configuration/
│       ├── wizardz_draft/
│       ├── wizardz_conversation/
│       └── wizardz_settings/
├── public/
│   ├── js/wizardz_widget.js     # Widget injection scripts
│   └── css/wizardz_widget.css   # Widget styling
├── www/
│   ├── wizard.html              # Widget launcher page (future)
│   └── wizard.py                # Context injection (future)
└── docs/                        # Documentation
```

## Next Steps
1. Create core DocTypes with wizardz_ prefix
2. Implement basic API endpoints
3. Test DocType creation and data flow
4. Build widget injection system
5. Implement React modal interface
6. Add real-time communication
7. Integrate AI agent tools

## Testing Strategy
- Test DocType creation and field validation
- Verify API endpoints with proper CSRF handling
- Test widget injection on different Frappe pages
- Validate AI conversation flow
- Test draft save/resume functionality

## Dependencies
- frappe-react-sdk (for React integration)
- OpenAI API access
- Frappe v15 framework
- Standard web technologies (React, TypeScript, Tailwind)

## Notes
- All DocTypes prefixed with `wizardz_` to avoid conflicts
- Following established React integration patterns from existing guide
- Using MCP frappe-server tools for Frappe API integration
- Designed for easy extension with additional AI models
