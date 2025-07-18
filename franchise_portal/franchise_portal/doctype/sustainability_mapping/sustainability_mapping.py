# Copyright (c) 2024, Nexchar Ventures and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now


class SustainabilityMapping(Document):
	
	def before_save(self):
		"""Update modified_at timestamp before saving"""
		self.modified_at = now()
		
		if not self.created_at:
			self.created_at = now()
	
	def validate(self):
		"""Validate the document before saving"""
		# Add any validation logic here
		pass
	
	def on_update(self):
		"""Actions to perform when the document is updated"""
		pass


@frappe.whitelist()
def get_company_options(doctype, txt, searchfield, start, page_len, filters):
	"""
	Get company options filtered to only show companies under Franchise and Internal Company groups
	"""
	# Get companies that are under Franchise or Internal Company groups
	companies = frappe.db.sql("""
		SELECT c.name, c.company_name 
		FROM `tabCompany` c
		WHERE c.parent_company IN ('Franchises', 'Internal')
		AND c.is_group = 0
		AND (c.name LIKE %s OR c.company_name LIKE %s)
		ORDER BY c.company_name
		LIMIT %s OFFSET %s
	""", (f'%{txt}%', f'%{txt}%', page_len, start), as_dict=1)
	
	return [(company.name, company.company_name) for company in companies] 