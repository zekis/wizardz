// Wizardz Utilities - Shared utility functions
// Copyright (c) 2025, TierneyMorris Pty Ltd

frappe.provide('wizardz');

// Global wizard configurations cache
wizardz.configurations = wizardz.configurations || {};

// Shared utility function for checking wizard configurations
function checkForWizardConfiguration(doctype, callback) {
    // Check cache first
    if (wizardz.configurations[doctype] !== undefined) {
        const config = wizardz.configurations[doctype];
        callback(config !== null, config);
        return;
    }
    
    // Check for wizard configuration
    frappe.call({
        method: 'wizardz.api.get_wizard_for_doctype',
        args: { doctype: doctype },
        callback: function(response) {
            if (response.message) {
                wizardz.configurations[doctype] = response.message;
                callback(true, response.message);
            } else {
                wizardz.configurations[doctype] = null;
                callback(false, null);
            }
        },
        error: function() {
            wizardz.configurations[doctype] = null;
            callback(false, null);
        }
    });
}
