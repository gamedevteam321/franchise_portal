# Copyright (c) 2024, Nexchar Ventures and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class SustainabilityAdminRole(Document):
	
	def validate(self):
		"""Validate the document before saving"""
		# Add any validation logic here
		pass
	
	def on_update(self):
		"""Actions to perform when the document is updated"""
		pass 