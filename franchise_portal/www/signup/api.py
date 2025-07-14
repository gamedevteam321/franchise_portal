# Copyright (c) 2024, Nexchar Ventures and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import now
import uuid
import json
import os
import datetime


@frappe.whitelist(allow_guest=True)
def send_verification_email(email, data):
    """Send email verification for franchise application"""
    try:
        if not email or not email.strip():
            return {"success": False, "message": "Email is required"}
        
        # Handle JSON string data from frontend (same fix as other APIs)
        if isinstance(data, str):
            data = json.loads(data)
            
        # Generate verification token
        verification_token = str(uuid.uuid4())
        
        # Store session data temporarily (expires in 24 hours)
        session_key = f"franchise_signup_{verification_token}"
        session_data = {
            "email": email,
            "data": data,
            "current_step": 1,
            "verified": False,
            "created_at": now()
        }
        
        # Store in cache for 24 hours (86400 seconds)
        frappe.cache().set_value(session_key, json.dumps(session_data), expires_in_sec=86400)
        
        # Create verification URL
        site_url = frappe.utils.get_url()
        verification_url = f"{site_url}/signup?verify={verification_token}"
        
        # Send verification email
        send_verification_email_to_user(email, data.get("company_name", ""), verification_url)
        
        return {
            "success": True,
            "message": "Verification email sent successfully",
            "requires_verification": True,
            "verification_token": verification_token
        }
        
    except Exception as e:
        frappe.log_error(f"Error sending verification email: {str(e)}", "Franchise Portal Verification Error")
        return {
            "success": False,
            "message": f"Error sending verification email: {str(e)}"
        }


@frappe.whitelist(allow_guest=True)
def verify_email(token):
    """Verify email and get user's current session data"""
    try:
        if not token:
            return {"success": False, "message": "Verification token is required"}
            
        session_key = f"franchise_signup_{token}"
        session_data_str = frappe.cache().get_value(session_key)
        
        if not session_data_str:
            return {"success": False, "message": "Invalid or expired verification token"}
            
        session_data = json.loads(session_data_str)
        email = session_data.get("email")
        
        if not email:
            return {"success": False, "message": "Email not found in session data"}
        
        # Mark as verified in session
        session_data["verified"] = True
        session_data["verified_at"] = now()
        
        # Update cache
        frappe.cache().set_value(session_key, json.dumps(session_data), expires_in_sec=86400)
        
        # Save/update the doctype with verified email data
        application_id = save_verified_email_to_doctype(email, session_data)
        
        # Update session data with the application ID if we got one
        if application_id:
            session_data["application_id"] = application_id
            # Update cache with application ID
            frappe.cache().set_value(session_key, json.dumps(session_data), expires_in_sec=86400)
        
        return {
            "success": True,
            "message": "Email verified successfully",
            "session_data": session_data,
            "current_step": session_data.get("current_step", 1),
            "application_id": application_id
        }
        
    except Exception as e:
        frappe.log_error(f"Error verifying email: {str(e)}", "Franchise Portal Verification Error")
        return {
            "success": False,
            "message": f"Error verifying email: {str(e)}"
        }


@frappe.whitelist(allow_guest=True)
def get_session_data(token):
    """Get current session data for a user"""
    try:
        if not token:
            return {"success": False, "message": "Token is required"}
            
        session_key = f"franchise_signup_{token}"
        session_data_str = frappe.cache().get_value(session_key)
        
        if not session_data_str:
            return {"success": False, "message": "Session not found or expired"}
            
        session_data = json.loads(session_data_str)
        
        return {
            "success": True,
            "session_data": session_data
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting session data: {str(e)}", "Franchise Portal Session Error")
        return {
            "success": False,
            "message": f"Error getting session data: {str(e)}"
        }


@frappe.whitelist(allow_guest=True)
def save_step_with_verification(token, data, step):
    """Save step data with verification check"""
    try:
        # Log RAW input data BEFORE any processing
        debug_file = os.path.join(frappe.get_site_path(), 'debug_save.txt')
        with open(debug_file, 'a') as f:
            f.write(f"\n=== RAW VERIFIED API INPUT {frappe.utils.now()} ===\n")
            f.write(f"Token: {token}\n")
            f.write(f"Step: {step}\n")
            f.write(f"Raw data type: {type(data)}\n")
            f.write(f"Raw data: {str(data)[:1000]}...\n")  # First 1000 chars
        
        if not token:
            return {"success": False, "message": "Verification token is required"}
        
        # Convert step to integer (it comes as string from frontend)
        try:
            step = int(step)
            if step < 1 or step > 8:
                step = 1
        except (ValueError, TypeError):
            step = 1
        # frappe.log_error(f"Saving step: {step}", "DEBUG: Franchise Signup")
        
        session_key = f"franchise_signup_{token}"
        session_data_str = frappe.cache().get_value(session_key)
        
        if not session_data_str:
            return {"success": False, "message": "Session not found or expired"}
            
        session_data = json.loads(session_data_str)
        
        if not session_data.get("verified"):
            return {"success": False, "message": "Email not verified", "requires_verification": True}
        
        # Handle JSON string data from frontend
        if isinstance(data, str):
            data = json.loads(data)
        
        # Update session data
        session_data["data"].update(data)
        session_data["current_step"] = step
        session_data["last_updated"] = now()
        session_data = serialize_datetimes(session_data)
        
        # Save updated session
        frappe.cache().set_value(session_key, json.dumps(session_data), expires_in_sec=86400)
        
        # Also update the current_step and all data in the DocType if the application exists
        email = session_data['data'].get('email')
        if email:
            applications = frappe.get_all(
                "Franchise Signup Application",
                filters={"email": email},
                fields=["name"]
            )
            if applications:
                # Prepare all updates as a single batch to avoid version conflicts
                doc_name = applications[0].name
                updates = {}
                
                # Collect all field updates - only include fields that exist in the doctype
                doctype_fields = frappe.get_meta("Franchise Signup Application").get_fieldnames_with_value()
                
                for key, value in session_data['data'].items():
                    if key not in ['name', 'doctype', 'generation_locations', 'creation', 'modified', 'modified_by', 'owner'] and key in doctype_fields:
                        # Convert empty strings to None for numeric fields to avoid database errors
                        if key in ['avg_transport_distance', 'heating_value', 'annual_volume_available', 'capacity', 'accuracy_rating'] and value == '':
                            value = 0
                        updates[key] = value
                
                updates['current_step'] = step
                
                # Ensure email verification status is preserved
                if session_data.get("verified"):
                    updates['email_verified'] = 1
                    if not updates.get('email_verified_at'):
                        updates['email_verified_at'] = now()
                
                # Handle generation_locations on step 4 and final step to avoid version conflicts
                if (step == 4 or step == 5 or step == 7) and 'generation_locations' in session_data['data'] and isinstance(session_data['data']['generation_locations'], list):
                    # Add debug logging
                    debug_file = os.path.join(frappe.get_site_path(), 'debug_save.txt')
                    with open(debug_file, 'a') as f:
                        f.write(f"\n=== GENERATION_LOCATIONS PROCESSING {frappe.utils.now()} ===\n")
                        f.write(f"Step: {step}\n")
                        f.write(f"Generation locations data: {session_data['data']['generation_locations']}\n")
                    
                    doc = frappe.get_doc("Franchise Signup Application", doc_name)
                    refresh_doc_modified(doc)
                    
                    doc.set('generation_locations', [])
                    for location_data in session_data['data']['generation_locations']:
                        doc.append('generation_locations', location_data)
                    
                    # Save with ignore_version=True to prevent version conflicts
                    doc.save(ignore_permissions=True, ignore_version=True)
                    
                    # Add debug logging after save
                    with open(debug_file, 'a') as f:
                        f.write(f"Generation locations saved successfully\n")
                        f.write(f"Doc generation_locations count: {len(doc.generation_locations)}\n")
                
                # Special handling for source_type checkbox data
                if 'source_type' in session_data['data']:
                    source_type_value = session_data['data']['source_type']
                    # Ensure source_type is properly formatted as comma-separated string
                    if isinstance(source_type_value, list):
                        source_type_value = ', '.join(source_type_value)
                    frappe.db.set_value("Franchise Signup Application", doc_name, 'source_type', source_type_value)
                    
                    # Add debug logging
                    debug_file = os.path.join(frappe.get_site_path(), 'debug_save.txt')
                    with open(debug_file, 'a') as f:
                        f.write(f"SET source_type to '{source_type_value}' on app {doc_name}\n")
                
                # Single atomic database update
                frappe.db.set_value("Franchise Signup Application", doc_name, updates)
                
                frappe.db.commit()
        
        # If this is the final step (8), finalize the application
        if step >= 8:
            finalize_result = finalize_application(session_data, token, step)
            if finalize_result.get("success"):
                return finalize_result
            else:
                # If finalization failed, return the error
                return finalize_result
        
        return {
            "success": True,
            "message": "Step data saved successfully",
            "application_id": doc_name,
            "current_step": step
        }
        
    except Exception as e:
        # frappe.log_error(f"Error saving verified step: {str(e)}", "Franchise Portal Verified Save Error")
        return {
            "success": False,
            "message": f"Error saving step data: {str(e)}"
        }


@frappe.whitelist(allow_guest=True)
def submit_application(email, data=None):
    """Submit the franchise application"""
    try:
        debug_file = os.path.join(frappe.get_site_path(), 'debug_save.txt')
        with open(debug_file, 'a') as f:
            f.write(f"\n=== RAW SUBMIT API INPUT {frappe.utils.now()} ===\n")
            f.write(f"Email: {email}\n")
            f.write(f"Raw data type: {type(data)}\n")
            f.write(f"Raw data: {str(data)[:1000]}...\n")
        if not email:
            return {"success": False, "message": "Email is required"}
        if data and isinstance(data, str):
            import json
            data = json.loads(data)
        if data:
            data = frappe._dict(data)
        applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email},
            fields=["name"]
        )
        if not applications:
            return {"success": False, "message": "Application not found"}
        doc_name = applications[0].name
        meta = frappe.get_meta("Franchise Signup Application")
        valid_fields = [df.fieldname for df in meta.fields]
        updates = {}
        if data:
            if 'generation_locations' in data and isinstance(data.generation_locations, list):
                doc = frappe.get_doc("Franchise Signup Application", doc_name)
                doc.generation_locations = []
                for location in data.generation_locations:
                    if isinstance(location, dict) and location.get('address') and location.get('gps_coordinates'):
                        doc.append('generation_locations', {
                            'address': location['address'],
                            'gps_coordinates': location['gps_coordinates']
                        })
                doc.save(ignore_permissions=True, ignore_version=True)
            for key, value in data.items():
                if key != 'generation_locations' and key in valid_fields:
                    updates[key] = value
        # Validate Step 7 (Emissions & Energy Accounting) required fields
        calculated_total = data.get('calculated_total') if data else None
        uncertainty_range = data.get('uncertainty_range') if data else None
        missing_step7_fields = []
        if not calculated_total or str(calculated_total).strip() == '':
            missing_step7_fields.append("Calculated Total (kg CO₂e/tonne)")
        if not uncertainty_range or str(uncertainty_range).strip() == '':
            missing_step7_fields.append("Uncertainty Range (%)")
        if missing_step7_fields:
            if len(missing_step7_fields) == 1:
                error_msg = f"Please provide the {missing_step7_fields[0]}. This emissions data is required to complete your application."
            else:
                error_msg = f"Please provide the following emissions data: {' and '.join(missing_step7_fields)}. This information is required to complete your application."
            return {"success": False, "message": error_msg}
        
        # Validate Step 8 (Employee Details) required fields
        employee_first_name = data.get('employee_first_name') if data else None
        employee_gender = data.get('employee_gender') if data else None
        employee_date_of_birth = data.get('employee_date_of_birth') if data else None
        employee_date_of_joining = data.get('employee_date_of_joining') if data else None
        
        missing_step8_fields = []
        field_labels = {
            'employee_first_name': 'Employee First Name',
            'employee_gender': 'Employee Gender',
            'employee_date_of_birth': 'Employee Date of Birth',
            'employee_date_of_joining': 'Employee Date of Joining'
        }
        
        if not employee_first_name or str(employee_first_name).strip() == '':
            missing_step8_fields.append(field_labels['employee_first_name'])
        if not employee_gender or str(employee_gender).strip() == '':
            missing_step8_fields.append(field_labels['employee_gender'])
        if not employee_date_of_birth or str(employee_date_of_birth).strip() == '':
            missing_step8_fields.append(field_labels['employee_date_of_birth'])
        if not employee_date_of_joining or str(employee_date_of_joining).strip() == '':
            missing_step8_fields.append(field_labels['employee_date_of_joining'])
        
        if missing_step8_fields:
            if len(missing_step8_fields) == 1:
                error_msg = f"Please provide the {missing_step8_fields[0]}. This employee information is required to complete your application."
            elif len(missing_step8_fields) == 2:
                error_msg = f"Please provide the {missing_step8_fields[0]} and {missing_step8_fields[1]}. This employee information is required to complete your application."
            else:
                last_field = missing_step8_fields.pop()
                error_msg = f"Please provide the following employee information: {', '.join(missing_step8_fields)}, and {last_field}. This information is required to complete your application."
            return {"success": False, "message": error_msg}
        
        updates['status'] = "Submitted"
        frappe.db.set_value("Franchise Signup Application", doc_name, updates)
        frappe.db.commit()
        return {"success": True, "message": "Application submitted successfully", "application_id": doc_name}
    except Exception as e:
        error_msg = str(e)
        truncated_msg = error_msg[:100] + "..." if len(error_msg) > 100 else error_msg
        frappe.log_error(f"Error submitting application: {truncated_msg}", "Franchise Portal Submission Error")
        return {"success": False, "message": f"Error submitting application: {error_msg}"}


@frappe.whitelist(allow_guest=True)
def get_application_status(email):
    """Get the current status of an application"""
    try:
        if not email:
            return {"success": False, "message": "Email is required"}
        
        applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email},
            fields=["name", "status", "current_step", "company_name"],
            limit=1
        )
        
        if not applications:
            return {"success": False, "message": "Application not found"}
        
        return {
            "success": True,
            "application": applications[0]
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting application status: {str(e)}")
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }


@frappe.whitelist(allow_guest=True)
def send_confirmation_email(email, application_id, applicant_name=None):
    """Send confirmation email after successful application submission"""
    try:
        if not email or not application_id:
            return {"success": False, "message": "Email and application ID are required"}
        
        # Get the application document
        try:
            doc = frappe.get_doc("Franchise Signup Application", application_id)
        except frappe.DoesNotExistError:
            return {"success": False, "message": "Application not found"}
        
        # Use the applicant name from the doc if not provided
        if not applicant_name:
            applicant_name = doc.contact_person or doc.company_name or "Applicant"
        
        # Send confirmation email to the applicant
        subject = f"✅ Application Submitted Successfully - {doc.company_name or 'Your Company'}"
        
        message = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 600;">🎉 Application Submitted Successfully!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Thank you for choosing Nexchar Ventures</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 20px;">
                <p style="font-size: 16px; color: #2d3436; margin-bottom: 20px;">Dear <strong>{applicant_name}</strong>,</p>
                
                <p style="color: #636e72; line-height: 1.6; margin-bottom: 25px;">
                    Congratulations! Your franchise application has been successfully submitted and is now under review. 
                    We appreciate your interest in partnering with Nexchar Ventures.
                </p>
                
                <!-- Application Details Card -->
                <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #74b9ff;">
                    <h3 style="margin: 0 0 15px 0; color: #2d3436; font-size: 18px;">📋 Your Application Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; font-weight: 600; color: #636e72; width: 35%;">Application ID:</td>
                            <td style="padding: 8px 0; color: #2d3436; font-family: monospace; background: #e8f4f8; padding: 4px 8px; border-radius: 4px; font-weight: 600;">{doc.name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: 600; color: #636e72;">Company Name:</td>
                            <td style="padding: 8px 0; color: #2d3436;">{doc.company_name or 'Not specified'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: 600; color: #636e72;">Project Name:</td>
                            <td style="padding: 8px 0; color: #2d3436;">{doc.project_name or 'Not specified'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: 600; color: #636e72;">Email:</td>
                            <td style="padding: 8px 0; color: #2d3436;">{doc.email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: 600; color: #636e72;">Status:</td>
                            <td style="padding: 8px 0; color: #74b9ff; font-weight: 600;">✅ Under Review</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: 600; color: #636e72;">Submitted On:</td>
                            <td style="padding: 8px 0; color: #2d3436;">{frappe.utils.format_date(now(), 'medium')}</td>
                        </tr>
                    </table>
                </div>
                
                <!-- Next Steps -->
                <div style="background: #e8f4f8; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <h4 style="margin: 0 0 15px 0; color: #0c5460; font-size: 16px;">🚀 What Happens Next?</h4>
                    <ul style="color: #0c5460; margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li><strong>Initial Review:</strong> Our team will review your application within 2-3 business days</li>
                        <li><strong>Technical Assessment:</strong> We'll evaluate your project details and feasibility</li>
                        <li><strong>Direct Contact:</strong> A franchise specialist will contact you for further discussion</li>
                        <li><strong>Partnership Decision:</strong> We'll provide feedback and next steps for partnership</li>
                    </ul>
                </div>
                
                <!-- Important Notice -->
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 25px 0;">
                    <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 14px;">📝 Important Information</h4>
                    <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                        Please save your <strong>Application ID: {doc.name}</strong> for future reference. 
                        Our team will contact you at <strong>{doc.email}</strong> or <strong>{doc.phone_number or 'your provided contact number'}</strong> 
                        with updates on your application status.
                    </p>
                </div>
                
                <!-- Contact Info -->
                <div style="text-align: center; margin: 30px 0 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <h4 style="margin: 0 0 10px 0; color: #2d3436;">Questions or Need Assistance?</h4>
                    <p style="margin: 0; color: #636e72;">Contact our support team:</p>
                    <p style="margin: 10px 0 0 0; color: #74b9ff; font-weight: 600;">
                        📧 support@nexcharventures.com<br>
                        📞 +91-XXX-XXX-XXXX
                    </p>
                </div>
                
                <p style="color: #636e72; line-height: 1.6; margin-top: 30px;">
                    Thank you for choosing Nexchar Ventures as your franchise partner. We look forward to working with you!
                </p>
                
                <div style="text-align: center; margin-top: 30px;">
                    <p style="margin: 0; color: #2d3436; font-weight: 600;">Best regards,</p>
                    <p style="margin: 5px 0 0 0; color: #74b9ff; font-weight: 700; font-size: 16px;">The Nexchar Ventures Team</p>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8f9fa; color: #636e72; text-align: center; padding: 20px; border-radius: 0 0 8px 8px; font-size: 12px;">
                <p style="margin: 0;">© 2024 Nexchar Ventures. All rights reserved.</p>
                <p style="margin: 5px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
        """
        
        # Send the email
        frappe.sendmail(
            recipients=[email],
            subject=subject,
            message=message,
            now=True
        )
        
        # Also send notification to admins (optional)
        try:
            admin_subject = f"📨 New Application Submitted: {doc.company_name}"
            admin_message = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #667eea;">New Franchise Application Notification</h2>
                <p>A new franchise application has been submitted and confirmation email sent to the applicant.</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #495057;">Quick Overview</h3>
                    <p><strong>Application ID:</strong> {doc.name}</p>
                    <p><strong>Company:</strong> {doc.company_name}</p>
                    <p><strong>Contact:</strong> {applicant_name} ({doc.email})</p>
                    <p><strong>Project:</strong> {doc.project_name or 'Not specified'}</p>
                    <p><strong>Confirmation Email:</strong> ✅ Sent to {email}</p>
                </div>
                
                <p>Please review this application in the system and follow up accordingly.</p>
            </div>
            """
            
            frappe.sendmail(
                recipients=["admin@nexcharventures.com"],  # Configure this email
                subject=admin_subject,
                message=admin_message,
                now=True
            )
        except Exception as admin_email_error:
            frappe.log_error(f"Failed to send admin notification: {str(admin_email_error)}", "Admin Email Notification Error")
        
        return {
            "success": True,
            "message": "Confirmation email sent successfully",
            "email_sent_to": email,
            "application_id": application_id
        }
        
    except Exception as e:
        frappe.log_error(f"Error sending confirmation email: {str(e)}", "Franchise Portal Confirmation Email Error")
        return {
            "success": False,
            "message": f"Failed to send confirmation email: {str(e)}"
        }


def send_notification_email(doc):
    """Send notification email to administrators"""
    subject = f"New Franchise Application: {doc.company_name}"
    
    message = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">New Franchise Application Submitted</h2>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #495057;">Application Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; width: 40%;">Application ID:</td>
                    <td style="padding: 8px 0;">{doc.name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Company Name:</td>
                    <td style="padding: 8px 0;">{doc.company_name or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Contact Person:</td>
                    <td style="padding: 8px 0;">{doc.contact_person or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                    <td style="padding: 8px 0;">{doc.email}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Phone:</td>
                    <td style="padding: 8px 0;">{doc.phone_number or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Project Name:</td>
                    <td style="padding: 8px 0;">{doc.project_name or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Location:</td>
                    <td style="padding: 8px 0;">{doc.project_location or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Feedstock Category:</td>
                    <td style="padding: 8px 0;">{doc.feedstock_category or 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Annual Volume:</td>
                    <td style="padding: 8px 0;">{doc.annual_volume_available or 'N/A'} MT</td>
                </tr>
            </table>
        </div>
        
        <p style="color: #6c757d;">Please review this application in the ERP system and follow up with the applicant.</p>
    </div>
    """
    
    frappe.sendmail(
        recipients=["admin@nexcharventures.com"],
        subject=subject,
        message=message,
        now=True
    )


@frappe.whitelist(allow_guest=True)
def send_confirmation_email(email, application_id, applicant_name=None):
    """Send confirmation email after successful application submission"""
    try:
        if not email or not application_id:
            return {"success": False, "message": "Email and application ID are required"}
        
        # Get the application document
        try:
            doc = frappe.get_doc("Franchise Signup Application", application_id)
        except frappe.DoesNotExistError:
            return {"success": False, "message": "Application not found"}
        
        # Use the applicant name from the doc if not provided
        if not applicant_name:
            applicant_name = doc.contact_person or doc.company_name or "Applicant"
        
        # Send confirmation email to the applicant
        subject = f"✅ Application Submitted Successfully - {doc.company_name or 'Your Company'}"
        
        message = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px; font-weight: 600;">🎉 Application Submitted Successfully!</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Thank you for choosing Nexchar Ventures</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px 20px;">
                <p style="font-size: 16px; color: #2d3436; margin-bottom: 20px;">Dear <strong>{applicant_name}</strong>,</p>
                
                <p style="color: #636e72; line-height: 1.6; margin-bottom: 25px;">
                    Congratulations! Your franchise application has been successfully submitted and is now under review. 
                    We appreciate your interest in partnering with Nexchar Ventures.
                </p>
                
                <!-- Application Details Card -->
                <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 25px 0; border-left: 4px solid #74b9ff;">
                    <h3 style="margin: 0 0 15px 0; color: #2d3436; font-size: 18px;">📋 Your Application Details</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 8px 0; font-weight: 600; color: #636e72; width: 35%;">Application ID:</td>
                            <td style="padding: 8px 0; color: #2d3436; font-family: monospace; background: #e8f4f8; padding: 4px 8px; border-radius: 4px; font-weight: 600;">{doc.name}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: 600; color: #636e72;">Company Name:</td>
                            <td style="padding: 8px 0; color: #2d3436;">{doc.company_name or 'Not specified'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: 600; color: #636e72;">Project Name:</td>
                            <td style="padding: 8px 0; color: #2d3436;">{doc.project_name or 'Not specified'}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: 600; color: #636e72;">Email:</td>
                            <td style="padding: 8px 0; color: #2d3436;">{doc.email}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: 600; color: #636e72;">Status:</td>
                            <td style="padding: 8px 0; color: #74b9ff; font-weight: 600;">✅ Under Review</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; font-weight: 600; color: #636e72;">Submitted On:</td>
                            <td style="padding: 8px 0; color: #2d3436;">{frappe.utils.format_date(now(), 'medium')}</td>
                        </tr>
                    </table>
                </div>
                
                <!-- Next Steps -->
                <div style="background: #e8f4f8; border: 1px solid #bee5eb; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <h4 style="margin: 0 0 15px 0; color: #0c5460; font-size: 16px;">🚀 What Happens Next?</h4>
                    <ul style="color: #0c5460; margin: 0; padding-left: 20px; line-height: 1.8;">
                        <li><strong>Initial Review:</strong> Our team will review your application within 2-3 business days</li>
                        <li><strong>Technical Assessment:</strong> We'll evaluate your project details and feasibility</li>
                        <li><strong>Direct Contact:</strong> A franchise specialist will contact you for further discussion</li>
                        <li><strong>Partnership Decision:</strong> We'll provide feedback and next steps for partnership</li>
                    </ul>
                </div>
                
                <!-- Important Notice -->
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 25px 0;">
                    <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 14px;">📝 Important Information</h4>
                    <p style="margin: 0; color: #856404; font-size: 14px; line-height: 1.5;">
                        Please save your <strong>Application ID: {doc.name}</strong> for future reference. 
                        Our team will contact you at <strong>{doc.email}</strong> or <strong>{doc.phone_number or 'your provided contact number'}</strong> 
                        with updates on your application status.
                    </p>
                </div>
                
                <!-- Contact Info -->
                <div style="text-align: center; margin: 30px 0 20px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
                    <h4 style="margin: 0 0 10px 0; color: #2d3436;">Questions or Need Assistance?</h4>
                    <p style="margin: 0; color: #636e72;">Contact our support team:</p>
                    <p style="margin: 10px 0 0 0; color: #74b9ff; font-weight: 600;">
                        📧 support@nexcharventures.com<br>
                        📞 +91-XXX-XXX-XXXX
                    </p>
                </div>
                
                <p style="color: #636e72; line-height: 1.6; margin-top: 30px;">
                    Thank you for choosing Nexchar Ventures as your franchise partner. We look forward to working with you!
                </p>
                
                <div style="text-align: center; margin-top: 30px;">
                    <p style="margin: 0; color: #2d3436; font-weight: 600;">Best regards,</p>
                    <p style="margin: 5px 0 0 0; color: #74b9ff; font-weight: 700; font-size: 16px;">The Nexchar Ventures Team</p>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8f9fa; color: #636e72; text-align: center; padding: 20px; border-radius: 0 0 8px 8px; font-size: 12px;">
                <p style="margin: 0;">© 2024 Nexchar Ventures. All rights reserved.</p>
                <p style="margin: 5px 0 0 0;">This is an automated message. Please do not reply to this email.</p>
            </div>
        </div>
        """
        
        # Send the email
        frappe.sendmail(
            recipients=[email],
            subject=subject,
            message=message,
            now=True
        )
        
        # Also send notification to admins (optional)
        try:
            admin_subject = f"📨 New Application Submitted: {doc.company_name}"
            admin_message = f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #667eea;">New Franchise Application Notification</h2>
                <p>A new franchise application has been submitted and confirmation email sent to the applicant.</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="margin-top: 0; color: #495057;">Quick Overview</h3>
                    <p><strong>Application ID:</strong> {doc.name}</p>
                    <p><strong>Company:</strong> {doc.company_name}</p>
                    <p><strong>Contact:</strong> {applicant_name} ({doc.email})</p>
                    <p><strong>Project:</strong> {doc.project_name or 'Not specified'}</p>
                    <p><strong>Confirmation Email:</strong> ✅ Sent to {email}</p>
                </div>
                
                <p>Please review this application in the system and follow up accordingly.</p>
            </div>
            """
            
            frappe.sendmail(
                recipients=["admin@nexcharventures.com"],  # Configure this email
                subject=admin_subject,
                message=admin_message,
                now=True
            )
        except Exception as admin_email_error:
            frappe.log_error(f"Failed to send admin notification: {str(admin_email_error)}", "Admin Email Notification Error")
        
        return {
            "success": True,
            "message": "Confirmation email sent successfully",
            "email_sent_to": email,
            "application_id": application_id
        }
        
    except Exception as e:
        frappe.log_error(f"Error sending confirmation email: {str(e)}", "Franchise Portal Confirmation Email Error")
        return {
            "success": False,
            "message": f"Failed to send confirmation email: {str(e)}"
        }


def send_verification_email_to_user(email, company_name, verification_url):
    """Send verification email to the applicant"""
    subject = f"Verify Your Email - Franchise Application"
    
    message = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Email Verification Required</h2>
        
        <p>Dear Applicant,</p>
        
        <p>Thank you for starting your franchise application for <strong>{company_name or 'your company'}</strong>.</p>
        
        <p>To continue with your application, please verify your email address by clicking the button below:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{verification_url}" 
               style="background-color: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Verify Email & Continue Application
            </a>
        </div>
        
        <p style="color: #6c757d; font-size: 14px;">If the button doesn't work, copy and paste this link in your browser:</p>
        <p style="color: #667eea; word-break: break-all; font-size: 14px;">{verification_url}</p>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #495057;">What happens next?</h4>
            <ul style="color: #6c757d; margin-bottom: 0;">
                <li>Click the verification link</li>
                <li>You'll be taken to where you left off in the application</li>
                <li>Complete the remaining sections</li>
                <li>Submit your complete application for review</li>
            </ul>
        </div>
        
        <p style="color: #dc3545; font-size: 14px;"><strong>Note:</strong> This verification link will expire in 24 hours.</p>
        
        <p>Best regards,<br>
        <strong>Nexchar Ventures Team</strong></p>
    </div>
    """
    
    frappe.sendmail(
        recipients=[email],
        subject=subject,
        message=message,
        now=True
    )


def send_reapplication_verification_email(email, company_name, verification_url, previous_rejected_app=None):
    """Helper function to send verification email for reapplications after rejection"""
    try:
        # Build rejection context if available
        rejection_context = ""
        if previous_rejected_app:
            rejection_context = f"""
            <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                <h4 style="margin-top: 0; color: #856404;">📋 Previous Application Reference</h4>
                <p style="margin-bottom: 0; color: #856404;">
                    <strong>Previous Application ID:</strong> {previous_rejected_app.get('name', 'N/A')}<br>
                    <strong>Company:</strong> {previous_rejected_app.get('company_name', 'N/A')}<br>
                    <strong>Status:</strong> Rejected
                </p>
            </div>
            """
        
        frappe.sendmail(
            recipients=[email],
            subject=f"🔄 New Application Verification - {company_name}",
            message=f"""
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #28a745;">🔄 Starting Your New Franchise Application</h2>
                
                <p>Dear Applicant,</p>
                
                <p>We're pleased that you're ready to submit a new franchise application for <strong>{company_name}</strong>. To continue with your fresh application, please verify your email address.</p>
                
                {rejection_context}
                
                <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                    <h4 style="margin-top: 0; color: #155724;">✨ Fresh Start</h4>
                    <p style="margin-bottom: 0; color: #155724;">This is a completely new application. None of your previous application data will be carried over, giving you the opportunity to address any previous concerns and provide updated information.</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="{verification_url}" 
                       style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                        ✅ Verify Email & Start New Application
                    </a>
                </div>
                
                <p>After verification, you'll complete your new franchise application in 8 steps:</p>
                <ul>
                    <li>Step 1: Supplier Information</li>
                    <li>Step 2: Project Information</li>
                    <li>Step 3: Feedstock Description</li>
                    <li>Step 4: Origin, Sourcing & Supply Chain</li>
                    <li>Step 5: Monitoring & Measurement</li>
                    <li>Step 6: Sustainability Assessment & Market Impact</li>
                    <li>Step 7: Emissions & Energy Accounting</li>
                    <li>Step 8: Employee Details</li>
                </ul>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h4 style="margin-top: 0; color: #495057;">💡 Tips for Success</h4>
                    <ul style="margin-bottom: 0; color: #495057;">
                        <li>Review any feedback from your previous application</li>
                        <li>Ensure all documents are updated and complete</li>
                        <li>Double-check all information for accuracy</li>
                        <li>Save your progress regularly as you complete each step</li>
                    </ul>
                </div>
                
                <p>This verification link will expire in 24 hours.</p>
                
                <p>If you didn't request this new application, please ignore this email.</p>
                
                <p>We look forward to reviewing your new application!</p>
                
                <p>Best regards,<br>Nexchar Ventures Franchise Team</p>
            </div>
            """,
            now=True
        )
    except Exception as e:
        frappe.log_error(f"Failed to send reapplication verification email: {str(e)}", "Franchise Portal Reapplication Email Error")


def send_final_confirmation_email(doc):
    """Send final confirmation email after application completion"""
    subject = f"Application Submitted Successfully - {doc.company_name}"
    
    message = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Application Submitted Successfully!</h2>
        
        <p>Dear {doc.contact_person or 'Applicant'},</p>
        
        <p>Congratulations! Your franchise application has been successfully submitted and is now under review.</p>
        
        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
            <h3 style="margin-top: 0; color: #155724;">Your Application Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; width: 40%;">Application ID:</td>
                    <td style="padding: 8px 0;">{doc.name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Company:</td>
                    <td style="padding: 8px 0;">{doc.company_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                    <td style="padding: 8px 0;">{doc.email}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Project:</td>
                    <td style="padding: 8px 0;">{doc.project_name or 'Not specified'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Location:</td>
                    <td style="padding: 8px 0;">{doc.project_location or 'Not specified'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold;">Status:</td>
                    <td style="padding: 8px 0; color: #28a745; font-weight: bold;">Submitted</td>
                </tr>
            </table>
        </div>
        
        <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0066cc;">What's Next?</h3>
            <ol style="color: #495057; margin-bottom: 0;">
                <li><strong>Review Process:</strong> Our team will review your application within 2-3 business days</li>
                <li><strong>Initial Contact:</strong> We'll reach out to discuss your project in detail</li>
                <li><strong>Due Diligence:</strong> Technical and commercial feasibility assessment</li>
                <li><strong>Partnership Agreement:</strong> If approved, we'll proceed with partnership terms</li>
            </ol>
        </div>
        
        <p>Our team will contact you at <strong>{doc.email}</strong> or <strong>{doc.phone_number or 'the provided contact information'}</strong> once we have completed our initial review.</p>
        
        <p>If you have any questions in the meantime, please don't hesitate to contact us.</p>
        
        <p>Thank you for your interest in partnering with us!</p>
        
        <p>Best regards,<br>
        <strong>Nexchar Ventures Team</strong></p>
    </div>
    """
    
    frappe.sendmail(
        recipients=[doc.email],
        subject=subject,
        message=message,
        now=True
    )


@frappe.whitelist(allow_guest=True)
def get_google_maps_api_key():
    """Get Google Maps API key from site config securely"""
    try:
        # Get the API key from site config
        api_key = frappe.conf.get("google_maps_api_key")
        
        if not api_key:
            frappe.log_error("Google Maps API key not found in site config", "Maps Configuration Error")
            return {
                "success": False,
                "message": "Google Maps API key not configured"
            }
        
        return {
            "success": True,
            "api_key": api_key
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting Google Maps API key: {str(e)}", "Maps Configuration Error")
        return {
            "success": False,
            "message": "Error retrieving Maps configuration"
        }


def finalize_application(session_data, token, current_step=8):
    try:
        application_data = session_data["data"]
        email = session_data["email"]
        annual_volume = application_data.get('annual_volume_available')
        try:
            annual_volume_float = float(annual_volume) if annual_volume and str(annual_volume).strip() else 0
        except (ValueError, TypeError):
            annual_volume_float = 0
        if annual_volume_float <= 0:
            return {"success": False, "message": "Annual Volume Available is required and must be greater than 0"}
        if current_step >= 7:
            calculated_total = application_data.get('calculated_total')
            uncertainty_range = application_data.get('uncertainty_range')
            missing_step7_fields = []
            if not calculated_total or str(calculated_total).strip() == '':
                missing_step7_fields.append("Calculated Total (kg CO₂e/tonne)")
            if not uncertainty_range or str(uncertainty_range).strip() == '':
                missing_step7_fields.append("Uncertainty Range (%)")
            if missing_step7_fields:
                if len(missing_step7_fields) == 1:
                    error_msg = f"Please provide the {missing_step7_fields[0]}. This emissions data is required to complete your application."
                else:
                    error_msg = f"Please provide the following emissions data: {' and '.join(missing_step7_fields)}. This information is required to complete your application."
                return {"success": False, "message": error_msg}
        
        if current_step >= 8:
            # Validate Step 8 (Employee Details) required fields
            employee_first_name = application_data.get('employee_first_name')
            employee_gender = application_data.get('employee_gender')
            employee_date_of_birth = application_data.get('employee_date_of_birth')
            employee_date_of_joining = application_data.get('employee_date_of_joining')
            
            missing_step8_fields = []
            field_labels = {
                'employee_first_name': 'Employee First Name',
                'employee_gender': 'Employee Gender',
                'employee_date_of_birth': 'Employee Date of Birth',
                'employee_date_of_joining': 'Employee Date of Joining'
            }
            
            if not employee_first_name or str(employee_first_name).strip() == '':
                missing_step8_fields.append(field_labels['employee_first_name'])
            if not employee_gender or str(employee_gender).strip() == '':
                missing_step8_fields.append(field_labels['employee_gender'])
            if not employee_date_of_birth or str(employee_date_of_birth).strip() == '':
                missing_step8_fields.append(field_labels['employee_date_of_birth'])
            if not employee_date_of_joining or str(employee_date_of_joining).strip() == '':
                missing_step8_fields.append(field_labels['employee_date_of_joining'])
            
            if missing_step8_fields:
                if len(missing_step8_fields) == 1:
                    error_msg = f"Please provide the {missing_step8_fields[0]}. This employee information is required to complete your application."
                elif len(missing_step8_fields) == 2:
                    error_msg = f"Please provide the {missing_step8_fields[0]} and {missing_step8_fields[1]}. This employee information is required to complete your application."
                else:
                    last_field = missing_step8_fields.pop()
                    error_msg = f"Please provide the following employee information: {', '.join(missing_step8_fields)}, and {last_field}. This information is required to complete your application."
                return {"success": False, "message": error_msg}
        existing_applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email},
            fields=["name"]
        )
        meta = frappe.get_meta("Franchise Signup Application")
        valid_fields = [df.fieldname for df in meta.fields]
        if existing_applications:
            doc_name = existing_applications[0].name
            updates = {}
            for key, value in application_data.items():
                if key != 'generation_locations' and key in valid_fields:
                    updates[key] = value
            updates['status'] = "Submitted"
            if session_data.get("verified"):
                updates['email_verified'] = 1
                if not updates.get('email_verified_at'):
                    updates['email_verified_at'] = now()
            frappe.db.set_value("Franchise Signup Application", doc_name, updates)
            if 'generation_locations' in application_data and isinstance(application_data['generation_locations'], list):
                doc = frappe.get_doc("Franchise Signup Application", doc_name)
                doc.generation_locations = []
                for location in application_data['generation_locations']:
                    if isinstance(location, dict) and location.get('address') and location.get('gps_coordinates'):
                        doc.append('generation_locations', {
                            'address': location['address'],
                            'gps_coordinates': location['gps_coordinates']
                        })
                doc.save(ignore_permissions=True, ignore_version=True)
            frappe.db.commit()
            frappe.cache().delete_value(f"franchise_signup_{token}")
            return {"success": True, "message": "Application submitted successfully!", "application_id": doc_name}
        else:
            doc = frappe.new_doc("Franchise Signup Application")
            if 'generation_locations' in application_data and isinstance(application_data['generation_locations'], list):
                for location in application_data['generation_locations']:
                    if isinstance(location, dict) and location.get('address') and location.get('gps_coordinates'):
                        doc.append('generation_locations', location_data)
            for key, value in application_data.items():
                if key != 'generation_locations' and hasattr(doc, key):
                    setattr(doc, key, value)
            if session_data.get("verified"):
                doc.email_verified = 1
                doc.email_verified_at = now()
            doc.status = "Submitted"
            doc.insert(ignore_permissions=True)
            frappe.db.commit()
            frappe.cache().delete_value(f"franchise_signup_{token}")
            return {"success": True, "message": "Application submitted successfully!", "application_id": doc.name}
    except Exception as e:
        error_msg = str(e)
        truncated_msg = error_msg[:100] + "..." if len(error_msg) > 100 else error_msg
        frappe.log_error(f"Error finalizing application: {truncated_msg}", "Franchise Portal Finalization Error")
        return {"success": False, "message": f"Error finalizing application: {error_msg}"}


@frappe.whitelist(allow_guest=True)
def save_step(data):
    """Save step data for the franchise application"""
    try:
        # Log RAW input data BEFORE any processing
        debug_file = os.path.join(frappe.get_site_path(), 'debug_save.txt')
        with open(debug_file, 'a') as f:
            f.write(f"\n=== RAW API INPUT {frappe.utils.now()} ===\n")
            f.write(f"Raw data type: {type(data)}\n")
            f.write(f"Raw data: {str(data)[:1000]}...\n")  # First 1000 chars
        
        # Handle JSON string data from frontend
        if isinstance(data, str):
            import json
            data = json.loads(data)
        
        data = frappe._dict(data)
        
        # File-based debug logging
        debug_file = os.path.join(frappe.get_site_path(), 'debug_save.txt')
        with open(debug_file, 'a') as f:
            f.write(f"\n=== SAVE_STEP DEBUG {frappe.utils.now()} ===\n")
            f.write(f"Data keys: {list(data.keys())}\n")
            if 'source_type' in data:
                f.write(f"source_type: '{data.source_type}' (type: {type(data.source_type)})\n")
            if 'generation_locations' in data:
                f.write(f"generation_locations: {data.generation_locations}\n")
            
            # Check for Step 5 fields
            step5_fields = ['electricity_meter_id', 'meter_type_model', 'monitoring_interval', 
                           'weighbridge_id', 'testing_laboratory_name', 'automatic_data_upload']
            step5_data = {k: v for k, v in data.items() if k in step5_fields}
            if step5_data:
                f.write(f"STEP 5 FIELDS FOUND: {step5_data}\n")
            else:
                f.write(f"NO STEP 5 FIELDS IN DATA\n")
        
        # Validate required fields
        if not data.get('email') or not data.get('email').strip():
            return {"success": False, "message": "Email is required"}
        
        if not data.get('company_name') or not data.get('company_name').strip():
            return {"success": False, "message": "Company name is required"}
        
        # Check for existing application
        existing_applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": data.email},
            fields=["name", "status"]
        )
        
        if existing_applications:
            # Update existing application
            application = frappe.get_doc("Franchise Signup Application", existing_applications[0].name)
            refresh_doc_modified(application)
            
            # Update fields from data - only include fields that exist in the doctype
            doctype_fields = frappe.get_meta("Franchise Signup Application").get_fieldnames_with_value()
            
            # Debug: log doctype fields to check if generation_locations is included
            with open(debug_file, 'a') as f:
                f.write(f"DOCTYPE FIELDS COUNT: {len(doctype_fields)}\n")
                f.write(f"GENERATION_LOCATIONS IN DOCTYPE FIELDS: {'generation_locations' in doctype_fields}\n")
                if 'generation_locations' not in doctype_fields:
                    f.write(f"CHILD TABLE FIELDS: {[f for f in doctype_fields if 'generation' in f.lower()]}\n")
            
            for key, value in data.items():
                # Handle child table fields separately (not in doctype_fields)
                if key == 'generation_locations' and isinstance(value, list):
                    # Debug logging for generation_locations
                    with open(debug_file, 'a') as f:
                        f.write(f"PROCESSING generation_locations: {value}\n")
                    
                    # Clear existing child records
                    application.set('generation_locations', [])
                    # Add new child records
                    for location_data in value:
                        application.append('generation_locations', location_data)
                        with open(debug_file, 'a') as f:
                            f.write(f"ADDED location: {location_data}\n")
                # Handle regular fields that exist in doctype
                elif key in doctype_fields and key not in ['name', 'doctype']:
                    # Special handling for source_type checkbox data
                    if key == 'source_type':
                        # Ensure source_type is properly formatted as comma-separated string
                        if isinstance(value, list):
                            value = ', '.join(value)
                        setattr(application, key, value)
                        with open(debug_file, 'a') as f:
                            f.write(f"SET source_type to '{value}'\n")
                    else:
                        setattr(application, key, value)
                        # File debug: track field setting
                        with open(debug_file, 'a') as f:
                            f.write(f"SET {key} to '{value}' on app {application.name}\n")
                else:
                    # Debug: track fields that are being skipped
                    with open(debug_file, 'a') as f:
                        f.write(f"SKIPPED {key} (hasattr={hasattr(application, key)}, in_doctype_fields={key in doctype_fields}, excluded={key in ['name', 'doctype']})\n")
            
            application.modified_at = frappe.utils.now()
            application.save(ignore_permissions=True, ignore_version=True)
            frappe.db.commit()
            
            # File debug: check what was saved (Step 5 fields)
            step5_fields = ['electricity_meter_id', 'meter_type_model', 'monitoring_interval', 
                           'weighbridge_id', 'testing_laboratory_name', 'automatic_data_upload']
            for field in step5_fields:
                if field in data:
                    saved_value = frappe.db.get_value("Franchise Signup Application", application.name, field)
                    with open(debug_file, 'a') as f:
                        f.write(f"SAVED {field} in DB: '{saved_value}'\n")
            
            return {"success": True, "message": "Application updated successfully", "application_id": application.name}
        
        else:
            # Create new application
            application = frappe.new_doc("Franchise Signup Application")
            
            # Set fields from data
            for key, value in data.items():
                if hasattr(application, key) and key not in ['name', 'doctype']:
                    # Special handling for generation_locations table
                    if key == 'generation_locations' and isinstance(value, list):
                        # Debug logging for generation_locations
                        with open(debug_file, 'a') as f:
                            f.write(f"NEW APP: PROCESSING generation_locations: {value}\n")
                        
                        for location_data in value:
                            application.append('generation_locations', location_data)
                            with open(debug_file, 'a') as f:
                                f.write(f"NEW APP: ADDED location: {location_data}\n")
                    # Special handling for source_type checkbox data
                    elif key == 'source_type':
                        # Ensure source_type is properly formatted as comma-separated string
                        if isinstance(value, list):
                            value = ', '.join(value)
                        setattr(application, key, value)
                        with open(debug_file, 'a') as f:
                            f.write(f"NEW APP: SET source_type to '{value}'\n")
                    else:
                        setattr(application, key, value)
                        # File debug: track field setting
                        with open(debug_file, 'a') as f:
                            f.write(f"SET {key} to '{value}' on new app\n")
                else:
                    # Debug: track fields that are being skipped
                    with open(debug_file, 'a') as f:
                        f.write(f"SKIPPED {key} (hasattr={hasattr(application, key)}, excluded={key in ['name', 'doctype']})\n")
            
            application.created_at = frappe.utils.now()
            application.modified_at = frappe.utils.now()
            application.insert(ignore_permissions=True, ignore_version=True)
            frappe.db.commit()
            
            # File debug: check what was saved (Step 5 fields)
            step5_fields = ['electricity_meter_id', 'meter_type_model', 'monitoring_interval', 
                           'weighbridge_id', 'testing_laboratory_name', 'automatic_data_upload']
            for field in step5_fields:
                if field in data:
                    saved_value = frappe.db.get_value("Franchise Signup Application", application.name, field)
                    with open(debug_file, 'a') as f:
                        f.write(f"INSERTED {field} in DB: '{saved_value}'\n")
            
            return {"success": True, "message": "Application created successfully", "application_id": application.name}
            
    except Exception as e:
        error_msg = str(e)
        # Truncate error message for logging to prevent title length issues
        truncated_msg = error_msg[:100] + "..." if len(error_msg) > 100 else error_msg
        frappe.log_error(f"Error saving application: {truncated_msg}", "Save Step Error")
        return {"success": False, "message": f"Error saving application: {error_msg}"}


@frappe.whitelist(allow_guest=True)
def test_step5_fields():
    """Test if Step 5 fields exist in the doctype"""
    try:
        # Create a test document to check field existence
        doc = frappe.new_doc("Franchise Signup Application")
        
        step5_fields = [
            'electricity_meter_id', 'meter_type_model', 'monitoring_interval',
            'last_calibration_date', 'next_calibration_due', 'weighbridge_id',
            'capacity', 'accuracy_rating', 'continuous_recording', 'data_logging_system',
            'testing_laboratory_name', 'lab_accreditation_number', 'testing_standards_used',
            'testing_standards_other', 'analysis_frequency', 'automatic_data_upload',
            'data_storage_method', 'backup_system', 'retention_period'
        ]
        
        field_status = {}
        for field in step5_fields:
            field_status[field] = hasattr(doc, field)
        
        return {
            "success": True,
            "message": "Step 5 field check completed",
            "field_status": field_status,
            "total_fields": len(step5_fields),
            "existing_fields": sum(field_status.values())
        }
        
    except Exception as e:
        return {"success": False, "message": f"Error testing Step 5 fields: {str(e)}"}


# File Upload Functionality
@frappe.whitelist(allow_guest=True)
def upload_file():
    """Handle file uploads for franchise application documents"""
    try:
        # Get uploaded file from request
        uploaded_file = frappe.request.files.get('file')
        field_name = frappe.form_dict.get('field_name')
        
        if not uploaded_file:
            return {"success": False, "message": "No file uploaded"}
        
        if not field_name:
            return {"success": False, "message": "Field name is required"}
        
        # Validate file size (25MB limit)
        max_size = 25 * 1024 * 1024  # 25MB in bytes
        file_size = len(uploaded_file.read())
        uploaded_file.seek(0)  # Reset file pointer
        
        if file_size > max_size:
            return {"success": False, "message": "File size exceeds 25MB limit"}
        
        # Validate file type
        allowed_extensions = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.bmp']
        filename = uploaded_file.filename
        file_extension = '.' + filename.split('.')[-1].lower()
        
        if file_extension not in allowed_extensions:
            return {"success": False, "message": "File type not supported"}
        
        # Create file document record in database using Frappe's proper file handling
        uploaded_file.seek(0)  # Reset file pointer
        file_content = uploaded_file.read()
        
        # Use Frappe's built-in file creation system
        file_doc = frappe.get_doc({
            "doctype": "File",
            "file_name": filename,
            "is_private": 1,
            "content": file_content
        })
        
        file_doc.insert(ignore_permissions=True)
        frappe.db.commit()
        
        # Use the file document's unique_url property which includes proper fid parameter
        # This ensures proper permission checking by Frappe
        site_url = frappe.utils.get_url()
        file_url = f"{site_url}{file_doc.unique_url}"
        
        return {
            "success": True,
            "message": "File uploaded successfully",
            "file_url": file_url,
            "file_name": filename,
            "file_size": file_size,
            "file_id": file_doc.name
        }
        
    except Exception as e:
        frappe.log_error(f"File upload error: {str(e)}", "Franchise File Upload")
        return {"success": False, "message": f"Upload failed: {str(e)}"}


@frappe.whitelist()
def test_file_access():
    """Test function to verify file access permissions for System Managers"""
    try:
        # Get current user info
        user = frappe.session.user
        roles = frappe.get_roles()
        
        # Get a recent private file from the database
        files = frappe.get_all(
            "File",
            filters={"is_private": 1},
            fields=["name", "file_name", "file_url", "owner"],
            limit=5,
            order_by="creation desc"
        )
        
        file_access_info = []
        for file_info in files:
            try:
                # Get the file document
                file_doc = frappe.get_doc("File", file_info.name)
                
                # Check if user has permission to access this file
                from frappe.core.doctype.file.file import has_permission
                can_read = has_permission(file_doc, "read")
                
                file_access_info.append({
                    "file_id": file_info.name,
                    "file_name": file_info.file_name,
                    "file_url": file_info.file_url,
                    "unique_url": file_doc.unique_url,
                    "owner": file_info.owner,
                    "can_read": can_read,
                    "is_private": file_doc.is_private
                })
            except Exception as e:
                file_access_info.append({
                    "file_id": file_info.name,
                    "error": str(e)
                })
        
        return {
            "success": True,
            "current_user": user,
            "user_roles": roles,
            "files_checked": len(files),
            "file_access_info": file_access_info
        }
        
    except Exception as e:
        frappe.log_error(f"File access test error: {str(e)}", "File Access Test")
        return {"success": False, "message": f"Test failed: {str(e)}"}


@frappe.whitelist()
def fix_existing_file_urls():
    """Fix existing file URLs in Franchise Signup Applications to use proper fid format"""
    try:
        # Fields that contain file URLs
        file_fields = [
            'feedstock_payment_file',
            'chain_of_custody_file',
            'supplier_agreements_file', 
            'origin_certificates_file',
            'transportation_records_file',
            'environmental_permits_file',
            'market_leakage_study_file'
        ]
        
        fixed_count = 0
        
        # Get all applications with file URLs
        applications = frappe.get_all(
            "Franchise Signup Application",
            fields=["name"] + file_fields
        )
        
        for app in applications:
            app_doc = frappe.get_doc("Franchise Signup Application", app.name)
            needs_save = False
            
            for field in file_fields:
                old_url = getattr(app_doc, field, None)
                if old_url and not "fid=" in old_url:
                    # Try to find the file by URL
                    try:
                        file_docs = frappe.get_all(
                            "File",
                            filters={"file_url": old_url.replace(frappe.utils.get_url(), "")},
                            fields=["name"]
                        )
                        
                        if file_docs:
                            file_doc = frappe.get_doc("File", file_docs[0].name)
                            # Update with proper unique URL
                            new_url = f"{frappe.utils.get_url()}{file_doc.unique_url}"
                            setattr(app_doc, field, new_url)
                            needs_save = True
                            fixed_count += 1
                    except Exception as e:
                        frappe.log_error(f"Error fixing URL for {field} in {app.name}: {str(e)}")
            
            if needs_save:
                app_doc.save(ignore_permissions=True)
        
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Fixed {fixed_count} file URLs",
            "applications_checked": len(applications)
        }
        
    except Exception as e:
        frappe.log_error(f"Error fixing file URLs: {str(e)}", "Fix File URLs")
        return {"success": False, "message": f"Error: {str(e)}"}


@frappe.whitelist()
def test_authenticated_file_access(file_id):
    """Test accessing a specific file through Frappe's authenticated system"""
    try:
        if not file_id:
            return {"success": False, "message": "File ID required"}
        
        # Get the file document
        file_doc = frappe.get_doc("File", file_id)
        
        # Check permissions
        from frappe.core.doctype.file.file import has_permission
        can_read = has_permission(file_doc, "read")
        
        if not can_read:
            return {"success": False, "message": "No permission to access this file"}
        
        # Try to get file content (this tests if file physically exists and is accessible)
        try:
            content = file_doc.get_content()
            content_size = len(content) if content else 0
        except Exception as e:
            return {"success": False, "message": f"Error reading file content: {str(e)}"}
        
        return {
            "success": True,
            "message": "File access successful",
            "file_info": {
                "name": file_doc.name,
                "file_name": file_doc.file_name,
                "file_url": file_doc.file_url,
                "unique_url": file_doc.unique_url,
                "is_private": file_doc.is_private,
                "content_size": content_size,
                "owner": file_doc.owner,
                "can_read": can_read
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error testing file access: {str(e)}", "Test File Access")
        return {"success": False, "message": f"Error: {str(e)}"}


@frappe.whitelist()
def debug_file_urls():
    """Debug function to check current file URL formats in the database"""
    try:
        # Get all applications with any file URLs
        applications = frappe.get_all(
            "Franchise Signup Application",
            fields=["name", "feedstock_payment_file", "chain_of_custody_file", 
                   "supplier_agreements_file", "origin_certificates_file",
                   "transportation_records_file", "environmental_permits_file", 
                   "market_leakage_study_file"]
        )
        
        file_url_info = []
        
        for app in applications:
            app_info = {"application_id": app.name, "files": {}}
            
            # Check each file field
            file_fields = [
                'feedstock_payment_file', 'chain_of_custody_file', 
                'supplier_agreements_file', 'origin_certificates_file',
                'transportation_records_file', 'environmental_permits_file', 
                'market_leakage_study_file'
            ]
            
            for field in file_fields:
                url = app.get(field)
                if url:
                    app_info["files"][field] = {
                        "url": url,
                        "has_fid": "fid=" in url,
                        "is_private": "/private/" in url,
                        "is_full_url": url.startswith("http")
                    }
            
            if app_info["files"]:
                file_url_info.append(app_info)
        
        return {
            "success": True,
            "applications_with_files": len(file_url_info),
            "file_url_info": file_url_info
        }
        
    except Exception as e:
        frappe.log_error(f"Error debugging file URLs: {str(e)}", "Debug File URLs")
        return {"success": False, "message": f"Error: {str(e)}"}


@frappe.whitelist()
def fix_doctype_file_urls():
    """Fix file URLs specifically for DocType display with proper fid parameters"""
    try:
        fixed_count = 0
        
        # Get all applications
        applications = frappe.get_all("Franchise Signup Application", fields=["name"])
        
        for app_data in applications:
            app_doc = frappe.get_doc("Franchise Signup Application", app_data.name)
            needs_save = False
            
            # File fields to check
            file_fields = [
                'feedstock_payment_file', 'chain_of_custody_file', 
                'supplier_agreements_file', 'origin_certificates_file',
                'transportation_records_file', 'environmental_permits_file', 
                'market_leakage_study_file'
            ]
            
            for field in file_fields:
                current_url = getattr(app_doc, field, None)
                
                if current_url and "/private/files/" in current_url:
                    # If it doesn't have fid parameter, we need to find it
                    if "fid=" not in current_url:
                        # Extract just the file path part
                        if current_url.startswith("http"):
                            file_path = current_url.split("/private/files/")[1].split("?")[0]
                        else:
                            file_path = current_url.replace("/private/files/", "").split("?")[0]
                        
                        # Find the file document by file_url or file_name
                        file_docs = frappe.get_all(
                            "File",
                            filters=[
                                ["file_url", "like", f"%{file_path}%"]
                            ],
                            fields=["name", "file_url", "file_name"],
                            limit=1
                        )
                        
                        if not file_docs:
                            # Try searching by file name if URL search failed
                            file_docs = frappe.get_all(
                                "File",
                                filters=[
                                    ["file_name", "=", file_path]
                                ],
                                fields=["name", "file_url", "file_name"],
                                limit=1
                            )
                        
                        if file_docs:
                            file_doc = frappe.get_doc("File", file_docs[0].name)
                            # Generate the proper URL with fid
                            proper_url = f"{frappe.utils.get_url()}{file_doc.unique_url}"
                            setattr(app_doc, field, proper_url)
                            needs_save = True
                            fixed_count += 1
                            
                            frappe.logger().info(f"Fixed {field} URL: {current_url} -> {proper_url}")
            
            if needs_save:
                app_doc.save(ignore_permissions=True)
        
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"Fixed {fixed_count} file URLs for DocType display",
            "fixed_count": fixed_count
        }
        
    except Exception as e:
        frappe.log_error(f"Error fixing DocType file URLs: {str(e)}", "Fix DocType File URLs")
        return {"success": False, "message": f"Error: {str(e)}"}


# Resume and Email Verification Functionality
def serialize_datetimes(data):
    """Recursively convert all datetime and date objects in a dict to ISO strings."""
    if isinstance(data, dict):
        return {k: serialize_datetimes(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [serialize_datetimes(v) for v in data]
    elif isinstance(data, (datetime.datetime, datetime.date)):
        return data.isoformat()
    else:
        return data


@frappe.whitelist(allow_guest=True)
def send_resume_email(email):
    try:
        # Debug log to track duplicate calls
        frappe.logger().info(f"send_resume_email called for: {email}")
        
        if not email or not email.strip():
            return {"success": False, "message": "Email is required"}
        # Check for incomplete application (status Draft or In Progress)
        applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email, "status": ["in", ["Draft", "In Progress"]]},
            fields=["name", "current_step", "status"]
        )
        if not applications:
            return {"success": False, "message": "No incomplete application found for this email."}
        # Generate resume token
        resume_token = str(uuid.uuid4())
        session_key = f"franchise_signup_{resume_token}"
        # Get application data
        doc = frappe.get_doc("Franchise Signup Application", applications[0].name)
        session_data = {
            "email": doc.email,
            "data": doc.as_dict(),
            "current_step": doc.current_step or 1,
            "verified": True,
            "created_at": now()
        }
        session_data = serialize_datetimes(session_data)
        frappe.cache().set_value(session_key, json.dumps(session_data), expires_in_sec=86400)
        # Create resume URL
        site_url = frappe.utils.get_url()
        resume_url = f"{site_url}/signup?resume={resume_token}"
        # Debug log before sending
        frappe.logger().info(f"About to send resume email to {email} with link {resume_url}")
        send_resume_email_to_user(email, doc.company_name or "", resume_url)
        frappe.logger().info(f"Resume email sent successfully to {email}")
        return {"success": True, "message": "Resume link sent successfully."}
    except Exception as e:
        frappe.log_error(f"Error sending resume email: {str(e)}", "Franchise Portal Resume Error")
        return {"success": False, "message": f"Error sending resume email: {str(e)}"}


def send_resume_email_to_user(email, company_name, resume_url):
    subject = "Resume Your Franchise Application"
    message = f"""
        <p>Dear {company_name or 'Applicant'},</p>
        <p>We noticed you started a franchise application but did not complete it. You can resume your application by clicking the link below:</p>
        <p><a href='{resume_url}' style='background:#667eea;color:white;padding:10px 20px;border-radius:5px;text-decoration:none;'>Resume Application</a></p>
        <p>If you did not request this, you can ignore this email.</p>
        <p>Best regards,<br>Nexchar Ventures Team</p>
    """
    frappe.sendmail(recipients=[email], subject=subject, message=message, now=True)


@frappe.whitelist(allow_guest=True)
def verify_resume_token(token):
    """Validate resume token and return session data"""
    try:
        if not token:
            return {"success": False, "message": "Resume token is required"}
        session_key = f"franchise_signup_{token}"
        session_data_str = frappe.cache().get_value(session_key)
        if not session_data_str:
            return {"success": False, "message": "Invalid or expired resume token"}
        session_data = json.loads(session_data_str)
        # Always refresh session data from the latest DocType
        email = session_data.get('email') or session_data.get('data', {}).get('email')
        if email:
            applications = frappe.get_all(
                "Franchise Signup Application",
                filters={"email": email},
                fields=["name", "current_step"]
            )
            if applications:
                doc = frappe.get_doc("Franchise Signup Application", applications[0].name)
                session_data = {
                    "email": doc.email,
                    "data": doc.as_dict(),
                    "current_step": doc.current_step or 1,
                    "verified": True,
                    "created_at": now()
                }
                session_data = serialize_datetimes(session_data)
                frappe.cache().set_value(session_key, json.dumps(session_data), expires_in_sec=86400)
        return {
            "success": True,
            "message": "Resume token valid",
            "session_data": session_data,
            "current_step": session_data.get("current_step", 1)
        }
    except Exception as e:
        # frappe.log_error(f"Error verifying resume token: {str(e)}", "Franchise Portal Resume Error")
        return {"success": False, "message": f"Error verifying resume token: {str(e)}"}


def save_verified_email_to_doctype(email, session_data):
    """Save or update doctype with verified email data - handles reapplications"""
    try:
        debug_file = os.path.join(frappe.get_site_path(), 'debug_save_verified.txt')
        with open(debug_file, 'a') as f:
            f.write(f"\n=== ENTER save_verified_email_to_doctype {frappe.utils.now()} ===\n")
            f.write(f"Email: {email}\n")
            f.write(f"Is reapplication: {session_data.get('is_reapplication', False)}\n")
            f.write(f"Session data: {json.dumps(session_data)[:1000]}...\n")
        
        # Check if this is a reapplication after rejection
        is_reapplication = session_data.get("is_reapplication", False)
        
        if is_reapplication:
            # For reapplications: Always create a NEW application, don't update existing rejected one
            with open(debug_file, 'a') as f:
                f.write(f"🔄 REAPPLICATION: Creating new application instead of updating existing\n")
            
            # Create new application document
            try:
                doc = frappe.new_doc("Franchise Signup Application")
                doc.email = email
                doc.original_email = email  # Set original email to prevent auto-modification
                doc.email_verified = 1
                doc.email_verified_at = now()
                application_data = session_data.get("data", {})
                basic_fields = [
                    "company_name", "contact_person", "phone_number", 
                    "company_address", "country_of_operation"
                ]
                for field in basic_fields:
                    if field in application_data and application_data[field]:
                        setattr(doc, field, application_data[field])
                doc.status = "Draft"
                doc.current_step = 1
                if not doc.naming_series:
                    doc.naming_series = "FSA-.YYYY.-"
                
                # Use flag to prevent automatic email modification 
                frappe.flags.ignore_email_uniqueness = True
                doc.insert(ignore_permissions=True)
                frappe.flags.ignore_email_uniqueness = False
                
                frappe.db.commit()
                with open(debug_file, 'a') as f:
                    f.write(f"✅ Created NEW reapplication {doc.name} for email {email} (original preserved)\n")
                return doc.name
            except Exception as e:
                with open(debug_file, 'a') as f:
                    f.write(f"❌ Exception during reapplication doc.insert: {str(e)}\n")
                frappe.log_error(f"Exception during reapplication doc.insert: {str(e)}", "Reapplication Creation Error")
                return None
        else:
            # For regular verification: Check if application already exists and update it
            existing_applications = frappe.get_all(
                "Franchise Signup Application",
                filters={"email": email},
                fields=["name", "status"]
            )
            if existing_applications:
                # Only update if it's not a rejected application
                existing_app = existing_applications[0]
                if existing_app.get("status") == "Rejected":
                    with open(debug_file, 'a') as f:
                        f.write(f"⚠️ Found rejected application {existing_app['name']}, creating new instead\n")
                    # Even for regular verification, if existing app is rejected, create new
                    try:
                        doc = frappe.new_doc("Franchise Signup Application")
                        doc.email = email
                        doc.original_email = email  # Set original email to prevent auto-modification
                        doc.email_verified = 1
                        doc.email_verified_at = now()
                        application_data = session_data.get("data", {})
                        basic_fields = [
                            "company_name", "contact_person", "phone_number", 
                            "company_address", "country_of_operation"
                        ]
                        for field in basic_fields:
                            if field in application_data and application_data[field]:
                                setattr(doc, field, application_data[field])
                        doc.status = "Draft"
                        doc.current_step = 1
                        if not doc.naming_series:
                            doc.naming_series = "FSA-.YYYY.-"
                        
                        # Use flag to prevent automatic email modification
                        frappe.flags.ignore_email_uniqueness = True
                        doc.insert(ignore_permissions=True)
                        frappe.flags.ignore_email_uniqueness = False
                        
                        frappe.db.commit()
                        with open(debug_file, 'a') as f:
                            f.write(f"✅ Created NEW application {doc.name} (existing was rejected, original email preserved)\n")
                        return doc.name
                    except Exception as e:
                        with open(debug_file, 'a') as f:
                            f.write(f"❌ Exception during new doc creation: {str(e)}\n")
                        frappe.log_error(f"Exception during new doc creation: {str(e)}", "Email Verification Error")
                        return None
                else:
                    # Update existing non-rejected application
                    doc_name = existing_app["name"]
                    updates = {
                        "email_verified": 1,
                        "email_verified_at": now()
                    }
                    application_data = session_data.get("data", {})
                    basic_fields = [
                        "company_name", "contact_person", "phone_number", 
                        "company_address", "country_of_operation"
                    ]
                    for field in basic_fields:
                        if field in application_data and application_data[field]:
                            updates[field] = application_data[field]
                    frappe.db.set_value("Franchise Signup Application", doc_name, updates)
                    frappe.db.commit()
                    with open(debug_file, 'a') as f:
                        f.write(f"Updated existing application {doc_name} with verified email\n")
                    return doc_name
            else:
                # No existing application found - create new one
                try:
                    doc = frappe.new_doc("Franchise Signup Application")
                    doc.email = email
                    doc.email_verified = 1
                    doc.email_verified_at = now()
                    application_data = session_data.get("data", {})
                    basic_fields = [
                        "company_name", "contact_person", "phone_number", 
                        "company_address", "country_of_operation"
                    ]
                    for field in basic_fields:
                        if field in application_data and application_data[field]:
                            setattr(doc, field, application_data[field])
                    doc.status = "Draft"
                    doc.current_step = 1
                    if not doc.naming_series:
                        doc.naming_series = "FSA-.YYYY.-"
                    doc.insert(ignore_permissions=True)
                    frappe.db.commit()
                    with open(debug_file, 'a') as f:
                        f.write(f"Created new application {doc.name} with verified email\n")
                    return doc.name
                except Exception as e:
                    with open(debug_file, 'a') as f:
                        f.write(f"Exception during doc.insert: {str(e)}\n")
                    frappe.log_error(f"Exception during doc.insert: {str(e)}", "Email Verification Error")
                    return None
    except Exception as e:
        debug_file = os.path.join(frappe.get_site_path(), 'debug_save_verified.txt')
        with open(debug_file, 'a') as f:
            f.write(f"Exception in save_verified_email_to_doctype: {str(e)}\n")
        frappe.log_error(f"Error saving verified email to doctype: {str(e)}", "Email Verification Error")
        return None


@frappe.whitelist(allow_guest=True)
def test_email_verification_flow():
    """Test the email verification flow"""
    try:
        # Test data
        test_email = "test@example.com"
        test_data = {
            "company_name": "Test Company",
            "contact_person": "Test Person",
            "phone_number": "1234567890"
        }
        
        # Step 1: Send verification email
        result1 = send_verification_email(test_email, test_data)
        if not result1.get("success"):
            return {"success": False, "message": f"Failed to send verification email: {result1.get('message')}"}
        
        verification_token = result1.get("verification_token")
        
        # Step 2: Verify email
        result2 = verify_email(verification_token)
        if not result2.get("success"):
            return {"success": False, "message": f"Failed to verify email: {result2.get('message')}"}
        
        # Step 3: Check if doctype was created/updated
        applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": test_email},
            fields=["name", "email_verified", "email_verified_at", "company_name"]
        )
        
        if not applications:
            return {"success": False, "message": "No application found after verification"}
        
        app = applications[0]
        
        return {
            "success": True,
            "message": "Email verification flow test completed successfully",
            "application_id": app.name,
            "email_verified": app.email_verified,
            "email_verified_at": app.email_verified_at,
            "company_name": app.company_name
        }
        
    except Exception as e:
        return {"success": False, "message": f"Test failed: {str(e)}"}


@frappe.whitelist(allow_guest=True)
def get_email_verification_status(email):
    """Get the email verification status for an application"""
    try:
        if not email:
            return {"success": False, "message": "Email is required"}
        
        applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email},
            fields=["name", "email_verified", "email_verified_at", "status", "current_step"],
            limit=1
        )
        
        if not applications:
            return {"success": False, "message": "Application not found"}
        
        app = applications[0]
        
        return {
            "success": True,
            "email_verified": bool(app.email_verified),
            "email_verified_at": app.email_verified_at,
            "status": app.status,
            "current_step": app.current_step,
            "application_id": app.name
        }
        
    except Exception as e:
        return {"success": False, "message": f"Error getting verification status: {str(e)}"}


@frappe.whitelist(allow_guest=True)
def get_application(email=None, name=None):
    """Fetch the latest Franchise Signup Application by email or name"""
    if not email and not name:
        return {"success": False, "message": "Email or name is required"}
    filters = {}
    if email:
        filters["email"] = email
    if name:
        filters["name"] = name
    applications = frappe.get_all("Franchise Signup Application", filters=filters, fields=["name"])
    if not applications:
        return {"success": False, "message": "Application not found"}
    doc = frappe.get_doc("Franchise Signup Application", applications[0].name)
    return {"success": True, "application": doc.as_dict()}


@frappe.whitelist(allow_guest=True)
def check_reapplication_eligibility(email):
    """Check if a user can create a new application after rejection"""
    try:
        if not email or not email.strip():
            return {"success": False, "message": "Email is required"}
        
        # Get all applications for this email
        applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email},
            fields=["name", "status", "company_name", "rejected_at", "rejection_reason"],
            order_by="creation desc"
        )
        
        if not applications:
            return {
                "success": True, 
                "can_reapply": True, 
                "message": "No previous applications found. You can proceed with a new application.",
                "previous_applications": []
            }
        
        # Check application statuses
        rejected_apps = [app for app in applications if app.status == "Rejected"]
        non_rejected_apps = [app for app in applications if app.status != "Rejected"]
        
        if non_rejected_apps:
            # Has active applications (Draft, In Progress, Submitted, Approved)
            active_app = non_rejected_apps[0]
            
            # Special message for approved applications - they're already franchise partners
            if active_app.status == "Approved":
                return {
                    "success": True,
                    "can_reapply": False,
                    "message": "🎉 You are already an approved franchise partner! You cannot submit another application as you are already part of our franchise network. If you need assistance with your existing franchise, please contact our support team.",
                    "active_application": active_app,
                    "previous_applications": applications,
                    "is_approved_partner": True
                }
            else:
                # Generic message for other active statuses (Draft, In Progress, Submitted)
                return {
                    "success": True,
                    "can_reapply": False,
                    "message": f"You have an active application (Status: {active_app.status}) with ID: {active_app.name}. You can only create a new application if your previous application was rejected.",
                    "active_application": active_app,
                    "previous_applications": applications,
                    "is_approved_partner": False
                }
            
        else:
            # Only has rejected applications - can reapply
            latest_rejected = rejected_apps[0] if rejected_apps else None
            return {
                "success": True,
                "can_reapply": True,
                "message": "Your previous application was rejected. You can submit a new application.",
                "latest_rejected_application": latest_rejected,
                "previous_applications": applications
            }
            
    except Exception as e:
        frappe.log_error(f"Error checking reapplication eligibility: {str(e)}", "Franchise Portal Reapplication Check")
        return {
            "success": False,
            "message": f"Error checking eligibility: {str(e)}"
        }


@frappe.whitelist(allow_guest=True)
def start_new_application_after_rejection(email, data):
    """Start a new application process after rejection, with proper validation"""
    try:
        if not email or not email.strip():
            return {"success": False, "message": "Email is required"}
        
        # Handle JSON string data from frontend
        if isinstance(data, str):
            data = json.loads(data)
        
        # First check if user is eligible to create a new application
        eligibility_check = check_reapplication_eligibility(email)
        if not eligibility_check.get("success") or not eligibility_check.get("can_reapply"):
            return {
                "success": False, 
                "message": eligibility_check.get("message", "You are not eligible to create a new application at this time.")
            }
        
        # Validate required data
        if not data.get("company_name") or not data.get("company_name").strip():
            return {"success": False, "message": "Company name is required"}
        
        # Generate verification token for the new application
        verification_token = str(uuid.uuid4())
        
        # Store session data temporarily (expires in 24 hours)
        session_key = f"franchise_signup_{verification_token}"
        session_data = {
            "email": email,
            "data": data,
            "current_step": 1,
            "verified": False,
            "created_at": now(),
            "is_reapplication": True,
            "previous_applications": eligibility_check.get("previous_applications", [])
        }
        
        # Store in cache for 24 hours (86400 seconds)
        frappe.cache().set_value(session_key, json.dumps(session_data), expires_in_sec=86400)
        
        # Create verification URL
        site_url = frappe.utils.get_url()
        verification_url = f"{site_url}/signup?verify={verification_token}"
        
        # Send verification email with reapplication context
        send_reapplication_verification_email(email, data.get("company_name", ""), verification_url, eligibility_check.get("latest_rejected_application"))
        
        return {
            "success": True,
            "message": "New application verification email sent successfully",
            "requires_verification": True,
            "verification_token": verification_token,
            "is_reapplication": True
        }
        
    except Exception as e:
        frappe.log_error(f"Error starting new application after rejection: {str(e)}", "Franchise Portal Reapplication Start")
        return {
            "success": False,
            "message": f"Error starting new application: {str(e)}"
        }


def refresh_doc_modified(doc):
    """Utility to always set the latest modified timestamp before saving to avoid version conflict."""
    current_modified = frappe.db.get_value(doc.doctype, doc.name, "modified")
    if current_modified:
        doc._original_modified = current_modified
        doc.modified = current_modified


@frappe.whitelist(allow_guest=True)
def test_document_creation_after_verification():
    """Test document creation after email verification without sending emails"""
    try:
        # Test data
        test_email = "test_verification@example.com"
        test_data = {
            "company_name": "Test Company",
            "contact_person": "Test Person",
            "phone_number": "1234567890"
        }
        
        # Step 1: Create session data (simulate send_verification_email)
        verification_token = str(uuid.uuid4())
        session_key = f"franchise_signup_{verification_token}"
        session_data = {
            "email": test_email,
            "data": test_data,
            "current_step": 1,
            "verified": False,
            "created_at": now()
        }
        
        # Store in cache
        frappe.cache().set_value(session_key, json.dumps(session_data), expires_in_sec=86400)
        
        # Step 2: Verify email (simulate verify_email)
        session_data["verified"] = True
        session_data["verified_at"] = now()
        
        # Update cache
        frappe.cache().set_value(session_key, json.dumps(session_data), expires_in_sec=86400)
        
        # Step 3: Save to doctype
        application_id = save_verified_email_to_doctype(test_email, session_data)
        
        # Step 4: Check if doctype was created
        applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": test_email},
            fields=["name", "email_verified", "email_verified_at", "company_name", "status", "current_step"]
        )
        
        if not applications:
            return {"success": False, "message": "No application found after verification"}
        
        app = applications[0]
        
        # Clean up test data
        try:
            frappe.delete_doc("Franchise Signup Application", app.name)
            frappe.db.commit()
        except:
            pass  # Ignore cleanup errors
        
        return {
            "success": True,
            "message": "Document creation test completed successfully",
            "application_id": app.name,
            "email_verified": app.email_verified,
            "email_verified_at": app.email_verified_at,
            "company_name": app.company_name,
            "status": app.status,
            "current_step": app.current_step,
            "returned_application_id": application_id
        }
        
    except Exception as e:
        return {"success": False, "message": f"Test failed: {str(e)}"}


@frappe.whitelist(allow_guest=True)
def update_current_step(application_id, current_step):
    """Update the current_step field for a Franchise Signup Application"""
    doc = frappe.get_doc("Franchise Signup Application", application_id)
    doc.current_step = int(current_step)
    doc.save(ignore_permissions=True)
    return {"success": True}
