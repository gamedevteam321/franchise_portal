# Copyright (c) 2024, Nexchar Ventures and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestFranchiseSignupApplication(FrappeTestCase):
	def test_application_creation(self):
		"""Test creating a new franchise application"""
		application = frappe.get_doc({
			"doctype": "Franchise Signup Application",
			"company_name": "Test Company",
			"contact_person": "Test Contact",
			"email": "test@example.com",
			"phone_number": "1234567890",
			"company_address": "Test Address",
			"country_of_operation": "India"
		})
		application.insert()
		
		self.assertEqual(application.company_name, "Test Company")
		self.assertEqual(application.status, "Draft")
		
		# Clean up
		application.delete()
	
	def test_email_uniqueness(self):
		"""Test that email uniqueness is enforced"""
		# Create first application
		application1 = frappe.get_doc({
			"doctype": "Franchise Signup Application",
			"company_name": "Test Company 1",
			"email": "unique@example.com"
		})
		application1.insert()
		
		# Try to create second application with same email
		application2 = frappe.get_doc({
			"doctype": "Franchise Signup Application",
			"company_name": "Test Company 2",
			"email": "unique@example.com"
		})
		
		with self.assertRaises(frappe.ValidationError):
			application2.insert()
		
		# Clean up
		application1.delete() 