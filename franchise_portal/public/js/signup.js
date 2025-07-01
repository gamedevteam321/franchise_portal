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
    console.log('Initializing form...');
    
    // Check for email verification in URL
    const urlParams = new URLSearchParams(window.location.search);
    const verifyToken = urlParams.get('verify');
    const testMode = urlParams.get('test');
    
    if (testMode === 'true') {
        console.log('TEST MODE: Email verification bypassed');
        emailVerified = true;
        verificationToken = 'test-token';
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
    console.log(`Showing step ${stepNumber}`);
    
    // Hide all steps
    document.querySelectorAll('.form-step').forEach(step => {
        step.style.display = 'none';
        step.classList.remove('active');
    });
    
    // Show current step
    const currentStepElement = document.getElementById(`step${stepNumber}`);
    if (currentStepElement) {
        currentStepElement.style.display = 'block';
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
    }
    
    // Update progress indicator
    updateProgressIndicator();
}

function updateProgressIndicator() {
    for (let i = 1; i <= 5; i++) {
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
    
    console.log('Basic form data collected:', data);
    
    // Special handling for Step 4 - Generation Locations
    if (step === 4) {
        console.log('Processing Step 4 special fields...');
        
        // Handle source_type checkboxes
        const sourceTypeCheckboxes = document.querySelectorAll('input[name="source_type"]:checked');
        if (sourceTypeCheckboxes.length > 0) {
            const selectedValues = Array.from(sourceTypeCheckboxes).map(checkbox => checkbox.value);
            data['source_type'] = selectedValues.join(', ');
            console.log('Source type processed:', data['source_type']);
        } else {
            console.log('No source_type checkboxes selected');
            data['source_type'] = '';
        }
        
        // Handle generation locations - transform dynamic fields to table structure
        const generationLocations = [];
        const container = document.getElementById('generation_locations_container');
        
        console.log('Generation locations container:', container);
        
        if (container) {
            const locationRows = container.querySelectorAll('.generation-location-row');
            console.log('Found location rows:', locationRows.length);
            
            locationRows.forEach((row, index) => {
                console.log(`Processing location row ${index + 1}`);
                
                const addressInput = row.querySelector(`input[name*="generation_location_address"]`);
                const gpsInput = row.querySelector(`input[name*="generation_location_gps"]`);
                
                console.log('Address input:', addressInput);
                console.log('GPS input:', gpsInput);
                
                if (addressInput || gpsInput) {
                    const locationData = {};
                    if (addressInput && addressInput.value.trim()) {
                        locationData.address = addressInput.value.trim();
                        console.log('Address found:', locationData.address);
                    }
                    if (gpsInput && gpsInput.value.trim()) {
                        locationData.gps_coordinates = gpsInput.value.trim();
                        console.log('GPS found:', locationData.gps_coordinates);
                    }
                    
                    // Only add if there's actual data
                    if (locationData.address || locationData.gps_coordinates) {
                        generationLocations.push(locationData);
                        console.log('Added location data:', locationData);
                    }
                }
            });
        } else {
            console.warn('generation_locations_container not found');
        }
        
        // Add the generation locations as proper table data
        if (generationLocations.length > 0) {
            data['generation_locations'] = generationLocations;
            console.log('Final generation_locations data:', data['generation_locations']);
        } else {
            console.warn('No generation locations found to add');
        }
        
        // Remove the individual dynamic field entries since they're now in the table structure
        Object.keys(data).forEach(key => {
            if (key.startsWith('generation_location_address_') || key.startsWith('generation_location_gps_')) {
                console.log('Removing dynamic field:', key);
                delete data[key];
            }
        });
    }
    
    // Special handling for Step 5 - Monitoring & Measurement (for debugging and validation)
    if (step === 5) {
        console.log('Processing Step 5 monitoring & measurement fields...');
        
        // Ensure testing_standards_other is only included if testing_standards_used is "Other"
        const testingStandards = data['testing_standards_used'];
        if (testingStandards !== 'Other') {
            data['testing_standards_other'] = '';
        }
        
        console.log('Step 5 processed data:', data);
    }
    
    console.log('Final step data:', data);
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
    if (currentStep <= 5) {
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
    if (!validateStep(5)) {
        return;
    }
    
    // Show loading
    showLoading(true);
    
    // Collect data from ALL steps (1-5) before submitting
    console.log('=== DEBUG: Submit Application - Collecting ALL Steps Data ===');
    
    const step1Data = getStepData(1);
    const step2Data = getStepData(2);
    const step3Data = getStepData(3);
    const step4Data = getStepData(4);
    const step5Data = getStepData(5);
    
    console.log('Step 1 data:', step1Data);
    console.log('Step 2 data:', step2Data);
    console.log('Step 3 data:', step3Data);
    console.log('Step 4 data:', step4Data);
    console.log('Step 5 data:', step5Data);
    
    // Merge all step data into one object
    const finalData = {
        ...step1Data,
        ...step2Data,
        ...step3Data,
        ...step4Data,
        ...step5Data
    };
    
    console.log('=== DEBUG: Submit Application Complete Data ===');
    console.log('Merged data from all steps:', finalData);
    console.log('Final data keys:', Object.keys(finalData));
    console.log('Final data length:', Object.keys(finalData).length);
    
    // Verify Step 5 fields are present
    const step5FieldNames = ['electricity_meter_id', 'meter_type_model', 'monitoring_interval', 'weighbridge_id', 'testing_laboratory_name'];
    console.log('Step 5 fields verification:');
    step5FieldNames.forEach(field => {
        console.log(`  ${field}: ${finalData[field] || 'MISSING'}`);
    });
    console.log('=== END DEBUG ===');
    
    Object.assign(applicationData, finalData);
    
    // Debug: Log what we're about to send to the API
    console.log('=== FRONTEND SENDING TO API ===');
    console.log('Application data being sent:', applicationData);
    console.log('Application data keys:', Object.keys(applicationData));
    console.log('Step 5 fields in application data:');
    const step5FieldCheck = ['electricity_meter_id', 'meter_type_model', 'monitoring_interval', 'weighbridge_id', 'testing_laboratory_name'];
    step5FieldCheck.forEach(field => {
        console.log(`  ${field}: ${applicationData[field] || 'MISSING'}`);
    });
    console.log('=== END FRONTEND DEBUG ===');
    
    if (emailVerified && verificationToken && verificationToken !== 'test-token') {
        // Use verified session API for final submission (but not for test mode)
        console.log('Using verified API for submission with token:', verificationToken);
        frappe.call({
            method: 'franchise_portal.www.signup.api.save_step_with_verification',
            args: { 
                token: verificationToken,
                data: finalData,
                step: 5
            },
            callback: function(response) {
                showLoading(false);
                console.log('Verified API response:', response);
                
                if (response.message && response.message.success) {
                    showSuccessMessage(response.message.application_id);
                } else {
                    console.error('Verified API error:', response.message);
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
        console.log('Application data being sent:', applicationData);
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
    
    if (paymentType && paymentType !== 'No Feedstock Payment') {
        paymentDetailsGroup.style.display = 'block';
        document.getElementById('payment_details').setAttribute('required', 'required');
    } else {
        paymentDetailsGroup.style.display = 'none';
        document.getElementById('payment_details').removeAttribute('required');
        document.getElementById('payment_details').value = '';
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
};

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
    // Get API key from config (inserted server-side or via template)
    const apiKey = window.GOOGLE_MAPS_API_KEY || '';
    if (!apiKey) {
        document.getElementById(`map_${modalId}`).innerHTML = 'Google Maps API key missing.';
        return;
    }
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
    currentStep = 5;
    showStep(5);
    updateProgressIndicator();
    console.log('Should now be showing Step 5');
};

// Debug function to test complete 5-step flow
window.testComplete5StepFlow = function() {
    console.log('=== DEBUG: Testing Complete 5-Step Data Collection ===');
    
    // Collect data from all steps
    const allData = {};
    
    for (let step = 1; step <= 5; step++) {
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
    const step5Fields = ['electricity_meter_id', 'weighbridge_id', 'testing_laboratory_name', 'automatic_data_upload'];
    
    console.log('=== FIELD COUNT SUMMARY ===');
    console.log('Step 1 fields found:', step1Fields.filter(f => allData[f]).length, '/', step1Fields.length);
    console.log('Step 2 fields found:', step2Fields.filter(f => allData[f]).length, '/', step2Fields.length);
    console.log('Step 3 fields found:', step3Fields.filter(f => allData[f]).length, '/', step3Fields.length);
    console.log('Step 4 fields found:', step4Fields.filter(f => allData[f]).length, '/', step4Fields.length);
    console.log('Step 5 fields found:', step5Fields.filter(f => allData[f]).length, '/', step5Fields.length);
    
    return allData;
};