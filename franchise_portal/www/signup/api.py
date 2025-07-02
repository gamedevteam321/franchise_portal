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
        save_verified_email_to_doctype(email, session_data)
        
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
            if step < 1 or step > 7:
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
                
                # Single atomic database update
                frappe.db.set_value("Franchise Signup Application", doc_name, updates)
                
                # Handle generation_locations only on final step to avoid version conflicts
                if step == 7 and 'generation_locations' in session_data['data'] and isinstance(session_data['data']['generation_locations'], list):
                    doc = frappe.get_doc("Franchise Signup Application", doc_name)
                    doc.set('generation_locations', [])
                    for location_data in session_data['data']['generation_locations']:
                        doc.append('generation_locations', location_data)
                    doc.save(ignore_permissions=True, ignore_version=True)
                
                frappe.db.commit()
        
        # If this is the final step (step 7), save to doctype
        if step >= 7:
            return finalize_application(session_data, token, step)
        
        return {
            "success": True,
            "message": "Step data saved successfully",
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


def finalize_application(session_data, token, current_step=7):
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
        
        # Only validate Step 7 fields if we're actually on Step 7
        if current_step >= 7:
            calculated_total = application_data.get('calculated_total')
            uncertainty_range = application_data.get('uncertainty_range')
            
            missing_step7_fields = []
            if not calculated_total or str(calculated_total).strip() == '':
                missing_step7_fields.append("Calculated Total (kg CO₂/tonne)")
            if not uncertainty_range or str(uncertainty_range).strip() == '':
                missing_step7_fields.append("Uncertainty Range (%)")
            
            if missing_step7_fields:
                return {"success": False, "message": f"The following required fields are missing: {', '.join(missing_step7_fields)}"}
        
        # Check for existing application
        existing_applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email},
            fields=["name"]
        )
        
        if existing_applications:
            # Update existing using database direct updates to avoid version conflicts
            doc_name = existing_applications[0].name
            updates = {}
            
            # Collect all field updates - only include fields that exist in the doctype
            doctype_fields = frappe.get_meta("Franchise Signup Application").get_fieldnames_with_value()
            
            for key, value in application_data.items():
                if key not in ['generation_locations', 'doctype', 'name', 'creation', 'modified', 'modified_by', 'owner'] and key in doctype_fields:
                    # Convert empty strings to None for numeric fields
                    if key in ['avg_transport_distance', 'heating_value', 'annual_volume_available', 'capacity', 'accuracy_rating'] and value == '':
                        value = 0
                    updates[key] = value
            
            updates['status'] = "Submitted"
            
            # Ensure email verification status is preserved
            if session_data.get("verified"):
                updates['email_verified'] = 1
                if not updates.get('email_verified_at'):
                    updates['email_verified_at'] = now()
            
            # Single atomic database update for main fields
            frappe.db.set_value("Franchise Signup Application", doc_name, updates)
            
            # Handle generation_locations table separately if needed
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
            
            # Clear session after successful submission
            frappe.cache().delete_value(f"franchise_signup_{token}")
            
            return {"success": True, "message": "Application submitted successfully!", "application_id": doc_name}
        else:
            # Create new
            doc = frappe.new_doc("Franchise Signup Application")
            
            # Handle generation_locations table data
            if 'generation_locations' in application_data and isinstance(application_data['generation_locations'], list):
                for location in application_data['generation_locations']:
                    if isinstance(location, dict) and location.get('address') and location.get('gps_coordinates'):
                        doc.append('generation_locations', {
                            'address': location['address'],
                            'gps_coordinates': location['gps_coordinates']
                        })
            
            # Set other fields
            for key, value in application_data.items():
                if key != 'generation_locations' and hasattr(doc, key):
                    setattr(doc, key, value)
            
            # Set email verification status if verified
            if session_data.get("verified"):
                doc.email_verified = 1
                doc.email_verified_at = now()
            
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
            
            # Update fields from data - only include fields that exist in the doctype
            doctype_fields = frappe.get_meta("Franchise Signup Application").get_fieldnames_with_value()
            
            for key, value in data.items():
                if key in doctype_fields and key not in ['name', 'doctype']:
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
    """Save or update doctype with verified email data"""
    try:
        # Check if application already exists
        existing_applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email},
            fields=["name"]
        )
        
        if existing_applications:
            # Update existing application
            doc_name = existing_applications[0].name
            updates = {
                "email_verified": 1,
                "email_verified_at": now()
            }
            
            # Update basic fields if they exist in session data
            application_data = session_data.get("data", {})
            basic_fields = [
                "company_name", "contact_person", "phone_number", 
                "company_address", "country_of_operation"
            ]
            
            for field in basic_fields:
                if field in application_data and application_data[field]:
                    updates[field] = application_data[field]
            
            # Update the doctype
            frappe.db.set_value("Franchise Signup Application", doc_name, updates)
            frappe.db.commit()
            
            frappe.log_error(f"Updated existing application {doc_name} with verified email", "Email Verification")
            
        else:
            # Create new application with verified email data
            doc = frappe.new_doc("Franchise Signup Application")
            
            # Set email verification fields
            doc.email = email
            doc.email_verified = 1
            doc.email_verified_at = now()
            
            # Set basic fields from session data if available
            application_data = session_data.get("data", {})
            basic_fields = [
                "company_name", "contact_person", "phone_number", 
                "company_address", "country_of_operation"
            ]
            
            for field in basic_fields:
                if field in application_data and application_data[field]:
                    setattr(doc, field, application_data[field])
            
            # Set default values
            doc.status = "Draft"
            doc.current_step = 1
            
            doc.insert(ignore_permissions=True)
            frappe.db.commit()
            
            frappe.log_error(f"Created new application {doc.name} with verified email", "Email Verification")
        
        return True
        
    except Exception as e:
        frappe.log_error(f"Error saving verified email to doctype: {str(e)}", "Email Verification Error")
        return False


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
