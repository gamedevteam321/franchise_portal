// Copyright (c) 2024, Nexchar Ventures and contributors
// For license information, please see license.txt

frappe.ui.form.on('Sustainability Mapping', {
	refresh: function(frm) {
		// Add custom functionality here
	},
	
	company: function(frm) {
		// Handle company selection
	},
	
	fuel_type: function(frm) {
		// Show/hide other fuel type field
		if (frm.doc.fuel_type === 'Other') {
			frm.set_df_property('fuel_type_other', 'hidden', 0);
		} else {
			frm.set_df_property('fuel_type_other', 'hidden', 1);
		}
	},
	
	drying_method: function(frm) {
		// Show/hide other drying method field
		if (frm.doc.drying_method === 'Other') {
			frm.set_df_property('drying_method_other', 'hidden', 0);
		} else {
			frm.set_df_property('drying_method_other', 'hidden', 1);
		}
	},
	
	energy_source: function(frm) {
		// Show/hide other energy source field
		if (frm.doc.energy_source === 'Other') {
			frm.set_df_property('energy_source_other', 'hidden', 0);
		} else {
			frm.set_df_property('energy_source_other', 'hidden', 1);
		}
	}
}); 