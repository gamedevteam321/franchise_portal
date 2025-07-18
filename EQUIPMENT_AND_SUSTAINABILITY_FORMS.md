# Equipment Mapping and Sustainability Mapping Forms

## Overview

This document describes the Equipment Mapping (Step 5) and Sustainability Mapping (Steps 6 & 7) forms that are part of the franchise portal application. These forms are designed to be filled by specific roles within the ERPNext system, not as separate HTML pages.

## Form Structure

### Step 5: Equipment Mapping Form
- **Purpose**: Map and track equipment used by franchise and internal companies
- **Role**: Hardware Engineer
- **Access**: Within ERPNext system
- **Company Filtering**: Only shows companies under Franchise and Internal Company groups

### Steps 6 & 7: Sustainability Mapping Form
- **Purpose**: Track sustainability assessments and environmental compliance
- **Role**: Sustainability Admin
- **Access**: Within ERPNext system
- **Company Filtering**: Only shows companies under Franchise and Internal Company groups

## Company Hierarchy

The forms filter companies based on the following hierarchy:

```
Nexchar Ventures (Root Company)
├── Franchise (Group Company)
│   └── [Individual Franchise Companies]
└── Internal Company (Group Company)
    └── [Individual Internal Companies]
```

Only companies under the "Franchise" and "Internal Company" groups are shown in the dropdown.

## Equipment Mapping Form (Step 5)

### Fields

#### Basic Information
- **Company** (Link): Dropdown filtered to show only Franchise and Internal Company groups
- **Equipment Name** (Data): Name of the equipment
- **Equipment Type** (Select): Electricity Meter, Weighbridge, Laboratory Equipment, Data Logging System, Other

#### Monitoring Equipment Details
- **Electricity Meter ID** (Data): Unique identifier for electricity meter
- **Meter Type/Model** (Data): Type and model of the meter
- **Monitoring Interval** (Select): Real-time, Every 5 minutes, Every 15 minutes, Every 30 minutes, Every hour, Daily, Weekly
- **Last Calibration Date** (Date): Date of last calibration
- **Next Calibration Due** (Date): Date when next calibration is due

#### Weighbridge Details
- **Weighbridge ID** (Data): Unique identifier for weighbridge
- **Capacity** (Float): Capacity in tonnes
- **Accuracy Rating** (Float): Accuracy rating in percentage
- **Continuous Recording** (Select): Yes/No
- **Data Logging System** (Data): Description of data logging system

#### Laboratory Details
- **Testing Laboratory Name** (Data): Name of the testing laboratory
- **Lab Accreditation Number** (Data): Accreditation number
- **Testing Standards Used** (Select): ISO 17025, ASTM, Other
- **Other Testing Standards** (Data): Specify other standards if applicable
- **Analysis Frequency** (Select): Daily, Weekly, Monthly, Quarterly, As needed

#### Data Management
- **Automatic Data Upload** (Select): Yes/No
- **Data Storage Method** (Select): Local Database, Cloud Storage, Hybrid, Other
- **Backup System** (Data): Description of backup system
- **Retention Period** (Int): Retention period in years

### Usage Instructions

1. **Access**: Navigate to Franchise Portal → Equipment Mapping
2. **Create New**: Click "New" to create a new equipment mapping
3. **Select Company**: Choose from the filtered company dropdown
4. **Fill Details**: Complete all relevant sections based on equipment type
5. **Save**: Save the record

## Sustainability Mapping Form (Steps 6 & 7)

### Fields

#### Basic Information
- **Company** (Link): Dropdown filtered to show only Franchise and Internal Company groups
- **Sustainability Assessment Name** (Data): Name of the assessment
- **Assessment Date** (Date): Date of the assessment

#### Sustainability Assessment & Market Impact
- **Environmental Permits** (Select): Attached, Not Required, In Process
- **Environmental Permits File** (Attach): File attachment (shown when "Attached" is selected)
- **Regulatory Compliance Status** (Select): Confirmed, Pending, Non-compliant
- **Market Impact Assessment** (Small Text): Description of market impact

#### Emissions & Energy Accounting
- **Equipment Used** (Data): Description of equipment used
- **Fuel Type** (Select): Diesel, Petrol, Electric, Natural Gas, Biomass, Other
- **Other Fuel Type** (Data): Specify other fuel type if applicable
- **Emissions Factor** (Float): Emissions factor in kg CO₂/L or kg CO₂/kWh
- **Vehicle Type** (Data): Type of vehicle used
- **Fuel Efficiency** (Float): Fuel efficiency in L/km or kWh/km
- **Emissions per tonne-km** (Float): Emissions per tonne-km in kg CO₂/tonne-km
- **Drying Required** (Select): Yes/No
- **Drying Method** (Select): Solar, Mechanical, Thermal, Other
- **Other Drying Method** (Data): Specify other drying method if applicable
- **Energy Used** (Float): Energy used in MJ/tonne
- **Energy Source** (Select): Grid Electricity, Solar, Wind, Biomass, Fossil Fuel, Other
- **Other Energy Source** (Data): Specify other energy source if applicable
- **Calculated Total** (Float): Calculated total in kg CO₂/tonne
- **Uncertainty Range** (Float): Uncertainty range in percentage

### Usage Instructions

1. **Access**: Navigate to Franchise Portal → Sustainability Mapping
2. **Create New**: Click "New" to create a new sustainability mapping
3. **Select Company**: Choose from the filtered company dropdown
4. **Fill Assessment Details**: Complete sustainability assessment information
5. **Fill Emissions Data**: Complete emissions and energy accounting data
6. **Save**: Save the record

## Role Permissions

### Hardware Engineer Role
- **Access**: Equipment Mapping form only
- **Permissions**: Create, Read, Write, Export, Print, Email, Share
- **Restrictions**: Cannot delete records

### Sustainability Admin Role
- **Access**: Sustainability Mapping form only
- **Permissions**: Create, Read, Write, Export, Print, Email, Share
- **Restrictions**: Cannot delete records

## Setup Instructions

### 1. Create Roles
Run the role creation script:
```bash
cd frappe-bench
python3 create_equipment_and_sustainability_roles.py
```

### 2. Assign Roles to Users
1. Go to Users → User List
2. Select the user to assign role
3. Add the appropriate role (Hardware Engineer or Sustainability Admin)
4. Save the user

### 3. Test Company Filtering
Run the testing script:
```bash
cd frappe-bench
python3 test_company_filtering.py
```

## Technical Implementation

### Company Filtering
The company dropdown is filtered using the `get_company_options` function in both doctypes:

```python
@frappe.whitelist()
def get_company_options(doctype, txt, searchfield, start, page_len, filters):
    """
    Get company options filtered to only show companies under Franchise and Internal Company groups
    """
    companies = frappe.db.sql("""
        SELECT c.name, c.company_name 
        FROM `tabCompany` c
        WHERE c.parent_company IN ('Franchise', 'Internal Company')
        AND c.is_group = 0
        AND (c.name LIKE %s OR c.company_name LIKE %s)
        ORDER BY c.company_name
        LIMIT %s OFFSET %s
    """, (f'%{txt}%', f'%{txt}%', page_len, start), as_dict=1)
    
    return [(company.name, company.company_name) for company in companies]
```

### Form Configuration
- **Naming Series**: EM-.YYYY.- for Equipment Mapping, SM-.YYYY.- for Sustainability Mapping
- **Auto-timestamps**: Created At and Modified At fields are automatically updated
- **Required Fields**: Company, Equipment Name, Equipment Type for Equipment Mapping; Company, Sustainability Assessment Name, Assessment Date for Sustainability Mapping

## Troubleshooting

### Common Issues

1. **No companies showing in dropdown**
   - Ensure company hierarchy is set up correctly
   - Check that companies exist under Franchise and Internal Company groups
   - Verify the `get_company_options` function is working

2. **Role permissions not working**
   - Ensure roles are created in the system
   - Check that users have the correct roles assigned
   - Verify doctype permissions are set correctly

3. **Forms not accessible**
   - Check that the Franchise Portal module is installed
   - Ensure user has the correct role assigned
   - Verify user has desk access enabled

### Testing
Use the provided test script to verify functionality:
```bash
python3 test_company_filtering.py
```

## Support

For issues or questions regarding these forms:
1. Check the troubleshooting section above
2. Review the test script output
3. Contact the system administrator
4. Check the Frappe/ERPNext logs for errors 