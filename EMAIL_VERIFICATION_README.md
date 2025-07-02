# Email Verification for Franchise Portal Signup

## Overview

This document explains the email verification functionality implemented for the franchise portal signup process. When a user signs up, their email is verified before the application data is saved to the doctype.

## How It Works

### 1. Email Verification Flow

1. **User submits initial signup data** - User provides email and basic information
2. **Verification email sent** - System generates a unique token and sends verification email
3. **User clicks verification link** - User clicks the link in their email
4. **Email verified** - System marks email as verified and saves/updates the doctype
5. **User continues with application** - User can now proceed with the full application process

### 2. Database Changes

Two new fields have been added to the `Franchise Signup Application` doctype:

- `email_verified` (Check) - Boolean field indicating if email is verified
- `email_verified_at` (Datetime) - Timestamp when email was verified

### 3. API Endpoints

#### Send Verification Email
```
POST /api/method/franchise_portal.signup.api.send_verification_email
```
- **Parameters**: `email`, `data` (JSON string)
- **Returns**: Success status and verification token

#### Verify Email
```
POST /api/method/franchise_portal.signup.api.verify_email
```
- **Parameters**: `token`
- **Returns**: Success status and session data

#### Get Email Verification Status
```
POST /api/method/franchise_portal.signup.api.get_email_verification_status
```
- **Parameters**: `email`
- **Returns**: Verification status and application details

#### Test Email Verification Flow
```
POST /api/method/franchise_portal.signup.api.test_email_verification_flow
```
- **Parameters**: None
- **Returns**: Test results for the verification flow

### 4. Key Functions

#### `save_verified_email_to_doctype(email, session_data)`
- Checks if application exists for the email
- If exists: Updates with verification status and basic fields
- If not exists: Creates new application with verification status
- Preserves existing data and adds verification information

#### `verify_email(token)`
- Validates the verification token
- Marks email as verified in session
- Calls `save_verified_email_to_doctype()` to update database
- Returns session data for continued application process

### 5. Data Flow

1. **Initial Signup**: User data stored in cache with verification token
2. **Email Verification**: Token validated, session marked as verified
3. **Database Update**: Doctype created/updated with verified email status
4. **Continued Application**: User can save steps with verification check

### 6. Security Features

- Verification tokens expire after 24 hours
- Tokens are unique UUIDs
- Email verification status is preserved throughout the application process
- Session data is validated before allowing step saves

### 7. Error Handling

- Invalid/expired tokens return appropriate error messages
- Database errors are logged and handled gracefully
- Missing email data is validated before processing

## Usage Examples

### Frontend Integration

```javascript
// Send verification email
const response = await fetch('/api/method/franchise_portal.signup.api.send_verification_email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        email: 'user@example.com',
        data: JSON.stringify({
            company_name: 'Test Company',
            contact_person: 'John Doe'
        })
    })
});

// Verify email (when user clicks link)
const verifyResponse = await fetch('/api/method/franchise_portal.signup.api.verify_email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'verification-token' })
});

// Check verification status
const statusResponse = await fetch('/api/method/franchise_portal.signup.api.get_email_verification_status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@example.com' })
});
```

### Testing

Use the test endpoint to verify the complete flow:

```bash
curl -X POST http://localhost:8000/api/method/franchise_portal.signup.api.test_email_verification_flow
```

## Notes

- Email verification is required before users can save application steps
- Verification status is automatically preserved when updating existing applications
- The system handles both new applications and updates to existing ones
- All verification-related operations are logged for debugging purposes 