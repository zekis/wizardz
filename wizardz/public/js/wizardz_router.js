// Wizardz Router - Combined routing logic for both list and form views
// Copyright (c) 2025, TierneyMorris Pty Ltd

frappe.provide('wizardz');

// Reliable page change detection approach using Frappe's native router
$(document).ready(function() {
    // Wait for Frappe to be available
    function waitForFrappe() {
        if (typeof frappe !== 'undefined' && frappe.router) {
            // Use Frappe's native router event - much more reliable
            frappe.router.on("change", page_changed);
            
            // Also trigger on initial load
            page_changed();
            
            // Set up list view integration using events
            setupListViewIntegration();
            
            console.log('Wizardz: Router integration initialized');
        } else {
            // Retry after a short delay
            setTimeout(waitForFrappe, 100);
        }
    }
    
    waitForFrappe();
});

function page_changed(event) {
    // Wait for page to load completely
    frappe.after_ajax(function() {
        var route = frappe.get_route();
        
        // Check if route exists and has elements
        if (!route || !Array.isArray(route) || route.length === 0) {
            return;
        }
        
        // Handle Form views
        if (route[0] == "Form" && route[1]) {
            var doctype = route[1];
            
            // Set up form event handler for this specific doctype
            frappe.ui.form.on(doctype, {
                refresh: function(frm) {
                    // Only add to form views, not other views
                    if (!frm || !frm.doctype) return;
                    
                    // Check if this doctype has a wizard configuration
                    checkForWizardConfiguration(frm.doctype, function(hasWizard, config) {
                        console.log(`Wizardz: Wizard check for ${frm.doctype} - hasWizard: ${hasWizard}`);
                        if (hasWizard) {
                            try {
                                console.log(`Wizardz: About to call addAIAssistantButtonToForm for ${frm.doctype}`);
                                addAIAssistantButtonToForm(frm, config);
                                console.log(`Wizardz: addAIAssistantButtonToForm call completed`);
                            } catch (error) {
                                console.error(`Wizardz: Error calling addAIAssistantButtonToForm:`, error);
                                console.error(`Wizardz: Error stack:`, error.stack);
                            }
                        } else {
                            console.log(`Wizardz: No wizard configuration found for ${frm.doctype}`);
                        }
                    });
                }
            });
            
            console.log(`Wizardz: Form integration setup for ${doctype}`);
        }
        
        // List views are handled by the event-based system below
    });
}

function setupListViewIntegration() {
    // Method 1: Use the existing list_view_loaded event (primary method)
    $(document).on('list_view_loaded', function(e, list_view) {
        if (!list_view || !list_view.doctype) return;
        
        console.log(`Wizardz: List view loaded for ${list_view.doctype}`);
        
        checkForWizardConfiguration(list_view.doctype, function(hasWizard, config) {
            if (hasWizard) {
                addAIAssistantButtonToList(list_view, config);
            }
        });
    });
    
    // Method 2: Periodic check for list views (backup method)
    let listViewCheckInterval = setInterval(function() {
        // Check if we're on a list view page
        if (frappe.get_route && frappe.get_route()[0] === 'List' && frappe.get_route()[1]) {
            const doctype = frappe.get_route()[1];
            
            // Check if list view exists and hasn't been processed
            if (cur_list && cur_list.doctype === doctype) {
                // Avoid duplicate processing
                if (!cur_list.wizardz_processed) {
                    cur_list.wizardz_processed = true;
                    
                    console.log(`Wizardz: Periodic check found ${doctype} list view`);
                    
                    checkForWizardConfiguration(doctype, function(hasWizard, config) {
                        if (hasWizard) {
                            addAIAssistantButtonToList(cur_list, config);
                        }
                    });
                }
            }
        }
    }, 1000); // Check every second
    
    console.log('Wizardz: List view integration setup completed');
}

// Form view button integration
function addAIAssistantButtonToForm(frm, wizard_config) {
    console.log(`Wizardz: addAIAssistantButtonToForm called for ${frm.doctype}`);
    
    // Remove any existing buttons first to ensure we get the right mode
    if (frm.custom_buttons) {
        if (frm.custom_buttons['AI Create']) {
            frm.custom_buttons['AI Create'].remove();
            delete frm.custom_buttons['AI Create'];
            console.log(`Wizardz: Removed existing AI Create button`);
        }
        if (frm.custom_buttons['AI Update']) {
            frm.custom_buttons['AI Update'].remove();
            delete frm.custom_buttons['AI Update'];
            console.log(`Wizardz: Removed existing AI Update button`);
        }
        // Also remove old button names for backward compatibility
        if (frm.custom_buttons['AI Assistant']) {
            frm.custom_buttons['AI Assistant'].remove();
            delete frm.custom_buttons['AI Assistant'];
            console.log(`Wizardz: Removed existing AI Assistant button`);
        }
    }
    
    // Determine button text based on document state
    let buttonText = 'AI Create';
    let buttonAction = 'create';
    
    console.log(`Wizardz: Document detection - name: "${frm.doc.name}", __islocal: ${frm.doc.__islocal}, doctype: ${frm.doctype}`);
    
    // Check if this is an existing document (not new)
    if (frm.doc.name && 
        !frm.doc.__islocal && 
        frm.doc.name !== '__islocal' && 
        !frm.doc.name.startsWith('new-') &&
        frm.doc.name !== 'New ' + frm.doctype &&
        frm.doc.name.length > 0) {
        // Existing document - update mode
        buttonText = 'AI Update';
        buttonAction = 'update';
        console.log(`Wizardz: Detected existing document "${frm.doc.name}" - using update mode`);
    } else {
        console.log(`Wizardz: Detected new document - using create mode`);
    }
    
    // Add AI Assistant button as primary button to the form toolbar
    frm.add_custom_button(
        __(buttonText),
        function() {
            console.log(`Wizardz: Button clicked - action: ${buttonAction}, doctype: ${frm.doctype}, doc:`, frm.doc);
            openWizardModal(wizard_config, frm.doctype, frm.doc, buttonAction);
        }
        // No group parameter = primary button in toolbar
    );
    
    // Style the button with primary color and icon
    const button = frm.custom_buttons[buttonText];
    if (button) {
        button.addClass('btn-primary wizardz-ai-btn');
        button.prepend('<i class="fa fa-magic" style="margin-right: 5px;"></i>');
        
        if (buttonAction === 'update') {
            button.attr('title', `AI Assistant - Update this ${frm.doctype} record`);
        } else {
            button.attr('title', `AI Assistant - Create new ${frm.doctype} record`);
        }
    }
    
    console.log(`Wizardz: Added AI Assistant button to ${frm.doctype} form view (${buttonAction} mode)`);
}

// List view button integration
function addAIAssistantButtonToList(list_view, wizard_config) {
    // Check if list_view and required properties exist
    if (!list_view || !list_view.page || !list_view.page.add_inner_button) {
        console.log('Wizardz: List view or page object not ready yet');
        return;
    }
    
    // Check if button already exists
    if (list_view.page.$wrapper && list_view.page.$wrapper.find('.wizardz-ai-btn').length > 0) {
        return;
    }
    
    try {
        // Add AI Create button to the list view using the actual text
        list_view.page.add_inner_button(__('AI Create'), function() {
            openWizardModal(wizard_config, list_view.doctype, null, 'create');
        });
        
        // Find and style the button that was just added
        setTimeout(function() {
            // Find the button by the text
            let ai_button = null;
            
            // Method 1: Try page wrapper if available
            if (list_view.page && list_view.page.$wrapper) {
                ai_button = list_view.page.$wrapper.find('.btn:contains("AI Create")').first();
            }
            
            // Method 2: Try direct jQuery search on document if wrapper method failed
            if (!ai_button || ai_button.length === 0) {
                ai_button = $('.btn:contains("AI Create")').first();
            }
            
            if (ai_button && ai_button.length > 0) {
                // Add icon to the existing text
                ai_button.html('<i class="fa fa-magic" style="margin-right: 5px;"></i>AI Create');
                ai_button.addClass('btn-primary wizardz-ai-btn');
                ai_button.attr('title', `AI Create - Create new ${list_view.doctype}`);
                
                console.log(`Wizardz: Added AI Create button to ${list_view.doctype} list view`);
            } else {
                console.log(`Wizardz: Could not find AI Create button to style for ${list_view.doctype}`);
            }
        }, 300); // Increased delay to ensure button is fully rendered
        
    } catch (error) {
        console.log(`Wizardz: Error adding button to ${list_view.doctype} list view:`, error);
    }
}

// Unified modal opening function
function openWizardModal(wizard_config, doctype, doc = null, action = 'create') {
    console.log(`Wizardz: openWizardModal called with action: ${action}, doctype: ${doctype}`);
    // Create and show the wizard modal using the shared modal class
    const modal = new WizardzModal(wizard_config, doctype, doc, action);
    console.log(`Wizardz: Modal created with action: ${modal.action}`);
    modal.show();
}
