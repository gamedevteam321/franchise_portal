console.log('=== FORCE UPDATED VERSION - CACHE BUSTED ===');
console.log('=== NEW VERSION LOADED AT:', new Date().toISOString(), '===');
console.log('=== REAPPLICATION RESPONSE FIX APPLIED ===');
console.log('=== VERSION ID: 20250711_0930_REAPPLICATION_FIXED ===');
console.log('=== FILE MODIFIED: 2025-01-11 09:30:00 ===');

// Franchise Portal Signup JavaScript
// Version: 2.0 - Email Verification Workflow

// Prevent variable redeclaration if script loads multiple times
if (typeof window.currentStep === 'undefined') {
    window.currentStep = 1;
}
if (typeof window.applicationData === 'undefined') {
    window.applicationData = {};
}
if (typeof window.applicationId === 'undefined') {
    window.applicationId = null;
}
if (typeof window.verificationToken === 'undefined') {
    window.verificationToken = null;
}
if (typeof window.emailVerified === 'undefined') {
    window.emailVerified = false;
}
if (typeof window.isResumeMode === 'undefined') {
    window.isResumeMode = false;
}

// Use var instead of let to prevent redeclaration errors
var currentStep = window.currentStep;
var applicationData = window.applicationData;
var applicationId = window.applicationId;
var verificationToken = window.verificationToken;
var emailVerified = window.emailVerified;
var isResumeMode = window.isResumeMode;

// Ensure applicationData is available globally
window.applicationData = applicationData;

// Initialize the form when page loads
if (typeof frappe !== 'undefined' && frappe.ready) {
    frappe.ready(() => {
        console.log('Franchise signup form loaded via frappe.ready - Version 2.0 Email Verification');
        initializeForm();
        setupSignupOptions();
        // checkResumeToken now handled in index.html
    });
} else {
    // Fallback if frappe is not available
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Franchise signup form loaded via DOMContentLoaded - Version 2.0 Email Verification');
        initializeForm();
        setupSignupOptions();
        // checkResumeToken now handled in index.html
    });
}

// Test function to verify button clicks work
function testNextStep() {
    console.log('Test button click works!');
    alert('Button click registered successfully!');
}

// Ensure functions are available globally immediately
window.testNextStep = testNextStep;

function initializeForm() {
    console.log('Initializing form...');
    
    // Restore emailVerified and currentStep from sessionStorage if available
    const storedEmailVerified = sessionStorage.getItem('franchise_email_verified');
    if (storedEmailVerified !== null) {
        window.emailVerified = emailVerified = (storedEmailVerified === 'true');
        console.log('Restored emailVerified from sessionStorage:', emailVerified);
    }
    const storedCurrentStep = sessionStorage.getItem('franchise_current_step');
    if (storedCurrentStep !== null) {
        const restoredStep = parseInt(storedCurrentStep, 10);
        // Ensure step is not greater than 4 (our new maximum)
        if (restoredStep > 4) {
            console.log('Restored step was greater than 4, resetting to 4');
            window.currentStep = currentStep = 4;
            sessionStorage.setItem('franchise_current_step', '4');
        } else {
            window.currentStep = currentStep = restoredStep;
        }
        console.log('Restored currentStep from sessionStorage:', currentStep);
    }
    
    // Recover application ID from sessionStorage if available
    const storedApplicationId = sessionStorage.getItem('franchise_application_id');
    if (storedApplicationId && !window.applicationId) {
        window.applicationId = applicationId = storedApplicationId;
        console.log('Recovered application ID from sessionStorage:', applicationId);
    }
    
    // Check for form data recovery after refresh (only if not already completed)
    const recoveryCompleted = sessionStorage.getItem('recovery_completed');
    if (!recoveryCompleted) {
        recoverFormDataAfterRefresh();
    } else {
        console.log('Recovery already completed, skipping...');
        // Clear the flag for future use
        sessionStorage.removeItem('recovery_completed');
    }
    
    // Clear any old session storage data that might cause issues
    const currentStepValue = sessionStorage.getItem('franchise_current_step');
    if (currentStepValue && parseInt(currentStepValue, 10) > 4) {
        console.log('Clearing old session storage data with invalid step number');
        sessionStorage.removeItem('franchise_current_step');
        sessionStorage.removeItem('franchise_form_recovery_data');
        sessionStorage.removeItem('franchise_form_recovery_timestamp');
        setCurrentStep(1); // Reset to step 1
    }

    // --- PATCH: Ensure resume always starts at step 2 if email is verified ---
    if (window.emailVerified && (!window.currentStep || window.currentStep === 1)) {
        setCurrentStep(2);
        showStep(currentStep);
        updateProgressIndicator();
        console.log('Resume: Email verified, forcing currentStep = 2');
    }
    // -------------------------------------------------------------
    
    // Check for email verification in URL
    const urlParams = new URLSearchParams(window.location.search);
    const verifyToken = urlParams.get('verify');
    const testMode = urlParams.get('test');
    
    if (testMode === 'true') {
        console.log('TEST MODE: Email verification bypassed');
        emailVerified = true;
        verificationToken = 'test-token';
        sessionStorage.setItem('franchise_email_verified', 'true');
    }
    
    if (verifyToken && !testMode) {
        handleEmailVerification(verifyToken);
    }
    
    // Force fix Step 3 if it's currently active
    const step3Element = document.getElementById('step3');
    if (step3Element && step3Element.classList.contains('active')) {
        console.log('Step 3 is active on page load, applying fixes...');
        showStep(3); // This will trigger our Step 3 fixes
    }
    
    console.log('Form initialization complete');
    
    // Disabled auto-save to prevent race conditions with manual saves
    // const inputs = document.querySelectorAll('input, select, textarea');
    // inputs.forEach(input => {
    //     input.addEventListener('blur', autoSaveStep);
    // });
}

// Add global flag to prevent duplicate email verification (fixed for multiple script loads)
window.emailVerificationInProgress = window.emailVerificationInProgress || false;
var emailVerificationInProgress = window.emailVerificationInProgress;

function handleEmailVerification(token) {
    console.log('Handling email verification for token:', token);
    
    // Prevent duplicate verification calls
    if (emailVerificationInProgress) {
        console.log('Email verification already in progress, skipping duplicate call');
        return;
    }
    
    emailVerificationInProgress = true;
    
    frappe.call({
        method: 'franchise_portal.www.signup.api.verify_email',
        args: { token: token },
        callback: function(response) {
            console.log('Verification response:', response);
            
            if (response.message && response.message.success) {
                window.verificationToken = verificationToken = token;
                setEmailVerified(true);
                
                const sessionData = response.message.session_data;
                setCurrentStep(2); // Always show step 2 after verification
                window.applicationData = applicationData = sessionData.data;
                
                // Store application ID if returned
                if (response.message.application_id) {
                    window.applicationId = applicationId = response.message.application_id;
                    console.log('Application ID set after email verification:', applicationId);
                    
                    // Store in sessionStorage for persistence
                    sessionStorage.setItem('franchise_application_id', applicationId);
                }
                
                // Populate form with saved data
                populateFormData(applicationData);
                
                // Show current step
                showStep(currentStep);
                updateProgressIndicator();
                document.getElementById('form-container').style.display = 'block';
                
                // Show success message
                frappe.msgprint({
                    title: 'Email Verified',
                    message: 'Your email has been verified successfully! You can continue your application.',
                    indicator: 'green'
                });
                
                // Clean URL
                history.replaceState({}, '', '/signup');
                
                // --- PATCH: Sync backend current_step to 2 after verification ---
                if (window.applicationId) {
                    frappe.call({
                        method: 'franchise_portal.www.signup.api.update_current_step',
                        args: {
                            application_id: window.applicationId,
                            current_step: 2
                        }
                    });
                }
                // ... rest of the code ...
            } else {
                frappe.msgprint({
                    title: 'Verification Failed',
                    message: response.message?.message || 'Invalid or expired verification link.',
                    indicator: 'red'
                });
                
                // Fallback to step 1
                setCurrentStep(1);
                updateProgressIndicator();
            }
            
            // Reset flag after completion
            emailVerificationInProgress = false;
        },
        error: function(error) {
            console.error('Verification error:', error);
            frappe.msgprint({
                title: 'Verification Error',
                message: 'Failed to verify email. Please try again.',
                indicator: 'red'
            });
            
            // Fallback to step 1
            setCurrentStep(1);
            updateProgressIndicator();
            
            // Reset flag after error
            emailVerificationInProgress = false;
        }
    });
}

function nextStep(step) {
    console.log(`Next step clicked for step ${step}`);
    console.log(`Current emailVerified status: ${emailVerified}`);
    console.log(`Current verificationToken: ${verificationToken}`);
    
    // Disable the Next button to prevent double submissions
    const nextBtn = document.querySelector(`#step${step} .btn-primary`);
    //if (nextBtn) nextBtn.disabled = true;

    // Debug: Check if validation passes
    const isValid = validateStep(step);
    console.log(`Validation result: ${isValid}`);
    
    if (isValid) {
        // Force email verification for step 1 (unless already verified)
        if (step === 1 && !emailVerified) {
            console.log('Step 1 completed, FORCING verification email workflow...');
            sendVerificationEmail(step);
            //if (nextBtn) nextBtn.disabled = false;
            return; // Stop here, don't proceed to saveStepData
        }
        
        // For verified users or steps 2+
        console.log('Validation passed, saving step data...');
        
        // Special handling for the final step (step 4)
        if (step === 4) {
            console.log('Final step reached, submitting application...');
            submitApplication();
            return;
        }
        
        saveStepData(step, () => {
            console.log('Step data saved successfully, moving to next step');
            setCurrentStep(step + 1);
            
            // current_step is already updated in saveStepData, just log for verification
            console.log('Current step updated to:', currentStep);
            console.log('applicationData.current_step is:', applicationData.current_step);
            
            showStep(currentStep);
            updateProgressIndicator();
            //if (nextBtn) nextBtn.disabled = false;
        });
    } else {
        console.log('Validation failed, staying on current step');
        //if (nextBtn) nextBtn.disabled = false;
    }
}

// Make available globally immediately
window.nextStep = nextStep;

function previousStep(step) {
    setCurrentStep(step - 1);
    showStep(currentStep);
    updateProgressIndicator();
}

// Make available globally immediately
window.previousStep = previousStep;

function showStep(stepNumber) {
    console.log('showStep called for', stepNumber, 'element:', document.getElementById(`step${stepNumber}`));
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(step => {
        step.style.display = 'none';
        step.classList.remove('active');
    });

    // Show current step
    const currentStepElement = document.getElementById(`step${stepNumber}`);
    if (currentStepElement) {
        currentStepElement.style.setProperty('display', 'block', 'important');
        currentStepElement.classList.add('active');
        
        // FORCE FIX for Step 3 layout issues
        if (stepNumber === 3) {
            console.log('Applying direct styling fixes to Step 3');
            
            // Apply styling directly via JavaScript to override any CSS conflicts
            currentStepElement.style.cssText = `
                display: block !important;
                max-height: none !important;
                overflow-y: visible !important;
                overflow-x: visible !important;
                padding: 30px 50px 30px 50px !important;
                margin: 0 !important;
                margin-left: 0 !important;
                box-sizing: border-box !important;
                width: 100% !important;
                position: relative !important;
                left: 0 !important;
                transform: none !important;
                border: none !important;
                background-color: transparent !important;
            `;
            
            // Also fix the parent container
            const formContainer = document.querySelector('.form-container');
            if (formContainer) {
                formContainer.style.overflow = 'visible';
                formContainer.style.maxHeight = 'none';
                formContainer.style.paddingLeft = '50px';
            }
            
            // Fix all child elements in Step 3
            const step3Elements = currentStepElement.querySelectorAll('*');
            step3Elements.forEach(element => {
                element.style.marginLeft = '0';
                element.style.paddingLeft = '0';
                element.style.position = 'relative';
                element.style.left = '0';
            });
            
            console.log('Step 3 styling fixes applied via JavaScript');
        }
        
        // Initialize file uploads for the current step
        setTimeout(() => {
            console.log(`Initializing file uploads for step ${stepNumber}`);
            initializeFileUploads();
            
            // Also trigger any file upload toggles that should be active
            if (stepNumber === 3) {
                // Check feedstock payment field
                const paymentField = document.getElementById('feedstock_payment');
                if (paymentField && paymentField.value && paymentField.value !== 'No Feedstock Payment') {
                    toggleFileUpload('feedstock_payment', 'feedstock_payment_file_group');
                }
            } else if (stepNumber === 4) {
                // Check Step 4 attachment fields
                // Use correct field to file group mappings instead of automatic generation
                const step4FileMapping = {
                    'chain_of_custody_protocol': 'chain_of_custody_file_group',
                    'supplier_agreements': 'supplier_agreements_file_group', 
                    'origin_certificates': 'origin_certificates_file_group',
                    'transportation_records': 'transportation_records_file_group'
                };
                
                Object.keys(step4FileMapping).forEach(fieldId => {
                    const field = document.getElementById(fieldId);
                    const fileGroupId = step4FileMapping[fieldId];
                    if (field && field.value === 'Attached') {
                        console.log(`Triggering file upload for ${fieldId} -> ${fileGroupId}`);
                        toggleFileUpload(fieldId, fileGroupId);
                    }
                                });
            }
        }, 300);
    }
    // Update progress indicator
    updateProgressIndicator();
}

function updateProgressIndicator() {
    for (let i = 1; i <= 4; i++) {
        const progressElement = document.getElementById(`progress-${i}`);
        if (progressElement) {
            if (i < currentStep) {
                progressElement.className = 'progress-step completed';
            } else if (i === currentStep) {
                progressElement.className = 'progress-step active';
            } else {
                progressElement.className = 'progress-step inactive';
            }
        }
    }
}

function validateStep(step) {
    console.log(`Validating step ${step}`);
    const form = document.getElementById(`step${step}`);
    
    if (!form) {
        console.error(`Form step${step} not found!`);
        return false;
    }
    
    // Define step-specific required fields with user-friendly names
    const stepRequiredFields = {
        1: [
            { id: 'company_name', name: 'Company Name' },
            { id: 'email', name: 'Email Address' }
        ],
        2: [
            { id: 'project_name', name: 'Project Name' },
            { id: 'project_type', name: 'Project Type' },
            { id: 'gps_coordinates', name: 'GPS Coordinates' },
            { id: 'project_start_date', name: 'Project Start Date' }
        ],
        3: [
            { id: 'primary_feedstock_category', name: 'Primary Feedstock Category' }
        ],
        4: [
            { id: 'partner_first_name', name: 'Partner First Name' },
            { id: 'partner_gender', name: 'Partner Gender' },
            { id: 'partner_date_of_birth', name: 'Partner Date of Birth' },
            { id: 'partner_date_of_joining', name: 'Partner Date of Joining' }
        ]
    };
    
    // Get all fields with required attribute plus step-specific fields
    const requiredFields = form.querySelectorAll('[required]');
    const stepSpecificFields = stepRequiredFields[step] || [];
    
    console.log(`Found ${requiredFields.length} fields with required attribute`);
    console.log(`Step ${step} has ${stepSpecificFields.length} specific required fields`);
    
    let isValid = true;
    let missingFields = [];
    
    // Validate fields with required attribute
    requiredFields.forEach((field, index) => {
        console.log(`Checking field ${index}: ${field.id} = "${field.value}"`);
        
        if (!field.value || !field.value.trim()) {
            field.style.borderColor = '#dc3545';
            field.style.backgroundColor = '#fff5f5';
            isValid = false;
            
            // Get the field label
            const label = form.querySelector(`label[for="${field.id}"]`);
            const fieldName = label ? label.textContent.replace('*', '').trim() : field.name;
            missingFields.push(fieldName);
            console.log(`Field ${field.id} is empty or invalid`);
        } else {
            field.style.borderColor = '#ced4da';
            field.style.backgroundColor = '';
            console.log(`Field ${field.id} is valid`);
        }
    });
    
    // Validate step-specific required fields
    stepSpecificFields.forEach(fieldConfig => {
        const field = document.getElementById(fieldConfig.id);
        if (field) {
            if (!field.value || !field.value.trim()) {
                field.style.borderColor = '#dc3545';
                field.style.backgroundColor = '#fff5f5';
                isValid = false;
                
                if (!missingFields.includes(fieldConfig.name)) {
                    missingFields.push(fieldConfig.name);
                }
                console.log(`Step-specific field ${fieldConfig.id} is empty or invalid`);
            } else {
                field.style.borderColor = '#ced4da';
                field.style.backgroundColor = '';
                console.log(`Step-specific field ${fieldConfig.id} is valid`);
            }
        }
    });
    
    // Additional email validation
    const emailField = document.getElementById('email');
    if (emailField && emailField.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailField.value)) {
            emailField.style.borderColor = '#dc3545';
            emailField.style.backgroundColor = '#fff5f5';
            isValid = false;
            if (!missingFields.includes('Valid Email Address')) {
                missingFields.push('Valid Email Address');
            }
        }
    }
    
    if (!isValid) {
        console.log(`Validation failed. Missing fields: ${missingFields.join(', ')}`);
        
        // Create user-friendly error message
        let errorMessage = '';
        if (missingFields.length === 1) {
            errorMessage = `Please fill in the ${missingFields[0]} field.`;
        } else if (missingFields.length === 2) {
            errorMessage = `Please fill in the ${missingFields[0]} and ${missingFields[1]} fields.`;
        } else {
            const lastField = missingFields.pop();
            errorMessage = `Please fill in the following fields: ${missingFields.join(', ')}, and ${lastField}.`;
        }
        
        // Show user-friendly error message
        if (typeof frappe !== 'undefined' && frappe.msgprint) {
            frappe.msgprint({
                title: 'Required Fields Missing',
                message: `<div style="font-size: 14px; line-height: 1.5;">
                    <p style="margin-bottom: 12px;">🚨 <strong>Oops! Some information is missing.</strong></p>
                    <p style="margin-bottom: 8px;">${errorMessage}</p>
                    <p style="color: #666; font-size: 12px; margin-top: 12px;">
                        💡 <strong>Tip:</strong> Look for fields highlighted in red and fill them out to continue.
                    </p>
                </div>`,
                indicator: 'red'
            });
        } else {
            alert(`Required Information Missing!\n\n${errorMessage}\n\nPlease fill out the highlighted fields to continue.`);
        }
    } else {
        console.log('All validation checks passed');
    }
    
    return isValid;
}

function getStepData(step) {
    console.log(`=== getStepData called for step ${step} ===`);
    const form = document.getElementById(`step${step}`);
    
    if (!form) {
        console.error(`Form step${step} not found!`);
        return {};
    }

    const formData = new FormData(form);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    // Collect file upload data
    const fileInputs = form.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => {
        if (input.getAttribute('data-file-url')) {
            data[input.name + '_url'] = input.getAttribute('data-file-url');
        }
    });
    
    console.log('Basic form data collected:', data);
    
    // Basic data sanitization for all steps (ensure no complex objects are sent)
    if (step <= 2) {
        // Steps 1 and 2 - Basic sanitization
        Object.keys(data).forEach(key => {
            if (data[key] === null || data[key] === undefined) {
                data[key] = '';
            } else if (typeof data[key] === 'object') {
                console.log(`Removing complex object for key: ${key}`, data[key]);
                delete data[key];
            } else {
                data[key] = String(data[key]);
            }
        });
    }
    
    // Special handling for Step 3 - Feedstock Description & File Uploads
    if (step === 3) {
        console.log('Processing Step 3 feedstock and file upload fields...');
        
        // FIRST: Extract file URLs before sanitization removes file objects
        const step3FileFields = ['feedstock_payment_file'];
        step3FileFields.forEach(fieldName => {
            // Check for file URL from uploaded files
            const fileInput = form.querySelector(`input[name="${fieldName}"]`);
            if (fileInput && fileInput.getAttribute('data-file-url')) {
                data[fieldName] = fileInput.getAttribute('data-file-url');
                console.log(`Found file URL for ${fieldName}: ${data[fieldName]}`);
            } else {
                // Remove file objects if no URL found
                if (data[fieldName] && typeof data[fieldName] === 'object') {
                    console.log(`Removing file object for ${fieldName} (no URL found)`);
                    delete data[fieldName];
                }
            }
        });
        
        // SECOND: Sanitize all other data values
        Object.keys(data).forEach(key => {
            if (!step3FileFields.includes(key)) { // Skip file fields that we already processed
                if (data[key] === null || data[key] === undefined) {
                    data[key] = '';
                } else {
                    data[key] = String(data[key]);
                }
            }
        });
        
        console.log('Step 3 processed data:', data);
    }
    
    // Special handling for Step 3 - Feedstock Description & Origin (including file uploads)
    if (step === 3) {
        console.log('Processing Step 3 feedstock and file upload fields...');
        
        // Handle source_type field (it's a select, not checkboxes)
        if (data['source_type'] && data['source_type'] !== '') {
            console.log('Source type found:', data['source_type']);
        } else {
            console.log('No source_type selected');
            data['source_type'] = '';
        }
        
        // Handle generation_locations field (it's a textarea, not dynamic fields)
        if (data['generation_locations'] && data['generation_locations'].trim() !== '') {
            console.log('Generation locations found:', data['generation_locations']);
        } else {
            console.log('No generation locations entered');
            data['generation_locations'] = '';
        }
        
        // FIRST: Extract file URLs before sanitization removes file objects
        const step3FileFields = ['feedstock_payment_file', 'chain_of_custody_file', 'supplier_agreements_file', 'origin_certificates_file', 'transportation_records_file'];
        step3FileFields.forEach(fieldName => {
            // Check for file URL from uploaded files
            const fileInput = form.querySelector(`input[name="${fieldName}"]`);
            if (fileInput && fileInput.getAttribute('data-file-url')) {
                data[fieldName] = fileInput.getAttribute('data-file-url');
                console.log(`Found file URL for ${fieldName}: ${data[fieldName]}`);
            } else {
                // Remove file objects if no URL found
                if (data[fieldName] && typeof data[fieldName] === 'object') {
                    console.log(`Removing file object for ${fieldName} (no URL found)`);
                    delete data[fieldName];
                }
            }
        });
        
        // SECOND: Sanitize all other data values
        Object.keys(data).forEach(key => {
            if (!step3FileFields.includes(key)) { // Skip file fields that we already processed
                if (data[key] === null || data[key] === undefined) {
                    data[key] = '';
                } else {
                    data[key] = String(data[key]);
                }
            }
        });
        
        console.log('Step 3 processed data:', data);
    }
    
    // Special handling for Step 4 - Franchise Partner Details
    if (step === 4) {
        console.log('Processing Step 4 franchise partner details fields...');
        
        // Sanitize all Step 4 data values
        Object.keys(data).forEach(key => {
            if (data[key] === null || data[key] === undefined) {
                data[key] = '';
            } else if (typeof data[key] === 'object') {
                console.log(`Removing complex object for key: ${key}`, data[key]);
                delete data[key];
            } else {
                data[key] = String(data[key]);
            }
        });
        
        console.log('Step 4 processed data:', data);
    }
    
    return data;
}

function sendVerificationEmail(step) {
    const stepData = getStepData(step);
    
    // Store data locally
    Object.assign(applicationData, stepData);
    
    console.log('Sending verification email for:', stepData);
    
    // First check if this is a reapplication scenario
    console.log('Checking reapplication eligibility for email:', stepData.email);
    
    frappe.call({
        method: 'franchise_portal.www.signup.api.check_reapplication_eligibility',
        args: { email: stepData.email },
        callback: function(eligibilityResponse) {
            console.log('Reapplication eligibility response:', eligibilityResponse);
            
            if (eligibilityResponse.message && 
                eligibilityResponse.message.success && 
                eligibilityResponse.message.can_reapply) {
                
                // This is a reapplication - use the special API
                console.log('🔄 Reapplication detected - using start_new_application_after_rejection API');
                
                frappe.call({
                    method: 'franchise_portal.www.signup.api.start_new_application_after_rejection',
                    args: { 
                        email: stepData.email,
                        data: stepData 
                    },
                    callback: function(response) {
                        console.log('Reapplication verification email response:', response);
                        console.log('Direct response success:', response.message?.success);
                        console.log('Direct response message:', response.message);
                        
                        // Fix: Backend returns success/token nested in response.message
                        if (response.message && response.message.success === true) {
                            window.verificationToken = verificationToken = response.message.verification_token;
                            console.log('About to call showReapplicationVerificationMessage for:', stepData.email);
                            console.log('Verification token set to:', verificationToken);
                            
                            // Show verification message with reapplication context
                            showReapplicationVerificationMessage(stepData.email);
                            console.log('showReapplicationVerificationMessage called successfully');
                            
                        } else {
                            const errorMessage = response.message?.message || 'Failed to send reapplication verification email. Please try again.';
                            console.error('Reapplication Verification Error:', response);
                            frappe.msgprint({
                                title: 'Reapplication Error',
                                message: errorMessage,
                                indicator: 'red'
                            });
                        }
                    },
                    error: function(error) {
                        console.error('Network Error sending reapplication verification:', error);
                        frappe.msgprint({
                            title: 'Network Error',
                            message: 'Failed to send reapplication verification email. Please check your connection and try again.',
                            indicator: 'red'
                        });
                    }
                });
                
            } else if (eligibilityResponse.message && 
                       eligibilityResponse.message.success && 
                       !eligibilityResponse.message.can_reapply) {
                
                // User cannot reapply - show appropriate message
                console.log('❌ User cannot reapply, showing restriction message');
                
                const isApprovedPartner = eligibilityResponse.message.is_approved_partner;
                const message = eligibilityResponse.message.message;
                
                if (isApprovedPartner) {
                    // Show special message for approved franchise partners
                    showApprovedPartnerMessage(stepData.email, message);
                } else {
                    // Show generic message for other active applications
                    showActiveApplicationMessage(stepData.email, message);
                }
                
            } else {
                // Regular new application - use the normal API
                console.log('✨ New application - using regular send_verification_email API');
                
                frappe.call({
                    method: 'franchise_portal.www.signup.api.send_verification_email',
                    args: { 
                        email: stepData.email,
                        data: stepData 
                    },
                    callback: function(response) {
                        console.log('Verification email response:', response);
                        console.log('Response success check:', response.message?.success);
                        console.log('Response message:', response.message);
                        
                        if (response.message && response.message.success) {
                            window.verificationToken = verificationToken = response.message.verification_token;
                            
                            // Show verification message
                            showVerificationMessage(stepData.email);
                            
                        } else {
                            const errorMessage = response.message?.message || 'Failed to send verification email. Please try again.';
                            console.error('Verification Error:', response);
                            console.error('Full verification error response:', JSON.stringify(response, null, 2));
                            frappe.msgprint({
                                title: 'Error',
                                message: errorMessage,
                                indicator: 'red'
                            });
                        }
                    },
                    error: function(error) {
                        console.error('Network Error sending verification:', error);
                        frappe.msgprint({
                            title: 'Network Error',
                            message: 'Failed to send verification email. Please check your connection and try again.',
                            indicator: 'red'
                        });
                    }
                });
            }
        },
        error: function(error) {
            console.error('Error checking reapplication eligibility:', error);
            
            // Fallback to regular verification if eligibility check fails
            console.log('Eligibility check failed, falling back to regular verification');
            
            frappe.call({
                method: 'franchise_portal.www.signup.api.send_verification_email',
                args: { 
                    email: stepData.email,
                    data: stepData 
                },
                callback: function(response) {
                    console.log('Fallback verification email response:', response);
                    
                    if (response.message && response.message.success) {
                        window.verificationToken = verificationToken = response.message.verification_token;
                        showVerificationMessage(stepData.email);
                    } else {
                        const errorMessage = response.message?.message || 'Failed to send verification email. Please try again.';
                        frappe.msgprint({
                            title: 'Error',
                            message: errorMessage,
                            indicator: 'red'
                        });
                    }
                },
                error: function(error) {
                    console.error('Fallback verification failed:', error);
                    frappe.msgprint({
                        title: 'Network Error',
                        message: 'Failed to send verification email. Please check your connection and try again.',
                        indicator: 'red'
                    });
                }
            });
        }
    });
}

function showVerificationMessage(email) {
    // Hide all forms
    document.querySelectorAll('.form-step').forEach(form => form.style.display = 'none');
    
    // Show verification message
    const formContainer = document.querySelector('.form-container');
    formContainer.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="color: #667eea; margin-bottom: 20px;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V19A2 2 0 0 0 5 21H19A2 2 0 0 0 21 19V9M19 19H5V3H13V9H19Z"/>
                </svg>
            </div>
            <h2 style="color: #495057; margin-bottom: 20px;">Check Your Email</h2>
            <p style="color: #6c757d; margin-bottom: 30px; line-height: 1.6;">
                We've sent a verification email to <strong>${email}</strong>.<br>
                Please click the verification link in the email to continue your application.
            </p>
            <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left;">
                <h4 style="margin-top: 0; color: #0066cc;">What to do next:</h4>
                <ol style="color: #495057; margin-bottom: 0;">
                    <li>Check your email inbox (and spam folder)</li>
                    <li>Click the "Verify Email & Continue Application" button</li>
                    <li>You'll be brought back to continue your application</li>
                </ol>
            </div>
            <p style="color: #dc3545; font-size: 14px;">
                <strong>Note:</strong> The verification link will expire in 24 hours.
            </p>
            <button onclick="location.reload()" class="btn btn-secondary" style="margin-top: 20px;">
                Refresh Page
            </button>
        </div>
    `;
}

function showReapplicationVerificationMessage(email) {
    // Hide all forms
    document.querySelectorAll('.form-step').forEach(form => form.style.display = 'none');
    
    // Show reapplication verification message with special context
    const formContainer = document.querySelector('.form-container');
    formContainer.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="color: #28a745; margin-bottom: 20px;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V19A2 2 0 0 0 5 21H19A2 2 0 0 0 21 19V9M19 19H5V3H13V9H19Z"/>
                </svg>
            </div>
            <h2 style="color: #495057; margin-bottom: 10px;">🔄 New Application - Check Your Email</h2>
            <p style="color: #28a745; margin-bottom: 20px; font-weight: 500;">
                Starting fresh after your previous application
            </p>
            <p style="color: #6c757d; margin-bottom: 30px; line-height: 1.6;">
                We've sent a verification email to <strong>${email}</strong> for your new franchise application.<br>
                Please click the verification link in the email to start your fresh application.
            </p>
            <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left; border-left: 4px solid #28a745;">
                <h4 style="margin-top: 0; color: #155724;">✨ Fresh Start</h4>
                <p style="color: #155724; margin-bottom: 10px;">
                    This is a completely new application. You can:
                </p>
                <ul style="color: #155724; margin-bottom: 0; text-align: left;">
                    <li>Provide updated information</li>
                    <li>Address any previous concerns</li>
                    <li>Submit with confidence</li>
                </ul>
            </div>
            <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left;">
                <h4 style="margin-top: 0; color: #0066cc;">What to do next:</h4>
                <ol style="color: #495057; margin-bottom: 0;">
                    <li>Check your email inbox (and spam folder)</li>
                    <li>Click the "Verify Email & Start New Application" button</li>
                    <li>You'll be brought back to start your fresh application</li>
                </ol>
            </div>
            <p style="color: #dc3545; font-size: 14px;">
                <strong>Note:</strong> The verification link will expire in 24 hours.
            </p>
            <button onclick="location.reload()" class="btn btn-secondary" style="margin-top: 20px;">
                Refresh Page
            </button>
        </div>
    `;
}

function showApprovedPartnerMessage(email, message) {
    // Hide all forms
    document.querySelectorAll('.form-step').forEach(form => form.style.display = 'none');
    
    // Show approved partner message
    const formContainer = document.querySelector('.form-container');
    formContainer.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="color: #28a745; margin-bottom: 20px;">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2M9 11H7v2h2v-2m4 0h-2v2h2v-2m4 0h-2v2h2v-2z"/>
                </svg>
            </div>
            <h2 style="color: #155724; margin-bottom: 10px;">🎉 Welcome Back, Franchise Partner!</h2>
            <p style="color: #155724; margin-bottom: 20px; font-weight: 500; font-size: 18px;">
                You're already part of our franchise family!
            </p>
            <div style="background: #d4edda; padding: 25px; border-radius: 10px; margin: 25px 0; text-align: left; border-left: 5px solid #28a745;">
                <p style="color: #155724; margin-bottom: 0; line-height: 1.6; font-size: 16px;">
                    ${message}
                </p>
            </div>
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left; border-left: 4px solid #ffc107;">
                <h4 style="margin-top: 0; color: #856404;">📞 Need Support?</h4>
                <p style="color: #856404; margin-bottom: 10px;">
                    If you need assistance with your existing franchise:
                </p>
                <ul style="color: #856404; margin-bottom: 0; text-align: left;">
                    <li>Contact our franchise support team</li>
                    <li>Access your franchise partner portal</li>
                    <li>Request operational guidance</li>
                </ul>
            </div>
            <div style="margin-top: 30px;">
                <button onclick="location.href='/'" class="btn btn-success" style="margin-right: 10px; padding: 12px 25px; font-size: 16px;">
                    Go to Homepage
                </button>
                <button onclick="location.reload()" class="btn btn-secondary" style="padding: 12px 25px;">
                    Refresh Page
                </button>
            </div>
        </div>
    `;
}

function showActiveApplicationMessage(email, message) {
    // Hide all forms
    document.querySelectorAll('.form-step').forEach(form => form.style.display = 'none');
    
    // Show active application message
    const formContainer = document.querySelector('.form-container');
    formContainer.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="color: #ffc107; margin-bottom: 20px;">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2M12 15.4l3.76 2L15 14.47l3-2.93-4.21-.62L12 7.6"/>
                </svg>
            </div>
            <h2 style="color: #856404; margin-bottom: 10px;">⏳ Application Already In Progress</h2>
            <p style="color: #856404; margin-bottom: 30px; line-height: 1.6;">
                You already have an active franchise application in our system.
            </p>
            <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left; border-left: 4px solid #ffc107;">
                <p style="color: #856404; margin-bottom: 0; line-height: 1.6;">
                    ${message}
                </p>
            </div>
            <div style="background: #e7f3ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left;">
                <h4 style="margin-top: 0; color: #0066cc;">What you can do:</h4>
                <ul style="color: #495057; margin-bottom: 0;">
                    <li>Wait for your current application to be processed</li>
                    <li>Contact support if you need to update information</li>
                    <li>Only submit a new application if your current one is rejected</li>
                </ul>
            </div>
            <div style="margin-top: 30px;">
                <button onclick="location.href='/'" class="btn btn-primary" style="margin-right: 10px; padding: 10px 20px;">
                    Go to Homepage
                </button>
                <button onclick="location.reload()" class="btn btn-secondary" style="padding: 10px 20px;">
                    Refresh Page
                </button>
            </div>
        </div>
    `;
}

function saveStepData(step, callback) {
    console.log('=== UPDATED saveStepData FUNCTION CALLED ===');
    // Ensure applicationData is properly initialized
    if (!window.applicationData) {
        window.applicationData = {};
    }
    
    // Synchronize local and global applicationData
    applicationData = window.applicationData;
    
    // If we're in resume mode, ensure current_step is correct
    if (isResumeMode && window.applicationData.current_step) {
        console.log('Resume mode detected, ensuring current_step is correct:', window.applicationData.current_step);
        setCurrentStep(window.applicationData.current_step);
    }
    
    // Log the full applicationData at the start
    const stepData = getStepData(step);
    console.log('DEBUG: stepData:', JSON.stringify(stepData, null, 2));

    // First, update with step data
    Object.assign(window.applicationData, stepData);
    Object.assign(applicationData, stepData); // Also update local variable
    
    // Handle email if missing
    if (!window.applicationData.email) {
        const emailField = document.getElementById('email');
        if (emailField && emailField.value) {
            window.applicationData.email = emailField.value;
            applicationData.email = emailField.value;
        }
    }
    
    // IMPORTANT: Set current_step to the NEXT step AFTER all other updates
    // This ensures it doesn't get overwritten by old data from the database
    const nextStepNumber = step + 1;
    console.log('Setting current_step from', step, 'to', nextStepNumber);
    console.log('Previous current_step value was:', window.applicationData.current_step);
    
    // Force update current_step to the next step
    window.applicationData.current_step = nextStepNumber;
    applicationData.current_step = nextStepNumber;
    
    // Also update the local currentStep variable
    setCurrentStep(nextStepNumber);
    
    console.log('DEBUG: applicationData after current_step update:', JSON.stringify(window.applicationData, null, 2));
    console.log('Verification - current_step in window.applicationData:', window.applicationData.current_step);
    console.log('Verification - current_step in applicationData:', applicationData.current_step);

    
    const allData = { ...window.applicationData };
    
    // Final verification: ensure current_step is correct in the data being sent
    allData.current_step = nextStepNumber;
    console.log('Final verification - current_step in allData:', allData.current_step);

    // Log the full data being sent
    console.log('Saving step data with current_step:', nextStepNumber, 'Data:', JSON.stringify(allData, null, 2));

    if (emailVerified && verificationToken && verificationToken !== 'test-token') {
        frappe.call({
            method: 'franchise_portal.www.signup.api.save_step_with_verification',
            args: { 
                token: verificationToken,
                data: allData,
                step: step
            },
            callback: function(response) {
                console.log('Save step with verification response:', response);
                if (response.message && response.message.success) {
                    console.log('Step data saved successfully with verification');
                    if (response.message.application_id) {
                        window.applicationId = applicationId = response.message.application_id;
                        console.log('Application ID updated:', applicationId);
                    }
                    if (callback) {
                        console.log('Executing callback function');
                        callback();
                    }
                } else {
                    const errorMessage = response.message?.message || 'Failed to save step data. Please try again.';
                    console.error('Save step error:', errorMessage);
                    frappe.msgprint({
                        title: 'Error',
                        message: errorMessage,
                        indicator: 'red'
                    });
                }
            },
            error: function(xhr, textStatus, errorThrown) {
                frappe.msgprint({
                    title: 'Network Error',
                    message: 'Failed to save step data. Please check your connection and try again.',
                    indicator: 'red'
                });
            }
        });
    } else {
        frappe.call({
            method: 'franchise_portal.www.signup.api.save_step',
            args: { data: allData },
            callback: function(response) {
                console.log('Save step (no verification) response:', response);
                if (response.message && response.message.success) {
                    console.log('Step data saved successfully (no verification)');
                    if (response.message.application_id) {
                        window.applicationId = applicationId = response.message.application_id;
                        console.log('Application ID updated:', applicationId);
                    }
                    if (callback) {
                        console.log('Executing callback function');
                        callback();
                    }
                } else {
                    const errorMessage = response.message?.message || 'Failed to save step data. Please try again.';
                    console.error('Save step error (no verification):', errorMessage);
                    frappe.msgprint({
                        title: 'Error',
                        message: errorMessage,
                        indicator: 'red'
                    });
                }
            },
            error: function(error) {
                frappe.msgprint({
                    title: 'Network Error',
                    message: 'Failed to save step data. Please check your connection and try again.',
                    indicator: 'red'
                });
            }
        });
    }
}

// Throttle auto-save to reduce performance impact
window.autoSaveTimeout = window.autoSaveTimeout || null;
let autoSaveTimeout = window.autoSaveTimeout;
function autoSaveStep() {
    // Auto-save disabled to prevent race conditions with manual saves
    // Clear existing timeout to avoid too frequent saves
    if (window.autoSaveTimeout) {
        clearTimeout(window.autoSaveTimeout);
    }
    
    // Throttle auto-save to once every 3 seconds
    window.autoSaveTimeout = setTimeout(() => {
        if (currentStep <= 4) {
            const stepData = getStepData(currentStep);
            Object.assign(applicationData, stepData);
            frappe.call({
                method: 'franchise_portal.www.signup.api.save_step',
                args: { data: stepData },
                no_spinner: true
            });
        }
    }, 3000);
}

function submitApplication() {
    if (!validateStep(4)) {
        return;
    }
    showLoading(true);
    // Collect data from ALL steps (1-4) before submitting
    const step1Data = getStepData(1);
    const step2Data = getStepData(2);
    const step3Data = getStepData(3);
    const step4Data = getStepData(4);
    // Merge all step data into one object
    const finalData = {
        ...step1Data,
        ...step2Data,
        ...step3Data,
        ...step4Data
    };
    // Always include email from step 1
    if (!finalData.email) {
        const step1Email = document.getElementById('email') && document.getElementById('email').value;
        if (step1Email) finalData.email = step1Email;
    }
    Object.assign(applicationData, finalData);
    // ... existing code for API call ...
    if (emailVerified && verificationToken && verificationToken !== 'test-token') {
        frappe.call({
            method: 'franchise_portal.www.signup.api.save_step_with_verification',
            args: { 
                token: verificationToken,
                data: finalData,
                step: 4  // Final step is now 4
            },
            callback: function(response) {
                showLoading(false);
                if (response.message && response.message.success) {
                    showSuccessMessage(response.message.application_id);
                } else {
                    // Enhanced error handling for API response errors
                    const errorMessage = response.message?.message || 'Failed to submit application. Please try again.';
                    
                    if (isVersionConflictError(errorMessage)) {
                        handleVersionConflictError();
                    } else {
                        frappe.msgprint({
                            title: 'Submission Error',
                            message: errorMessage,
                            indicator: 'red'
                        });
                    }
                }
            },
            error: function(error) {
                showLoading(false);
                console.error('Submit error:', error);
                
                // Enhanced error parsing for different error formats
                const errorMessage = extractErrorMessage(error);
                
                if (isVersionConflictError(errorMessage)) {
                    handleVersionConflictError();
                } else {
                    frappe.msgprint({
                        title: 'Submission Error',
                        message: 'Failed to submit application. Please try again.',
                        indicator: 'red'
                    });
                }
            }
        });
    } else {
        frappe.call({
            method: 'franchise_portal.www.signup.api.submit_application',
            args: { 
                email: applicationData.email,
                data: applicationData
            },
            callback: function(response) {
                showLoading(false);
                if (response.message && response.message.success) {
                    showSuccessMessage(response.message.application_id);
                } else {
                    // Enhanced error handling for API response errors
                    const errorMessage = response.message?.message || 'Failed to submit application. Please try again.';
                    
                    if (isVersionConflictError(errorMessage)) {
                        handleVersionConflictError();
                    } else {
                        frappe.msgprint({
                            title: 'Submission Error',
                            message: errorMessage,
                            indicator: 'red'
                        });
                    }
                }
            },
            error: function(error) {
                showLoading(false);
                console.error('Submit error:', error);
                
                // Enhanced error parsing for different error formats
                const errorMessage = extractErrorMessage(error);
                
                if (isVersionConflictError(errorMessage)) {
                    handleVersionConflictError();
                } else {
                    frappe.msgprint({
                        title: 'Submission Error',
                        message: 'Failed to submit application. Please try again.',
                        indicator: 'red'
                    });
                }
            }
        });
    }
}

// Helper function to extract error message from different error formats
function extractErrorMessage(error) {
    // Try different ways to extract the error message
    if (error.responseJSON?.message) {
        return error.responseJSON.message;
    }
    if (error.responseJSON?.exc) {
        return error.responseJSON.exc;
    }
    if (error.responseText) {
        try {
            const parsed = JSON.parse(error.responseText);
            return parsed.message || parsed.exc || error.responseText;
        } catch (e) {
            return error.responseText;
        }
    }
    if (error.message) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error occurred';
}

// Helper function to detect version conflict errors
function isVersionConflictError(errorMessage) {
    const versionConflictIndicators = [
        'Document has been modified after you have opened it',
        'TimestampMismatchError',
        'version conflict',
        'document was modified',
        'modified after you have opened',
        'Please refresh to get the latest document'
    ];
    
    return versionConflictIndicators.some(indicator => 
        errorMessage.toLowerCase().includes(indicator.toLowerCase())
    );
}

// Enhanced version conflict error handler
function handleVersionConflictError() {
    console.log('Version conflict detected, initiating recovery...');
    
    frappe.msgprint({
        title: 'Form Updated',
        message: `
            <div style="text-align: center; padding: 10px;">
                <h4 style="color: #f39c12; margin-bottom: 15px;">📝 Application Updated</h4>
                <p style="margin-bottom: 15px;">This form has been updated while you were filling it out. This can happen when:</p>
                <ul style="text-align: left; margin: 10px 0; padding-left: 20px;">
                    <li>You have multiple tabs open</li>
                    <li>Auto-save updated the form</li>
                    <li>Another process modified the application</li>
                </ul>
                <p style="margin-top: 15px; font-weight: bold; color: #667eea;">
                    The page will refresh automatically to load the latest version.
                </p>
                <div style="background: #e8f4f8; padding: 10px; border-radius: 5px; margin-top: 10px;">
                    <small>✅ Your current form data has been preserved and will be restored.</small>
                </div>
            </div>
        `,
        indicator: 'orange'
    });
    
    // Clear any existing recovery data and flags
    sessionStorage.removeItem('franchise_form_recovery_data');
    sessionStorage.removeItem('franchise_form_recovery_timestamp');
    sessionStorage.removeItem('recovery_completed');
    
    // Store current form data before refresh to minimize data loss
    const currentFormData = {};
    try {
        // Collect current step data
        const currentStepData = getStepData(4); // Get step 4 data since we're submitting
        Object.assign(currentFormData, currentStepData);
        
        // Store in sessionStorage for recovery after refresh
        sessionStorage.setItem('franchise_form_recovery_data', JSON.stringify(currentFormData));
        sessionStorage.setItem('franchise_form_recovery_timestamp', new Date().toISOString());
        
        console.log('Stored form data for recovery:', currentFormData);
    } catch (e) {
        console.warn('Could not store form data for recovery:', e);
    }
    
    // Auto-refresh after a short delay
    setTimeout(() => {
        console.log('Auto-refreshing page due to version conflict...');
        window.location.reload();
    }, 3000);
}

// Form recovery function to restore data after refresh
function recoverFormDataAfterRefresh() {
    try {
        const recoveryData = sessionStorage.getItem('franchise_form_recovery_data');
        const recoveryTimestamp = sessionStorage.getItem('franchise_form_recovery_timestamp');
        
        if (recoveryData && recoveryTimestamp) {
            const timestamp = new Date(recoveryTimestamp);
            const now = new Date();
            const minutesAgo = (now - timestamp) / (1000 * 60);
            
            // Only recover data if it's less than 10 minutes old
            if (minutesAgo < 10) {
                const formData = JSON.parse(recoveryData);
                console.log('Recovering form data from before refresh:', formData);
                
                // Merge recovered data into applicationData
                Object.assign(window.applicationData, formData);
                
                // Populate form fields with recovered data
                populateFormData(formData);
                
                // Show recovery success message
                frappe.show_alert({
                    message: '✅ Form data recovered successfully from before the refresh!',
                    indicator: 'green'
                }, 5);
                
                // Clear recovery data immediately after use
                sessionStorage.removeItem('franchise_form_recovery_data');
                sessionStorage.removeItem('franchise_form_recovery_timestamp');
                
                // Set a flag to prevent re-recovery
                sessionStorage.setItem('recovery_completed', 'true');
                
                console.log('Recovery completed and data cleared');
            } else {
                // Clear old recovery data
                sessionStorage.removeItem('franchise_form_recovery_data');
                sessionStorage.removeItem('franchise_form_recovery_timestamp');
                sessionStorage.removeItem('recovery_completed');
                console.log('Old recovery data cleared (expired)');
            }
        } else {
            // No recovery data found, clear any stale flags
            sessionStorage.removeItem('recovery_completed');
        }
    } catch (e) {
        console.warn('Could not recover form data:', e);
        // Clear any corrupted recovery data
        sessionStorage.removeItem('franchise_form_recovery_data');
        sessionStorage.removeItem('franchise_form_recovery_timestamp');
        sessionStorage.removeItem('recovery_completed');
    }
}

// Make available globally immediately
window.submitApplication = submitApplication;

function showLoading(show) {
    const formContainer = document.querySelector('.form-container');
    const loadingDiv = document.getElementById('loading');
    const forms = document.querySelectorAll('.form-step');
    
    if (show) {
        forms.forEach(form => form.style.display = 'none');
        loadingDiv.style.display = 'block';
    } else {
        loadingDiv.style.display = 'none';
        showStep(currentStep);
    }
}

function showSuccessMessage(appId) {
    const formContainer = document.querySelector('.form-container');
    const successDiv = document.getElementById('success');
    const applicationIdSpan = document.getElementById('application-id');
    const forms = document.querySelectorAll('.form-step');
    const loadingDiv = document.getElementById('loading');
    
    // Hide all forms and loading
    forms.forEach(form => form.style.display = 'none');
    loadingDiv.style.display = 'none';
    
    // Show success message
    if (applicationIdSpan) {
        applicationIdSpan.textContent = appId;
    }
    successDiv.style.display = 'block';
    
    // Update progress to show completion
    document.querySelectorAll('.progress-step').forEach(step => {
        step.className = 'progress-step completed';
    });
    
    // Send confirmation email to the user
    sendConfirmationEmail(appId);
}

// New function to send confirmation email after successful submission
function sendConfirmationEmail(applicationId) {
    console.log('Sending confirmation email for application:', applicationId);
    
    // Get user email from applicationData or from the form
    const userEmail = applicationData.email || document.getElementById('email')?.value;
    
    if (!userEmail) {
        console.warn('No email address found to send confirmation');
        return;
    }
    
    // Call the backend API to send confirmation email
    frappe.call({
        method: 'franchise_portal.www.signup.api.send_confirmation_email',
        args: {
            email: userEmail,
            application_id: applicationId,
            applicant_name: applicationData.contact_person || applicationData.company_name || 'Applicant'
        },
        callback: function(response) {
            console.log('Confirmation email response:', response);
            if (response.message && response.message.success) {
                console.log('✅ Confirmation email sent successfully');
                
                // Show additional success message about email
                const successDiv = document.getElementById('success');
                if (successDiv) {
                    const emailNotification = document.createElement('div');
                    emailNotification.innerHTML = `
                        <div style="background: #e8f4f8; border: 1px solid #bee5eb; border-radius: 6px; padding: 15px; margin-top: 20px; text-align: center;">
                            <div style="color: #0c5460; font-weight: 500; margin-bottom: 8px;">
                                📧 Confirmation Email Sent!
                            </div>
                            <div style="color: #0c5460; font-size: 14px;">
                                We've sent a confirmation email to <strong>${userEmail}</strong><br>
                                Please check your inbox (and spam folder) for details about your application.
                            </div>
                        </div>
                    `;
                    successDiv.appendChild(emailNotification);
                }
            } else {
                console.warn('Failed to send confirmation email:', response.message?.message);
                
                // Show warning about email failure (but don't disrupt the success flow)
                const successDiv = document.getElementById('success');
                if (successDiv) {
                    const emailWarning = document.createElement('div');
                    emailWarning.innerHTML = `
                        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin-top: 20px; text-align: center;">
                            <div style="color: #856404; font-weight: 500; margin-bottom: 8px;">
                                ⚠️ Email Notification
                            </div>
                            <div style="color: #856404; font-size: 14px;">
                                Your application was submitted successfully, but we couldn't send the confirmation email.<br>
                                Please save your Application ID: <strong>${applicationId}</strong>
                            </div>
                        </div>
                    `;
                    successDiv.appendChild(emailWarning);
                }
            }
        },
        error: function(error) {
            console.error('Error sending confirmation email:', error);
            
            // Show warning about email failure (but don't disrupt the success flow)
            const successDiv = document.getElementById('success');
            if (successDiv) {
                const emailError = document.createElement('div');
                emailError.innerHTML = `
                    <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 15px; margin-top: 20px; text-align: center;">
                        <div style="color: #721c24; font-weight: 500; margin-bottom: 8px;">
                            📧 Email Service Unavailable
                        </div>
                        <div style="color: #721c24; font-size: 14px;">
                            Your application was submitted successfully, but email service is temporarily unavailable.<br>
                            Please save your Application ID: <strong>${applicationId}</strong>
                        </div>
                    </div>
                `;
                successDiv.appendChild(emailError);
            }
        }
    });
}

// Utility function to populate form if returning user
function populateFormData(data) {
    console.log('Populating form data:', data);

    // 1. Simple fields (text, email, select, etc.)
    Object.keys(data).forEach(key => {
        const field = document.getElementById(key);
        if (field && typeof data[key] !== 'object') {
            console.log(`Setting field ${key} to value: ${data[key]}`);
            if (field.type === 'checkbox') {
                field.checked = !!data[key];
            } else if (field.type === 'radio') {
                // For radio, set the one with matching value
                const radios = document.querySelectorAll(`input[name="${key}"]`);
                radios.forEach(radio => {
                    radio.checked = (radio.value === data[key]);
                });
            } else {
                field.value = data[key] || '';
            }
            // Trigger change events for selects, checkboxes, and fields with onchange
            if (field.type === 'select-one' || field.type === 'checkbox' || typeof field.onchange === 'function') {
                if (typeof field.onchange === 'function') field.onchange();
            }
        } else if (field) {
            console.log(`Field ${key} found but data is object or null:`, data[key]);
        } else {
            console.log(`Field ${key} not found in DOM`);
        }
    });

    // 2. Step 3: Source Type (select field, not checkboxes)
    if (data.source_type) {
        const sourceTypeField = document.getElementById('source_type');
        if (sourceTypeField) {
            sourceTypeField.value = data.source_type;
            // Trigger change event to show/hide "Other" field if needed
            if (typeof window.toggleSourceTypeOther === 'function') {
                window.toggleSourceTypeOther();
            }
        }
    }

    // 3. Step 3: Generation Locations (textarea field, not dynamic rows)
    if (data.generation_locations) {
        console.log('Processing generation_locations:', data.generation_locations);
        const generationLocationsField = document.getElementById('generation_locations');
        if (generationLocationsField) {
            // Handle both string and array formats
            if (Array.isArray(data.generation_locations)) {
                // If it's an array, convert to string format
                const locationsText = data.generation_locations.map(loc => 
                    loc.address || loc.gps_coordinates || ''
                ).filter(text => text.trim() !== '').join(', ');
                generationLocationsField.value = locationsText;
                console.log('Set generation_locations (array) to:', locationsText);
            } else {
                // If it's already a string, use it directly
                generationLocationsField.value = data.generation_locations;
                console.log('Set generation_locations (string) to:', data.generation_locations);
            }
        } else {
            console.log('generation_locations field not found in DOM');
        }
    } else {
        console.log('No generation_locations data found');
    }

    // 4. Step 3: Current Use/Disposal Method (specific debugging)
    if (data.current_use_disposal_method) {
        console.log('Processing current_use_disposal_method:', data.current_use_disposal_method);
        const currentUseField = document.getElementById('current_use_disposal_method');
        if (currentUseField) {
            currentUseField.value = data.current_use_disposal_method;
            console.log('Set current_use_disposal_method to:', data.current_use_disposal_method);
        } else {
            console.log('current_use_disposal_method field not found in DOM');
        }
    } else {
        console.log('No current_use_disposal_method data found');
    }

    // 5. Step 7: "Other" fields (fuel_type, drying_method, energy_source)
    ['fuel_type', 'drying_method', 'energy_source'].forEach(fieldKey => {
        if (data[fieldKey]) {
            const field = document.getElementById(fieldKey);
            if (field) {
                field.value = data[fieldKey];
                if (data[fieldKey] === 'Other' && typeof window.toggleOtherField === 'function') {
                    // Show the "Other" input
                    window.toggleOtherField(fieldKey, `${fieldKey}_other_group`);
                    // Set the value if available
                    const otherInput = document.getElementById(`${fieldKey}_other`);
                    if (otherInput && data[`${fieldKey}_other`]) {
                        otherInput.value = data[`${fieldKey}_other`];
                    }
                }
            }
        }
    });

    // 6. Any additional custom logic for other dynamic/multi fields can be added here

    // 7. File upload fields - restore uploaded files
    const fileFields = ['feedstock_payment_file', 'chain_of_custody_file', 'supplier_agreements_file', 'origin_certificates_file', 'transportation_records_file'];
    fileFields.forEach(fieldName => {
        const fileInput = document.getElementById(fieldName);
        if (fileInput && data[fieldName]) {
            // Set the file URL attribute
            fileInput.setAttribute('data-file-url', data[fieldName]);
            
            // Extract filename from URL for display
            const fileName = data[fieldName].split('/').pop().split('?')[0];
            
            // Update the file preview to show the uploaded file
            const uploadArea = fileInput.closest('.file-upload-area');
            if (uploadArea) {
                const placeholder = uploadArea.querySelector('.upload-placeholder');
                const preview = uploadArea.querySelector('.file-preview');
                
                if (placeholder && preview) {
                    placeholder.style.display = 'none';
                    preview.style.display = 'block';
                    
                    preview.innerHTML = `
                        <div class="file-item">
                            <div class="file-item-info">
                                <div class="file-item-icon">📄</div>
                                <div class="file-item-details">
                                    <div class="file-item-name" id="filename-${fieldName}" style="cursor: pointer; color: #667eea; text-decoration: underline;" title="Click to download file">${fileName}</div>
                                    <div class="file-item-size">File uploaded</div>
                                    <div class="file-item-status" style="color: #28a745;">✓ Uploaded successfully</div>
                                </div>
                            </div>
                            <div class="file-item-actions">
                                <button type="button" class="file-action-btn remove" onclick="removeFile('${fieldName}')">Remove</button>
                            </div>
                        </div>
                    `;
                    
                    // Add click handler for download
                    const fileNameElement = preview.querySelector(`#filename-${fieldName}`);
                    if (fileNameElement) {
                        fileNameElement.onclick = function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            downloadFileDirectly(data[fieldName], fileName);
                        };
                    }
                }
            }
        }
    });

    // 8. Trigger any UI updates or calculations needed after populating
    if (typeof updateProgressIndicator === 'function') updateProgressIndicator();
}

// Google Maps Variables
let map;
let selectedMarker;
let selectedCoordinates = null;
let searchBox;

// Project ID Generation
function generateProjectId() {
    const companyName = applicationData.company_name || document.getElementById('company_name')?.value || '';
    const projectName = document.getElementById('project_name')?.value || '';
    const currentYear = new Date().getFullYear();
    
    if (companyName && projectName) {
        // Clean company and project names (remove spaces, special chars)
        const cleanCompany = companyName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
        const cleanProject = projectName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 10);
        
        const projectId = `${cleanCompany}-${cleanProject}-${currentYear}`;
        document.getElementById('project_id').value = projectId;
    }
}

// Google Maps Functions
function initMap() {
    console.log('initMap called');
    
    try {
        // Check if Google Maps is loaded
        if (typeof google === 'undefined' || !google.maps) {
            console.error('Google Maps API not loaded');
            return;
        }
        
        console.log('Google Maps API loaded successfully');
        
        // Initialize map centered on India
        const mapElement = document.getElementById('map');
        if (!mapElement) {
            console.error('Map element not found');
            return;
        }
        
        map = new google.maps.Map(mapElement, {
            center: { lat: 20.5937, lng: 78.9629 }, // India center
            zoom: 5,
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true
        });
        
        console.log('Map initialized successfully');
        
        // Initialize Places search
        const searchInput = document.getElementById('mapSearchInput');
        if (searchInput && google.maps.places) {
            searchBox = new google.maps.places.SearchBox(searchInput);
            
            // Bias search results to current map viewport
            map.addListener('bounds_changed', () => {
                searchBox.setBounds(map.getBounds());
            });
            
            // Listen for place search results
            searchBox.addListener('places_changed', () => {
                const places = searchBox.getPlaces();
                if (places.length === 0) return;
                
                const place = places[0];
                if (!place.geometry || !place.geometry.location) return;
                
                // Center map on selected place
                map.setCenter(place.geometry.location);
                map.setZoom(15);
                
                // Add marker at selected place
                addMarkerAtLocation(place.geometry.location);
            });
            
            console.log('Places search initialized');
        } else {
            console.warn('Places API not available or search input not found');
        }
        
        // Add click listener to map
        map.addListener('click', (event) => {
            console.log('Map clicked at:', event.latLng.toString());
            addMarkerAtLocation(event.latLng);
        });
        
    } catch (error) {
        console.error('Error initializing map:', error);
    }
}

// Fallback initialization function
function initMapFallback() {
    console.log('Fallback map initialization');
    if (typeof google !== 'undefined' && google.maps) {
        initMap();
    } else {
        console.log('Google Maps not ready, retrying in 500ms...');
        setTimeout(initMapFallback, 500);
    }
}

function addMarkerAtLocation(location) {
    // Remove existing marker
    if (selectedMarker) {
        selectedMarker.setMap(null);
    }
    
    // Add new marker
    selectedMarker = new google.maps.Marker({
        position: location,
        map: map,
        title: 'Selected Location'
    });
    
    // Store coordinates
    selectedCoordinates = {
        lat: location.lat(),
        lng: location.lng()
    };
    
    // Update coordinates display
    const coordinatesText = `${selectedCoordinates.lat.toFixed(6)}, ${selectedCoordinates.lng.toFixed(6)}`;
    document.getElementById('coordinatesDisplay').textContent = `Selected: ${coordinatesText}`;
}

function openMapModal() {
    console.log('Opening map modal');
    
    const modal = document.getElementById('mapModal');
    const modalContent = document.querySelector('.map-modal-content');
    const mapElement = document.getElementById('map');
    
    modal.style.display = 'block';
    
    // Force modal to be within viewport and fix button visibility
    setTimeout(() => {
        if (modalContent) {
            // Ensure modal fits in viewport
            const viewportHeight = window.innerHeight;
            const modalMaxHeight = Math.min(600, viewportHeight - 100); // Leave 100px margin
            
            modalContent.style.maxHeight = modalMaxHeight + 'px';
            modalContent.style.top = '50px';
            modalContent.style.position = 'relative';
            modalContent.style.overflow = 'hidden';
            
            // Adjust content area height to make room for buttons
            const contentArea = document.querySelector('.map-content-area');
            if (contentArea) {
                contentArea.style.height = (modalMaxHeight - 120) + 'px'; // Reserve space for header + buttons
                contentArea.style.overflow = 'auto';
            }
            
            // Ensure buttons are visible
            const buttons = document.querySelector('.map-buttons');
            if (buttons) {
                buttons.style.position = 'absolute';
                buttons.style.bottom = '0';
                buttons.style.left = '0';
                buttons.style.right = '0';
                buttons.style.zIndex = '1000';
                buttons.style.backgroundColor = '#f8f9fa';
                buttons.style.borderTop = '2px solid #667eea';
                buttons.style.padding = '10px 15px';
            }
            
            const rect = modalContent.getBoundingClientRect();
            console.log('Modal dimensions after adjustment:', {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                bottom: rect.bottom,
                windowHeight: window.innerHeight,
                modalMaxHeight: modalMaxHeight
            });
            
            // Check button visibility
            if (buttons) {
                const buttonRect = buttons.getBoundingClientRect();
                console.log('Buttons position after adjustment:', {
                    top: buttonRect.top,
                    bottom: buttonRect.bottom,
                    visible: buttonRect.bottom <= window.innerHeight
                });
            }
        }
    }, 100);
    
    // Load Google Maps API - implement direct API loading if the HTML function isn't available
    if (mapElement) {
        mapElement.innerHTML = '<div style="padding: 20px; text-align: center;"><p>Loading Google Maps...</p></div>';
    }
    
    // More robust Google Maps loading
    const loadGoogleMaps = () => {
        return new Promise((resolve, reject) => {
            // Check if Google Maps is already loaded
            if (typeof google !== 'undefined' && google.maps) {
                console.log('Google Maps already available');
                resolve();
                return;
            }
            
            // Try to use the HTML function first
            if (typeof window.loadGoogleMapsAPI === 'function') {
                console.log('Using HTML loadGoogleMapsAPI function');
                window.loadGoogleMapsAPI()
                    .then(resolve)
                    .catch((error) => {
                        console.log('HTML loadGoogleMapsAPI failed, trying direct method:', error);
                        loadGoogleMapsDirectly().then(resolve).catch(reject);
                    });
            } else {
                console.log('HTML loadGoogleMapsAPI not available, using direct method');
                loadGoogleMapsDirectly().then(resolve).catch(reject);
            }
        });
    };
    
    // Direct Google Maps loading function
    const loadGoogleMapsDirectly = () => {
        return new Promise((resolve, reject) => {
            // First get the API key
            frappe.call({
                method: 'franchise_portal.www.signup.api.get_google_maps_api_key',
                callback: function(response) {
                    if (response.message && response.message.success) {
                        const apiKey = response.message.api_key;
                        console.log('API key retrieved for direct loading');
                        
                        // Check if script already exists
                        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
                        if (existingScript) {
                            console.log('Google Maps script already exists, waiting for load...');
                            // Wait for existing script to load
                            const checkGoogleMaps = setInterval(() => {
                                if (typeof google !== 'undefined' && google.maps) {
                                    clearInterval(checkGoogleMaps);
                                    resolve();
                                }
                            }, 100);
                            
                            setTimeout(() => {
                                clearInterval(checkGoogleMaps);
                                reject(new Error('Google Maps loading timeout'));
                            }, 10000);
                            return;
                        }
                        
                        // Create callback function
                        window.directMapCallback = function() {
                            console.log('Direct Google Maps callback triggered');
                            resolve();
                        };
                        
                        // Create and load script
                        const script = document.createElement('script');
                        script.async = true;
                        script.defer = true;
                        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=directMapCallback`;
                        script.onerror = () => reject(new Error('Failed to load Google Maps script'));
                        
                        document.head.appendChild(script);
                        
                    } else {
                        reject(new Error('Failed to get API key: ' + (response.message?.message || 'Unknown error')));
                    }
                },
                error: function(error) {
                    reject(new Error('Error fetching API key: ' + error.message));
                }
            });
        });
    };
    
    // Load Google Maps
    loadGoogleMaps()
        .then(() => {
            console.log('Google Maps loaded successfully, initializing map...');
            
            // Initialize map if not already done
            if (!map && typeof google !== 'undefined' && google.maps) {
                console.log('Initializing map on modal open');
                initMap();
            } else if (!map) {
                console.log('Google Maps not ready, using fallback');
                initMapFallback();
            }
            
            // Trigger map resize to ensure proper display
            setTimeout(() => {
                if (map && typeof google !== 'undefined') {
                    console.log('Triggering map resize');
                    google.maps.event.trigger(map, 'resize');
                    
                    // Re-center the map
                    map.setCenter({ lat: 20.5937, lng: 78.9629 });
                } else {
                    console.warn('Map not available for resize');
                }
            }, 300);
        })
        .catch((error) => {
            console.error('Failed to load Google Maps:', error);
            if (mapElement) {
                mapElement.innerHTML = '<div style="padding: 20px; text-align: center; color: #dc3545;">' +
                    '<h4>📍 Map Loading Issue</h4>' +
                    '<p>' + error.message + '</p>' +
                    '<div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0;">' +
                    '<strong>✅ Alternative: Manual Entry</strong><br>' +
                    'You can enter coordinates directly in the GPS field below:<br>' +
                    '<code style="background: white; padding: 2px 5px;">28.6139, 77.2090</code> (latitude, longitude)<br>' +
                    '<small>💡 Get coordinates from Google Maps by right-clicking any location</small>' +
                    '</div>' +
                    '</div>';
            }
        });
}

function closeMapModal() {
    document.getElementById('mapModal').style.display = 'none';
}

function confirmLocation() {
    if (selectedCoordinates) {
        const coordinatesText = `${selectedCoordinates.lat.toFixed(6)}, ${selectedCoordinates.lng.toFixed(6)}`;
        document.getElementById('gps_coordinates').value = coordinatesText;
        closeMapModal();
        
        // Show success message
        if (typeof frappe !== 'undefined' && frappe.show_alert) {
            frappe.show_alert({
                message: 'Location selected successfully!',
                indicator: 'green'
            });
        }
    } else {
        if (typeof frappe !== 'undefined' && frappe.msgprint) {
            frappe.msgprint({
                title: 'No Location Selected',
                message: 'Please click on the map to select a location first.',
                indicator: 'red'
            });
        } else {
            alert('Please click on the map to select a location first.');
        }
    }
}

function enableManualEntry() {
    const coordinatesField = document.getElementById('gps_coordinates');
    coordinatesField.removeAttribute('readonly');
    coordinatesField.focus();
    coordinatesField.placeholder = 'Enter coordinates manually (e.g., 28.6139, 77.2090)';
    
    // Show help message
    if (typeof frappe !== 'undefined' && frappe.show_alert) {
        frappe.show_alert({
            message: 'You can now enter coordinates manually. Format: latitude, longitude',
            indicator: 'blue'
        });
    }
}

// Step 3 Conditional Logic Functions
function togglePaymentDetails() {
    const paymentType = document.getElementById('feedstock_payment_type').value;
    const paymentDetailsGroup = document.getElementById('payment_details_group');
    const paymentFileSection = document.getElementById('payment_file_section');
    
    if (paymentType && paymentType !== 'No Feedstock Payment') {
        paymentDetailsGroup.style.display = 'block';
        paymentFileSection.style.display = 'block';
        document.getElementById('payment_details').setAttribute('required', 'required');
    } else {
        paymentDetailsGroup.style.display = 'none';
        paymentFileSection.style.display = 'none';
        document.getElementById('payment_details').removeAttribute('required');
        document.getElementById('payment_details').value = '';
        
        // Clear file upload when hiding
        const fileInput = document.getElementById('feedstock_payment_file');
        if (fileInput) {
            fileInput.value = '';
            clearFilePreview('feedstock_payment_file');
        }
    }
}

function toggleOtherContaminants() {
    const contaminants = document.getElementById('contaminants_present').value;
    const otherGroup = document.getElementById('other_contaminants_group');
    
    if (contaminants === 'Other') {
        otherGroup.style.display = 'block';
        document.getElementById('other_contaminants').setAttribute('required', 'required');
    } else {
        otherGroup.style.display = 'none';
        document.getElementById('other_contaminants').removeAttribute('required');
        document.getElementById('other_contaminants').value = '';
    }
}

function toggleSeasonalMonths() {
    const schedule = document.getElementById('plant_operation_schedule').value;
    const seasonalGroup = document.getElementById('seasonal_months_group');
    
    if (schedule === 'Seasonal') {
        seasonalGroup.style.display = 'block';
        document.getElementById('seasonal_months').setAttribute('required', 'required');
    } else {
        seasonalGroup.style.display = 'none';
        document.getElementById('seasonal_months').removeAttribute('required');
        document.getElementById('seasonal_months').value = '';
    }
}

function calculateCHRatio() {
    const carbon = parseFloat(document.getElementById('carbon_content').value);
    const hydrogen = parseFloat(document.getElementById('hydrogen_content').value);
    const ratioField = document.getElementById('ch_ratio');
    
    if (carbon && hydrogen && hydrogen > 0) {
        const ratio = (carbon / hydrogen).toFixed(2);
        ratioField.value = ratio;
    } else {
        ratioField.value = '';
    }
}

// Step 5: Toggle testing standards other field
function toggleTestingStandardsOther() {
    const testingStandards = document.getElementById('testing_standards_used').value;
    const otherGroup = document.getElementById('testing_standards_other_group');
    
    if (testingStandards === 'Other') {
        otherGroup.style.display = 'block';
        document.getElementById('testing_standards_other').setAttribute('required', 'required');
    } else {
        otherGroup.style.display = 'none';
        document.getElementById('testing_standards_other').removeAttribute('required');
        document.getElementById('testing_standards_other').value = '';
    }
}

// Utility for Step 7: Show/hide 'Other' text input for select fields
function toggleOtherField(selectId, groupId) {
    const select = document.getElementById(selectId);
    const group = document.getElementById(groupId);
    if (select && group) {
        if (select.value === 'Other') {
            group.style.display = '';
            group.querySelector('input').setAttribute('required', 'required');
        } else {
            group.style.display = 'none';
            group.querySelector('input').removeAttribute('required');
            group.querySelector('input').value = '';
        }
    }
}

// Export functions for global access
window.nextStep = nextStep;
window.previousStep = previousStep;
window.submitApplication = submitApplication;
window.testNextStep = testNextStep;
window.generateProjectId = generateProjectId;
window.initMap = initMap;
window.initMapFallback = initMapFallback;
window.openMapModal = openMapModal;
window.closeMapModal = closeMapModal;
window.confirmLocation = confirmLocation;
window.enableManualEntry = enableManualEntry;
window.togglePaymentDetails = togglePaymentDetails;
window.toggleOtherContaminants = toggleOtherContaminants;
window.toggleSeasonalMonths = toggleSeasonalMonths;
window.calculateCHRatio = calculateCHRatio;
window.toggleTestingStandardsOther = toggleTestingStandardsOther;
window.forceFixStep3Layout = forceFixStep3Layout;
window.toggleOtherField = toggleOtherField;

// Add debugging function
window.debugStep3 = function() {
    const step3 = document.getElementById('step3');
    console.log('=== Step 3 Debug Info ===');
    console.log('Step 3 element:', step3);
    console.log('Step 3 computed styles:', step3 ? window.getComputedStyle(step3) : 'Not found');
    console.log('Step 3 inline styles:', step3 ? step3.style.cssText : 'Not found');
    console.log('Step 3 classes:', step3 ? step3.classList : 'Not found');
    console.log('Form container:', document.querySelector('.form-container'));
    console.log('========================');
};

// Add a manual function to force fix Step 3 layout
function forceFixStep3Layout() {
    console.log('Manually forcing Step 3 layout fix...');
    const step3Element = document.getElementById('step3');
    if (step3Element) {
        // Apply the same fixes as in showStep function
        step3Element.style.cssText = `
            display: block !important;
            max-height: none !important;
            overflow-y: visible !important;
            overflow-x: visible !important;
            padding: 30px 50px 30px 50px !important;
            margin: 0 !important;
            margin-left: 0 !important;
            box-sizing: border-box !important;
            width: 100% !important;
            position: relative !important;
            left: 0 !important;
            transform: none !important;
            border: none !important;
            background-color: transparent !important;
        `;
        
        // Fix parent container
        const formContainer = document.querySelector('.form-container');
        if (formContainer) {
            formContainer.style.overflow = 'visible';
            formContainer.style.maxHeight = 'none';
            formContainer.style.paddingLeft = '50px';
        }
        
        // Fix all child elements
        const step3Elements = step3Element.querySelectorAll('*');
        step3Elements.forEach(element => {
            element.style.marginLeft = '0';
            element.style.paddingLeft = '0';
            element.style.position = 'relative';
            element.style.left = '0';
        });
        
        console.log('Step 3 layout manually fixed');
    }
}

// Step 4: Dynamic UI logic for Source Type 'Other' and Generation Locations
window.toggleSourceTypeOther = function() {
    const sourceTypeCheckboxes = document.querySelectorAll('input[name="source_type"]:checked');
    const otherGroup = document.getElementById('source_type_other_group');
    if (otherGroup) {
        const selectedValues = Array.from(sourceTypeCheckboxes).map(checkbox => checkbox.value);
        otherGroup.style.display = selectedValues.includes('Other') ? '' : 'none';
    }
}

window.addGenerationLocation = function() {
    const container = document.getElementById('generation_locations_container');
    if (!container) return;
    const idx = container.children.length + 1;
    const rowId = `generation_location_row_${idx}`;
    const modalId = `mapModal_location_${idx}`;
    const gpsInputId = `generation_location_gps_${idx}`;
    const addressInputId = `generation_location_address_${idx}`;
    // Create the row
    const div = document.createElement('div');
    div.className = 'generation-location-row';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.gap = '8px';
    div.style.marginBottom = '10px';
    div.id = rowId;
    div.innerHTML = `
        <input type="text" name="generation_location_address_${idx}" id="${addressInputId}" placeholder="Address" style="flex:2; min-width:120px;" />
        <input type="text" name="generation_location_gps_${idx}" id="${gpsInputId}" placeholder="GPS Coordinates" style="flex:1; min-width:120px;" readonly />
        <button type="button" class="btn btn-secondary" onclick="openMapModalForLocation('${modalId}', '${gpsInputId}')">Map</button>
        <button type="button" class="btn btn-danger" onclick="this.parentNode.remove()">Remove</button>
        <div id="${modalId}" class="map-modal" style="display:none;"></div>
    `;
    container.appendChild(div);
};

window.openMapModalForLocation = function(modalId, gpsInputId) {
    // If modal already initialized, just show it
    let modal = document.getElementById(modalId);
    if (!modal) return;
    if (!modal.innerHTML) {
        modal.innerHTML = `
            <div class="map-modal-content">
                <div class="map-modal-header">
                    <h3>Select Location</h3>
                    <span class="map-close" onclick="closeMapModalForLocation('${modalId}')">&times;</span>
                </div>
                <div class="map-content-area">
                    <div class="map-search-container">
                        <input type="text" id="mapSearchInput_${modalId}" placeholder="Search for a location...">
                    </div>
                    <div id="map_${modalId}" style="width:100%;height:180px;"></div>
                    <div class="coordinates-display" id="coordinatesDisplay_${modalId}">Click on the map to select coordinates</div>
                </div>
                <div class="map-buttons">
                    <button type="button" class="btn btn-secondary" onclick="closeMapModalForLocation('${modalId}')">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="confirmLocationForRow('${modalId}', '${gpsInputId}')">Confirm Location</button>
                </div>
            </div>
        `;
    }
    modal.style.display = 'block';
    // Load Google Maps if not already loaded for this modal
    if (!window["mapInstance_"+modalId]) {
        loadGoogleMapsForLocation(modalId, gpsInputId);
    }
    
    // Apply enhanced visibility fixes for Step 4 modals
    enhanceStep4ModalVisibility(modalId);
};

// Enhanced Step 4 map modal visibility function
function enhanceStep4ModalVisibility(modalId) {
    console.log(`Enhancing visibility for modal: ${modalId}`);
    
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`Modal ${modalId} not found`);
        return;
    }
    
    // Apply aggressive CSS fixes to ensure visibility
    modal.style.setProperty('display', 'block', 'important');
    modal.style.setProperty('position', 'fixed', 'important');
    modal.style.setProperty('top', '0', 'important');
    modal.style.setProperty('left', '0', 'important');
    modal.style.setProperty('width', '100%', 'important');
    modal.style.setProperty('height', '100%', 'important');
    modal.style.setProperty('z-index', '2000', 'important');
    modal.style.setProperty('background-color', 'rgba(45, 52, 54, 0.8)', 'important');
    modal.style.setProperty('overflow', 'auto', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('opacity', '1', 'important');
    
    // Remove any conflicting classes
    modal.classList.remove('hidden', 'hide', 'd-none');
    modal.classList.add('map-modal', 'visible');
    
    // Ensure parent containers don't interfere
    let parent = modal.parentElement;
    while (parent && parent !== document.body) {
        // Don't hide parent containers
        if (parent.style.display === 'none') {
            console.log('Found hidden parent, making visible:', parent);
            parent.style.setProperty('display', 'block', 'important');
        }
        
        // Ensure parent doesn't have overflow hidden that could clip the modal
        if (window.getComputedStyle(parent).overflow === 'hidden') {
            parent.style.setProperty('overflow', 'visible', 'important');
        }
        
        parent = parent.parentElement;
    }
    
    // Log final state for debugging
    const computedStyle = window.getComputedStyle(modal);
    console.log(`Modal ${modalId} final state:`, {
        display: modal.style.display,
        position: modal.style.position,
        zIndex: modal.style.zIndex,
        visibility: modal.style.visibility,
        opacity: modal.style.opacity,
        computedDisplay: computedStyle.display,
        computedVisibility: computedStyle.visibility,
        offsetWidth: modal.offsetWidth,
        offsetHeight: modal.offsetHeight
    });
    
    // Add click handler to modal background for closing
    modal.onclick = function(e) {
        if (e.target === modal) {
            closeMapModalForLocation(modalId);
        }
    };
    
    console.log(`Enhanced visibility applied to modal: ${modalId}`);
}

window.closeMapModalForLocation = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
};

window.confirmLocationForRow = function(modalId, gpsInputId) {
    const coords = window["selectedCoords_"+modalId];
    if (coords) {
        document.getElementById(gpsInputId).value = coords;
    }
    closeMapModalForLocation(modalId);
};

function loadGoogleMapsForLocation(modalId, gpsInputId) {
    // Fetch API key from backend instead of using the undefined window variable
    frappe.call({
        method: 'franchise_portal.www.signup.api.get_google_maps_api_key',
        callback: function(response) {
            if (response.message && response.message.success) {
                const apiKey = response.message.api_key;
                
                // Dynamically load Google Maps script if not already loaded
                if (!window.google || !window.google.maps) {
                    const script = document.createElement('script');
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initMapForLocation_${modalId}`;
                    script.async = true;
                    window[`initMapForLocation_${modalId}`] = function() {
                        initMapForLocation(modalId, gpsInputId);
                    };
                    document.body.appendChild(script);
                } else {
                    initMapForLocation(modalId, gpsInputId);
                }
            } else {
                document.getElementById(`map_${modalId}`).innerHTML = 'Failed to get Google Maps API key.';
            }
        },
        error: function(error) {
            document.getElementById(`map_${modalId}`).innerHTML = 'Error loading Google Maps configuration.';
        }
    });
}

function initMapForLocation(modalId, gpsInputId) {
    const mapDiv = document.getElementById(`map_${modalId}`);
    if (!mapDiv) return;
    const center = { lat: 20.5937, lng: 78.9629 }; // Default: India
    const map = new google.maps.Map(mapDiv, {
        center: center,
        zoom: 5
    });
    let marker = null;
    // Search box
    const input = document.getElementById(`mapSearchInput_${modalId}`);
    const searchBox = new google.maps.places.SearchBox(input);
    map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);
    map.addListener('bounds_changed', function() {
        searchBox.setBounds(map.getBounds());
    });
    searchBox.addListener('places_changed', function() {
        const places = searchBox.getPlaces();
        if (places.length === 0) return;
        const place = places[0];
        if (!place.geometry) return;
        if (marker) marker.setMap(null);
        marker = new google.maps.Marker({
            map: map,
            position: place.geometry.location
        });
        map.panTo(place.geometry.location);
        map.setZoom(15);
        const latlng = `${place.geometry.location.lat().toFixed(6)}, ${place.geometry.location.lng().toFixed(6)}`;
        document.getElementById(`coordinatesDisplay_${modalId}`).innerText = latlng;
        window["selectedCoords_"+modalId] = latlng;
    });
    // Click on map
    map.addListener('click', function(e) {
        if (marker) marker.setMap(null);
        marker = new google.maps.Marker({
            map: map,
            position: e.latLng
        });
        const latlng = `${e.latLng.lat().toFixed(6)}, ${e.latLng.lng().toFixed(6)}`;
        document.getElementById(`coordinatesDisplay_${modalId}`).innerText = latlng;
        window["selectedCoords_"+modalId] = latlng;
    });
    // If already has value, show marker
    const gpsInput = document.getElementById(gpsInputId);
    if (gpsInput && gpsInput.value) {
        const [lat, lng] = gpsInput.value.split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) {
            marker = new google.maps.Marker({
                map: map,
                position: { lat, lng }
            });
            map.panTo({ lat, lng });
            map.setZoom(15);
            document.getElementById(`coordinatesDisplay_${modalId}`).innerText = gpsInput.value;
            window["selectedCoords_"+modalId] = gpsInput.value;
        }
    }
    window["mapInstance_"+modalId] = map;
}

// Add debug function to test generation locations manually
window.debugGenerationLocations = function() {
    console.log('=== DEBUG: Generation Locations ===');
    const container = document.getElementById('generation_locations_container');
    console.log('Container:', container);
    console.log('Container HTML:', container ? container.innerHTML : 'NOT FOUND');
    
    if (container) {
        const rows = container.querySelectorAll('.generation-location-row');
        console.log('Rows found:', rows.length);
        
        rows.forEach((row, index) => {
            console.log(`Row ${index + 1}:`, row);
            const addressInput = row.querySelector(`input[name*="generation_location_address"]`);
            const gpsInput = row.querySelector(`input[name*="generation_location_gps"]`);
            console.log(`  Address input:`, addressInput, addressInput ? addressInput.value : 'N/A');
            console.log(`  GPS input:`, gpsInput, gpsInput ? gpsInput.value : 'N/A');
        });
    }
    
    // Test getStepData function
    console.log('Testing getStepData(4):');
    const testData = getStepData(4);
    console.log('Result:', testData);
};

// Add debug function to manually add a test location
window.debugAddTestLocation = function() {
    console.log('Adding test generation location...');
    addGenerationLocation();
    
    // Find the last added row and fill it with test data
    const container = document.getElementById('generation_locations_container');
    if (container) {
        const rows = container.querySelectorAll('.generation-location-row');
        const lastRow = rows[rows.length - 1];
        
        if (lastRow) {
            const addressInput = lastRow.querySelector(`input[name*="generation_location_address"]`);
            const gpsInput = lastRow.querySelector(`input[name*="generation_location_gps"]`);
            
            if (addressInput) addressInput.value = 'Test Address 123';
            if (gpsInput) gpsInput.value = '12.3456, 78.9012';
            
            console.log('Test location added with test data');
        }
    }
}; 

// Add debug function to test Step 5 data collection
window.debugStep5Data = function() {
    console.log('=== DEBUG: Step 5 Data Collection ===');
    
    // Fill Step 5 with test data
    const step5Fields = {
        'electricity_meter_id': 'METER-001',
        'meter_type_model': 'Smart Meter Pro 2024',
        'monitoring_interval': 'Hourly',
        'last_calibration_date': '2024-01-15',
        'next_calibration_due': '2025-01-15',
        'weighbridge_id': 'WB-001',
        'capacity': '50.00',
        'accuracy_rating': '99.95',
        'continuous_recording': 'Yes',
        'data_logging_system': 'Cloud Logger v2.0',
        'testing_laboratory_name': 'Test Lab Inc.',
        'lab_accreditation_number': 'ACC-12345',
        'testing_standards_used': 'ISO',
        'analysis_frequency': 'Daily',
        'automatic_data_upload': 'Yes',
        'data_storage_method': 'Cloud',
        'backup_system': 'Daily Cloud Backup',
        'retention_period': '7'
    };
    
    // Fill the form
    Object.keys(step5Fields).forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = step5Fields[fieldId];
            console.log(`Set ${fieldId} = ${step5Fields[fieldId]}`);
        } else {
            console.warn(`Field ${fieldId} not found`);
        }
    });
    
    // Test data collection
    console.log('Testing getStepData(5):');
    const collectedData = getStepData(5);
    console.log('Collected data:', collectedData);
    
    // Show summary
    console.log('=== Step 5 Data Summary ===');
    Object.keys(step5Fields).forEach(fieldId => {
        const expectedValue = step5Fields[fieldId];
        const actualValue = collectedData[fieldId];
        const match = expectedValue === actualValue;
        console.log(`${fieldId}: Expected="${expectedValue}", Actual="${actualValue}", Match=${match}`);
    });
};

// Debug function to navigate directly to Step 5
window.goToStep5 = function() {
    console.log('=== DEBUG: Forcing navigation to Step 5 ===');
    setCurrentStep(5);
    showStep(5);
    updateProgressIndicator();
    console.log('Should now be showing Step 5');
};

// Debug function to test complete 5-step flow
window.testComplete5StepFlow = function() {
    console.log('=== DEBUG: Testing Complete 5-Step Data Collection ===');
    
    // Collect data from all steps
    const allData = {};
    
    for (let step = 1; step <= 4; step++) {
        console.log(`Collecting data from step ${step}:`);
        const stepData = getStepData(step);
        console.log(`Step ${step} data:`, stepData);
        Object.assign(allData, stepData);
    }
    
    console.log('=== COMPLETE FORM DATA ===');
    console.log('All collected data:', allData);
    
    // Count fields from each step
    const step1Fields = ['company_name', 'contact_person', 'email', 'phone_number'];
    const step2Fields = ['project_name', 'project_city', 'project_state', 'gps_coordinates'];
    const step3Fields = ['primary_feedstock_category', 'annual_volume_available', 'heating_value'];
    const step4Fields = ['partner_first_name', 'partner_gender', 'partner_date_of_birth', 'partner_date_of_joining'];
    
    console.log('=== FIELD COUNT SUMMARY ===');
    console.log('Step 1 fields found:', step1Fields.filter(f => allData[f]).length, '/', step1Fields.length);
    console.log('Step 2 fields found:', step2Fields.filter(f => allData[f]).length, '/', step2Fields.length);
    console.log('Step 3 fields found:', step3Fields.filter(f => allData[f]).length, '/', step3Fields.length);
    console.log('Step 4 fields found:', step4Fields.filter(f => allData[f]).length, '/', step4Fields.length);
    
    return allData;
};

// Debug function to manually test Step 4 data saving
window.testStep4Save = function() {
    console.log('=== DEBUG: Testing Step 4 Data Saving ===');
    
    // First collect the data
    const step4Data = getStepData(4);
    console.log('Step 4 data to save:', step4Data);
    
    // Test saving with verification if available
    if (emailVerified && verificationToken && verificationToken !== 'test-token') {
        console.log('Using verified save method...');
        frappe.call({
            method: 'franchise_portal.www.signup.api.save_step_with_verification',
            args: { 
                token: verificationToken,
                data: step4Data,
                step: 4
            },
            callback: function(response) {
                console.log('Step 4 save response:', response);
                if (response.message && response.message.success) {
                    console.log('✅ Step 4 data saved successfully!');
                    frappe.msgprint({
                        title: 'Success',
                        message: 'Step 4 data saved successfully!',
                        indicator: 'green'
                    });
                } else {
                    console.error('❌ Step 4 save failed:', response.message?.message);
                    frappe.msgprint({
                        title: 'Error',
                        message: response.message?.message || 'Failed to save Step 4 data',
                        indicator: 'red'
                    });
                }
            },
            error: function(error) {
                console.error('❌ Step 4 save network error:', error);
                frappe.msgprint({
                    title: 'Network Error',
                    message: 'Failed to save Step 4 data. Please check your connection.',
                    indicator: 'red'
                });
            }
        });
    } else {
        console.log('Using regular save method...');
        frappe.call({
            method: 'franchise_portal.www.signup.api.save_step',
            args: { 
                data: step4Data 
            },
            callback: function(response) {
                console.log('Step 4 save response:', response);
                if (response.message && response.message.success) {
                    console.log('✅ Step 4 data saved successfully!');
                    frappe.msgprint({
                        title: 'Success',
                        message: 'Step 4 data saved successfully!',
                        indicator: 'green'
                    });
                } else {
                    console.error('❌ Step 4 save failed:', response.message?.message);
                    frappe.msgprint({
                        title: 'Error',
                        message: response.message?.message || 'Failed to save Step 4 data',
                        indicator: 'red'
                    });
                }
            },
            error: function(error) {
                console.error('❌ Step 4 save network error:', error);
                frappe.msgprint({
                    title: 'Network Error',
                    message: 'Failed to save Step 4 data. Please check your connection.',
                    indicator: 'red'
                });
            }
        });
    }
};

// File Upload Functionality
function toggleFileUpload(selectFieldId, fileGroupId) {
    console.log(`toggleFileUpload called: ${selectFieldId} -> ${fileGroupId}`);
    const selectField = document.getElementById(selectFieldId);
    const fileGroup = document.getElementById(fileGroupId);
    
    if (selectField && fileGroup) {
        // Check for different trigger values based on field
        const shouldShow = selectField.value === 'Attached' || selectField.value === 'Yes (attach)';
        console.log(`Should show file upload: ${shouldShow} (value: "${selectField.value}")`);
        
        if (shouldShow) {
            fileGroup.style.display = 'block';
            console.log(`File group ${fileGroupId} shown, initializing upload...`);
            
            // Initialize file upload for this specific area after showing
            setTimeout(() => {
                const uploadArea = fileGroup.querySelector('.file-upload-area');
                if (uploadArea) {
                    // Remove any existing initialization to avoid conflicts
                    uploadArea.removeAttribute('data-initialized');
                    initializeSpecificFileUpload(fileGroup);
                    console.log(`File upload initialized for ${fileGroupId}`);
                } else {
                    console.error(`Upload area not found in ${fileGroupId}`);
                }
            }, 200);
        } else {
            fileGroup.style.display = 'none';
            console.log(`File group ${fileGroupId} hidden`);
            // Clear any uploaded files when hiding
            const fileInput = fileGroup.querySelector('input[type="file"]');
            if (fileInput) {
                fileInput.value = '';
                clearFilePreview(fileInput.id);
            }
        }
    } else {
        console.error(`Elements not found: selectField=${!!selectField}, fileGroup=${!!fileGroup}`);
    }
}

function initializeSpecificFileUpload(uploadGroup) {
    console.log('initializeSpecificFileUpload called');
    
    const uploadArea = uploadGroup.querySelector('.file-upload-area');
    if (!uploadArea) {
        console.error('Upload area not found in group');
        return;
    }
    
    if (uploadArea.hasAttribute('data-initialized')) {
        console.log('Upload area already initialized, skipping');
        return; // Already initialized
    }
    
    const fieldName = uploadArea.getAttribute('data-field');
    const fileInput = uploadArea.querySelector('input[type="file"]');
    const placeholder = uploadArea.querySelector('.upload-placeholder');
    const browseLink = uploadArea.querySelector('.browse-link');
    
    if (!fileInput || !placeholder || !browseLink) {
        console.error('Missing required elements:', {
            fileInput: !!fileInput,
            placeholder: !!placeholder,
            browseLink: !!browseLink,
            fieldName
        });
        return;
    }
    
    console.log('Initializing specific file upload for:', fieldName);
    
    // Clear any existing event listeners first
    const newFileInput = fileInput.cloneNode(true);
    fileInput.parentNode.replaceChild(newFileInput, fileInput);
    
    // Set up click handler on browse link only (same as working Step 3)
    browseLink.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log(`Browse clicked for ${fieldName}`);
        newFileInput.click();
    };
    
    // Set up file input change handler
    newFileInput.onchange = function(e) {
        console.log(`File selected for ${fieldName}:`, e.target.files[0]);
        if (e.target.files.length > 0) {
            handleFileSelection(e.target);
        }
    };
    
    // Set up drag and drop
    uploadArea.ondragover = function(e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    };
    
    uploadArea.ondragleave = function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    };
    
    uploadArea.ondrop = function(e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            newFileInput.files = files;
            handleFileSelection(newFileInput);
        }
    };
    
    uploadArea.setAttribute('data-initialized', 'true');
    console.log(`File upload initialized successfully for ${fieldName}`);
}

function initializeFileUploads() {
    console.log('Initializing all file uploads...');
    
    // Get all file upload areas
    const uploadAreas = document.querySelectorAll('.file-upload-area');
    let initializedCount = 0;
    let skippedCount = 0;
    
    uploadAreas.forEach(area => {
        const fieldName = area.getAttribute('data-field');
        
        // Skip if already initialized
        if (area.hasAttribute('data-initialized')) {
            console.log(`File upload already initialized for: ${fieldName}`);
            return;
        }
        
        const fileInput = area.querySelector('input[type="file"]');
        const placeholder = area.querySelector('.upload-placeholder');
        const browseLink = area.querySelector('.browse-link');
        
        if (!fileInput || !placeholder || !browseLink) {
            console.warn('Missing elements for file upload area:', fieldName);
            skippedCount++;
            return;
        }
        
        console.log('Initializing file upload for field:', fieldName);
        
        // Clear any existing event listeners first
        const newFileInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newFileInput, fileInput);
        
        // Set up click handler on browse link only
        browseLink.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log(`Browse clicked for ${fieldName}`);
            newFileInput.click();
        };
        
        // Set up file input change handler
        newFileInput.onchange = function(e) {
            console.log(`File selected for ${fieldName}:`, e.target.files[0]);
            if (e.target.files.length > 0) {
                handleFileSelection(e.target);
            }
        };
        
        // Set up drag and drop
        area.ondragover = function(e) {
            e.preventDefault();
            area.classList.add('dragover');
        };
        
        area.ondragleave = function(e) {
            e.preventDefault();
            area.classList.remove('dragover');
        };
        
        area.ondrop = function(e) {
            e.preventDefault();
            area.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                newFileInput.files = files;
                handleFileSelection(newFileInput);
            }
        };
        
        area.setAttribute('data-initialized', 'true');
        initializedCount++;
    });
    
    console.log(`File uploads initialized: ${initializedCount} areas, ${skippedCount} skipped`);
}

function handleFileSelection(fileInput) {
    console.log('handleFileSelection called with:', fileInput);
    const file = fileInput.files[0];
    console.log('Selected file:', file);
    
    if (!file) {
        console.log('No file selected');
        return;
    }
    
    // Validate file
    const validation = validateFile(file);
    console.log('File validation result:', validation);
    
    if (!validation.valid) {
        showFileError(fileInput.id, validation.message);
        fileInput.value = '';
        return;
    }
    
    // Show file preview
    showFilePreview(fileInput.id, file);
    
    // Upload file
    console.log('Starting file upload for:', fileInput.name);
    uploadFile(fileInput, file);
}

function validateFile(file) {
    // Check file size (25MB = 25 * 1024 * 1024 bytes)
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
        return {
            valid: false,
            message: 'File size must be less than 25MB'
        };
    }
    
    // Check file type
    const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'application/msword', // DOC
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
        'application/vnd.ms-excel', // XLS
        'text/csv',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/bmp'
    ];
    
    const allowedExtensions = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.csv', '.jpg', '.jpeg', '.png', '.gif', '.bmp'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        return {
            valid: false,
            message: 'File type not supported. Please upload PDF, DOCX, JPG, PNG, XLSX, or CSV files.'
        };
    }
    
    return { valid: true };
}

function showFilePreview(inputId, file) {
    const uploadArea = document.querySelector(`input#${inputId}`).closest('.file-upload-area');
    const placeholder = uploadArea.querySelector('.upload-placeholder');
    const preview = uploadArea.querySelector('.file-preview');
    
    placeholder.style.display = 'none';
    preview.style.display = 'block';
    
    const fileSize = formatFileSize(file.size);
    const fileName = file.name;
    
    preview.innerHTML = `
        <div class="file-item">
            <div class="file-item-info">
                <div class="file-item-icon">📄</div>
                <div class="file-item-details">
                    <div class="file-item-name" id="filename-${inputId}">${fileName}</div>
                    <div class="file-item-size">${fileSize}</div>
                    <div class="file-item-status">Uploading...</div>
                </div>
            </div>
            <div class="file-item-actions">
                <button type="button" class="file-action-btn remove" onclick="removeFile('${inputId}')">Remove</button>
            </div>
        </div>
    `;
}

function clearFilePreview(inputId) {
    const uploadArea = document.querySelector(`input#${inputId}`).closest('.file-upload-area');
    const placeholder = uploadArea.querySelector('.upload-placeholder');
    const preview = uploadArea.querySelector('.file-preview');
    const progress = uploadArea.querySelector('.upload-progress');
    
    placeholder.style.display = 'block';
    preview.style.display = 'none';
    progress.style.display = 'none';
    
    // Clear any error messages
    const errorDiv = uploadArea.querySelector('.upload-error');
    if (errorDiv) {
        errorDiv.remove();
    }
}

function removeFile(inputId) {
    const fileInput = document.getElementById(inputId);
    fileInput.value = '';
    clearFilePreview(inputId);
}

function showFileError(inputId, message) {
    const uploadArea = document.querySelector(`input#${inputId}`).closest('.file-upload-area');
    
    // Remove existing error messages
    const existingError = uploadArea.querySelector('.upload-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Add new error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'upload-error';
    errorDiv.textContent = message;
    uploadArea.appendChild(errorDiv);
}

function uploadFile(fileInput, file) {
    console.log('uploadFile called for:', fileInput.name, 'file:', file.name);
    
    const uploadArea = fileInput.closest('.file-upload-area');
    const progress = uploadArea.querySelector('.upload-progress');
    
    if (!progress) {
        console.error('Progress element not found for:', fileInput.name);
        return;
    }
    
    const progressBar = progress.querySelector('.progress-bar');
    const progressFill = progress.querySelector('.progress-fill');
    const progressText = progress.querySelector('.progress-text');
    
    progress.style.display = 'block';
    console.log('Upload progress shown');
    
    // Create FormData for file upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('field_name', fileInput.name);
    
    console.log('FormData created, sending request...');
    
    // Use XMLHttpRequest for progress tracking
    const xhr = new XMLHttpRequest();
    
    // Progress tracking
    xhr.upload.addEventListener('progress', function(e) {
        if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            progressFill.style.width = percentComplete + '%';
            progressText.textContent = Math.round(percentComplete) + '%';
            console.log('Upload progress:', Math.round(percentComplete) + '%');
        }
    });
    
    // Handle completion
    xhr.addEventListener('load', function() {
        console.log('Upload completed, status:', xhr.status);
        console.log('Response:', xhr.responseText);
        
        progress.style.display = 'none';
        
        if (xhr.status === 200) {
            try {
                const response = JSON.parse(xhr.responseText);
                console.log('Parsed response:', response);
                
                // Check for success in response.message.success (Frappe API structure)
                const uploadSuccess = response.message && response.message.success;
                
                if (uploadSuccess) {
                    console.log('File uploaded successfully, URL:', response.message.file_url);
                    showUploadSuccess(fileInput.id);
                    // Store file reference for later use
                    fileInput.setAttribute('data-file-url', response.message.file_url);
                    console.log('File URL stored in data-file-url attribute:', response.message.file_url);
                } else {
                    const errorMessage = response.message?.message || response.message || 'Upload failed';
                    console.error('Upload failed:', errorMessage);
                    showFileError(fileInput.id, errorMessage);
                }
            } catch (e) {
                console.error('Failed to parse response:', e);
                showFileError(fileInput.id, 'Upload failed - invalid response');
            }
        } else {
            console.error('Upload failed with status:', xhr.status);
            showFileError(fileInput.id, 'Upload failed. Please try again.');
        }
    });
    
    // Handle errors
    xhr.addEventListener('error', function() {
        console.error('Upload network error');
        progress.style.display = 'none';
        showFileError(fileInput.id, 'Upload failed. Please check your connection.');
    });
    
    // Send the request
    xhr.open('POST', '/api/method/franchise_portal.www.signup.api.upload_file');
    
    // Add CSRF token header (required for Frappe API calls)
    if (typeof frappe !== 'undefined' && frappe.csrf_token) {
        xhr.setRequestHeader('X-Frappe-CSRF-Token', frappe.csrf_token);
    }
    
    console.log('Sending upload request...');
    xhr.send(formData);
}

function showUploadSuccess(inputId) {
    const uploadArea = document.querySelector(`input#${inputId}`).closest('.file-upload-area');
    const fileInput = document.getElementById(inputId);
    const fileUrl = fileInput.getAttribute('data-file-url');
    
    // Remove existing messages
    const existingError = uploadArea.querySelector('.upload-error');
    const existingSuccess = uploadArea.querySelector('.upload-success');
    if (existingError) existingError.remove();
    if (existingSuccess) existingSuccess.remove();
    
    // Update the file status and make it clickable
    const statusElement = uploadArea.querySelector('.file-item-status');
    const fileNameElement = uploadArea.querySelector(`#filename-${inputId}`);
    
    if (statusElement) {
        statusElement.textContent = '✓ Uploaded successfully';
        statusElement.style.color = '#28a745';
    }
    
    // Make the file name clickable with proper download behavior
    if (fileNameElement && fileUrl) {
        fileNameElement.style.cursor = 'pointer';
        fileNameElement.style.color = '#667eea';
        fileNameElement.style.textDecoration = 'underline';
        fileNameElement.title = 'Click to download file';
        
        // Add click handler for proper download
        fileNameElement.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            downloadFileDirectly(fileUrl, fileNameElement.textContent);
        };
    }
    
    // Add temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'upload-success';
    successDiv.textContent = '✓ File uploaded successfully - Click filename to download';
    successDiv.style.color = '#28a745';
    successDiv.style.fontSize = '12px';
    successDiv.style.marginTop = '5px';
    uploadArea.appendChild(successDiv);
    
    // Remove success message after 5 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.remove();
        }
    }, 5000);
}

function downloadFileDirectly(fileUrl, fileName) {
    console.log('Downloading file:', fileName, 'URL:', fileUrl);
    
    // Show user feedback that download is starting
    showDownloadFeedback('Starting download...');
    
    try {
        // For private files with fid parameter, use Frappe's download endpoint
        if (fileUrl.includes('/private/') && fileUrl.includes('fid=')) {
            // Extract the file path and fid for Frappe's download method
            const urlParts = fileUrl.split('?');
            const filePath = urlParts[0];
            const fid = urlParts[1].split('fid=')[1];
            
            // Use Frappe's authenticated download endpoint
            const downloadUrl = `/api/method/frappe.core.doctype.file.file.download_file?file_url=${encodeURIComponent(filePath)}&fid=${fid}`;
            
            console.log('Using Frappe download endpoint:', downloadUrl);
            
            // Create a temporary link for download
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            link.style.display = 'none';
            
            // Add to document temporarily
            document.body.appendChild(link);
            
            // Trigger download
            link.click();
            
            // Clean up
            document.body.removeChild(link);
            
            // Success feedback
            setTimeout(() => {
                showDownloadFeedback('Download started! Check your downloads folder.', 'success');
            }, 500);
            
        } else {
            // For regular files, use direct download
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = fileName; // This suggests browser to download instead of opening
            link.style.display = 'none';
            
            // Add to document temporarily
            document.body.appendChild(link);
            
            // Trigger download
            link.click();
            
            // Clean up
            document.body.removeChild(link);
            
            // Success feedback
            setTimeout(() => {
                showDownloadFeedback('Download started! Check your downloads folder.', 'success');
            }, 500);
        }
        
        console.log('Download triggered for:', fileName);
        
    } catch (error) {
        console.error('Download error:', error);
        showDownloadFeedback('Download failed. Please try again or contact support.', 'error');
    }
}

function showDownloadFeedback(message, type = 'info') {
    // Remove any existing feedback
    const existing = document.querySelector('.download-feedback');
    if (existing) {
        existing.remove();
    }
    
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = 'download-feedback';
    feedback.textContent = message;
    
    // Style based on type
    const baseStyle = {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: 'bold',
        zIndex: '10000',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
    };
    
    const typeStyles = {
        info: { backgroundColor: '#e7f3ff', color: '#0066cc', border: '1px solid #b3d9ff' },
        success: { backgroundColor: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' },
        error: { backgroundColor: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' }
    };
    
    Object.assign(feedback.style, baseStyle, typeStyles[type] || typeStyles.info);
    
    // Add to page
    document.body.appendChild(feedback);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        if (feedback.parentNode) {
            feedback.remove();
        }
    }, 4000);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Initialize file uploads when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Add a small delay to ensure all elements are rendered
    setTimeout(() => {
        initializeFileUploads();
    }, 1000);
});

// Also initialize when frappe is ready
if (typeof frappe !== 'undefined' && frappe.ready) {
    frappe.ready(() => {
        setTimeout(() => {
            initializeFileUploads();
        }, 1000);
    });
}

// Make file upload functions globally available
window.toggleFileUpload = toggleFileUpload;
window.removeFile = removeFile;
window.initializeFileUploads = initializeFileUploads;

// Debug function to test file uploads
window.debugFileUploads = function() {
    console.log('=== DEBUG: File Upload Status ===');
    
    // Check Step 3 file uploads
    const step3FileGroups = [
        {id: 'feedstock_payment_file_group', trigger: 'feedstock_payment', field: 'feedstock_payment_file'}
    ];
    
    // Check Step 4 file uploads  
    const step4FileGroups = [
        {id: 'chain_of_custody_file_group', trigger: 'chain_of_custody', field: 'chain_of_custody_file'},
        {id: 'supplier_agreements_file_group', trigger: 'supplier_agreements', field: 'supplier_agreements_file'},
        {id: 'origin_certificates_file_group', trigger: 'origin_certificates', field: 'origin_certificates_file'},
        {id: 'transportation_records_file_group', trigger: 'transportation_records', field: 'transportation_records_file'}
    ];
    
    const allFileGroups = [...step3FileGroups, ...step4FileGroups];
    
    allFileGroups.forEach(group => {
        const fileGroup = document.getElementById(group.id);
        const triggerField = document.getElementById(group.trigger);
        const fileInput = document.querySelector(`input[name="${group.field}"]`);
        const uploadArea = fileGroup?.querySelector('.file-upload-area');
        
        console.log(`\n--- ${group.field} ---`);
        console.log(`File Group Found: ${!!fileGroup}`);
        console.log(`Trigger Field Found: ${!!triggerField}`);
        console.log(`Trigger Value: ${triggerField?.value || 'N/A'}`);
        console.log(`File Input Found: ${!!fileInput}`);
        console.log(`Upload Area Found: ${!!uploadArea}`);
        console.log(`Upload Area Initialized: ${uploadArea?.hasAttribute('data-initialized')}`);
        console.log(`File Group Visible: ${fileGroup?.style.display !== 'none'}`);
        console.log(`File URL Stored: ${fileInput?.getAttribute('data-file-url') || 'None'}`);
    });
    
    console.log('\n=== File Upload Initialization Test ===');
    console.log('Running initializeFileUploads()...');
    initializeFileUploads();
    
    console.log('\n=== Complete File Upload Debug Done ===');
};



// Comprehensive debug function for file upload issues
window.debugUploadIssues = function() {
    console.log('=== COMPREHENSIVE UPLOAD DEBUG ===');
    
    // Test file upload initialization
    console.log('\n1. File Upload Initialization Status:');
    const uploadAreas = document.querySelectorAll('.file-upload-area');
    uploadAreas.forEach(area => {
        const fieldName = area.getAttribute('data-field');
        const isInitialized = area.hasAttribute('data-initialized');
        const fileInput = area.querySelector('input[type="file"]');
        const browseLink = area.querySelector('.browse-link');
        
        console.log(`${fieldName}: Initialized=${isInitialized}, FileInput=${!!fileInput}, BrowseLink=${!!browseLink}`);
        
        if (fileInput) {
            console.log(`  - File Input ID: ${fileInput.id}, Name: ${fileInput.name}`);
            console.log(`  - Has data-file-url: ${!!fileInput.getAttribute('data-file-url')}`);
            console.log(`  - File URL: ${fileInput.getAttribute('data-file-url') || 'None'}`);
        }
    });
    
    // Test manual file trigger
    console.log('\n2. Manual File Upload Test:');
    const testField = document.querySelector('input[name="environmental_permits_file"]');
    if (testField) {
        console.log('Testing environmental permits file input...');
        console.log('File input element:', testField);
        console.log('Parent upload area:', testField.closest('.file-upload-area'));
        console.log('Browse link:', testField.closest('.file-upload-area')?.querySelector('.browse-link'));
    }
    
    // Test data collection for all steps
    console.log('\n3. Data Collection Test:');
    for (let step = 1; step <= 4; step++) {
        try {
            const stepData = getStepData(step);
            const fieldCount = Object.keys(stepData).length;
            console.log(`Step ${step}: ${fieldCount} fields collected`);
            
            // Check for file fields specifically
            const fileFields = Object.keys(stepData).filter(key => key.includes('_file'));
            if (fileFields.length > 0) {
                console.log(`  File fields: ${fileFields.join(', ')}`);
                fileFields.forEach(field => {
                    console.log(`    ${field}: ${stepData[field] || 'Empty'}`);
                });
            }
        } catch (e) {
            console.error(`Error collecting data for step ${step}:`, e);
        }
    }
    
    console.log('\n=== DEBUG COMPLETE ===');
};

// Quick test function for file upload clicks
window.testFileUpload = function(fieldName) {
    console.log(`Testing file upload for: ${fieldName}`);
    const fileInput = document.querySelector(`input[name="${fieldName}"]`);
    if (fileInput) {
        console.log('File input found, triggering click...');
        fileInput.click();
    } else {
        console.error('File input not found for:', fieldName);
    }
};

// Test file upload URL collection
window.testFileURLCollection = function() {
    console.log('=== TESTING FILE URL COLLECTION ===');
    
    const fileFields = [
        'feedstock_payment_file',
        'chain_of_custody_file', 
        'supplier_agreements_file',
        'origin_certificates_file', 
        'transportation_records_file'
    ];
    
    fileFields.forEach(fieldName => {
        const fileInput = document.querySelector(`input[name="${fieldName}"]`);
        if (fileInput) {
            const hasDataUrl = fileInput.hasAttribute('data-file-url');
            const dataUrl = fileInput.getAttribute('data-file-url');
            const hasFiles = fileInput.files && fileInput.files.length > 0;
            
            console.log(`${fieldName}:`);
            console.log(`  - Input found: ${!!fileInput}`);
            console.log(`  - Has data-file-url: ${hasDataUrl}`);
            console.log(`  - URL value: ${dataUrl || 'None'}`);
            console.log(`  - Has files: ${hasFiles}`);
            if (hasFiles) {
                console.log(`  - File name: ${fileInput.files[0].name}`);
            }
        } else {
            console.log(`${fieldName}: Input not found`);
        }
    });
    
    console.log('=== TEST COMPLETE ===');
};

// Signup Options and Resume Functionality
function setupSignupOptions() {
    const modalOverlay = document.getElementById('signup-modal-overlay');
    const optionsModalContent = document.getElementById('options-modal-content');
    const resumeModalContent = document.getElementById('resume-modal-content');
    const btnSignup = document.getElementById('btn-signup');
    const btnResume = document.getElementById('btn-resume');
    const backToOptions = document.getElementById('back-to-options');
    const resumeForm = document.getElementById('resume-form');
    const formContainer = document.getElementById('form-container');
    const stepProgress = document.getElementById('step-progress');

    // Check if we're on the signup page (elements exist)
    if (!formContainer || !stepProgress) {
        console.log('Franchise signup elements not found - not on signup page');
        return;
    }

    // Hide all main content until a choice is made
    if(formContainer && formContainer.style) formContainer.style.display = 'none';
    if(stepProgress && stepProgress.style) stepProgress.style.display = 'none';

    // Show options by default
    if (optionsModalContent) optionsModalContent.style.display = '';
    if (resumeModalContent) resumeModalContent.style.display = 'none';

    // Note: Sign Up button click is now handled in index.html modal initialization
    // to avoid conflicts and ensure proper display property setting
    
    if (btnResume) {
        btnResume.onclick = function() {
            isResumeMode = true;
            if (optionsModalContent) optionsModalContent.style.display = 'none';
            if (resumeModalContent) resumeModalContent.style.display = '';
            const resumeMessage = document.getElementById('resume-message');
            const resumeEmail = document.getElementById('resume-email');
            if (resumeMessage) resumeMessage.innerHTML = '';
            if (resumeEmail) resumeEmail.value = '';
        };
    }
    
    if (backToOptions) {
        backToOptions.onclick = function() {
            if (optionsModalContent) optionsModalContent.style.display = '';
            if (resumeModalContent) resumeModalContent.style.display = 'none';
        };
    }
    // Note: Resume form submission is now handled in index.html only
}

// sendResumeEmail function removed - now handled in index.html

// checkResumeToken function removed - now handled in index.html

window.applicationData = window.applicationData || {};
// Remove the reference to undefined savedData variable
console.log('PATCH: applicationData after resume:', JSON.stringify(window.applicationData, null, 2));

// Debug function specifically for Step 4 data issues
window.debugStep4Data = function() {
    console.log('=== DEBUG: Step 4 Data Collection ===');
    
    // Force navigation to Step 4 if not already there
    if (currentStep !== 4) {
        console.log(`Currently on step ${currentStep}, moving to step 4...`);
        setCurrentStep(4);
        showStep(4);
    }
    
    // Test data collection
    console.log('Testing getStepData(4):');
    const rawData = getStepData(4);
    console.log('Raw collected data:', rawData);
    
    // Check data types
    console.log('\n--- Data Type Analysis ---');
    Object.keys(rawData).forEach(key => {
        const value = rawData[key];
        const type = typeof value;
        const isObject = type === 'object' && value !== null;
        console.log(`${key}: "${value}" (${type}${isObject ? ' - OBJECT!' : ''})`);
    });
    
    // Test Step 4 specific fields
    const step4Fields = [
        'source_type', 'generation_locations', 'generation_datetime', 'collection_method',
        'number_of_suppliers', 'max_sourcing_radius', 'avg_transport_distance',
        'primary_transport_method', 'handling_steps', 'storage_duration',
        'chain_of_custody_protocol', 'chain_of_custody_file', 'supplier_agreements',
        'supplier_agreements_file', 'origin_certificates', 'origin_certificates_file',
        'transportation_records', 'transportation_records_file'
    ];
    
    console.log('\n--- Step 4 Field Values ---');
    step4Fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        const formValue = field ? field.value : 'FIELD_NOT_FOUND';
        const dataValue = rawData[fieldId];
        console.log(`${fieldId}: Form="${formValue}", Data="${dataValue}"`);
    });
    
    // Test source_type checkboxes specifically
    console.log('\n--- Source Type Checkbox Test ---');
    const sourceTypeCheckboxes = document.querySelectorAll('input[name="source_type"]:checked');
    console.log('Checked source_type checkboxes:', sourceTypeCheckboxes.length);
    sourceTypeCheckboxes.forEach((checkbox, index) => {
        console.log(`  Checkbox ${index + 1}: ${checkbox.value}`);
    });
    
    // Test generation locations specifically
    console.log('\n--- Generation Locations Test ---');
    const container = document.getElementById('generation_locations_container');
    console.log('Container found:', !!container);
    if (container) {
        const rows = container.querySelectorAll('.generation-location-row');
        console.log('Location rows found:', rows.length);
        rows.forEach((row, index) => {
            const addressInput = row.querySelector(`input[name*="generation_location_address"]`);
            const gpsInput = row.querySelector(`input[name*="generation_location_gps"]`);
            console.log(`  Row ${index + 1}: Address="${addressInput?.value || 'N/A'}", GPS="${gpsInput?.value || 'N/A'}"`);
        });
    }
    
    // Test file upload status
    console.log('\n--- Step 4 File Upload Status ---');
    const fileFields = ['chain_of_custody', 'supplier_agreements', 'origin_certificates', 'transportation_records'];
    fileFields.forEach(fieldId => {
        const selectField = document.getElementById(fieldId);
        const fileGroup = document.getElementById(fieldId + '_file_group');
        console.log(`${fieldId}: "${selectField?.value}", Upload Group Visible: ${fileGroup?.style.display !== 'none'}`);
    });
    
    console.log('\n=== Step 4 Debug Complete ===');
    return rawData;
};

// Debug function to test complete 4-step flow
window.testComplete4StepFlow = function() {
    console.log('=== DEBUG: Testing Complete 4-Step Data Collection ===');
    
    // Collect data from all steps
    const allData = {};
    
    for (let step = 1; step <= 4; step++) {
        console.log(`Collecting data from step ${step}:`);
        const stepData = getStepData(step);
        console.log(`Step ${step} data:`, stepData);
        Object.assign(allData, stepData);
    }
    
    console.log('=== COMPLETE FORM DATA ===');
    console.log('All collected data:', allData);
    
    // Count fields from each step
    const step1Fields = ['company_name', 'contact_person', 'email', 'phone_number'];
    const step2Fields = ['project_name', 'project_city', 'project_state', 'gps_coordinates'];
    const step3Fields = ['primary_feedstock_category', 'annual_volume_available', 'heating_value'];
    const step4Fields = ['source_type', 'generation_locations', 'collection_method'];
    
    console.log('=== FIELD COUNT SUMMARY ===');
    console.log('Step 1 fields found:', step1Fields.filter(f => allData[f]).length, '/', step1Fields.length);
    console.log('Step 2 fields found:', step2Fields.filter(f => allData[f]).length, '/', step2Fields.length);
    console.log('Step 3 fields found:', step3Fields.filter(f => allData[f]).length, '/', step3Fields.length);
    console.log('Step 4 fields found:', step4Fields.filter(f => allData[f]).length, '/', step4Fields.length);
    
    return allData;
};

// Debug function to test Step 4 map modals
window.debugStep4Maps = function() {
    console.log('=== DEBUG: Step 4 Map Modal Test ===');
    
    // First, add a test generation location if none exist
    if (typeof addGenerationLocation === 'function') {
        console.log('Adding test generation location...');
        addGenerationLocation();
        
        // Find the newly added row
        const container = document.getElementById('generation_locations_container');
        if (container) {
            const rows = container.querySelectorAll('.generation-location-row');
            const lastRow = rows[rows.length - 1];
            
            if (lastRow) {
                // Fill with test data
                const addressInput = lastRow.querySelector('input[name*="generation_location_address"]');
                const gpsInput = lastRow.querySelector('input[name*="generation_location_gps"]');
                
                if (addressInput) {
                    addressInput.value = 'Test Location Address';
                    console.log('Set test address');
                }
                if (gpsInput) {
                    gpsInput.value = '21.3099, 77.7192';
                    console.log('Set test GPS coordinates');
                }
                
                // Find the map button and test it
                const mapButton = lastRow.querySelector('button[onclick*="openMapModalForLocation"]');
                if (mapButton) {
                    console.log('Found map button, testing click...');
                    
                    // Extract modal ID and GPS input ID from onclick
                    const onclickText = mapButton.getAttribute('onclick');
                    const match = onclickText.match(/openMapModalForLocation\('([^']+)',\s*'([^']+)'\)/);
                    
                    if (match) {
                        const modalId = match[1];
                        const gpsInputId = match[2];
                        
                        console.log(`Testing modal: ${modalId}, GPS input: ${gpsInputId}`);
                        
                        // Test the map modal function directly
                        if (typeof openMapModalForLocation === 'function') {
                            console.log('Calling openMapModalForLocation...');
                            openMapModalForLocation(modalId, gpsInputId);
                            
                            // Check if modal became visible
                            setTimeout(() => {
                                const modal = document.getElementById(modalId);
                                if (modal) {
                                    const isVisible = modal.offsetWidth > 0 && modal.offsetHeight > 0;
                                    const styles = window.getComputedStyle(modal);
                                    
                                    console.log(`Modal visibility check:`, {
                                        found: true,
                                        visible: isVisible,
                                        display: modal.style.display,
                                        computedDisplay: styles.display,
                                        zIndex: modal.style.zIndex,
                                        position: modal.style.position,
                                        offsetWidth: modal.offsetWidth,
                                        offsetHeight: modal.offsetHeight
                                    });
                                    
                                    if (isVisible) {
                                        console.log('✅ Map modal is now visible!');
                                    } else {
                                        console.log('❌ Map modal is still not visible, applying enhanced fixes...');
                                        enhanceStep4ModalVisibility(modalId);
                                    }
                                } else {
                                    console.error(`Modal ${modalId} not found after creation`);
                                }
                            }, 1000);
                            
                        } else {
                            console.error('openMapModalForLocation function not found');
                        }
                    } else {
                        console.error('Could not parse onclick attribute:', onclickText);
                    }
                } else {
                    console.error('Map button not found in the generated row');
                }
            } else {
                console.error('Could not find the last generation location row');
            }
        } else {
            console.error('generation_locations_container not found');
        }
    } else {
        console.error('addGenerationLocation function not found');
    }
    
    console.log('=== Step 4 Map Debug Complete ===');
};

// Debug function to manually create and show a Step 4 map modal
window.forceShowStep4MapModal = function() {
    console.log('=== FORCE SHOWING Step 4 Map Modal ===');
    
    const testModalId = 'mapModal_test_debug';
    const testGpsInputId = 'test_gps_input';
    
    // Create a test modal div if it doesn't exist
    let testModal = document.getElementById(testModalId);
    if (!testModal) {
        testModal = document.createElement('div');
        testModal.id = testModalId;
        testModal.className = 'map-modal';
        document.body.appendChild(testModal);
        console.log('Created test modal element');
    }
    
    // Create a test GPS input if it doesn't exist
    let testGpsInput = document.getElementById(testGpsInputId);
    if (!testGpsInput) {
        testGpsInput = document.createElement('input');
        testGpsInput.id = testGpsInputId;
        testGpsInput.type = 'text';
        testGpsInput.style.display = 'none';
        document.body.appendChild(testGpsInput);
        console.log('Created test GPS input');
    }
    
    // Use the openMapModalForLocation function
    if (typeof openMapModalForLocation === 'function') {
        console.log('Calling openMapModalForLocation with test parameters...');
        openMapModalForLocation(testModalId, testGpsInputId);
        
        // Additional aggressive visibility fixes
        setTimeout(() => {
            const modal = document.getElementById(testModalId);
            if (modal) {
                modal.style.setProperty('border', '5px solid red', 'important');
                modal.style.setProperty('background-color', 'rgba(255, 0, 0, 0.3)', 'important');
                console.log('Applied red border for visibility test');
                
                const isVisible = modal.offsetWidth > 0 && modal.offsetHeight > 0;
                console.log(`Test modal visible: ${isVisible}`);
                
                if (isVisible) {
                    console.log('✅ SUCCESS: Test modal is visible!');
                } else {
                    console.log('❌ FAILURE: Test modal is still not visible');
                    console.log('Modal computed styles:', window.getComputedStyle(modal));
                }
            }
        }, 500);
        
    } else {
        console.error('openMapModalForLocation function not available');
    }
    
    console.log('=== Force Show Test Complete ===');
};

// Enhanced form field handling with real-time validation feedback
function initializeFormFieldHandling() {
    // Add event listeners for real-time validation feedback
    document.addEventListener('DOMContentLoaded', function() {
        // Add visual indicators for required fields
        const allSteps = document.querySelectorAll('.form-step');
        allSteps.forEach(step => {
            const requiredFields = step.querySelectorAll('[required]');
            requiredFields.forEach(field => {
                // Add real-time validation on blur
                field.addEventListener('blur', function() {
                    validateFieldRealTime(this);
                });
                
                // Remove error styling on focus
                field.addEventListener('focus', function() {
                    clearFieldError(this);
                });
                
                // Add input validation for specific field types
                if (field.type === 'email') {
                    field.addEventListener('input', function() {
                        validateEmailRealTime(this);
                    });
                }
            });
        });
        
        // Add specific validation for step-specific required fields
        const stepSpecificFields = {
            'primary_feedstock_category': 'Please select a feedstock category',
            'calculated_total': 'Please enter the calculated total emissions',
            'uncertainty_range': 'Please enter the uncertainty range',
            'employee_first_name': 'Please enter the employee first name',
            'employee_gender': 'Please select the employee gender',
            'employee_date_of_birth': 'Please enter the employee date of birth',
            'employee_date_of_joining': 'Please enter the employee date of joining'
        };
        
        Object.keys(stepSpecificFields).forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', function() {
                    validateFieldRealTime(this, stepSpecificFields[fieldId]);
                });
                
                field.addEventListener('focus', function() {
                    clearFieldError(this);
                });
            }
        });
    });
}

function validateFieldRealTime(field, customMessage = null) {
    const value = field.value ? field.value.trim() : '';
    const fieldName = getFieldDisplayName(field);
    
    if (!value && (field.hasAttribute('required') || customMessage)) {
        showFieldError(field, customMessage || `${fieldName} is required`);
        return false;
    } else {
        clearFieldError(field);
        return true;
    }
}

function validateEmailRealTime(field) {
    const value = field.value ? field.value.trim() : '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (value && !emailRegex.test(value)) {
        showFieldError(field, 'Please enter a valid email address');
        return false;
    } else if (value && emailRegex.test(value)) {
        clearFieldError(field);
        return true;
    }
    return true;
}

function showFieldError(field, message) {
    // Style the field
    field.style.borderColor = '#dc3545';
    field.style.backgroundColor = '#fff5f5';
    
    // Remove existing error message
    const existingError = field.parentNode.querySelector('.field-error-message');
    if (existingError) {
        existingError.remove();
    }
    
    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error-message';
    errorDiv.style.cssText = `
        color: #dc3545;
        font-size: 12px;
        margin-top: 4px;
        display: flex;
        align-items: center;
        gap: 4px;
    `;
    errorDiv.innerHTML = `<span style="font-size: 14px;">⚠️</span> ${message}`;
    
    field.parentNode.appendChild(errorDiv);
}

function clearFieldError(field) {
    // Reset field styling
    field.style.borderColor = '#ced4da';
    field.style.backgroundColor = '';
    
    // Remove error message
    const errorMessage = field.parentNode.querySelector('.field-error-message');
    if (errorMessage) {
        errorMessage.remove();
    }
}

function getFieldDisplayName(field) {
    // Try to get the label text
    const label = document.querySelector(`label[for="${field.id}"]`);
    if (label) {
        return label.textContent.replace('*', '').trim();
    }
    
    // Fallback to field name
    return field.name || field.id || 'This field';
}

// Initialize the enhanced form handling
initializeFormFieldHandling();

// Patch: Persist emailVerified and currentStep whenever they are set
function setEmailVerified(value) {
    window.emailVerified = emailVerified = value;
    sessionStorage.setItem('franchise_email_verified', value ? 'true' : 'false');
}
function setCurrentStep(value) {
    // Ensure step is not greater than 4 (our new maximum)
    if (value > 4) {
        console.log('Attempted to set step to', value, 'but maximum is 4, setting to 4');
        value = 4;
    }
    window.currentStep = currentStep = value;
    sessionStorage.setItem('franchise_current_step', String(value));
}
// Patch: Use setEmailVerified and setCurrentStep in relevant places
// In handleEmailVerification success:
// setEmailVerified(true); setCurrentStep(2);
// In nextStep and other places where currentStep is updated, use setCurrentStep(newStep);
