# Copyright (c) 2024, Nexchar Ventures and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import now
import frappe.utils
import re


class FranchiseSignupApplication(Document):
	
	def _safe_log_error(self, title, message):
		"""Safely log errors with truncated titles to prevent cascading failures"""
		try:
			# Truncate title to fit within 140 character limit with buffer
			max_title_length = 130  # Leave some buffer for safety
			if len(title) > max_title_length:
				title = title[:max_title_length-3] + "..."
			
			# Also truncate the message if it's extremely long
			max_message_length = 5000  # Reasonable limit for error message
			if len(message) > max_message_length:
				message = message[:max_message_length-3] + "..."
			
			frappe.log_error(message, title)
		except Exception:
			# If even the safe logging fails, just pass to avoid infinite recursion
			pass

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
		
		# Only validate Step 7 and Step 8 fields when application is being submitted/finalized
		if self.status == "Submitted":
			self.validate_step7_required_fields()
			self.validate_step8_required_fields()
	
	def validate_email_uniqueness(self):
		"""Ensure email is unique across all applications"""
		existing = frappe.get_all(
			"Franchise Signup Application",
			filters={"email": self.email, "name": ["!=", self.name]},
			limit=1
		)
		if existing:
			frappe.throw(f"An application with email {self.email} already exists.")
	
	def on_update(self):
		"""Actions to perform when the document is updated"""
		# If email is verified, ensure the verification timestamp is set
		if self.email_verified and not self.email_verified_at:
			self.email_verified_at = now()
	
	def validate_step7_required_fields(self):
		"""Validate required fields for Step 7 (Emissions & Energy Accounting) only when submitting"""
		missing_fields = []
		
		if not self.calculated_total:
			missing_fields.append("Calculated Total (kg CO₂/tonne)")
		
		if not self.uncertainty_range:
			missing_fields.append("Uncertainty Range (%)")
		
		if missing_fields:
			frappe.throw(f"The following required fields are missing: {', '.join(missing_fields)}")
	
	def validate_step8_required_fields(self):
		"""Validate required fields for Step 8 (Employee Details) only when submitting"""
		missing_fields = []
		
		if not getattr(self, 'employee_first_name', None):
			missing_fields.append("Employee First Name")
		
		if not getattr(self, 'employee_gender', None):
			missing_fields.append("Employee Gender")
		
		if not getattr(self, 'employee_date_of_birth', None):
			missing_fields.append("Employee Date of Birth")
		
		if not getattr(self, 'employee_date_of_joining', None):
			missing_fields.append("Employee Date of Joining")
		
		if missing_fields:
			frappe.throw(f"The following Step 8 (Employee Details) required fields are missing: {', '.join(missing_fields)}")
	
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
			self._safe_log_error("Notification Email Failed", f"Failed to send notification email: {str(e)}")
	
	@frappe.whitelist()
	def update_step_data(self, step_data):
		"""Update application data for a specific step"""
		for field, value in step_data.items():
			if hasattr(self, field):
				setattr(self, field, value)
		
		self.save(ignore_permissions=True)
		frappe.db.commit()
		
		return {"success": True, "message": "Step data saved successfully"}
	
	@frappe.whitelist()
	def approve_application(self, comments=None):
		"""Approve the franchise application and create company/user"""
		if not frappe.has_permission(self.doctype, "write"):
			frappe.throw("You don't have permission to approve applications")
		
		# Check if user has required role
		user_roles = frappe.get_roles()
		allowed_roles = ["Franchise Approval Admin", "System Manager", "Administrator"]
		if not any(role in user_roles for role in allowed_roles):
			frappe.throw("You don't have permission to approve franchise applications")
		
		if self.status != "Submitted":
			frappe.throw("Only submitted applications can be approved")
		
		try:
			# Update approval fields
			self.status = "Approved"
			self.approved_by = frappe.session.user
			self.approved_at = now()
			self.approval_comments = comments or ""
			
			# Create company and user
			company_name = self._create_company()
			user_email = self._create_user(company_name)
			
			# Update tracking fields
			self.company_created = 1
			self.company_name_created = company_name
			self.user_created = user_email
			self.processed_at = now()
			
			self.save(ignore_permissions=True)
			frappe.db.commit()
			
			# Send approval notification
			self._send_approval_notification(company_name, user_email)
			
			frappe.msgprint(
				f"✅ Application approved successfully!<br>"
				f"• Company created: {company_name}<br>"
				f"• User created: {user_email}<br>"
				f"• Employee record created<br>"
				f"• Roles assigned: Franchise Partner, Employee, System Manager",
				title="Approval Successful",
				indicator="green"
			)
			
			return {
				"success": True,
				"message": "Application approved and company/user created successfully",
				"company_name": company_name,
				"user_email": user_email
			}
			
		except Exception as e:
			self._safe_log_error("Application Approval Error", f"Error approving application {self.name}: {str(e)}")
			frappe.throw(f"Error processing approval: {str(e)}")
	
	@frappe.whitelist()
	def reject_application(self, reason=None):
		"""Reject the franchise application"""
		if not frappe.has_permission(self.doctype, "write"):
			frappe.throw("You don't have permission to reject applications")
		
		# Check if user has required role
		user_roles = frappe.get_roles()
		allowed_roles = ["Franchise Approval Admin", "System Manager", "Administrator"]
		if not any(role in user_roles for role in allowed_roles):
			frappe.throw("You don't have permission to reject franchise applications")
		
		if self.status != "Submitted":
			frappe.throw("Only submitted applications can be rejected")
		
		try:
			# Update rejection fields
			self.status = "Rejected"
			self.rejected_by = frappe.session.user
			self.rejected_at = now()
			self.rejection_reason = reason or "No reason provided"
			
			self.save(ignore_permissions=True)
			frappe.db.commit()
			
			# Send rejection notification
			self._send_rejection_notification(reason)
			
			frappe.msgprint(
				f"Application rejected successfully",
				title="Rejection Successful",
				indicator="orange"
			)
			
			return {
				"success": True,
				"message": "Application rejected successfully"
			}
			
		except Exception as e:
			self._safe_log_error("Application Rejection Error", f"Error rejecting application {self.name}: {str(e)}")
			frappe.throw(f"Error processing rejection: {str(e)}")
	
	def _create_company(self):
		"""Create company from franchise application data"""
		# Generate company abbreviation
		company_name = self.company_name
		abbr = self._generate_company_abbr(company_name)
		
		# Check if company already exists and modify name if needed
		original_name = company_name
		counter = 1
		while frappe.db.exists("Company", company_name):
			company_name = f"{original_name} - {counter}"
			abbr = f"{self._generate_company_abbr(original_name)}{counter}"
			counter += 1
		
		# Determine parent company based on project type
		parent_company = None
		project_type = getattr(self, 'project_type', '')
		
		# Map project type to parent company groups under Nexchar Ventures
		if project_type == "Franchise":
			parent_company = "Franchise"  # This should be the group company under Nexchar Ventures
		elif project_type == "Internal Company":
			parent_company = "Internal Company"  # This should be the group company under Nexchar Ventures
		
		# Ensure parent company structure exists
		if parent_company:
			parent_company = self._ensure_company_hierarchy(parent_company, project_type)
		
		# Create the company with Indian defaults as requested
		company_doc = frappe.get_doc({
			"doctype": "Company",
			"company_name": company_name,
			"abbr": abbr,
			"default_currency": "INR",  # Set to INR as requested
			"country": "India",  # Set to India as requested
			"parent_company": parent_company,  # Set parent based on project type
			"domain": "Manufacturing",
			"email": self.email,
			"phone_no": getattr(self, 'phone_number', ''),
			"company_description": f"{project_type} company created from franchise application {self.name}",
			"date_of_establishment": getattr(self, 'project_start_date', None),
			"date_of_incorporation": getattr(self, 'project_start_date', None),
			# Additional fields for better organization
			"website": getattr(self, 'website', ''),
			"tax_id": getattr(self, 'tax_id', ''),
		})
		
		company_doc.insert(ignore_permissions=True)
		frappe.db.commit()
		
		# Log successful creation
		frappe.logger().info(f"Company '{company_name}' created successfully under parent '{parent_company}' for {project_type} application {self.name}")
		
		return company_doc.name
	
	def _ensure_company_hierarchy(self, target_parent, project_type):
		"""Ensure the company hierarchy exists: Nexchar Ventures -> Franchise/Internal Company -> New Company"""
		
		# First, ensure Nexchar Ventures exists as the root company
		nexchar_ventures = "Nexchar Ventures"
		if not frappe.db.exists("Company", nexchar_ventures):
			self._safe_log_error("Root Company Missing", f"Root company '{nexchar_ventures}' not found. Cannot create proper hierarchy.")
			return None
		
		# Check if the target parent (Franchise or Internal Company) exists
		if not frappe.db.exists("Company", target_parent):
			try:
				# Create the group company under Nexchar Ventures
				group_company_doc = frappe.get_doc({
					"doctype": "Company",
					"company_name": target_parent,
					"abbr": "FRA" if target_parent == "Franchise" else "INT",
					"default_currency": "INR",
					"country": "India",
					"parent_company": nexchar_ventures,
					"is_group": 1,  # Mark as group company
					"domain": "Manufacturing",
					"company_description": f"Group company for {project_type} companies under Nexchar Ventures",
				})
				
				group_company_doc.insert(ignore_permissions=True)
				frappe.db.commit()
				
				frappe.logger().info(f"Created group company '{target_parent}' under '{nexchar_ventures}'")
				
			except Exception as e:
				self._safe_log_error("Group Company Creation Failed", f"Failed to create group company '{target_parent}': {str(e)}")
				return None
		
		return target_parent
	
	def _create_user(self, company_name):
		"""Create user and employee from franchise application data"""
		email = self.email
		
		# Check if user already exists
		if frappe.db.exists("User", email):
			user_doc = frappe.get_doc("User", email)
			
			# Add all required roles if not already present
			existing_roles = [role.role for role in user_doc.roles]
			roles_to_add = ["Franchise Partner", "Employee", "System Manager"]
			
			for role in roles_to_add:
				if role not in existing_roles:
					user_doc.append("roles", {"role": role})
			
			# Assign the newly created company to the user
			user_doc.company = company_name
			user_doc.save(ignore_permissions=True)
		else:
			# Create new user with all required roles
			first_name = getattr(self, 'employee_first_name', None) or getattr(self, 'contact_person', email.split('@')[0])
			if ' ' in first_name:
				first_name = first_name.split(' ')[0]
			
			user_doc = frappe.get_doc({
				"doctype": "User",
				"email": email,
				"first_name": first_name,
				"company": company_name,  # Assign the newly created company
				"user_type": "System User",
				"send_welcome_email": 1,
				"enabled": 1,
				"roles": [
					{"role": "Franchise Partner"},
					{"role": "Employee"},
					{"role": "System Manager"},
				]
			})
			user_doc.insert(ignore_permissions=True)
		
		# Create Employee record if employee details are provided
		self._create_employee_record(email, company_name)
		
		frappe.db.commit()
		return email
	
	def _create_employee_record(self, email, company_name):
		"""Create Employee record with data from Step 8"""
		try:
			# Check if Employee record already exists for this user
			existing_employee = frappe.db.get_value("Employee", {"user_id": email}, "name")
			if existing_employee:
				frappe.logger().info(f"Employee record already exists for {email}: {existing_employee}")
				return existing_employee
			
			# Ensure required master data exists
			self._ensure_employee_master_data(company_name)
			
			# Get employee data from Step 8 fields
			first_name = getattr(self, 'employee_first_name', None) or getattr(self, 'contact_person', email.split('@')[0])
			middle_name = getattr(self, 'employee_middle_name', '')
			last_name = getattr(self, 'employee_last_name', '')
			
			# Build full employee name
			employee_name_parts = [first_name]
			if middle_name:
				employee_name_parts.append(middle_name)
			if last_name:
				employee_name_parts.append(last_name)
			employee_name = ' '.join(employee_name_parts)
			
			# Create Employee record with Step 8 data
			employee_doc = frappe.get_doc({
				"doctype": "Employee",
				"first_name": first_name,
				"middle_name": middle_name,
				"last_name": last_name,
				"employee_name": employee_name,
				"gender": getattr(self, 'employee_gender', 'Prefer not to say'),
				"date_of_birth": getattr(self, 'employee_date_of_birth', None),
				"date_of_joining": getattr(self, 'employee_date_of_joining', frappe.utils.today()),
				"company": company_name,
				"status": 'Active',  # Default to Active since status field is removed from form
				"salutation": getattr(self, 'employee_salutation', ''),
				"user_id": email,
				"personal_email": getattr(self, 'employee_personal_email', email),
				"company_email": email,
				"cell_number": getattr(self, 'employee_phone', getattr(self, 'phone_number', '')),
				"designation": getattr(self, 'employee_designation', 'Franchise Partner'),
				"department": getattr(self, 'employee_department', 'Management'),
				"branch": getattr(self, 'employee_branch', ''),
				"reports_to": getattr(self, 'employee_reports_to', ''),
				"grade": getattr(self, 'employee_grade', ''),
				"employee_number": frappe.generate_hash()[:8].upper(),  # Generate unique employee number
			})
			
			# Use flags to bypass validations that might cause issues
			employee_doc.flags.ignore_validate = True
			employee_doc.flags.ignore_links = True
			employee_doc.flags.ignore_permissions = True
			
			employee_doc.insert(ignore_permissions=True)
			frappe.logger().info(f"Created Employee record for {email}: {employee_doc.name}")
			
			return employee_doc.name
			
		except Exception as e:
			self._safe_log_error("Employee Creation Failed", f"Failed to create Employee record for {email}: {str(e)}")
			# Don't re-raise the exception - Employee creation failure shouldn't break user creation
			return None
	
	def _ensure_employee_master_data(self, company_name):
		"""Ensure required master data exists for Employee creation"""
		try:
			# Ensure Department exists
			department_name = getattr(self, 'employee_department', 'Management')
			if not frappe.db.exists("Department", department_name):
				dept_doc = frappe.get_doc({
					"doctype": "Department",
					"department_name": department_name,
					"company": company_name,
					"is_group": 0
				})
				dept_doc.insert(ignore_permissions=True)
				frappe.logger().info(f"Created Department: {department_name} for {company_name}")
			
			# Ensure Designation exists
			designation_name = getattr(self, 'employee_designation', 'Franchise Partner')
			if not frappe.db.exists("Designation", designation_name):
				desig_doc = frappe.get_doc({
					"doctype": "Designation",
					"designation_name": designation_name
				})
				desig_doc.insert(ignore_permissions=True)
				frappe.logger().info(f"Created Designation: {designation_name}")
				
		except Exception as e:
			self._safe_log_error("Master Data Creation Failed", f"Failed to create master data: {str(e)}")
			# Continue with Employee creation even if master data creation fails

	
	def _generate_company_abbr(self, company_name):
		"""Generate company abbreviation from company name"""
		# Remove special characters and split by spaces
		words = re.findall(r'\b\w+', company_name.upper())
		
		if len(words) == 1:
			return words[0][:3]
		elif len(words) >= 2:
			return ''.join(word[0] for word in words[:3])
		else:
			return company_name[:3].upper()
	
	def _send_approval_notification(self, company_name, user_email):
		"""Send email notification after approval"""
		try:
			# Email to applicant
			frappe.sendmail(
				recipients=[self.email],
				subject=f"🎉 Franchise Application Approved - {self.company_name}",
				message=f"""
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<h2 style="color: #28a745;">🎉 Congratulations! Your Franchise Application has been Approved!</h2>
					
					<p>Dear {getattr(self, 'contact_person', 'Applicant')},</p>
					
					<p>We are pleased to inform you that your franchise application has been <strong>approved</strong>!</p>
					
					<div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
						<h3 style="margin-top: 0; color: #155724;">Application Details</h3>
						<table style="width: 100%; border-collapse: collapse;">
							<tr>
								<td style="padding: 8px 0; font-weight: bold; width: 40%;">Application ID:</td>
								<td style="padding: 8px 0;">{self.name}</td>
							</tr>
							<tr>
								<td style="padding: 8px 0; font-weight: bold;">Project Type:</td>
								<td style="padding: 8px 0;">{getattr(self, 'project_type', 'N/A')}</td>
							</tr>
							<tr>
								<td style="padding: 8px 0; font-weight: bold;">Company Created:</td>
								<td style="padding: 8px 0;">{company_name}</td>
							</tr>
							<tr>
								<td style="padding: 8px 0; font-weight: bold;">Company Hierarchy:</td>
								<td style="padding: 8px 0;">Nexchar Ventures → {getattr(self, 'project_type', 'Unknown')} → {company_name}</td>
							</tr>
							<tr>
								<td style="padding: 8px 0; font-weight: bold;">User Account:</td>
								<td style="padding: 8px 0;">{user_email}</td>
							</tr>
							<tr>
								<td style="padding: 8px 0; font-weight: bold;">Employee Name:</td>
								<td style="padding: 8px 0;">{getattr(self, 'employee_first_name', 'N/A')} {getattr(self, 'employee_last_name', '')}</td>
							</tr>
							<tr>
								<td style="padding: 8px 0; font-weight: bold;">Roles Assigned:</td>
								<td style="padding: 8px 0;">Franchise Partner, Employee, System Manager</td>
							</tr>
							<tr>
								<td style="padding: 8px 0; font-weight: bold;">Approved By:</td>
								<td style="padding: 8px 0;">{frappe.get_value('User', self.approved_by, 'full_name') or self.approved_by}</td>
							</tr>
						</table>
					</div>
					
					<h3>Next Steps:</h3>
					<ol>
						<li>You will receive a welcome email with login credentials</li>
						<li>Access your franchise dashboard</li>
						<li>Complete the onboarding process</li>
						<li>Start your franchise operations</li>
					</ol>
					
					<p>Welcome to the franchise family!</p>
					
					<p>Best regards,<br>Franchise Management Team</p>
				</div>
				""",
				now=True
			)
			
			# Email to internal team
			frappe.sendmail(
				recipients=["admin@nexcharventures.com"],
				subject=f"Franchise Application Approved - {self.company_name}",
				message=f"""
				<h3>Franchise Application Approved & Processed</h3>
				<p><strong>Application ID:</strong> {self.name}</p>
				<p><strong>Project Type:</strong> {getattr(self, 'project_type', 'N/A')}</p>
				<p><strong>Company Created:</strong> {company_name}</p>
				<p><strong>Company Hierarchy:</strong> Nexchar Ventures → {getattr(self, 'project_type', 'Unknown')} → {company_name}</p>
				<p><strong>User Created:</strong> {user_email}</p>
				<p><strong>Employee Name:</strong> {getattr(self, 'employee_first_name', 'N/A')} {getattr(self, 'employee_last_name', '')}</p>
				<p><strong>Employee Designation:</strong> {getattr(self, 'employee_designation', 'Franchise Partner')}</p>
				<p><strong>Employee Department:</strong> {getattr(self, 'employee_department', 'Management')}</p>
				<p><strong>Roles Assigned:</strong> Franchise Partner, Employee, System Manager</p>
				<p><strong>Approved By:</strong> {frappe.get_value('User', self.approved_by, 'full_name') or self.approved_by}</p>
				<p><strong>Contact Email:</strong> {self.email}</p>
				<p><strong>Approval Comments:</strong> {self.approval_comments or 'None'}</p>
				""",
				now=True
			)
		except Exception as e:
			self._safe_log_error("Approval Notification Failed", f"Failed to send approval notification: {str(e)}")
	
	def _send_rejection_notification(self, reason):
		"""Send email notification after rejection"""
		try:
			# Email to applicant
			frappe.sendmail(
				recipients=[self.email],
				subject=f"Franchise Application Update - {self.company_name}",
				message=f"""
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<h2 style="color: #dc3545;">Franchise Application Status Update</h2>
					
					<p>Dear {getattr(self, 'contact_person', 'Applicant')},</p>
					
					<p>Thank you for your interest in our franchise program. After careful review, we regret to inform you that your application has not been approved at this time.</p>
					
					<div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
						<h3 style="margin-top: 0; color: #721c24;">Application Details</h3>
						<table style="width: 100%; border-collapse: collapse;">
							<tr>
								<td style="padding: 8px 0; font-weight: bold; width: 40%;">Application ID:</td>
								<td style="padding: 8px 0;">{self.name}</td>
							</tr>
							<tr>
								<td style="padding: 8px 0; font-weight: bold;">Company:</td>
								<td style="padding: 8px 0;">{self.company_name}</td>
							</tr>
							<tr>
								<td style="padding: 8px 0; font-weight: bold;">Reason:</td>
								<td style="padding: 8px 0;">{reason or 'Please contact us for details'}</td>
							</tr>
						</table>
					</div>
					
					<p>We encourage you to address the concerns mentioned and reapply in the future.</p>
					
					<p>For any questions, please contact our franchise team.</p>
					
					<p>Best regards,<br>Franchise Management Team</p>
				</div>
				""",
				now=True
			)
			
			# Email to internal team
			frappe.sendmail(
				recipients=["admin@nexcharventures.com"],
				subject=f"Franchise Application Rejected - {self.company_name}",
				message=f"""
				<h3>Franchise Application Rejected</h3>
				<p><strong>Application ID:</strong> {self.name}</p>
				<p><strong>Company:</strong> {self.company_name}</p>
				<p><strong>Rejected By:</strong> {frappe.get_value('User', self.rejected_by, 'full_name') or self.rejected_by}</p>
				<p><strong>Contact Email:</strong> {self.email}</p>
				<p><strong>Rejection Reason:</strong> {reason or 'No reason provided'}</p>
				""",
				now=True
			)
		except Exception as e:
			self._safe_log_error("Rejection Notification Failed", f"Failed to send rejection notification: {str(e)}") 