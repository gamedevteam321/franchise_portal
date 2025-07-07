// List view customization for Franchise Signup Application

frappe.listview_settings['Franchise Signup Application'] = {
	// Add custom indicators for status
	add_fields: ['status', 'company_name', 'email', 'project_type'],
	
	// Custom list view formatting
	get_indicator: function(doc) {
		if (doc.status === 'Approved') {
			return [__('Approved'), 'green', 'status,=,Approved'];
		} else if (doc.status === 'Rejected') {
			return [__('Rejected'), 'red', 'status,=,Rejected'];
		} else if (doc.status === 'Submitted') {
			return [__('Pending Approval'), 'orange', 'status,=,Submitted'];
		} else if (doc.status === 'In Progress') {
			return [__('In Progress'), 'blue', 'status,=,In Progress'];
		} else if (doc.status === 'Draft') {
			return [__('Draft'), 'grey', 'status,=,Draft'];
		}
	},
	
	// Custom column formatting - simplified for better compatibility
	formatters: {
		company_name: function(value, field, doc) {
			return value || '';
		},
		status: function(value, field, doc) {
			let text = value || 'Draft';
			
			switch(value) {
				case 'Submitted':
					text = 'Pending Approval';
					break;
				default:
					text = value || 'Draft';
			}
			
			return text;
		},
		email: function(value, field, doc) {
			return value || '';
		}
	},
	
	// Hide standard indicator since we're using custom status formatting
	hide_name_column: false,
	
	// Custom refresh function
	refresh: function(listview) {
		// Add custom list view actions for bulk operations
		if (frappe.user.has_role(['Franchise Approval Admin', 'System Manager', 'Administrator'])) {
			// Add bulk approval option in the future if needed
			listview.page.add_action_item(__('Bulk Operations'), function() {
				frappe.msgprint(__('Bulk operations coming soon!'));
			});
		}
		
		// Set default sorting
		if (!listview.sort_by) {
			listview.sort_by = 'modified';
			listview.sort_order = 'desc';
		}
	},
	
	// Custom primary action
	primary_action: function() {
		frappe.new_doc('Franchise Signup Application');
	},
	
	// Custom row click action
	onload: function(listview) {
		// Add CSS for better list styling
		if (!$('#franchise-list-css').length) {
			$('head').append(`
				<style id="franchise-list-css">
					/* Better table styling */
					.list-row .list-row-col {
						border-right: 1px solid #f0f0f0;
						padding: 8px 12px;
					}
					
					/* Company name styling */
					.list-row .list-row-col:nth-child(2) {
						font-weight: 600;
						color: #333;
					}
					
					/* Status column styling */
					.list-row .list-row-col:nth-child(3) {
						font-weight: 500;
					}
					
					/* Email styling */
					.list-row .list-row-col:nth-child(4) {
						color: #007bff;
					}
					
					/* ID column styling */
					.list-row .list-row-col:nth-child(5) {
						font-family: monospace;
						font-size: 11px;
						color: #666;
					}
					
					/* Hover effects */
					.list-row:hover {
						background-color: #f8f9fa;
					}
				</style>
			`);
		}
	}
}; 