# Copyright (c) 2024, Franchise Portal and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class GenerationLocation(Document):
    pass

@frappe.whitelist()
def select_location():
    """Open map modal for location selection"""
    try:
        # This will be handled by the frontend JavaScript
        # The actual map functionality will be implemented in the signup form
        frappe.msgprint("Map selection will be handled by the signup form interface.")
    except Exception as e:
        frappe.log_error(f"Error in select_location: {str(e)}", "Generation Location Map Error")
        frappe.throw("Error opening map for location selection.") 