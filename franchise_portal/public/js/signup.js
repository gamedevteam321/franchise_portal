// Franchise Portal Signup JavaScript
// Version: 2.0 - Email Verification Workflow

let currentStep = 1;
let applicationData = {};
let applicationId = null;
let verificationToken = null;
let emailVerified = false;

// Initialize the form when page loads
if (typeof frappe !== 'undefined' && frappe.ready) {
    frappe.ready(() => {
        console.log('Franchise signup form loaded via frappe.ready - Version 2.0 Email Verification');
        initializeForm();
    });
} else {
    // Fallback if frappe is not available
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Franchise signup form loaded via DOMContentLoaded - Version 2.0 Email Verification');
        initializeForm();
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
    // Check for verification token in URL
    const urlParams = new URLSearchParams(window.location.search);
    const verifyToken = urlParams.get('verify');
    const testMode = urlParams.get('test') === 'true'; // Add ?test=true to bypass verification
    
    if (testMode) {
        console.log('TEST MODE: Email verification bypassed');
        emailVerified = true;
        verificationToken = 'test-token';
    }
    
    if (verifyToken) {
        handleEmailVerification(verifyToken);
    } else {
        // Set default values
        currentStep = 1;
        updateProgressIndicator();
    }
    
    // Add input listeners for auto-save
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        input.addEventListener('blur', autoSaveStep);
    });
}

function handleEmailVerification(token) {
    console.log('Handling email verification for token:', token);
    
    frappe.call({
        method: 'franchise_portal.www.signup.api.verify_email',
        args: { token: token },
        callback: function(response) {
            console.log('Verification response:', response);
            
            if (response.message && response.message.success) {
                verificationToken = token;
                emailVerified = true;
                
                const sessionData = response.message.session_data;
                currentStep = sessionData.current_step + 1; // Move to next unfilled step
                applicationData = sessionData.data;
                
                // Populate form with saved data
                populateFormData(applicationData);
                
                // Show current step
                showStep(currentStep);
                updateProgressIndicator();
                
                // Show success message
                frappe.msgprint({
                    title: 'Email Verified',
                    message: 'Your email has been verified successfully! You can continue your application.',
                    indicator: 'green'
                });
                
                // Clean URL
                history.replaceState({}, '', '/signup');
                
            } else {
                frappe.msgprint({
                    title: 'Verification Failed',
                    message: response.message?.message || 'Invalid or expired verification link.',
                    indicator: 'red'
                });
                
                // Fallback to step 1
                currentStep = 1;
                updateProgressIndicator();
            }
        },
        error: function(error) {
            console.error('Verification error:', error);
            frappe.msgprint({
                title: 'Verification Error',
                message: 'Failed to verify email. Please try again.',
                indicator: 'red'
            });
            
            // Fallback to step 1
            currentStep = 1;
            updateProgressIndicator();
        }
    });
}

function nextStep(step) {
    console.log(`Next step clicked for step ${step}`);
    console.log(`Current emailVerified status: ${emailVerified}`);
    console.log(`Current verificationToken: ${verificationToken}`);
    
    // Debug: Check if validation passes
    const isValid = validateStep(step);
    console.log(`Validation result: ${isValid}`);
    
    if (isValid) {
        // Force email verification for step 1 (unless already verified)
        if (step === 1 && !emailVerified) {
            console.log('Step 1 completed, FORCING verification email workflow...');
            sendVerificationEmail(step);
            return; // Stop here, don't proceed to saveStepData
        }
        
        // For verified users or steps 2+
        console.log('Validation passed, saving step data...');
        saveStepData(step, () => {
            console.log('Step data saved successfully, moving to next step');
            currentStep = step + 1;
            showStep(currentStep);
            updateProgressIndicator();
        });
    } else {
        console.log('Validation failed, staying on current step');
    }
}

// Make available globally immediately
window.nextStep = nextStep;

function previousStep(step) {
    currentStep = step - 1;
    showStep(currentStep);
    updateProgressIndicator();
}

// Make available globally immediately
window.previousStep = previousStep;

function showStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(form => {
        form.classList.remove('active');
    });
    
    // Show current step
    const currentForm = document.getElementById(`step${stepNumber}`);
    if (currentForm) {
        currentForm.classList.add('active');
    }
}

function updateProgressIndicator() {
    for (let i = 1; i <= 3; i++) {
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
    
    const requiredFields = form.querySelectorAll('[required]');
    console.log(`Found ${requiredFields.length} required fields`);
    
    let isValid = true;
    let missingFields = [];
    
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
    
    if (!isValid) {
        console.log(`Validation failed. Missing fields: ${missingFields.join(', ')}`);
        
        // Show alert instead of frappe.msgprint in case frappe is not loaded
        if (typeof frappe !== 'undefined' && frappe.msgprint) {
            frappe.msgprint({
                title: 'Validation Error',
                message: `Please fill in the following required fields: ${missingFields.join(', ')}`,
                indicator: 'red'
            });
        } else {
            alert(`Please fill in the following required fields: ${missingFields.join(', ')}`);
        }
    } else {
        console.log('All validation checks passed');
    }
    
    return isValid;
}

function getStepData(step) {
    const form = document.getElementById(`step${step}`);
    const formData = new FormData(form);
    const data = {};
    
    for (let [key, value] of formData.entries()) {
        data[key] = value;
    }
    
    return data;
}

function sendVerificationEmail(step) {
    const stepData = getStepData(step);
    
    // Store data locally
    Object.assign(applicationData, stepData);
    
    console.log('Sending verification email for:', stepData);
    
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
                verificationToken = response.message.verification_token;
                
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

function saveStepData(step, callback) {
    const stepData = getStepData(step);
    
    // Store data locally
    Object.assign(applicationData, stepData);
    
    // Always include email and company_name from stored data for all steps
    if (applicationData.email) {
        stepData.email = applicationData.email;
    }
    if (applicationData.company_name) {
        stepData.company_name = applicationData.company_name;
    }
    
    console.log('Saving step data:', stepData);
    
    if (emailVerified && verificationToken && verificationToken !== 'test-token') {
        // Use verified session API (but not for test mode)
        frappe.call({
            method: 'franchise_portal.www.signup.api.save_step_with_verification',
            args: { 
                token: verificationToken,
                data: stepData,
                step: step
            },
            callback: function(response) {
                console.log('Verified API Response:', response);
                if (response.message && response.message.success) {
                    if (response.message.application_id) {
                        applicationId = response.message.application_id;
                    }
                    if (callback) callback();
                } else {
                    const errorMessage = response.message?.message || 'Failed to save step data. Please try again.';
                    console.error('Verified API Error - Full details:');
                    console.error('Response:', response);
                    console.error('Response message:', response.message);
                    console.error('Error message:', errorMessage);
                    console.error('Full response object:', JSON.stringify(response, null, 2));
                    frappe.msgprint({
                        title: 'Error',
                        message: errorMessage,
                        indicator: 'red'
                    });
                }
            },
            error: function(xhr, textStatus, errorThrown) {
                console.error('Network Error saving verified step - Full details:');
                console.error('XHR:', xhr);
                console.error('XHR status:', xhr.status);
                console.error('XHR responseText:', xhr.responseText);
                console.error('XHR responseJSON:', xhr.responseJSON);
                console.error('Text Status:', textStatus);
                console.error('Error Thrown:', errorThrown);
                frappe.msgprint({
                    title: 'Network Error',
                    message: 'Failed to save step data. Please check your connection and try again.',
                    indicator: 'red'
                });
            }
        });
    } else {
        // Fallback to original API (for test mode or non-verified users)
        console.log('Using fallback original API (test mode or non-verified)');
        frappe.call({
            method: 'franchise_portal.www.signup.api.save_step',
            args: { 
                data: stepData 
            },
            callback: function(response) {
                console.log('Fallback API Response:', response);
                if (response.message && response.message.success) {
                    if (response.message.application_id) {
                        applicationId = response.message.application_id;
                    }
                    if (callback) callback();
                } else {
                    const errorMessage = response.message?.message || 'Failed to save step data. Please try again.';
                    console.error('Fallback API Error:', response);
                    console.error('Full fallback error response:', JSON.stringify(response, null, 2));
                    frappe.msgprint({
                        title: 'Error',
                        message: errorMessage,
                        indicator: 'red'
                    });
                }
            },
            error: function(error) {
                console.error('Network Error saving step:', error);
                frappe.msgprint({
                    title: 'Network Error',
                    message: 'Failed to save step data. Please check your connection and try again.',
                    indicator: 'red'
                });
            }
        });
    }
}

function autoSaveStep() {
    if (currentStep <= 3) {
        const stepData = getStepData(currentStep);
        Object.assign(applicationData, stepData);
        
        // Auto-save without showing loading
        frappe.call({
            method: 'franchise_portal.www.signup.api.save_step',
            args: { data: stepData },
            no_spinner: true
        });
    }
}

function submitApplication() {
    if (!validateStep(3)) {
        return;
    }
    
    // Show loading
    showLoading(true);
    
    // Get final step data
    const finalData = getStepData(3);
    Object.assign(applicationData, finalData);
    
    if (emailVerified && verificationToken && verificationToken !== 'test-token') {
        // Use verified session API for final submission (but not for test mode)
        frappe.call({
            method: 'franchise_portal.www.signup.api.save_step_with_verification',
            args: { 
                token: verificationToken,
                data: finalData,
                step: 3
            },
            callback: function(response) {
                showLoading(false);
                
                if (response.message && response.message.success) {
                    showSuccessMessage(response.message.application_id);
                } else {
                    frappe.msgprint({
                        title: 'Submission Error',
                        message: response.message?.message || 'Failed to submit application. Please try again.',
                        indicator: 'red'
                    });
                }
            },
            error: function(error) {
                showLoading(false);
                console.error('Error submitting verified application:', error);
                frappe.msgprint({
                    title: 'Submission Error',
                    message: 'Failed to submit application. Please try again.',
                    indicator: 'red'
                });
            }
        });
    } else {
        // Fallback to original API (for test mode or non-verified users)
        console.log('Using fallback submit API (test mode or non-verified)');
        frappe.call({
            method: 'franchise_portal.www.signup.api.submit_application',
            args: { 
                email: applicationData.email,
                data: applicationData
            },
            callback: function(response) {
                showLoading(false);
                console.log('Fallback submit response:', response);
                
                if (response.message && response.message.success) {
                    showSuccessMessage(response.message.application_id);
                } else {
                    console.error('Fallback submit error:', JSON.stringify(response, null, 2));
                    frappe.msgprint({
                        title: 'Submission Error',
                        message: response.message?.message || 'Failed to submit application. Please try again.',
                        indicator: 'red'
                    });
                }
            },
            error: function(error) {
                showLoading(false);
                console.error('Error submitting application:', error);
                frappe.msgprint({
                    title: 'Submission Error',
                    message: 'Failed to submit application. Please try again.',
                    indicator: 'red'
                });
            }
        });
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
}

// Utility function to populate form if returning user
function populateFormData(data) {
    Object.keys(data).forEach(key => {
        const field = document.getElementById(key);
        if (field) {
            field.value = data[key] || '';
        }
    });
}

// Export functions for global access
window.nextStep = nextStep;
window.previousStep = previousStep;
window.submitApplication = submitApplication;
window.testNextStep = testNextStep; 