// Copyright (c) 2024, Nexchar Ventures and contributors
// For license information, please see license.txt

frappe.ui.form.on('Franchise Signup Application', {
    refresh: function(frm) {
        // Custom handling for file fields to prevent 403 errors
        handleFileFields(frm);
        
        // Add custom download buttons for file fields
        addFileDownloadButtons(frm);
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