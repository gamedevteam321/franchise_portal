# Franchise Portal Setup Guide

Complete installation and setup guide for the Franchise Portal application built on Frappe/ERPNext.

## Table of Contents

1. [File Structure](#file-structure)
2. [Overview](#overview)
3. [Prerequisites](#prerequisites)
4. [System Requirements](#system-requirements)
5. [Installation](#installation)
6. [Configuration](#configuration)
7. [Roles and Permissions Setup](#roles-and-permissions-setup)
8. [DocTypes Overview](#doctypes-overview)
9. [Company Hierarchy Setup](#company-hierarchy-setup)
10. [Email Configuration](#email-configuration)
11. [Website Routes and Templates](#website-routes-and-templates)
12. [API Endpoints](#api-endpoints)
13. [File Upload Configuration](#file-upload-configuration)
14. [Testing and Verification](#testing-and-verification)
15. [Usage Instructions](#usage-instructions)
16. [Troubleshooting](#troubleshooting)
17. [Maintenance](#maintenance)

## File Structure

Before starting, understand the correct file locations:

### ✅ App Files (Inside `frappe-bench/apps/franchise_portal/`)
```
franchise_portal/
├── SETUP.md (this file)
├── README.md
├── pyproject.toml
├── franchise_portal/
│   ├── hooks.py
│   ├── modules.txt
│   ├── public/
│   │   └── js/
│   │       ├── franchise_portal.js
│   │       └── signup.js
│   ├── www/
│   │   └── signup/
│   │       ├── index.html
│   │       └── api.py
│   └── franchise_portal/
│       └── doctype/
│           └── franchise_signup_application/
```

### ✅ Setup Scripts (Outside app, in `frappe-bench/`)
```
frappe-bench/
├── create_role.py
├── create_franchise_partner_role.py
├── deploy_franchise_approval.py
├── setup_company_hierarchy.py
├── check_roles.py
└── apps/
    └── franchise_portal/ (app folder)
```

**Why this structure?**
- **Setup scripts**: Need access to bench context and database, must run from `frappe-bench/`
- **App documentation**: Belongs inside the app folder for version control and deployment
- **App code**: All application code stays within the app folder structure

## Overview

The Franchise Portal is a comprehensive application for managing franchise signup and approval processes. It includes:

- **Multi-step franchise application form** (7 steps)
- **Email verification system**
- **Approval/rejection workflow**
- **Automatic company and user creation**
- **Company hierarchy management**
- **File upload support**
- **Email notifications**
- **Admin dashboard**

### Key Features

- ✅ Professional multi-step application form
- ✅ Email verification for applicants
- ✅ Role-based access control
- ✅ Automatic company creation under proper hierarchy
- ✅ User management with franchise-specific roles
- ✅ File upload and management
- ✅ Email notifications and confirmations
- ✅ Admin approval/rejection workflow
- ✅ Comprehensive data collection (feedstock, monitoring, sustainability)

## Prerequisites

### Frappe Framework
- **Frappe Framework**: v14.x or v15.x
- **ERPNext**: v14.x or v15.x (if using ERPNext)
- **Python**: 3.8+ (3.10+ recommended)
- **Node.js**: 16.x or 18.x
- **Redis**: Latest stable
- **MariaDB**: 10.3+ or **PostgreSQL**: 12+

### Development Tools
- **Git**: Latest version
- **Bench**: Frappe bench CLI tool

### API Keys (Optional but Recommended)
- **Google Maps API Key**: For location features
- **Email Service**: SMTP configuration

## System Requirements

### Minimum Hardware Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **Network**: Stable internet connection

### Recommended Hardware Requirements
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD
- **Network**: High-speed internet

### Operating System
- **Linux**: Ubuntu 20.04+, CentOS 7+, Debian 10+
- **macOS**: 10.15+ (for development)
- **Windows**: WSL2 with Ubuntu (for development)

## Installation

### Step 1: Setup Frappe Bench Environment

```bash
# Install bench if not already installed
pip3 install frappe-bench

# Create a new bench
bench init frappe-bench
cd frappe-bench

# Create a new site
bench new-site localhost
```

### Step 2: Get the Franchise Portal App

```bash
# Get the app from repository
bench get-app franchise_portal https://github.com/nexcharventures/franchise_portal.git

# OR if developing locally
# bench new-app franchise_portal
```

### Step 3: Install the App

```bash
# Install app to site
bench --site localhost install-app franchise_portal

# Build assets
bench build --app franchise_portal

# Migrate
bench --site localhost migrate
```

### Step 4: Start Services

```bash
# Start bench in development mode
bench start

# OR for production
bench setup production [user]
```

## Configuration

### 1. Site Configuration

Edit `sites/common_site_config.json`:

```json
{
  "background_workers": 1,
  "default_site": "localhost",
  "file_watcher_port": 6787,
  "google_maps_api_key": "YOUR_GOOGLE_MAPS_API_KEY",
  "gunicorn_workers": 4,
  "live_reload": true,
  "redis_cache": "redis://127.0.0.1:13000",
  "redis_queue": "redis://127.0.0.1:11000",
  "redis_socketio": "redis://127.0.0.1:13000",
  "serve_default_site": true,
  "socketio_port": 9000,
  "webserver_port": 8000
}
```

### 2. Email Configuration

Configure SMTP in ERPNext:
1. Go to **Setup → Email → Email Account**
2. Create new Email Account with SMTP details
3. Set as default outgoing

Example configuration:
```
Email ID: admin@nexcharventures.com
SMTP Server: smtp.gmail.com
SMTP Port: 587
Use TLS: Yes
Username: your-email@gmail.com
Password: your-app-password
```

### 3. Google Maps API (Optional)

Set your Google Maps API key in `common_site_config.json`:
```json
{
  "google_maps_api_key": "YOUR_API_KEY_HERE"
}
```

## Roles and Permissions Setup

### Required Roles

The franchise portal uses these roles:

#### 1. Franchise Approval Admin
- **Purpose**: Approve/reject franchise applications
- **Permissions**: Full access to Franchise Signup Application doctype
- **Can**: Read, Write, Create, Report, Export, Print, Email

#### 2. Franchise Partner
- **Purpose**: Role for approved franchise partners
- **Permissions**: Limited access based on business requirements
- **Can**: Access franchise-specific features

### Setup Roles and Permissions

**Important**: Setup scripts are located in the `frappe-bench/` directory (outside the app folder) and must be run from there.

Run the automated setup script:

```bash
cd frappe-bench
python3 create_role.py
```

### Manual Role Creation

If automated script fails, create roles manually:

```bash
# Start bench console
bench --site localhost console

# Create Franchise Approval Admin role
role_doc = frappe.get_doc({
    "doctype": "Role",
    "role_name": "Franchise Approval Admin",
    "desk_access": 1,
    "disabled": 0
})
role_doc.insert()

# Create Franchise Partner role
partner_role = frappe.get_doc({
    "doctype": "Role",
    "role_name": "Franchise Partner",
    "desk_access": 1,
    "disabled": 0
})
partner_role.insert()

frappe.db.commit()
exit()
```

### Assign Roles to Users

```bash
# Start console
bench --site localhost console

# Assign role to administrator
user = frappe.get_doc("User", "administrator@localhost")
user.add_roles("Franchise Approval Admin")

# OR assign to specific user
user = frappe.get_doc("User", "admin@nexcharventures.com")
user.add_roles("Franchise Approval Admin")

frappe.db.commit()
exit()
```

## DocTypes Overview

### Primary DocType: Franchise Signup Application

**Purpose**: Main application form for franchise signups

**Key Fields**:
- **Naming Series**: `FSA-.YYYY.-`
- **Status**: Draft, In Progress, Submitted, Approved, Rejected
- **Email Verification**: `email_verified`, `email_verified_at`
- **Approval Fields**: `approved_by`, `approved_at`, `approval_comments`
- **Company Creation**: `company_created`, `company_name_created`
- **User Creation**: `user_created`

**Tabs Structure**:
1. **Supplier Information** - Company details, contact info
2. **Project Information** - Project details, location, timeline
3. **Feedstock Description** - Feedstock categories, specifications
4. **Origin, Sourcing & Supply Chain** - Source details, logistics
5. **Monitoring & Measurement** - Equipment, laboratory analysis
6. **Sustainability Assessment & Market Impact** - Environmental data
7. **Emissions & Energy Accounting** - Carbon calculations

### Secondary DocType: Generation Location

**Purpose**: Child table for multiple generation locations

**Fields**:
- `address` (Data) - Location address
- `gps_coordinates` (Data) - GPS coordinates

### DocType Permissions

```json
{
  "System Manager": {
    "create": 1, "read": 1, "write": 1, "delete": 1,
    "submit": 1, "cancel": 1, "report": 1, "export": 1
  },
  "Franchise Approval Admin": {
    "create": 1, "read": 1, "write": 1, "delete": 0,
    "submit": 0, "cancel": 0, "report": 1, "export": 1,
    "print": 1, "email": 1
  },
  "Guest": {
    "create": 1, "read": 1, "write": 1
  }
}
```

## Company Hierarchy Setup

### Automatic Company Creation

When applications are approved, companies are created under this hierarchy:

```
Nexchar Ventures (Root Company)
├── Franchise (Group Company)
│   └── [Franchise companies created here]
└── Internal Company (Group Company)
    └── [Internal companies created here]
```

### Setup Company Hierarchy

**Important**: This script is located in `frappe-bench/` directory and must be run from there.

Run the setup script:

```bash
cd frappe-bench
python3 setup_company_hierarchy.py
```

### Manual Setup

```bash
# Start console
bench --site localhost console

# Ensure root company exists
if not frappe.db.exists("Company", "Nexchar Ventures"):
    root_company = frappe.get_doc({
        "doctype": "Company",
        "company_name": "Nexchar Ventures",
        "abbr": "NEX",
        "default_currency": "INR",
        "country": "India",
        "is_group": 1,
        "domain": "Manufacturing"
    })
    root_company.insert()

# Create Franchise group
if not frappe.db.exists("Company", "Franchise"):
    franchise_group = frappe.get_doc({
        "doctype": "Company",
        "company_name": "Franchise",
        "abbr": "FRA",
        "default_currency": "INR",
        "country": "India",
        "parent_company": "Nexchar Ventures",
        "is_group": 1
    })
    franchise_group.insert()

# Create Internal Company group
if not frappe.db.exists("Company", "Internal Company"):
    internal_group = frappe.get_doc({
        "doctype": "Company",
        "company_name": "Internal Company",
        "abbr": "INT",
        "default_currency": "INR",
        "country": "India", 
        "parent_company": "Nexchar Ventures",
        "is_group": 1
    })
    internal_group.insert()

frappe.db.commit()
exit()
```

### Company Creation Process

When an application is approved:

1. **Company Name**: Uses application's company name
2. **Abbreviation**: Auto-generated from company name
3. **Parent Company**: Based on project type (Franchise/Internal Company)
4. **Currency**: INR (Indian Rupees)
5. **Country**: India
6. **Domain**: Manufacturing
7. **Additional Fields**: Email, phone, description, dates

## Email Configuration

### Email Templates

The system uses several email templates:

#### 1. Verification Email
- **Purpose**: Verify applicant's email address
- **Trigger**: On initial application submission
- **Contains**: Verification link with unique token

#### 2. Confirmation Email
- **Purpose**: Confirm successful application submission
- **Trigger**: After completing all 7 steps
- **Contains**: Application ID, next steps, contact information

#### 3. Approval Email
- **Purpose**: Notify applicant of approval
- **Trigger**: When admin approves application
- **Contains**: Company created, user credentials, login instructions

#### 4. Rejection Email
- **Purpose**: Notify applicant of rejection
- **Trigger**: When admin rejects application
- **Contains**: Rejection reason, contact for clarification

#### 5. Admin Notification
- **Purpose**: Notify admins of new applications
- **Trigger**: On application submission
- **Contains**: Application summary, applicant details

### Email Settings

Configure in **Setup → Email**:

```
Default Outgoing Email: admin@nexcharventures.com
Footer: © 2024 Nexchar Ventures. All rights reserved.
Auto Reply: Enabled
Signature: Nexchar Ventures Team
```

## Website Routes and Templates

### Public Routes

#### 1. Signup Form: `/signup`
- **Template**: `franchise_portal/www/signup/index.html`
- **JavaScript**: `signup.js` (with cache busting)
- **API**: `signup/api.py`
- **Features**: 
  - Multi-step form (7 steps)
  - Email verification
  - File uploads
  - Progress tracking
  - Session management

#### 2. Email Verification: `/signup?verify=TOKEN`
- **Purpose**: Email verification landing
- **Process**: Validates token, marks email verified
- **Redirect**: Back to signup form with verified status

### Admin Routes

#### 1. Franchise Signup Application List
- **Route**: `/app/franchise-signup-application`
- **Purpose**: View all applications
- **Features**: Filter by status, search, export

#### 2. Individual Application View
- **Route**: `/app/franchise-signup-application/[ID]`
- **Purpose**: View/edit single application
- **Features**: Approve/reject buttons, history tracking

### Template Structure

```
templates/
├── web.html (base template)
└── pages/
    └── signup/
        ├── index.html (main signup form)
        └── api.py (backend API)

public/
├── js/
│   ├── franchise_portal.js (common utilities)
│   ├── signup.js (form logic)
│   └── franchise_signup_application.js (admin interface)
├── css/
│   └── [custom styles]
└── img/
    └── [assets]
```

## API Endpoints

### Public APIs (Guest Access)

#### 1. Send Verification Email
```
POST /api/method/franchise_portal.signup.api.send_verification_email
Parameters: email, data (JSON)
Returns: success, verification_token
```

#### 2. Verify Email
```
POST /api/method/franchise_portal.signup.api.verify_email
Parameters: token
Returns: success, session_data
```

#### 3. Save Step Data
```
POST /api/method/franchise_portal.signup.api.save_step
Parameters: data (form data)
Returns: success, application_id
```

#### 4. Save Step with Verification
```
POST /api/method/franchise_portal.signup.api.save_step_with_verification
Parameters: token, data, step
Returns: success, message
```

#### 5. Send Confirmation Email
```
POST /api/method/franchise_portal.signup.api.send_confirmation_email
Parameters: email, application_id, applicant_name
Returns: success, email_sent_to
```

#### 6. Get Application
```
POST /api/method/franchise_portal.signup.api.get_application
Parameters: email OR name
Returns: success, application
```

### Admin APIs (Authenticated)

#### 1. Approve Application
```
POST /api/method/[docname].approve_application
Parameters: comments (optional)
Returns: success, company_name, user_email
```

#### 2. Reject Application
```
POST /api/method/[docname].reject_application
Parameters: reason
Returns: success, message
```

### File Upload APIs

#### 1. Upload File
```
POST /api/method/upload_file
Headers: Content-Type: multipart/form-data
Parameters: file, doctype, docname, fieldname
Returns: file_url, file_name
```

## File Upload Configuration

### Supported File Types
- **Documents**: PDF, DOC, DOCX
- **Images**: JPG, JPEG, PNG, GIF
- **Spreadsheets**: XLS, XLSX, CSV
- **Archives**: ZIP, RAR

### File Size Limits
- **Maximum File Size**: 10MB per file
- **Total Upload Limit**: 100MB per application

### File Storage
- **Private Files**: Stored in `sites/[site]/private/files/`
- **Public Files**: Stored in `sites/[site]/public/files/`
- **Access Control**: Based on DocType permissions

### File Fields in Application
- `feedstock_payment_file`
- `chain_of_custody_file`
- `supplier_agreements_file`
- `origin_certificates_file`
- `transportation_records_file`

## Testing and Verification

### 1. Installation Verification

```bash
# Check if app is installed
bench --site localhost list-apps

# Check DocTypes
bench --site localhost console
>>> frappe.get_meta("Franchise Signup Application")
>>> exit()

# Check roles
bench --site localhost console
>>> frappe.db.exists("Role", "Franchise Approval Admin")
>>> frappe.db.exists("Role", "Franchise Partner")
>>> exit()
```

### 2. Functional Testing

#### Test Signup Process
1. Navigate to `http://localhost:8000/signup`
2. Fill out Step 1 (Supplier Information)
3. Verify email verification process
4. Complete all 7 steps
5. Submit application
6. Check confirmation email

#### Test Approval Process
1. Login as admin
2. Go to Franchise Signup Application list
3. Open submitted application
4. Click "Approve" button
5. Verify company and user creation
6. Check approval email

### 3. API Testing

```bash
# Test email verification
curl -X POST http://localhost:8000/api/method/franchise_portal.signup.api.send_verification_email \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "data": "{\"company_name\": \"Test Company\"}"}'

# Test application retrieval
curl -X POST http://localhost:8000/api/method/franchise_portal.signup.api.get_application \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### 4. Database Verification

```sql
-- Check applications
SELECT name, company_name, status, email_verified FROM `tabFranchise Signup Application`;

-- Check companies created
SELECT name, company_name, parent_company FROM `tabCompany` WHERE parent_company IN ('Franchise', 'Internal Company');

-- Check roles
SELECT name, role_name FROM `tabRole` WHERE role_name LIKE '%Franchise%';
```

## Usage Instructions

### For Administrators

#### 1. Managing Applications

1. **Access Applications**
   - Go to **Franchise Portal → Franchise Signup Application**
   - View list of all applications
   - Filter by status (Draft, Submitted, Approved, Rejected)

2. **Review Application**
   - Click on application to open
   - Review all tabs and information
   - Check uploaded files
   - Verify contact information

3. **Approve Application**
   - Click **"Approve"** button
   - Add optional comments
   - System automatically:
     - Creates company under proper hierarchy
     - Creates user with Franchise Partner role
     - Sends approval email to applicant
     - Updates application status

4. **Reject Application**
   - Click **"Reject"** button
   - Provide rejection reason
   - System sends rejection email

#### 2. User Management

1. **View Created Users**
   - Go to **Users → User List**
   - Filter by role "Franchise Partner"
   - Manage user permissions as needed

2. **Company Management**
   - Go to **Accounting → Company**
   - View company hierarchy
   - Manage company settings

### For Applicants

#### 1. Starting Application

1. **Navigate to Signup**
   - Go to `http://[your-domain]/signup`
   - Fill in basic company information
   - Verify email address

2. **Complete Application Steps**

   **Step 1: Supplier Information**
   - Company name, contact person
   - Email, phone number
   - Company address
   - Country of operation

   **Step 2: Project Information**
   - Project name and type
   - Location details
   - GPS coordinates
   - Start date and reporting period

   **Step 3: Feedstock Description**
   - Primary feedstock category
   - Specific feedstock type
   - Classification and source
   - Payment information

   **Step 4: Origin, Sourcing & Supply Chain**
   - Source type and locations
   - Collection methods
   - Transportation details
   - Supply chain documentation

   **Step 5: Monitoring & Measurement**
   - Equipment specifications
   - Laboratory analysis details
   - Data management systems

   **Step 6: Sustainability Assessment**
   - Environmental impact data
   - Market analysis
   - Sustainability metrics

   **Step 7: Emissions & Energy**
   - Carbon calculations
   - Energy accounting
   - Final submission

3. **Track Application Status**
   - Save application ID from confirmation email
   - Contact support for status updates

#### 2. Email Verification

1. **Check Email**
   - Look for verification email
   - Click verification link
   - Return to signup form

2. **Verification Issues**
   - Check spam folder
   - Ensure correct email address
   - Contact support if needed

### For Franchise Partners

#### 1. First Login

1. **Welcome Email**
   - Check email for login credentials
   - Use provided login link
   - Set new password if required

2. **Portal Access**
   - Login to franchise portal
   - Access franchise-specific features
   - Update profile information

## Troubleshooting

### Common Installation Issues

#### 1. App Installation Fails

```bash
# Clear cache and retry
bench clear-cache
bench build --app franchise_portal
bench --site localhost install-app franchise_portal
```

#### 2. Role Creation Fails

```bash
# Manual role creation (ensure you're in frappe-bench directory)
cd frappe-bench
bench --site localhost console
>>> exec(open('create_role.py').read())
>>> exit()
```

#### 3. Permission Issues

```bash
# Reset permissions
bench --site localhost set-admin-password [password]
bench --site localhost add-to-hosts
```

### Common Runtime Issues

#### 1. Email Not Sending

**Check Configuration:**
- Verify SMTP settings in Email Account
- Test email account connection
- Check firewall/port access

**Debug Steps:**
```bash
# Check email queue
bench --site localhost console
>>> frappe.get_all("Email Queue", fields=["name", "status", "error"])
>>> exit()
```

#### 2. File Upload Issues

**Check:**
- File size limits
- File type restrictions
- Directory permissions

**Fix:**
```bash
# Check file permissions
sudo chown -R [user]:[group] sites/[site]/private/files/
sudo chmod -R 755 sites/[site]/private/files/
```

#### 3. Company Creation Fails

**Debug:**
```bash
# Check company hierarchy
bench --site localhost console
>>> frappe.get_all("Company", fields=["name", "company_name", "parent_company"])
>>> exit()
```

**Fix:**
```bash
# Reset company hierarchy (run from frappe-bench directory)
cd frappe-bench
python3 setup_company_hierarchy.py
```

### Debug Mode

Enable debug mode for troubleshooting:

```json
// sites/[site]/site_config.json
{
  "developer_mode": 1,
  "disable_website_cache": 1,
  "logging": 2
}
```

### Log Files

Check these log files for errors:

```bash
# Error logs
tail -f sites/[site]/logs/error.log

# Access logs  
tail -f sites/[site]/logs/web.log

# Background job logs
tail -f logs/worker.log
```

## Maintenance

### Regular Tasks

#### 1. Database Maintenance

```bash
# Backup database
bench --site localhost backup

# Optimize database
bench --site localhost console
>>> frappe.db.sql("OPTIMIZE TABLE `tabFranchise Signup Application`")
>>> exit()
```

#### 2. File Cleanup

```bash
# Clean up temporary files
bench --site localhost console
>>> frappe.utils.file_manager.cleanup_temp_files()
>>> exit()

# Archive old applications (optional)
# Create custom script to archive applications older than X months
```

#### 3. Cache Management

```bash
# Clear all caches
bench clear-cache

# Clear website cache
bench clear-website-cache

# Rebuild assets
bench build --app franchise_portal
```

### Updates and Upgrades

#### 1. App Updates

```bash
# Pull latest changes
cd apps/franchise_portal
git pull origin main

# Migrate changes
bench --site localhost migrate
bench build --app franchise_portal
bench restart
```

#### 2. Frappe Framework Updates

```bash
# Update bench
pip3 install --upgrade frappe-bench

# Update Frappe
bench update

# Test thoroughly after updates
```

### Monitoring

#### 1. Application Metrics

Track these metrics:
- Number of applications per month
- Approval/rejection rates
- Average completion time
- User engagement metrics

#### 2. System Health

Monitor:
- Database performance
- File storage usage
- Email delivery rates
- Error rates in logs

### Security

#### 1. Regular Security Checks

- Review user permissions
- Check for unauthorized access
- Validate file upload security
- Monitor email activity

#### 2. Data Protection

- Regular database backups
- Secure file storage
- Email encryption
- Access logging

### Performance Optimization

#### 1. Database Optimization

```sql
-- Add indexes for frequently queried fields
ALTER TABLE `tabFranchise Signup Application` ADD INDEX idx_email (email);
ALTER TABLE `tabFranchise Signup Application` ADD INDEX idx_status (status);
ALTER TABLE `tabFranchise Signup Application` ADD INDEX idx_created (creation);
```

#### 2. Caching Strategy

- Enable Redis caching
- Configure browser caching
- Optimize asset delivery

## Support and Documentation

### Internal Documentation

- **API Documentation**: Available at `/app/api`
- **User Guide**: Create internal user guides
- **Training Materials**: Develop training videos/documents

### External Resources

- **Frappe Documentation**: https://frappeframework.com/docs
- **ERPNext Documentation**: https://docs.erpnext.com
- **Community Forum**: https://discuss.frappe.io

### Getting Help

1. **Check Logs**: Always check error logs first
2. **Search Documentation**: Look for similar issues
3. **Community Support**: Post in Frappe community forums
4. **Professional Support**: Contact Frappe for commercial support

---

## Conclusion

This comprehensive setup guide covers all aspects of installing, configuring, and maintaining the Franchise Portal application. Follow the steps carefully and refer to the troubleshooting section for common issues.

For questions or support, please contact the development team or refer to the Frappe community resources.

**Version**: 1.0.0  
**Last Updated**: 2024  
**Maintained By**: Nexchar Ventures 