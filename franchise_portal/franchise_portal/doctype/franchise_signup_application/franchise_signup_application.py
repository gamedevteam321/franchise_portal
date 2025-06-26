# Copyright (c) 2024, Nexchar Ventures and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now


class FranchiseSignupApplication(Document):
	def before_save(self):
		"""Update modified_at timestamp before saving"""
		self.modified_at = now()
		
		if not self.created_at:
			self.created_at = now()
		
		# Set title if not set
		if not getattr(self, 'title', None) and self.company_name:
			self.title = self.company_name[:140]  # Ensure title fits within limit
	
	def validate(self):
		"""Validate the document before saving"""
		if self.email:
			self.validate_email_uniqueness()
	
	def validate_email_uniqueness(self):
		"""Ensure email is unique across all applications"""
		existing = frappe.get_all(
			"Franchise Signup Application",
			filters={"email": self.email, "name": ["!=", self.name]},
			limit=1
		)
		if existing:
			frappe.throw(f"An application with email {self.email} already exists.")
	
	def on_submit(self):
		"""Actions to perform when the application is submitted"""
		self.status = "Submitted"
		self.send_notification_email()
	
	def send_notification_email(self):
		"""Send email notification to administrators"""
		try:
			frappe.sendmail(
				recipients=["admin@nexcharventures.com"],
				subject=f"New Franchise Application: {self.company_name}",
				message=f"""
				<h3>New Franchise Signup Application Submitted</h3>
				<p><strong>Company:</strong> {self.company_name}</p>
				<p><strong>Contact Person:</strong> {self.contact_person}</p>
				<p><strong>Email:</strong> {self.email}</p>
				<p><strong>Phone:</strong> {self.phone_number}</p>
				<p><strong>Project:</strong> {self.project_name}</p>
				<p><strong>Location:</strong> {self.project_location}</p>
				<p><strong>Application ID:</strong> {self.name}</p>
				
				<p>Please review the application in the system.</p>
				""",
				now=True
			)
		except Exception as e:
			frappe.log_error(f"Failed to send notification email: {str(e)}")
	
	@frappe.whitelist()
	def update_step_data(self, step_data):
		"""Update application data for a specific step"""
		for field, value in step_data.items():
			if hasattr(self, field):
				setattr(self, field, value)
		
		self.save(ignore_permissions=True)
		frappe.db.commit()
		
		return {"success": True, "message": "Step data saved successfully"} 