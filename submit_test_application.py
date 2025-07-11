#!/usr/bin/env python3
"""
Submit a test franchise application for rejection testing.
This script creates and submits a complete application that can be rejected by admin.
"""

import frappe
import json
from frappe.utils import now, today, add_days
from datetime import datetime, timedelta

def submit_test_application_for_rejection():
    """Submit a complete test application that can be rejected"""
    
    print("🚀 Submitting Test Franchise Application for Rejection Testing")
    print("=" * 65)
    
    # Test application data
    test_email = "test.rejection.demo@example.com"
    
    # Clean up any existing test applications first
    cleanup_existing_applications(test_email)
    
    try:
        # Step 1: Create the application with all required data
        print("\n1️⃣ Creating complete test application...")
        
        application_data = {
            # Step 1: Supplier Information
            "email": test_email,
            "company_name": "Test Rejection Company Ltd",
            "contact_person": "John Doe",
            "phone_number": "+91-9876543210",
            "company_address": "123 Test Street, Business District, Mumbai, Maharashtra, India",
            "country_of_operation": "India",
            
            # Step 2: Project Information  
            "project_name": "Mumbai Biomass Processing Project",
            "project_type": "Franchise",
            "project_city": "Mumbai",
            "project_state": "Maharashtra",
            "gps_coordinates": "19.0760, 72.8777",
            "project_start_date": add_days(today(), 30),
            "reporting_period": "Monthly",
            
            # Step 3: Feedstock Description
            "primary_feedstock_category": "Agricultural Residues",
            "specific_feedstock_type": "Rice husk, wheat straw, sugarcane bagasse",
            "classification": "Waste",
            "source": "Local farms and sugar mills",
            "feedstock_payment_type": "Cash",
            "payment_details": "Payment within 15 days of delivery",
            
            # Chemical composition data
            "carbon_content": 45.2,
            "hydrogen_content": 6.1,
            "nitrogen_content": 0.8,
            "oxygen_content": 47.5,
            "sulfur_content": 0.2,
            "fixed_carbon": 18.5,
            "volatile_matter": 75.3,
            "ash_content": 6.2,
            "ch_ratio": 7.4,
            
            # Physical properties
            "moisture_content": 12.5,
            "heating_value": 16.8,
            "r0_measurement": 0.45,
            
            # Contaminants
            "contaminants_present": "Yes",
            "other_contaminants": "Small amounts of sand and soil particles",
            
            # Volume data
            "annual_volume_available": 5000,
            "plant_operation_schedule": "Year-round operation with seasonal peaks",
            "seasonal_months": "October to March (peak harvest season)",
            
            # Current use
            "current_use_disposal_method": "Open burning and landfill disposal",
            
            # Step 4: Origin, Sourcing & Supply Chain
            "source_type": "Agricultural farms, Sugar mills, Rice processing units",
            "generation_locations": [
                {
                    "address": "Pune District Agricultural Farms",
                    "gps_coordinates": "18.5204, 73.8567"
                },
                {
                    "address": "Nashik Sugar Mill Complex", 
                    "gps_coordinates": "19.9975, 73.7898"
                }
            ],
            "generation_datetime": now(),
            "collection_method": "Truck collection from farm gates and mill yards",
            "number_of_suppliers": 25,
            "max_sourcing_radius": 150,
            "avg_transport_distance": 85,
            "primary_transport_method": "Truck",
            "handling_steps": 3,
            "storage_duration": 7,
            "chain_of_custody_protocol": "Attached",
            "supplier_agreements": "Attached",
            
            # Step 5: Monitoring & Measurement
            "electricity_meter_id": "MH-MUM-2024-001",
            "meter_type_model": "Schneider Electric PM8000",
            "monitoring_interval": "Real-time with 15-minute logging",
            "last_calibration_date": add_days(today(), -90),
            "next_calibration_due": add_days(today(), 275),
            "weighbridge_id": "WB-MUM-001",
            "capacity": 80.0,
            "accuracy_rating": 99.5,
            "continuous_recording": "Yes",
            "data_logging_system": "Automated SCADA system with cloud backup",
            "testing_laboratory_name": "Mumbai Environmental Testing Labs Pvt Ltd",
            "lab_accreditation_number": "NABL-T-0567",
            "testing_standards_used": "ASTM",
            "analysis_frequency": "Weekly",
            "automatic_data_upload": "Yes",
            "data_storage_method": "Cloud",
            "backup_system": "Triple redundancy with local and cloud backup",
            "retention_period": 7,
            
            # Step 6: Sustainability Assessment & Market Impact
            "land_use_change": "No",
            "biodiversity_impact": "Positive - reduces open burning",
            "water_usage": 150.5,
            "water_source": "Treated municipal water and rainwater harvesting",
            "waste_generation": "Minimal - only ash residue which is used as fertilizer",
            "social_impact": "Creates 50+ local jobs, reduces air pollution",
            "economic_benefits": "Provides income to farmers, reduces waste management costs",
            "compliance_certifications": "ISO 14001, State Pollution Control Board clearance",
            
            # Step 7: Emissions & Energy Accounting
            "total_energy_consumption": 1250.8,
            "renewable_energy_percentage": 85.5,
            "fossil_fuel_usage": 185.2,
            "electricity_grid_consumption": 450.6,
            "transport_fuel_consumption": 125.4,
            "fuel_type": "Diesel, Electricity",
            "vehicle_type": "Heavy trucks, Light commercial vehicles",
            "average_distance": 85.5,
            "fuel_efficiency": 4.2,
            "emissions_per_tonne_km": 0.85,
            "drying_required": "Yes",
            "drying_method": "Solar drying with backup biomass heating",
            "energy_used": 125.8,
            "energy_source": "Solar energy and biomass",
            "calculated_total": 2.45,
            "uncertainty_range": 8.5,
            
            # Step 8: Employee Details (Required)
            "employee_first_name": "Rajesh",
            "employee_middle_name": "Kumar",
            "employee_last_name": "Sharma",
            "employee_gender": "Male", 
            "employee_date_of_birth": "1985-05-15",
            "employee_date_of_joining": today(),
            "employee_status": "Active",
            "employee_salutation": "Mr",
            "employee_designation": "Franchise Partner",
            "employee_department": "Management",
            "employee_branch": "Mumbai Operations",
            "employee_reports_to": "Regional Manager",
            "employee_grade": "Senior Manager",
            "employee_personal_email": "rajesh.sharma@personal.com",
            "employee_phone": "+91-9876543210",
            
            # Verification and status
            "email_verified": 1,
            "email_verified_at": now(),
            "status": "Draft",
            "current_step": 8
        }
        
        # Create the application
        app = frappe.get_doc({
            "doctype": "Franchise Signup Application",
            **application_data
        })
        
        app.insert(ignore_permissions=True)
        frappe.db.commit()
        
        print(f"   ✅ Application created: {app.name}")
        print(f"   📧 Email: {test_email}")
        print(f"   🏢 Company: {application_data['company_name']}")
        
        # Step 2: Submit the application
        print("\n2️⃣ Submitting application...")
        
        app.status = "Submitted"
        app.save(ignore_permissions=True)
        frappe.db.commit()
        
        print(f"   ✅ Application submitted successfully!")
        print(f"   📋 Application ID: {app.name}")
        print(f"   📊 Status: {app.status}")
        
        # Step 3: Display application details for admin
        print("\n3️⃣ Application Details for Admin Review:")
        print("   " + "="*50)
        print(f"   📋 Application ID: {app.name}")
        print(f"   🏢 Company Name: {app.company_name}")
        print(f"   👤 Contact Person: {app.contact_person}")
        print(f"   📧 Email: {app.email}")
        print(f"   📱 Phone: {app.phone_number}")
        print(f"   🏗️ Project: {app.project_name}")
        print(f"   📍 Location: {app.project_city}, {app.project_state}")
        print(f"   📊 Status: {app.status}")
        print(f"   📅 Created: {app.creation}")
        
        # Step 4: Provide admin instructions
        print("\n4️⃣ Next Steps for Admin:")
        print("   " + "="*50)
        print(f"   1. Go to: /app/franchise-signup-application/{app.name}")
        print(f"   2. Click the 'Reject' button")
        print(f"   3. Provide a rejection reason (e.g., 'Insufficient financial documentation')")
        print(f"   4. Confirm rejection")
        print(f"   5. Check the rejection email sent to: {test_email}")
        print(f"   6. Test reapplication flow using the email link")
        
        # Step 5: Quick link for admin
        print("\n5️⃣ Quick Admin Links:")
        print("   " + "="*50)
        site_url = frappe.utils.get_url()
        print(f"   🔗 Direct Application Link: {site_url}/app/franchise-signup-application/{app.name}")
        print(f"   📋 All Applications: {site_url}/app/franchise-signup-application")
        print(f"   📧 Test Email: {test_email}")
        
        # Step 6: API test commands
        print("\n6️⃣ Test API Commands (after rejection):")
        print("   " + "="*50)
        print("   # Check if user can reapply:")
        print(f"   frappe.call({{")
        print(f"       method: 'franchise_portal.signup.api.check_reapplication_eligibility',")
        print(f"       args: {{ email: '{test_email}' }}")
        print(f"   }})")
        print("")
        print("   # Start new application:")
        print(f"   frappe.call({{")
        print(f"       method: 'franchise_portal.signup.api.start_new_application_after_rejection',")
        print(f"       args: {{ email: '{test_email}', data: {{company_name: 'New Company Name'}} }}")
        print(f"   }})")
        
        print("\n✨ Test application ready for rejection testing!")
        
        return app.name
        
    except Exception as e:
        print(f"\n❌ Error creating test application: {str(e)}")
        frappe.log_error(f"Test application creation error: {str(e)}", "Test Application Error")
        return None


def cleanup_existing_applications(email):
    """Clean up existing test applications"""
    try:
        existing_apps = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email},
            fields=["name"]
        )
        
        for app in existing_apps:
            frappe.delete_doc("Franchise Signup Application", app.name, ignore_permissions=True)
        
        frappe.db.commit()
        
        if existing_apps:
            print(f"   🧹 Cleaned up {len(existing_apps)} existing test applications")
            
    except Exception as e:
        print(f"   ⚠️ Cleanup warning: {str(e)}")


def get_application_summary(app_name):
    """Get a summary of the created application"""
    try:
        app = frappe.get_doc("Franchise Signup Application", app_name)
        
        print(f"\n📊 Application Summary:")
        print(f"   ID: {app.name}")
        print(f"   Company: {app.company_name}")
        print(f"   Email: {app.email}")
        print(f"   Status: {app.status}")
        print(f"   Steps Completed: {app.current_step}/8")
        print(f"   Email Verified: {'Yes' if app.email_verified else 'No'}")
        
    except Exception as e:
        print(f"   ❌ Error getting application summary: {str(e)}")


if __name__ == "__main__":
    # Run from frappe-bench directory: python apps/franchise_portal/submit_test_application.py
    submit_test_application_for_rejection() 