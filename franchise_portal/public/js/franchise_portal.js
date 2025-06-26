// Franchise Portal - Main JavaScript file

// Initialize when frappe is ready
frappe.ready(() => {
    console.log('Franchise Portal loaded');
});

// Utility functions for franchise portal
window.franchise_portal = {
    // Version info
    version: '1.0.0',
    
    // Common utility functions
    utils: {
        formatApplicationId: function(id) {
            return id ? id.toUpperCase() : '';
        },
        
        validateEmail: function(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        },
        
        formatPhoneNumber: function(phone) {
            // Basic phone number formatting
            return phone ? phone.replace(/\D/g, '') : '';
        }
    }
}; 