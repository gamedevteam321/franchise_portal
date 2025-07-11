# Franchise Portal - Rejection & Reapplication Feature

## Overview

This feature implements functionality to allow users to create new franchise signup applications with the same email address after their previous application has been rejected. This addresses the business requirement to enable applicants to reapply after addressing rejection concerns.

## Features Implemented

### ✅ 1. Modified Email Uniqueness Validation
- **Previous Behavior**: Email addresses were completely unique - no two applications could use the same email
- **New Behavior**: Users can create new applications with the same email ONLY if their previous applications were rejected
- **Location**: `franchise_signup_application.py` - `validate_email_uniqueness()` method

### ✅ 2. Enhanced Rejection Notification Email
- **Added**: Clear instructions for reapplying
- **Added**: Direct link to signup form for creating new applications
- **Added**: Step-by-step guidance for successful reapplication
- **Added**: Important notes about fresh application process
- **Location**: `franchise_signup_application.py` - `_send_rejection_notification()` method

### ✅ 3. New API Endpoints

#### `check_reapplication_eligibility(email)`
- **Purpose**: Check if a user can create a new application
- **Returns**: Eligibility status, previous applications, and detailed messaging
- **URL**: `POST /api/method/franchise_portal.signup.api.check_reapplication_eligibility`

#### `start_new_application_after_rejection(email, data)`
- **Purpose**: Initiate a new application process after rejection with proper validation
- **Returns**: Verification token for email verification process
- **URL**: `POST /api/method/franchise_portal.signup.api.start_new_application_after_rejection`

### ✅ 4. Specialized Reapplication Email
- **Function**: `send_reapplication_verification_email()`
- **Features**: 
  - Shows previous rejected application context
  - Emphasizes fresh start approach
  - Provides success tips
  - Clear call-to-action for verification

## Technical Implementation

### Database Changes
No database schema changes were required. The existing `Franchise Signup Application` doctype supports multiple records per email when previous ones are rejected.

### Validation Logic
```python
def validate_email_uniqueness(self):
    """Ensure email is unique across all applications, except for rejected applications"""
    existing = frappe.get_all(
        "Franchise Signup Application",
        filters={"email": self.email, "name": ["!=", self.name]},
        fields=["name", "status"],
        limit=10  # Get more to check if any are non-rejected
    )
    if existing:
        # Check if any existing applications are not rejected
        non_rejected_applications = [app for app in existing if app.status != "Rejected"]
        if non_rejected_applications:
            frappe.throw(f"An active application with email {self.email} already exists. You can only create a new application if your previous application was rejected.")
```

### Email Flow
1. **Application Rejected** → Enhanced rejection email sent with reapplication instructions
2. **User Clicks Reapply Link** → Directed to signup form
3. **Email Verification Process** → Special reapplication verification email
4. **New Application Creation** → Fresh application with same email allowed

## User Experience Flow

### For Rejected Applicants
1. **Receive Rejection Email**
   - Clear explanation of rejection reason
   - Prominent "Submit New Application" button
   - Detailed next steps and tips

2. **Click Reapply Button**
   - Directed to signup form
   - Can enter same email address
   - System validates eligibility

3. **Email Verification**
   - Receives reapplication-specific verification email
   - Shows context of previous rejected application
   - Emphasizes fresh start approach

4. **Complete New Application**
   - All 8 steps must be completed fresh
   - No data carried over from rejected application
   - Independent review process

### For Administrators
1. **Reject Application**
   - Provide clear rejection reason
   - System automatically sends enhanced rejection email
   - Tracking of rejection reason and date

2. **Review New Applications**
   - Can see previous applications in system
   - Each application is independent
   - Clear audit trail maintained

## API Usage Examples

### Check Reapplication Eligibility
```javascript
frappe.call({
    method: 'franchise_portal.signup.api.check_reapplication_eligibility',
    args: { email: 'user@example.com' },
    callback: function(response) {
        if (response.message.success && response.message.can_reapply) {
            // User can create new application
            console.log('User can reapply');
        } else {
            // User has active application or other issue
            console.log('Cannot reapply: ' + response.message.message);
        }
    }
});
```

### Start New Application After Rejection
```javascript
const applicationData = {
    company_name: "New Company Name",
    contact_person: "Contact Person",
    phone_number: "1234567890"
};

frappe.call({
    method: 'franchise_portal.signup.api.start_new_application_after_rejection',
    args: { 
        email: 'user@example.com',
        data: applicationData 
    },
    callback: function(response) {
        if (response.message.success) {
            // Verification email sent
            console.log('Verification token: ' + response.message.verification_token);
        }
    }
});
```

## Testing

### Manual Testing Steps
1. Create a franchise application
2. Submit the application
3. Reject the application from admin panel
4. Check rejection email content
5. Try to create new application with same email
6. Verify new application creation works
7. Test that users with active applications cannot create new ones

### Automated Testing
Run the test script:
```bash
cd frappe-bench
python apps/franchise_portal/test_rejection_flow.py
```

### Test Cases Covered
- ✅ Email uniqueness validation with rejected applications
- ✅ Email uniqueness validation prevention with active applications  
- ✅ Rejection notification email sending
- ✅ Reapplication eligibility checking
- ✅ New application creation after rejection
- ✅ Verification email for reapplications

## Business Rules

### When Users CAN Reapply
- ✅ Previous application status is "Rejected"
- ✅ No other active applications (Draft, In Progress, Submitted, Approved)
- ✅ Valid email address provided
- ✅ Required application data provided

### When Users CANNOT Reapply
- ❌ Has active application (any status except Rejected)
- ❌ Invalid or missing email address
- ❌ Missing required application data

### Application Independence
- Each application is completely independent
- No data is carried over between applications
- Separate review and approval process
- Independent audit trail

## Security Considerations

### Email Verification
- All new applications require email verification
- Verification tokens expire in 24 hours
- Secure token generation using UUID4

### Permission Checks
- API endpoints are publicly accessible (as required for signup)
- Backend validation ensures only eligible users can create applications
- Rejection functionality requires admin permissions

### Data Integrity
- Applications maintain referential integrity
- Previous rejected applications are preserved for audit
- Clear status tracking and timestamps

## Monitoring & Analytics

### Trackable Metrics
- Number of reapplications per email
- Time between rejection and reapplication
- Success rate of reapplications vs initial applications
- Common rejection reasons leading to reapplication

### Logging
- All reapplication attempts are logged
- Email sending success/failure tracking
- API endpoint usage monitoring
- Error tracking and alerting

## Future Enhancements

### Potential Improvements
1. **Auto-populate Common Fields**: Option to carry over basic company information
2. **Rejection Reason Categories**: Standardized rejection reasons for better tracking
3. **Reapplication Guidelines**: Dynamic tips based on rejection reason
4. **Dashboard Analytics**: Admin dashboard showing reapplication statistics
5. **Follow-up Emails**: Automated follow-up after rejection to encourage reapplication

### Integration Opportunities
1. **CRM Integration**: Track lead nurturing through rejection/reapplication cycle
2. **Marketing Automation**: Targeted campaigns for rejected applicants
3. **Document Management**: Version control for updated documents in reapplications

## Support & Troubleshooting

### Common Issues
1. **Email not received**: Check spam folder, verify email address
2. **Cannot create new application**: Verify previous application is rejected
3. **Verification link expired**: Request new verification email

### Error Messages
- "An active application with email X already exists": User has non-rejected application
- "You are not eligible to create a new application": System validation failed
- "Email verification failed": Invalid or expired token

### Admin Actions
- View all applications for an email in the admin panel
- Manually update application status if needed
- Resend verification emails through API

---

## Summary

This implementation successfully addresses the business requirement to allow reapplication after rejection while maintaining data integrity and security. The solution provides:

1. **Clear User Experience**: Users receive helpful emails with direct paths to reapplication
2. **Robust Validation**: System prevents misuse while enabling legitimate reapplications  
3. **Audit Trail**: Complete tracking of all applications and status changes
4. **Scalable Architecture**: API-based approach supports future enhancements

The feature is production-ready and includes comprehensive testing, documentation, and error handling. 