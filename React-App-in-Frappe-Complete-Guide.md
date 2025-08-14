# Complete Guide: Implementing React Apps in Frappe

## Overview

This guide documents the complete process of implementing a React application within a Frappe framework, based on lessons learned from building the Synapse flow canvas application. It covers all critical aspects from initial setup to production deployment.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Initial Setup](#initial-setup)
3. [CSRF Token Management](#csrf-token-management)
4. [Frappe Integration](#frappe-integration)
5. [DocType Design](#doctype-design)
6. [API Layer](#api-layer)
7. [Frontend Architecture](#frontend-architecture)
8. [Common Pitfalls & Solutions](#common-pitfalls--solutions)
9. [Testing Strategy](#testing-strategy)
10. [Deployment Checklist](#deployment-checklist)

---

## Project Structure

### Recommended Directory Layout

```
your_app/
├── your_app/
│   ├── __init__.py
│   ├── hooks.py
│   ├── api.py                    # Custom API endpoints
│   ├── doctype/                  # Frappe DocTypes
│   │   ├── your_doctype/
│   │   │   ├── your_doctype.json
│   │   │   └── your_doctype.py
│   └── www/                      # Website routes
│       ├── your_app.html         # Main HTML template
│       └── your_app.py           # Website route handler
├── frontend/                     # React application
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── proxyOptions.js           # CRITICAL: Vite proxy config
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       ├── services/             # API integration layer
│       └── lib/
├── www/                          # Public website files
│   ├── your_app.html            # Public route template
│   └── your_app.py              # Public route handler
└── docs/                        # Documentation
```

---

## Initial Setup

### 1. Create Frappe App

```bash
# Create new Frappe app
bench new-app your_app_name

# Install app to site
bench --site your_site install-app your_app_name
```

### 2. Setup React Frontend

```bash
# Create React app with Vite + TypeScript
cd your_app_name
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install

# Install essential dependencies
npm install @xyflow/react frappe-react-sdk
npm install -D tailwindcss postcss autoprefixer
npm install lucide-react sonner
npm install @radix-ui/react-dialog @radix-ui/react-button
```

### 3. Configure Vite for Frappe Integration

**Critical File: `frontend/proxyOptions.js`**

```javascript
export default {
  '/api': {
    target: 'http://localhost:8000',
    changeOrigin: true,
    ws: true,
  },
  '/assets': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  },
  '/files': {
    target: 'http://localhost:8000',
    changeOrigin: true,
  }
};
```

**Critical File: `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import proxyOptions from './proxyOptions.js'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    proxy: proxyOptions
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

---

## CSRF Token Management

### The Critical Issue

**Problem**: Frappe requires CSRF tokens for all POST/PUT/DELETE requests, but React apps running on different ports don't automatically get these tokens.

**Solution**: Create a website route that injects Frappe context into your React app.

### 1. Website Route Handler

**File: `www/your_app.py`**

```python
import frappe

def get_context(context):
    # This makes Frappe boot data available to the frontend
    context.boot = frappe.sessions.get()
    return context
```

### 2. HTML Template with Context Injection

**File: `www/your_app.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your App</title>
    <script>
        // CRITICAL: Inject Frappe context before React loads
        window.frappe_boot = {{ boot | tojson }};
        window.frappeBootAvailable = true;
    </script>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="http://localhost:8080/src/main.tsx"></script>
</body>
</html>
```

### 3. React App CSRF Integration

**File: `frontend/src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import { FrappeProvider } from 'frappe-react-sdk'
import App from './App.tsx'
import './index.css'

// Wait for Frappe boot data to be available
const initializeApp = () => {
  if (window.frappeBootAvailable && window.frappe_boot) {
    const siteName = window.frappe_boot.sitename || window.location.hostname;
    
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <FrappeProvider
          siteName={siteName}
          url={window.location.origin}
        >
          <App />
        </FrappeProvider>
      </React.StrictMode>,
    )
  } else {
    // Retry if boot data not ready
    setTimeout(initializeApp, 100);
  }
};

initializeApp();
```

---

## DocType Design

### Key Principles

1. **Field Length Limits**: Be very careful with field lengths
2. **JSON Storage**: Use `Long Text` fields for JSON data
3. **Indexing**: Add indexes for frequently queried fields
4. **Permissions**: Set appropriate read/write permissions

### Example DocType: Canvas Workspace

**File: `your_app/doctype/canvas_workspace/canvas_workspace.json`**

```json
{
 "actions": [],
 "allow_rename": 1,
 "creation": "2024-01-01 00:00:00.000000",
 "doctype": "DocType",
 "engine": "InnoDB",
 "field_order": [
  "workspace_name",
  "workspace_id", 
  "canvas_data",
  "owner"
 ],
 "fields": [
  {
   "fieldname": "workspace_name",
   "fieldtype": "Data",
   "label": "Workspace Name",
   "length": 50,
   "reqd": 1
  },
  {
   "fieldname": "workspace_id", 
   "fieldtype": "Data",
   "label": "Workspace ID",
   "length": 50,
   "unique": 1
  },
  {
   "fieldname": "canvas_data",
   "fieldtype": "Long Text",
   "label": "Canvas Data"
  },
  {
   "fieldname": "owner",
   "fieldtype": "Link",
   "label": "Owner",
   "options": "User"
  }
 ],
 "index_web_pages_for_search": 1,
 "links": [],
 "modified": "2024-01-01 00:00:00.000000",
 "modified_by": "Administrator",
 "module": "Your App",
 "name": "Canvas Workspace",
 "owner": "Administrator",
 "permissions": [
  {
   "create": 1,
   "delete": 1,
   "email": 1,
   "export": 1,
   "print": 1,
   "read": 1,
   "report": 1,
   "role": "System Manager",
   "share": 1,
   "write": 1
  }
 ],
 "sort_field": "modified",
 "sort_order": "DESC"
}
```

### Critical Field Length Issue

**LESSON LEARNED**: Frappe has strict field length limits that aren't always obvious.

```python
# BAD: Will cause validation errors
"workspace_name": "This is a very long workspace name that exceeds the field limit"

# GOOD: Keep within defined limits
"workspace_name": "Short Name"  # Max 50 chars as defined in DocType
```

---

## API Layer

### 1. Custom API Endpoints

**File: `your_app/api.py`**

```python
import frappe
import json

@frappe.whitelist()
def get_workspace_list():
    """Get list of workspaces for current user"""
    workspaces = frappe.get_all(
        'Canvas Workspace',
        fields=['name', 'workspace_name', 'workspace_id', 'modified', 'owner'],
        order_by='modified desc'
    )
    return workspaces

@frappe.whitelist()
def save_workspace(workspace_name, canvas_data, workspace_id=None):
    """Save or update workspace"""
    try:
        if workspace_id:
            # Update existing
            doc = frappe.get_doc('Canvas Workspace', workspace_id)
            doc.workspace_name = workspace_name
            doc.canvas_data = canvas_data
            doc.save()
        else:
            # Create new
            doc = frappe.get_doc({
                'doctype': 'Canvas Workspace',
                'workspace_name': workspace_name,
                'workspace_id': frappe.generate_hash(length=10),
                'canvas_data': canvas_data
            })
            doc.insert()
        
        return {
            'success': True,
            'workspace_id': doc.workspace_id,
            'name': doc.name
        }
    except Exception as e:
        frappe.log_error(f"Error saving workspace: {str(e)}")
        return {'success': False, 'error': str(e)}
```

### 2. React Service Layer

**File: `frontend/src/services/workspaceService.ts`**

```typescript
import { useFrappeGetCall, useFrappeCreateDoc, useFrappeUpdateDoc, useFrappeGetDoc } from 'frappe-react-sdk';

// Custom hook for workspace operations
export function useWorkspaceOperations() {
  const saveWorkspace = async (workspaceName: string, canvasData: string, workspaceId?: string) => {
    const response = await fetch('/api/method/your_app.api.save_workspace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Frappe-CSRF-Token': window.frappe_boot?.csrf_token || '',
      },
      body: JSON.stringify({
        workspace_name: workspaceName,
        canvas_data: canvasData,
        workspace_id: workspaceId
      })
    });
    
    const result = await response.json();
    if (!result.message?.success) {
      throw new Error(result.message?.error || 'Failed to save workspace');
    }
    
    return result.message;
  };

  return { saveWorkspace };
}

// Hook for listing workspaces
export function useWorkspaceList() {
  const { data, error, isLoading, mutate } = useFrappeGetCall<any[]>(
    'your_app.api.get_workspace_list'
  );

  return {
    workspaces: data || [],
    error,
    isLoading,
    refetch: mutate
  };
}
```

---

## Frontend Architecture

### 1. Component Structure

```
src/
├── components/
│   ├── Canvas/
│   │   ├── FlowCanvas.tsx           # Main canvas component
│   │   ├── NodeTypes/
│   │   │   ├── TextNode.tsx
│   │   │   └── DocNode.tsx
│   │   └── Dialogs/
│   │       ├── WorkspaceSelector.tsx
│   │       └── DocumentSelector.tsx
│   ├── ui/                          # Reusable UI components
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── card.tsx
├── services/                        # API integration
│   ├── workspaceService.ts
│   └── documentService.ts
├── lib/
│   └── utils.ts                     # Utility functions
└── types/                           # TypeScript definitions
    └── index.ts
```

### 2. State Management Pattern

```typescript
// Use React Flow's built-in state management for canvas
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

// Use custom hooks for Frappe integration
const { saveWorkspace } = useWorkspaceOperations();
const { workspaces, refetch } = useWorkspaceList();

// Callback pattern for parent-child communication
const handleDeleteNode = useCallback((nodeId: string) => {
  setNodes((nds) => nds.filter(node => node.id !== nodeId));
  toast.success('Node deleted');
}, [setNodes]);

// Pass callbacks to child components
const newNode = {
  id: `doc-${Date.now()}`,
  data: { 
    ...nodeData,
    onDelete: handleDeleteNode  // Callback for child to parent communication
  }
};
```

---

## Common Pitfalls & Solutions

### 1. CSRF Token Issues

**Problem**: 403 Forbidden errors on API calls

**Solution**: 
- Ensure website route injects boot data
- Include CSRF token in all requests
- Use `frappe-react-sdk` which handles this automatically

### 2. Field Length Validation Errors

**Problem**: "Value too long for field" errors

**Solution**:
- Check DocType field definitions carefully
- Use appropriate field types (`Long Text` for JSON)
- Validate data length before saving

### 3. Proxy Configuration Issues

**Problem**: API calls fail in development

**Solution**:
- Configure Vite proxy correctly
- Ensure all Frappe routes are proxied
- Test proxy configuration thoroughly

### 4. State Management Complexity

**Problem**: Complex state updates and re-renders

**Solution**:
- Use React Flow's built-in state management
- Implement callback patterns for component communication
- Use custom hooks for Frappe integration

### 5. TypeScript Errors in Development

**Problem**: TypeScript compilation errors

**Solution**:
- These are often development environment issues
- Focus on runtime functionality
- Use proper type definitions where possible

---

## Testing Strategy

### 1. Development Testing

```bash
# Start Frappe development server
bench start

# Start React development server (separate terminal)
cd frontend
npm run dev

# Test in browser at: http://localhost:8000/your_app
```

### 2. Key Test Cases

1. **CSRF Token Validation**
   - Verify boot data injection
   - Test API calls with authentication
   - Confirm CSRF tokens are included

2. **Data Persistence**
   - Create, read, update, delete operations
   - Field length validation
   - JSON serialization/deserialization

3. **User Interface**
   - Component rendering
   - State management
   - User interactions

### 3. Production Testing

```bash
# Build React app
cd frontend
npm run build

# Test production build
bench --site your_site serve --port 8000
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All DocTypes created and migrated
- [ ] API endpoints tested and working
- [ ] CSRF token integration verified
- [ ] React app builds without errors
- [ ] All dependencies installed
- [ ] Database migrations completed

### Production Build

```bash
# Build React application
cd frontend
npm run build

# Copy build files to Frappe public directory
cp -r dist/* ../www/

# Update HTML template to use built files
# Replace development script tag with production build references
```

### Post-Deployment

- [ ] Website routes accessible
- [ ] API endpoints responding correctly
- [ ] User authentication working
- [ ] Data persistence functioning
- [ ] Error handling working properly

---

## Performance Considerations

### 1. Bundle Size Optimization

```javascript
// Use dynamic imports for large components
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Optimize React Flow performance
const nodeTypes = useMemo(() => ({
  textNode: TextNode,
  docNode: DocNode,
}), []);
```

### 2. API Optimization

```python
# Use efficient database queries
frappe.get_all(
    'Canvas Workspace',
    fields=['name', 'workspace_name', 'modified'],  # Only needed fields
    filters={'owner': frappe.session.user},         # Filter at database level
    limit=50                                        # Limit results
)
```

### 3. Caching Strategy

```typescript
// Use SWR for caching API responses
const { data, error, mutate } = useFrappeGetCall(
  'your_app.api.get_workspace_list',
  undefined,
  {
    revalidateOnFocus: false,
    dedupingInterval: 60000  // Cache for 1 minute
  }
);
```

---

## Security Considerations

### 1. API Security

```python
@frappe.whitelist()
def secure_api_endpoint():
    # Always validate user permissions
    if not frappe.has_permission('Canvas Workspace', 'read'):
        frappe.throw('Insufficient permissions')
    
    # Validate input data
    data = frappe.local.form_dict
    if not data.get('required_field'):
        frappe.throw('Missing required field')
    
    # Use parameterized queries
    results = frappe.db.sql("""
        SELECT name FROM `tabCanvas Workspace` 
        WHERE owner = %s
    """, (frappe.session.user,))
    
    return results
```

### 2. Frontend Security

```typescript
// Sanitize user input
const sanitizeInput = (input: string) => {
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
};

// Validate data before sending to API
const validateWorkspaceName = (name: string) => {
  if (name.length > 50) {
    throw new Error('Workspace name too long');
  }
  return sanitizeInput(name);
};
```

---

## Troubleshooting Guide

### Common Error Messages

1. **"CSRF Token Missing"**
   - Check website route context injection
   - Verify boot data availability
   - Ensure CSRF token in request headers

2. **"Value too long for field"**
   - Check DocType field length definitions
   - Validate data before saving
   - Consider using Long Text fields

3. **"Permission Denied"**
   - Check DocType permissions
   - Verify user roles
   - Test with System Manager role first

4. **"Module not found"**
   - Check import paths
   - Verify file locations
   - Ensure proper TypeScript configuration

### Debug Tools

```javascript
// Add to React app for debugging
console.log('Frappe Boot Available:', window.frappeBootAvailable);
console.log('Frappe Boot Data:', window.frappe_boot);
console.log('CSRF Token:', window.frappe_boot?.csrf_token);
```

---

## Conclusion

This guide provides a comprehensive foundation for implementing React applications within Frappe. The key to success is:

1. **Proper CSRF token management** through website routes
2. **Careful DocType design** with appropriate field lengths
3. **Clean separation** between Frappe backend and React frontend
4. **Thorough testing** of the integration points

Following this guide should eliminate most common issues and provide a solid foundation for building complex React applications within the Frappe ecosystem.

---

## Additional Resources

- [Frappe Framework Documentation](https://frappeframework.com/docs)
- [React Flow Documentation](https://reactflow.dev/)
- [frappe-react-sdk Documentation](https://github.com/netchampfaris/frappe-react-sdk)
- [Vite Configuration Guide](https://vitejs.dev/config/)

---

*Last Updated: January 2024*
*Based on: Synapse Flow Canvas Application Implementation*
