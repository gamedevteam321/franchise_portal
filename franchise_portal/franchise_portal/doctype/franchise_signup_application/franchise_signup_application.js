// Copyright (c) 2024, Nexchar Ventures and contributors
// For license information, please see license.txt

frappe.ui.form.on('Franchise Signup Application', {
	refresh: function(frm) {
		// Custom handling for file fields to prevent 403 errors
		handleFileFields(frm);
		
		// Add custom download buttons for file fields
		addFileDownloadButtons(frm);
		
		// Add custom buttons based on status and user permissions
		if (frm.doc.status === 'Submitted' && !frm.doc.__islocal) {
			add_approval_buttons(frm);
		}
		
		// Add status indicator
		add_status_indicator(frm);
		
		// Make read-only if approved or rejected
		if (frm.doc.status === 'Approved' || frm.doc.status === 'Rejected') {
			frm.disable_form();
		}
	},
	
	status: function(frm) {
		// Update form when status changes
		add_status_indicator(frm);
	}
});

function handleFileFields(frm) {
	// List of file fields in the DocType
	const fileFields = [
		'feedstock_payment_file',
		'chain_of_custody_file', 
		'supplier_agreements_file',
		'origin_certificates_file',
		'transportation_records_file',
		'environmental_permits_file',
		'market_leakage_study_file'
	];
	
	fileFields.forEach(fieldName => {
		const field = frm.get_field(fieldName);
		if (field && field.$wrapper) {
			// Find any existing file links
			const fileLinks = field.$wrapper.find('a[href*="/private/files/"]');
			
			fileLinks.each(function() {
				const link = $(this);
				const originalHref = link.attr('href');
				
				if (originalHref && !originalHref.includes('fid=')) {
					// Prevent default click behavior
					link.off('click').on('click', function(e) {
						e.preventDefault();
						e.stopPropagation();
						
						// Show custom download dialog
						showFileDownloadDialog(originalHref, link.text());
					});
					
					// Change appearance to indicate it's handled
					link.css({
						'color': '#667eea',
						'cursor': 'pointer'
					});
					
					// Add download icon
					if (!link.find('.fa-download').length) {
						link.append(' <i class="fa fa-download" style="margin-left: 5px;"></i>');
					}
				}
			});
		}
	});
}

function addFileDownloadButtons(frm) {
	// List of file fields with their labels
	const fileFields = [
		{field: 'feedstock_payment_file', label: 'Payment Documentation'},
		{field: 'chain_of_custody_file', label: 'Chain of Custody Protocol'},
		{field: 'supplier_agreements_file', label: 'Supplier Agreements'},
		{field: 'origin_certificates_file', label: 'Origin Certificates'},
		{field: 'transportation_records_file', label: 'Transportation Records'},
		{field: 'environmental_permits_file', label: 'Environmental Permits'},
		{field: 'market_leakage_study_file', label: 'Market Leakage Study'}
	];
	
	fileFields.forEach(({field, label}) => {
		const fileUrl = frm.doc[field];
		if (fileUrl) {
			// Add custom button for each file
			frm.add_custom_button(`Download ${label}`, function() {
				downloadFileWithAuth(fileUrl, label);
			}, __('File Downloads'));
		}
	});
}

function showFileDownloadDialog(fileUrl, fileName) {
	// Create a dialog for file download options
	const dialog = new frappe.ui.Dialog({
		title: 'File Download Options',
		fields: [
			{
				fieldtype: 'HTML',
				fieldname: 'download_info',
				options: `
					<div style="padding: 20px; text-align: center;">
						<div style="margin-bottom: 20px;">
							<i class="fa fa-file-o" style="font-size: 48px; color: #667eea; margin-bottom: 15px;"></i>
							<h4>${fileName || 'File'}</h4>
						</div>
						<div style="margin-bottom: 20px;">
							<button class="btn btn-primary btn-sm" onclick="downloadFileWithAuth('${fileUrl}', '${fileName}')">
								<i class="fa fa-download"></i> Download File
							</button>
						</div>
						<div style="font-size: 12px; color: #666;">
							Click "Download File" to securely download this file
						</div>
					</div>
				`
			}
		],
		primary_action_label: 'Close',
		primary_action: function() {
			dialog.hide();
		}
	});
	
	dialog.show();
}

function downloadFileWithAuth(fileUrl, fileName) {
	console.log('Attempting to download file:', fileName, 'URL:', fileUrl);
	
	// Show loading message
	frappe.show_alert({
		message: 'Starting download...',
		indicator: 'blue'
	});
	
	try {
		// For private files, try to find the File record and use proper download endpoint
		if (fileUrl.includes('/private/files/')) {
			// Extract filename from URL
			let filename = fileUrl.split('/').pop().split('?')[0];
			
			// Use Frappe's file download API
			frappe.call({
				method: 'frappe.core.doctype.file.file.download_file',
				args: {
					file_url: fileUrl.replace(window.location.origin, '')
				},
				callback: function(response) {
					if (response.message) {
						// Create download link
						const link = document.createElement('a');
						link.href = fileUrl;
						link.download = filename;
						link.style.display = 'none';
						document.body.appendChild(link);
						link.click();
						document.body.removeChild(link);
						
						frappe.show_alert({
							message: 'Download started!',
							indicator: 'green'
						});
					}
				},
				error: function() {
					// Fallback: try direct download
					window.open(fileUrl, '_blank');
				}
			});
		} else {
			// For non-private files, direct download
			const link = document.createElement('a');
			link.href = fileUrl;
			link.download = fileName || 'file';
			link.style.display = 'none';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			
			frappe.show_alert({
				message: 'Download started!',
				indicator: 'green'
			});
		}
	} catch (error) {
		console.error('Download error:', error);
		frappe.show_alert({
			message: 'Download failed. Please try again.',
			indicator: 'red'
		});
	}
}

// Make download function globally available
window.downloadFileWithAuth = downloadFileWithAuth;

function add_approval_buttons(frm) {
	// Check if user has permission to approve  
	const user_roles = frappe.user_roles || [];
	const can_approve = user_roles.includes('Franchise Approval Admin') || 
	                   user_roles.includes('System Manager') || 
	                   user_roles.includes('Administrator');
	
	if (can_approve) {
		// Add Approve Button
		frm.add_custom_button(__('Approve'), function() {
			show_approval_dialog(frm);
		}, __('Actions')).addClass('btn-success');
		
		// Add Reject Button  
		frm.add_custom_button(__('Reject'), function() {
			show_rejection_dialog(frm);
		}, __('Actions')).addClass('btn-danger');
	}
	
	// Debug logging
	console.log('User roles:', user_roles);
	console.log('Can approve:', can_approve);
}

function show_approval_dialog(frm) {
	let dialog = new frappe.ui.Dialog({
		title: __('Approve Franchise Application'),
		fields: [
			{
				fieldtype: 'Small Text',
				fieldname: 'comments',
				label: __('Approval Comments'),
				description: __('Optional comments about the approval')
			}
		],
		primary_action_label: __('Approve Application'),
		primary_action: function(values) {
			frappe.show_alert({
				message: __('Processing approval...'),
				indicator: 'blue'
			});
			
			frappe.call({
				method: 'approve_application',
				doc: frm.doc,
				args: {
					comments: values.comments
				},
				freeze: true,
				freeze_message: __('Approving application and creating company/user...'),
				callback: function(r) {
					if (r.message && r.message.success) {
						dialog.hide();
						frm.reload_doc();
						
						frappe.show_alert({
							message: __('Application approved successfully!'),
							indicator: 'green'
						}, 5);
						
						// Show success details
						frappe.msgprint({
							title: __('Approval Successful'),
							message: `
								<div style="color: green;">
									<p><strong>✅ Application approved successfully!</strong></p>
									<p>📋 <strong>Company created:</strong> ${r.message.company_name}</p>
									<p>👤 <strong>User created:</strong> ${r.message.user_email}</p>
									<p>📧 Notification emails have been sent.</p>
								</div>
							`,
							indicator: 'green'
						});
					} else {
						frappe.msgprint({
							title: __('Approval Failed'),
							message: r.message?.message || __('Failed to approve application'),
							indicator: 'red'
						});
					}
				},
				error: function(r) {
					frappe.msgprint({
						title: __('Error'),
						message: r.message || __('An error occurred while approving the application'),
						indicator: 'red'
					});
				}
			});
		}
	});
	
	dialog.show();
}

function show_rejection_dialog(frm) {
	let dialog = new frappe.ui.Dialog({
		title: __('Reject Franchise Application'),
		fields: [
			{
				fieldtype: 'Small Text',
				fieldname: 'reason',
				label: __('Rejection Reason'),
				reqd: 1,
				description: __('Please provide a reason for rejection')
			}
		],
		primary_action_label: __('Reject Application'),
		primary_action: function(values) {
			if (!values.reason) {
				frappe.msgprint(__('Please provide a reason for rejection'));
				return;
			}
			
			frappe.show_alert({
				message: __('Processing rejection...'),
				indicator: 'orange'
			});
			
			frappe.call({
				method: 'reject_application',
				doc: frm.doc,
				args: {
					reason: values.reason
				},
				freeze: true,
				freeze_message: __('Rejecting application...'),
				callback: function(r) {
					if (r.message && r.message.success) {
						dialog.hide();
						frm.reload_doc();
						
						frappe.show_alert({
							message: __('Application rejected'),
							indicator: 'orange'
						}, 5);
						
						frappe.msgprint({
							title: __('Rejection Successful'),
							message: __('Application has been rejected and notifications sent.'),
							indicator: 'orange'
						});
					} else {
						frappe.msgprint({
							title: __('Rejection Failed'),
							message: r.message?.message || __('Failed to reject application'),
							indicator: 'red'
						});
					}
				},
				error: function(r) {
					frappe.msgprint({
						title: __('Error'),
						message: r.message || __('An error occurred while rejecting the application'),
						indicator: 'red'
					});
				}
			});
		}
	});
	
	dialog.show();
}

function add_status_indicator(frm) {
	// Add colored status indicators
	if (frm.doc.status) {
		let color = 'blue';
		let message = frm.doc.status;
		
		switch(frm.doc.status) {
			case 'Draft':
				color = 'gray';
				break;
			case 'In Progress':
				color = 'orange';
				break;
			case 'Submitted':
				color = 'blue';
				message = 'Pending Approval';
				break;
			case 'Approved':
				color = 'green';
				if (frm.doc.company_created) {
					message = 'Approved & Processed';
				}
				break;
			case 'Rejected':
				color = 'red';
				break;
		}
		
		frm.dashboard.add_indicator(__(message), color);
	}
}

// Additional helper functions for form validation and UI enhancements
frappe.ui.form.on('Franchise Signup Application', {
	company_name: function(frm) {
		// Auto-generate title from company name
		if (frm.doc.company_name) {
			frm.set_value('title', frm.doc.company_name);
		}
	},
	
	onload: function(frm) {
		// Set up form filters and formatting
		setup_form_filters(frm);
	}
});

function setup_form_filters(frm) {
	// Set up any field filters or formatting here
	
	// Filter for approved_by and rejected_by to show only users with relevant roles
	frm.set_query('approved_by', function() {
		return {
			filters: {
				'enabled': 1,
				'user_type': 'System User'
			}
		};
	});
	
	frm.set_query('rejected_by', function() {
		return {
			filters: {
				'enabled': 1,
				'user_type': 'System User'  
			}
		};
	});
	
	// Filter for company_name_created
	frm.set_query('company_name_created', function() {
		return {
			filters: {
				'disabled': 0
			}
		};
	});
} 