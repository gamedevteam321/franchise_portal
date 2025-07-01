# Copyright (c) 2024, Nexchar Ventures and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import now
import uuid
import json
import os


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
        
        # Mark as verified
        session_data["verified"] = True
        session_data["verified_at"] = now()
        
        # Update cache
        frappe.cache().set_value(session_key, json.dumps(session_data), expires_in_sec=86400)
        
        return {
            "success": True,
            "message": "Email verified successfully",
            "session_data": session_data,
            "current_step": session_data.get("current_step", 1)
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
        except (ValueError, TypeError):
            step = 1
            
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
        
        # Save updated session
        frappe.cache().set_value(session_key, json.dumps(session_data), expires_in_sec=86400)
        
        # If this is the final step (step 5), save to doctype
        if step >= 5:
            return finalize_application(session_data, token)
        
        return {
            "success": True,
            "message": "Step data saved successfully",
            "current_step": step
        }
        
    except Exception as e:
        frappe.log_error(f"Error saving verified step: {str(e)}", "Franchise Portal Verified Save Error")
        return {
            "success": False,
            "message": f"Error saving step data: {str(e)}"
        }


@frappe.whitelist(allow_guest=True)
def submit_application(email, data=None):
    """Submit the franchise application"""
    try:
        # Log RAW input data BEFORE any processing
        debug_file = os.path.join(frappe.get_site_path(), 'debug_save.txt')
        with open(debug_file, 'a') as f:
            f.write(f"\n=== RAW SUBMIT API INPUT {frappe.utils.now()} ===\n")
            f.write(f"Email: {email}\n")
            f.write(f"Raw data type: {type(data)}\n")
            f.write(f"Raw data: {str(data)[:1000]}...\n")  # First 1000 chars
        
        if not email:
            return {"success": False, "message": "Email is required"}
        
        # Handle JSON string data from frontend (same fix as save_step)
        if data and isinstance(data, str):
            import json
            data = json.loads(data)
        
        # Convert to frappe._dict for easier access
        if data:
            data = frappe._dict(data)
        
        # Find the application
        applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email},
            fields=["name"]
        )
        
        if not applications:
            return {"success": False, "message": "Application not found"}
        
        doc = frappe.get_doc("Franchise Signup Application", applications[0].name)
        
        # Update with final data if provided
        if data:
            # Handle generation_locations table data
            if 'generation_locations' in data and isinstance(data.generation_locations, list):
                # Clear existing generation locations
                doc.generation_locations = []
                
                # Add new generation locations
                for location in data.generation_locations:
                    if isinstance(location, dict) and location.get('address') and location.get('gps_coordinates'):
                        doc.append('generation_locations', {
                            'address': location['address'],
                            'gps_coordinates': location['gps_coordinates']
                        })
            
            # Update other fields
            for key, value in data.items():
                if key != 'generation_locations' and hasattr(doc, key):
                    setattr(doc, key, value)
        
        # Mark as submitted
        doc.status = "Submitted"
        doc.save()
        
        return {"success": True, "message": "Application submitted successfully", "application_id": doc.name}
        
    except Exception as e:
        return {"success": False, "message": f"Error submitting application: {str(e)}"}


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


def send_confirmation_email(doc):
    """Send confirmation email to the applicant"""
    subject = f"Application Received - {doc.company_name}"
    
    message = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #667eea;">Application Received Successfully</h2>
        
        <p>Dear {doc.contact_person or 'Applicant'},</p>
        
        <p>Thank you for submitting your franchise application. We have received your information and will review it within 2-3 business days.</p>
        
        <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0066cc;">Your Application Details</h3>
            <p><strong>Application ID:</strong> {doc.name}</p>
            <p><strong>Company:</strong> {doc.company_name}</p>
            <p><strong>Project:</strong> {doc.project_name or 'N/A'}</p>
            <p><strong>Status:</strong> Under Review</p>
        </div>
        
        <p>Our team will contact you at {doc.email} or {doc.phone_number or 'the provided contact information'} once we have completed our initial review.</p>
        
        <p>If you have any questions, please don't hesitate to contact us.</p>
        
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


def finalize_application(session_data, token):
    """Finalize application in doctype (update existing or create new)"""
    try:
        application_data = session_data["data"]
        email = session_data["email"]
        
        # Validate required Step 3 fields before finalizing
        annual_volume = application_data.get('annual_volume_available')
        try:
            annual_volume_float = float(annual_volume) if annual_volume and str(annual_volume).strip() else 0
        except (ValueError, TypeError):
            annual_volume_float = 0
            
        if annual_volume_float <= 0:
            return {"success": False, "message": "Annual Volume Available is required and must be greater than 0"}
        
        # Check for existing application
        existing_applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email},
            fields=["name"]
        )
        
        if existing_applications:
            # Update existing
            doc = frappe.get_doc("Franchise Signup Application", existing_applications[0].name)
            
            # Handle generation_locations table data
            if 'generation_locations' in application_data and isinstance(application_data.generation_locations, list):
                # Clear existing generation locations
                doc.generation_locations = []
                
                # Add new generation locations
                for location in application_data.generation_locations:
                    if isinstance(location, dict) and location.get('address') and location.get('gps_coordinates'):
                        doc.append('generation_locations', {
                            'address': location['address'],
                            'gps_coordinates': location['gps_coordinates']
                        })
            
            # Update other fields
            for key, value in application_data.items():
                if key != 'generation_locations' and hasattr(doc, key):
                    setattr(doc, key, value)
            
            doc.status = "Submitted"
            doc.save()
            
            # Clear session after successful submission
            frappe.cache().delete_value(f"franchise_signup_{token}")
            
            return {"success": True, "message": "Application submitted successfully!", "application_id": doc.name}
        else:
            # Create new
            doc = frappe.new_doc("Franchise Signup Application")
            
            # Handle generation_locations table data
            if 'generation_locations' in application_data and isinstance(application_data.generation_locations, list):
                for location in application_data.generation_locations:
                    if isinstance(location, dict) and location.get('address') and location.get('gps_coordinates'):
                        doc.append('generation_locations', {
                            'address': location['address'],
                            'gps_coordinates': location['gps_coordinates']
                        })
            
            # Set other fields
            for key, value in application_data.items():
                if key != 'generation_locations' and hasattr(doc, key):
                    setattr(doc, key, value)
            
            doc.status = "Submitted"
            doc.insert()
            
            # Clear session after successful submission
            frappe.cache().delete_value(f"franchise_signup_{token}")
            
            return {"success": True, "message": "Application submitted successfully!", "application_id": doc.name}
            
    except Exception as e:
        return {"success": False, "message": f"Error finalizing application: {str(e)}"}


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
            
            # Update fields from data
            for key, value in data.items():
                if hasattr(application, key) and key not in ['name', 'doctype']:
                    # Special handling for generation_locations table
                    if key == 'generation_locations' and isinstance(value, list):
                        # Clear existing child records
                        application.set('generation_locations', [])
                        # Add new child records
                        for location_data in value:
                            application.append('generation_locations', location_data)
                    else:
                        setattr(application, key, value)
                        # File debug: track field setting
                        with open(debug_file, 'a') as f:
                            f.write(f"SET {key} to '{value}' on app {application.name}\n")
                else:
                    # Debug: track fields that are being skipped
                    with open(debug_file, 'a') as f:
                        f.write(f"SKIPPED {key} (hasattr={hasattr(application, key)}, excluded={key in ['name', 'doctype']})\n")
            
            application.modified_at = frappe.utils.now()
            application.save(ignore_permissions=True)
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
                        for location_data in value:
                            application.append('generation_locations', location_data)
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
            application.insert(ignore_permissions=True)
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
        frappe.log_error(frappe.get_traceback(), "Save Step Error")
        return {"success": False, "message": f"Error saving application: {str(e)}"}


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