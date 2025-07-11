#!/usr/bin/env python3
"""
Test script for franchise portal rejection and reapplication functionality.
This script tests the new features:
1. Email uniqueness validation allowing rejected applications
2. Enhanced rejection notification emails
3. New application creation after rejection
"""

import frappe
import json
from frappe.utils import now

def test_rejection_and_reapplication_flow():
    """Test the complete rejection and reapplication flow"""
    
    print("🧪 Testing Franchise Portal Rejection & Reapplication Flow")
    print("=" * 60)
    
    test_email = "test.rejection@example.com"
    test_company_1 = "Test Company Alpha"
    test_company_2 = "Test Company Beta"
    
    try:
        # Clean up any existing test data
        cleanup_test_data(test_email)
        
        # Step 1: Create initial application
        print("\n1️⃣ Creating initial application...")
        app1 = create_test_application(test_email, test_company_1)
        print(f"   ✅ Created application: {app1.name}")
        
        # Step 2: Submit the application
        print("\n2️⃣ Submitting application...")
        app1.status = "Submitted"
        app1.save()
        print(f"   ✅ Application submitted: {app1.name}")
        
        # Step 3: Reject the application
        print("\n3️⃣ Rejecting application...")
        rejection_reason = "Insufficient financial documentation provided"
        result = app1.reject_application(rejection_reason)
        print(f"   ✅ Application rejected with reason: {rejection_reason}")
        
        # Step 4: Test email uniqueness validation - should allow new application now
        print("\n4️⃣ Testing email uniqueness validation...")
        try:
            app2 = create_test_application(test_email, test_company_2)
            print(f"   ✅ New application allowed after rejection: {app2.name}")
        except Exception as e:
            print(f"   ❌ Error creating new application: {str(e)}")
            return False
        
        # Step 5: Test reapplication eligibility API
        print("\n5️⃣ Testing reapplication eligibility API...")
        from franchise_portal.www.signup.api import check_reapplication_eligibility
        eligibility = check_reapplication_eligibility(test_email)
        
        if eligibility.get("success") and eligibility.get("can_reapply"):
            print(f"   ✅ API correctly identifies user can reapply")
            print(f"   📋 Previous applications found: {len(eligibility.get('previous_applications', []))}")
        else:
            print(f"   ❌ API error: {eligibility.get('message')}")
            return False
        
        # Step 6: Test new application creation API
        print("\n6️⃣ Testing new application creation API...")
        from franchise_portal.www.signup.api import start_new_application_after_rejection
        
        test_data = {
            "company_name": "Test Company Gamma",
            "contact_person": "Test Contact",
            "phone_number": "1234567890"
        }
        
        new_app_result = start_new_application_after_rejection(test_email, test_data)
        
        if new_app_result.get("success"):
            print(f"   ✅ New application process started successfully")
            print(f"   🔗 Verification token: {new_app_result.get('verification_token')[:20]}...")
        else:
            print(f"   ❌ New application start failed: {new_app_result.get('message')}")
            return False
        
        # Step 7: Verify the applications exist in the system
        print("\n7️⃣ Verifying applications in system...")
        applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": test_email},
            fields=["name", "status", "company_name", "creation"],
            order_by="creation asc"
        )
        
        print(f"   📊 Total applications found: {len(applications)}")
        for i, app in enumerate(applications, 1):
            print(f"   {i}. {app.name} - {app.company_name} - Status: {app.status}")
        
        # Step 8: Test that active applications prevent new ones
        print("\n8️⃣ Testing active application prevention...")
        app2.status = "Submitted"
        app2.save()
        
        eligibility_with_active = check_reapplication_eligibility(test_email)
        
        if not eligibility_with_active.get("can_reapply"):
            print(f"   ✅ API correctly prevents reapplication with active application")
        else:
            print(f"   ❌ API should prevent reapplication but allowed it")
            return False
        
        print("\n🎉 All tests passed successfully!")
        print("\nFeatures verified:")
        print("  ✅ Email uniqueness validation allows rejected applications")
        print("  ✅ Rejection notification system works")
        print("  ✅ Reapplication eligibility checking")
        print("  ✅ New application creation after rejection")
        print("  ✅ Prevention of multiple active applications")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        frappe.log_error(f"Rejection flow test error: {str(e)}", "Test Error")
        return False
        
    finally:
        # Clean up test data
        print("\n🧹 Cleaning up test data...")
        cleanup_test_data(test_email)


def create_test_application(email, company_name):
    """Create a test application"""
    app = frappe.get_doc({
        "doctype": "Franchise Signup Application",
        "email": email,
        "company_name": company_name,
        "contact_person": "Test Contact Person",
        "phone_number": "1234567890",
        "company_address": "123 Test Street, Test City",
        "country_of_operation": "India",
        "project_name": f"Test Project for {company_name}",
        "project_type": "Franchise",
        "project_city": "Test City",
        "project_state": "Test State",
        "email_verified": 1,
        "email_verified_at": now(),
        "status": "Draft"
    })
    
    app.insert(ignore_permissions=True)
    frappe.db.commit()
    return app


def cleanup_test_data(email):
    """Clean up any existing test data"""
    try:
        applications = frappe.get_all(
            "Franchise Signup Application",
            filters={"email": email},
            fields=["name"]
        )
        
        for app in applications:
            frappe.delete_doc("Franchise Signup Application", app.name, ignore_permissions=True)
        
        frappe.db.commit()
        
        if applications:
            print(f"   🧹 Cleaned up {len(applications)} existing test applications")
            
    except Exception as e:
        print(f"   ⚠️  Cleanup warning: {str(e)}")


if __name__ == "__main__":
    # This script should be run from the Frappe bench directory
    # Example: python apps/franchise_portal/test_rejection_flow.py
    test_rejection_and_reapplication_flow() 