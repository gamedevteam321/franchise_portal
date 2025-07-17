// Copyright (c) 2024, Nexchar Ventures and contributors
// For license information, please see license.txt

frappe.ui.form.on('Equipment Mapping', {
	refresh: function(frm) {
		// Add custom functionality here
	},
	
	company: function(frm) {
		// Handle company selection
	},
	
	equipment_type: function(frm) {
		// Show/hide relevant sections based on equipment type
		if (frm.doc.equipment_type === 'Electricity Meter') {
			frm.set_df_property('section_break_monitoring', 'hidden', 0);
			frm.set_df_property('section_break_weighbridge', 'hidden', 1);
			frm.set_df_property('section_break_laboratory', 'hidden', 1);
		} else if (frm.doc.equipment_type === 'Weighbridge') {
			frm.set_df_property('section_break_monitoring', 'hidden', 1);
			frm.set_df_property('section_break_weighbridge', 'hidden', 0);
			frm.set_df_property('section_break_laboratory', 'hidden', 1);
		} else if (frm.doc.equipment_type === 'Laboratory Equipment') {
			frm.set_df_property('section_break_monitoring', 'hidden', 1);
			frm.set_df_property('section_break_weighbridge', 'hidden', 1);
			frm.set_df_property('section_break_laboratory', 'hidden', 0);
		} else {
			frm.set_df_property('section_break_monitoring', 'hidden', 0);
			frm.set_df_property('section_break_weighbridge', 'hidden', 0);
			frm.set_df_property('section_break_laboratory', 'hidden', 0);
		}
	}
}); 