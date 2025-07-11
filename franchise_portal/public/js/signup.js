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