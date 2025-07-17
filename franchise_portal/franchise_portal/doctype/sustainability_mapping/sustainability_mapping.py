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