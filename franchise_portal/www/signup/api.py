# Copyright (c) 2024, Nexchar Ventures and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import now
import uuid
import json


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
        
        # If this is the final step, save to doctype
        if step >= 3:
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
        
        if not application_data.get('primary_feedstock_category'):
            return {"success": False, "message": "Primary Feedstock Category is required"}
        
        # Check if application already exists for this email
        existing_applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email},
            fields=["name"]
        )
        
        if existing_applications:
            # Update existing application
            doc = frappe.get_doc("Franchise Signup Application", existing_applications[0].name)
            
            # Update all fields with new data
            for key, value in application_data.items():
                if hasattr(doc, key) and key not in ['name', 'doctype']:
                    setattr(doc, key, value)
            
            # Handle legacy project_location field - combine city and state if needed
            if application_data.get('project_city') or application_data.get('project_state'):
                city = application_data.get('project_city', '')
                state = application_data.get('project_state', '')
                if city and state:
                    doc.project_location = f"{city}, {state}"
                elif city:
                    doc.project_location = city
                elif state:
                    doc.project_location = state
            
            # Update status to submitted
            doc.status = "Submitted"
            doc.current_step = 3
            doc.save(ignore_permissions=True)
            
        else:
            # Create new application (fallback case)
            doc_data = {
                "doctype": "Franchise Signup Application",
                "status": "Submitted",
                "naming_series": "FSA-.YYYY.-"
            }
            
            # Add all provided data
            for key, value in application_data.items():
                if key not in ['doctype', 'name'] and value is not None:
                    doc_data[key] = value
            
            # Ensure required fields
            if not doc_data.get('company_name'):
                doc_data['company_name'] = 'Untitled Application'
                
            doc = frappe.get_doc(doc_data)
            doc.insert(ignore_permissions=True)
        
        # Send notification emails
        try:
            send_notification_email(doc)
            send_final_confirmation_email(doc)
        except Exception as e:
            frappe.log_error(f"Error sending emails: {str(e)}")
        
        frappe.db.commit()
        
        # Clear session data
        session_key = f"franchise_signup_{token}"
        frappe.cache().delete_value(session_key)
        
        return {
            "success": True,
            "message": "Application submitted successfully",
            "application_id": doc.name
        }
        
    except Exception as e:
        frappe.log_error(f"Error finalizing application: {str(e)}", "Franchise Portal Finalize Error")
        return {
            "success": False,
            "message": f"Error finalizing application: {str(e)}"
        }


@frappe.whitelist(allow_guest=True)
def save_step(data):
    """Save step data for the franchise application"""
    try:
        # Handle JSON string data from frontend
        if isinstance(data, str):
            import json
            data = json.loads(data)
        
        data = frappe._dict(data)
        
        # Validate required fields
        if not data.get('email') or not data.get('email').strip():
            return {"success": False, "message": "Email is required"}
        
        if not data.get('company_name') or not data.get('company_name').strip():
            return {"success": False, "message": "Company name is required"}
        
        # Check for existing application
        existing = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": data.email},
            fields=["name"]
        )
        
        if existing:
            # Update existing application
            doc = frappe.get_doc("Franchise Signup Application", existing[0].name)
            
            # Update fields
            for key, value in data.items():
                if hasattr(doc, key) and key != 'name':
                    setattr(doc, key, value)
            
            # Handle legacy project_location field - combine city and state if needed
            if data.get('project_city') or data.get('project_state'):
                city = data.get('project_city', '')
                state = data.get('project_state', '')
                if city and state:
                    doc.project_location = f"{city}, {state}"
                elif city:
                    doc.project_location = city
                elif state:
                    doc.project_location = state
            
            doc.status = "In Progress"
            doc.save(ignore_permissions=True)
            application_id = doc.name
            
        else:
            # Create new application
            doc_data = {
                "doctype": "Franchise Signup Application",
                "status": "Draft",
                "naming_series": "FSA-.YYYY.-"
            }
            
            # Add all provided data, ensuring proper field mapping
            for key, value in data.items():
                if key not in ['doctype', 'name'] and value is not None:
                    doc_data[key] = value
            
            # Handle legacy project_location field - combine city and state if needed
            if data.get('project_city') or data.get('project_state'):
                city = data.get('project_city', '')
                state = data.get('project_state', '')
                if city and state:
                    doc_data['project_location'] = f"{city}, {state}"
                elif city:
                    doc_data['project_location'] = city
                elif state:
                    doc_data['project_location'] = state
            
            # Ensure company_name is set for title generation
            if not doc_data.get('company_name'):
                doc_data['company_name'] = 'Untitled Application'
                
            doc = frappe.get_doc(doc_data)
            doc.insert(ignore_permissions=True)
            application_id = doc.name
        
        frappe.db.commit()
        
        return {
            "success": True,
            "message": "Step data saved successfully",
            "application_id": application_id
        }
        
    except Exception as e:
        frappe.log_error(f"Error saving step data: {str(e)}", "Franchise Portal Save Step Error")
        
        # Log only essential data to avoid title truncation issues
        try:
            # Handle both string and dict data for logging
            if isinstance(data, str):
                import json
                parsed_data = json.loads(data)
            else:
                parsed_data = data
                
            essential_data = {
                "email": parsed_data.get("email", "") if hasattr(parsed_data, 'get') else str(parsed_data)[:50],
                "company_name": parsed_data.get("company_name", "") if hasattr(parsed_data, 'get') else "",
                "step": parsed_data.get("current_step", "") if hasattr(parsed_data, 'get') else ""
            }
            frappe.log_error(f"Essential data: {essential_data}", "Franchise Portal Save Step Data")
        except Exception as log_error:
            frappe.log_error(f"Could not log data: {str(log_error)}", "Franchise Portal Logging Error")
            
        return {
            "success": False,
            "message": f"Error saving data: {str(e)}"
        }


@frappe.whitelist(allow_guest=True)
def submit_application(email, data=None):
    """Submit the franchise application"""
    try:
        if not email:
            return {"success": False, "message": "Email is required"}
        
        # Handle JSON string data from frontend (same fix as save_step)
        if data and isinstance(data, str):
            import json
            data = json.loads(data)
        
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
            data = frappe._dict(data)
            for key, value in data.items():
                if hasattr(doc, key) and key not in ['name', 'doctype']:
                    setattr(doc, key, value)
            
            # Handle legacy project_location field - combine city and state if needed
            if data.get('project_city') or data.get('project_state'):
                city = data.get('project_city', '')
                state = data.get('project_state', '')
                if city and state:
                    doc.project_location = f"{city}, {state}"
                elif city:
                    doc.project_location = city
                elif state:
                    doc.project_location = state
        
        # Validate required fields for final submission
        if not doc.company_name:
            return {"success": False, "message": "Company name is required"}
        
        if not doc.email:
            return {"success": False, "message": "Email is required"}
        
        # Validate required Step 3 fields for final submission
        annual_volume = doc.annual_volume_available
        try:
            annual_volume_float = float(annual_volume) if annual_volume and str(annual_volume).strip() else 0
        except (ValueError, TypeError):
            annual_volume_float = 0
            
        if annual_volume_float <= 0:
            return {"success": False, "message": "Annual Volume Available is required and must be greater than 0"}
        
        if not doc.primary_feedstock_category:
            return {"success": False, "message": "Primary Feedstock Category is required"}
        
        # Update status and save
        doc.status = "Submitted"
        doc.current_step = 3
        doc.save(ignore_permissions=True)
        
        # Send notification email
        try:
            send_notification_email(doc)
            send_confirmation_email(doc)
        except Exception as e:
            frappe.log_error(f"Error sending emails: {str(e)}")
        
        frappe.db.commit()
        
        return {
            "success": True,
            "message": "Application submitted successfully",
            "application_id": doc.name
        }
        
    except Exception as e:
        frappe.log_error(f"Error submitting application: {str(e)}")
        return {
            "success": False,
            "message": f"Error submitting application: {str(e)}"
        }


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