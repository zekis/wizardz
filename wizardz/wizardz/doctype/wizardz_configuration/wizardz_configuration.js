// Copyright (c) 2025, TierneyMorris Pty Ltd and contributors
// For license information, please see license.txt

frappe.ui.form.on('Wizardz Configuration', {
    refresh: function(frm) {
        // Add Test Wizard button
        if (!frm.doc.__islocal && frm.doc.is_active) {
            frm.add_custom_button(__('Test Wizard'), function() {
                test_wizard(frm);
            }, __('Actions'));
        }
    }
});

function test_wizard(frm) {
    // Call the test_wizard method
    frappe.call({
        method: 'test_wizard',
        doc: frm.doc,
        callback: function(response) {
            if (response.message && response.message.success) {
                // Open the wizard modal directly
                open_wizard_modal(response.message.wizard_config, response.message.target_doctype);
            } else {
                frappe.msgprint(__('Error testing wizard'));
            }
        }
    });
}

function open_wizard_modal(wizardConfig, doctype) {
    // Load the wizard widget script if not already loaded
    if (typeof WizardzModal === 'undefined') {
        // Load the widget script
        frappe.require('/assets/wizardz/js/wizardz_widget.js', function() {
            create_and_show_modal(wizardConfig, doctype);
        });
    } else {
        create_and_show_modal(wizardConfig, doctype);
    }
}

function create_and_show_modal(wizardConfig, doctype) {
    // Create and show the wizard modal
    const modal = new WizardzModal(wizardConfig, doctype);
    modal.show();
}
