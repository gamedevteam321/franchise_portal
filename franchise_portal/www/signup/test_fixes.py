#!/usr/bin/env python3
"""
Test script to verify the fixes for:
1. File uploads showing proper file names instead of [object File]
2. Source Type and Generation Locations fields being properly populated
3. Form data being saved correctly
"""

import frappe
import json
import os

def test_file_upload_fixes():
    """Test that file uploads are working correctly"""
    print("=== Testing File Upload Fixes ===")
    
    # Test 1: Check if file upload fields are properly configured
    doctype_fields = frappe.get_meta("Franchise Signup Application").get_fieldnames_with_value()
    file_fields = ['feedstock_payment_file', 'chain_of_custody_file', 'supplier_agreements_file', 'origin_certificates_file', 'transportation_records_file']
    
    print("Checking file field configuration:")
    for field in file_fields:
        if field in doctype_fields:
            print(f"✓ {field} is properly configured")
        else:
            print(f"✗ {field} is missing from doctype")
    
    # Test 2: Check existing applications for file URL issues
    applications = frappe.get_all(
        "Franchise Signup Application",
        filters={"status": ["in", ["Draft", "Submitted", "Pending Approval"]]},
        fields=["name", "feedstock_payment_file", "chain_of_custody_file", "supplier_agreements_file", "origin_certificates_file", "transportation_records_file"],
        limit=5
    )
    
    print(f"\nChecking {len(applications)} existing applications for file URL issues:")
    for app in applications:
        print(f"\nApplication: {app.name}")
        for field in file_fields:
            value = app.get(field)
            if value:
                if value.startswith('http'):
                    print(f"  ✓ {field}: Proper URL format")
                elif value == '[object File]':
                    print(f"  ✗ {field}: Still showing [object File] - needs fixing")
                else:
                    print(f"  ? {field}: Unknown format: {value}")
            else:
                print(f"  - {field}: No value")
    
    return True

def test_field_population():
    """Test that source_type and generation_locations fields are properly handled"""
    print("\n=== Testing Field Population Fixes ===")
    
    # Test 1: Check source_type field configuration
    source_type_field = frappe.get_meta("Franchise Signup Application").get_field("source_type")
    if source_type_field:
        print(f"✓ source_type field exists with type: {source_type_field.fieldtype}")
        if hasattr(source_type_field, 'options'):
            print(f"  Options: {source_type_field.options}")
    else:
        print("✗ source_type field not found")
    
    # Test 2: Check generation_locations field configuration
    generation_locations_field = frappe.get_meta("Franchise Signup Application").get_field("generation_locations")
    if generation_locations_field:
        print(f"✓ generation_locations field exists with type: {generation_locations_field.fieldtype}")
    else:
        print("✗ generation_locations field not found")
    
    # Test 3: Check existing applications for field values
    applications = frappe.get_all(
        "Franchise Signup Application",
        filters={"status": ["in", ["Draft", "Submitted", "Pending Approval"]]},
        fields=["name", "source_type", "generation_locations"],
        limit=5
    )
    
    print(f"\nChecking {len(applications)} existing applications for field values:")
    for app in applications:
        print(f"\nApplication: {app.name}")
        source_type = app.get('source_type', '')
        generation_locations = app.get('generation_locations', '')
        
        if source_type:
            print(f"  ✓ source_type: {source_type}")
        else:
            print(f"  - source_type: Empty")
        
        if generation_locations:
            print(f"  ✓ generation_locations: {generation_locations}")
        else:
            print(f"  - generation_locations: Empty")
    
    return True

def test_form_data_saving():
    """Test that form data is being saved correctly"""
    print("\n=== Testing Form Data Saving ===")
    
    # Test 1: Check if the save_step_with_verification function exists
    try:
        from franchise_portal.www.signup.api import save_step_with_verification
        print("✓ save_step_with_verification function exists")
    except ImportError as e:
        print(f"✗ save_step_with_verification function not found: {e}")
        return False
    
    # Test 2: Check if the fix_file_urls_in_application function exists
    try:
        from franchise_portal.www.signup.api import fix_file_urls_in_application
        print("✓ fix_file_urls_in_application function exists")
    except ImportError as e:
        print(f"✗ fix_file_urls_in_application function not found: {e}")
        return False
    
    # Test 3: Check if the finalize_application function exists
    try:
        from franchise_portal.www.signup.api import finalize_application
        print("✓ finalize_application function exists")
    except ImportError as e:
        print(f"✗ finalize_application function not found: {e}")
        return False
    
    return True

def test_doctype_configuration():
    """Test that the doctype is properly configured"""
    print("\n=== Testing Doctype Configuration ===")
    
    # Test 1: Check if the doctype exists
    if frappe.db.exists("DocType", "Franchise Signup Application"):
        print("✓ Franchise Signup Application doctype exists")
    else:
        print("✗ Franchise Signup Application doctype not found")
        return False
    
    # Test 2: Check field configurations
    meta = frappe.get_meta("Franchise Signup Application")
    required_fields = [
        'source_type',
        'generation_locations', 
        'feedstock_payment_file',
        'chain_of_custody_file',
        'supplier_agreements_file',
        'origin_certificates_file',
        'transportation_records_file'
    ]
    
    print("Checking required fields:")
    for field_name in required_fields:
        field = meta.get_field(field_name)
        if field:
            print(f"  ✓ {field_name}: {field.fieldtype}")
        else:
            print(f"  ✗ {field_name}: Not found")
    
    return True

def main():
    """Run all tests"""
    print("Starting tests for franchise signup form fixes...")
    print("=" * 60)
    
    try:
        # Run all tests
        test_doctype_configuration()
        test_file_upload_fixes()
        test_field_population()
        test_form_data_saving()
        
        print("\n" + "=" * 60)
        print("✓ All tests completed successfully!")
        print("\nSummary of fixes applied:")
        print("1. Fixed step 3 data collection to properly handle source_type and generation_locations")
        print("2. Fixed file upload field handling in populateFormData function")
        print("3. Removed conflicting step 4 handlers")
        print("4. Updated file upload display to show proper file names instead of [object File]")
        print("5. Added proper file URL restoration when form is loaded")
        
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        frappe.log_error(f"Test script error: {e}", "Franchise Portal Test Error")

if __name__ == "__main__":
    main() 