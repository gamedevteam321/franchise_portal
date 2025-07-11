/**
 * Franchise Portal: User Role Restrictions
 * Simple and reliable approach for hiding unauthorized roles for Franchise Partners
 */

// Global configuration
const ALLOWED_FRANCHISE_ROLES = [
    'Accounts User', 'Accounts Manager', 'Purchase User', 'Sales User',
    'Maintenance User', 'Maintenance Manager',
    'HR User', 'HR Manager', 'Employee', 'Employee Self Service', 'Leave Approver', 'Expense Approver',
    'Stock User', 'Stock Manager', 'Item Manager', 'Quality Manager', 'Material Manager'
];

// Allowed modules for Franchise Partners (only these 4 core modules)
const ALLOWED_FRANCHISE_MODULES = [
    'Accounts',
    'Assets', 
    'HR',
    'Stock'
];

// Check if current user should have restrictions
function shouldApplyFranchiseRestrictions() {
    const isFranchisePartner = frappe.user.has_role('Franchise Partner');
    const isAdministrator = frappe.session.user === 'Administrator';
    
    console.log('=== FRANCHISE RESTRICTION CHECK ===');
    console.log('User:', frappe.session.user);
    console.log('Has Franchise Partner role:', isFranchisePartner);
    console.log('Is Administrator:', isAdministrator);
    console.log('Should apply restrictions:', isFranchisePartner && !isAdministrator);
    
    return isFranchisePartner && !isAdministrator;
}

// Main function to hide unauthorized roles
function applyRoleRestrictions() {
    if (!shouldApplyFranchiseRestrictions()) {
        console.log('❌ No restrictions needed for this user');
        return false;
    }
    
    console.log('🔒 Applying Franchise Partner role restrictions...');
    
    // Method 1: Try grid-based approach
    if (cur_frm && cur_frm.get_field('roles') && cur_frm.get_field('roles').grid) {
        console.log('✅ Using grid-based method');
        return hideRolesUsingGrid();
    }
    
    // Method 2: Try DOM-based approach
    console.log('✅ Using DOM-based method');
    return hideRolesUsingDOM();
}

// Hide roles using Frappe grid structure
function hideRolesUsingGrid() {
    try {
        const rolesField = cur_frm.get_field('roles');
        const grid = rolesField.grid;
        
        console.log('Grid rows found:', grid.grid_rows.length);
        
        let hidden = 0, visible = 0;
        
        grid.grid_rows.forEach((gridRow, index) => {
            if (gridRow.doc && gridRow.doc.role) {
                const roleName = gridRow.doc.role;
                const rowElement = gridRow.row;
                
                console.log(`Row ${index}: ${roleName}`);
                
                if (ALLOWED_FRANCHISE_ROLES.includes(roleName)) {
                    // Show authorized role
                    if (rowElement) {
                        rowElement.style.display = '';
                        rowElement.style.opacity = '1';
                    }
                    visible++;
                    console.log(`  ✅ Visible: ${roleName}`);
                } else {
                    // Hide unauthorized role
                    if (rowElement) {
                        rowElement.style.display = 'none';
                    }
                    hidden++;
                    console.log(`  🚫 Hidden: ${roleName}`);
                }
            }
        });
        
        addStatusMessage('grid', visible, hidden);
        console.log(`✅ Grid method: ${visible} visible, ${hidden} hidden`);
        return true;
        
    } catch (error) {
        console.error('❌ Grid method failed:', error);
        return false;
    }
}

// Hide roles using direct DOM manipulation
function hideRolesUsingDOM() {
    try {
        // Find role rows in the DOM
        const selectors = [
            '[data-fieldname="roles"] .grid-row',
            '.frappe-control[data-fieldname="roles"] .grid-row',
            '.grid-row'
        ];
        
        let roleRows = [];
        let usedSelector = '';
        
        for (const selector of selectors) {
            roleRows = document.querySelectorAll(selector);
            if (roleRows.length > 0) {
                usedSelector = selector;
                break;
            }
        }
        
        console.log(`Found ${roleRows.length} rows using: ${usedSelector}`);
        
        if (roleRows.length === 0) {
            console.log('❌ No role rows found');
            return false;
        }
        
        let hidden = 0, visible = 0;
        
        roleRows.forEach((row, index) => {
            const roleName = extractRoleNameFromRow(row);
            console.log(`DOM Row ${index}: "${roleName}"`);
            
            if (roleName) {
                if (ALLOWED_FRANCHISE_ROLES.includes(roleName)) {
                    // Show authorized role
                    row.style.display = '';
                    row.style.opacity = '1';
                    visible++;
                    console.log(`  ✅ DOM Visible: ${roleName}`);
                } else {
                    // Hide unauthorized role
                    row.style.display = 'none';
                    hidden++;
                    console.log(`  🚫 DOM Hidden: ${roleName}`);
                }
            }
        });
        
        addStatusMessage('dom', visible, hidden);
        console.log(`✅ DOM method: ${visible} visible, ${hidden} hidden`);
        return true;
        
    } catch (error) {
        console.error('❌ DOM method failed:', error);
        return false;
    }
}

// Apply module restrictions by overriding ModuleEditor
function applyModuleRestrictions() {
    if (!shouldApplyFranchiseRestrictions()) {
        return false;
    }
    
    console.log('🔒 Applying Franchise Partner module restrictions...');
    
    // Wait for module editor to be created and override it
    setTimeout(() => {
        if (cur_frm && cur_frm.module_editor && cur_frm.module_editor.multicheck) {
            console.log('✅ Found module editor, applying restrictions...');
            
            // Store original get_data function
            const originalGetData = cur_frm.module_editor.multicheck.df.get_data;
            
            // Override get_data to filter modules
            cur_frm.module_editor.multicheck.df.get_data = () => {
                console.log('🔄 Module editor get_data called with restrictions');
                
                // Get all modules
                const allModules = cur_frm.doc.__onload.all_modules || [];
                console.log('All available modules:', allModules);
                
                // Filter to only allowed modules
                const allowedModules = allModules.filter(module => 
                    ALLOWED_FRANCHISE_MODULES.includes(module)
                );
                console.log('Allowed modules for franchise partner:', allowedModules);
                
                const blockModules = cur_frm.doc.block_modules.map((row) => row.module);
                
                return allowedModules.map((module) => {
                    return {
                        label: __(module),
                        value: module,
                        checked: !blockModules.includes(module),
                    };
                });
            };
            
            // Refresh the module editor to apply changes
            cur_frm.module_editor.show();
            
            addModuleStatusMessage(ALLOWED_FRANCHISE_MODULES.length);
            console.log(`✅ Module restrictions applied. ${ALLOWED_FRANCHISE_MODULES.length} modules available.`);
            return true;
        } else {
            console.log('⚠️  Module editor not found, retrying...');
            // Retry after a longer delay
            setTimeout(() => applyModuleRestrictions(), 2000);
            return false;
        }
    }, 1000);
    
    return true;
}

// Extract role name from a DOM row element
function extractRoleNameFromRow(row) {
    // Try multiple methods to get role name
    const methods = [
        () => row.querySelector('[data-fieldname="role"] input')?.value,
        () => row.querySelector('[data-fieldname="role"] .control-value')?.textContent,
        () => row.querySelector('[data-fieldname="role"]')?.textContent,
        () => row.querySelector('.grid-static-col')?.textContent,
        () => row.getAttribute('data-role')
    ];
    
    for (const method of methods) {
        try {
            const result = method();
            if (result && result.trim()) {
                return result.trim();
            }
        } catch (e) {
            // Continue to next method
        }
    }
    
    return '';
}

// Add status message to the form
function addStatusMessage(method, visible, hidden) {
    try {
        // Remove existing message
        const existing = document.querySelector('.franchise-status-message');
        if (existing) existing.remove();
        
        // Find target container
        let container = document.querySelector('[data-fieldname="roles"]');
        if (!container) container = document.querySelector('.form-section');
        if (!container) return;
        
        // Create message
        const message = document.createElement('div');
        message.className = 'franchise-status-message alert alert-info';
        message.style.margin = '10px 0';
        message.style.padding = '10px';
        message.style.fontSize = '12px';
        message.innerHTML = `
            <strong>🔒 Franchise Partner Role Restrictions Applied</strong><br>
            Method: ${method.toUpperCase()} | Visible: ${visible} | Hidden: ${hidden}<br>
            <small>Only roles from Accounts, Assets, HR/Attendance, and Stock modules can be assigned.</small>
        `;
        
        container.appendChild(message);
        
    } catch (error) {
        console.error('Error adding status message:', error);
    }
}

// Add module status message
function addModuleStatusMessage(allowedCount) {
    try {
        // Remove existing message
        const existing = document.querySelector('.franchise-module-status-message');
        if (existing) existing.remove();
        
        // Find target container  
        let container = document.querySelector('[data-fieldname="modules_html"]');
        if (!container) container = document.querySelector('.form-section');
        if (!container) return;
        
        // Create message
        const message = document.createElement('div');
        message.className = 'franchise-module-status-message alert alert-info';
        message.style.margin = '10px 0';
        message.style.padding = '10px';
        message.style.fontSize = '12px';
        message.innerHTML = `
            <strong>🔒 Franchise Partner Module Restrictions Applied</strong><br>
            Available modules: ${allowedCount} (${ALLOWED_FRANCHISE_MODULES.join(', ')})<br>
            <small>Only core business modules can be assigned to users.</small>
        `;
        
        container.appendChild(message);
        
    } catch (error) {
        console.error('Error adding module status message:', error);
    }
}

// Frappe form events
frappe.ui.form.on('User', {
    refresh: function(frm) {
        if (shouldApplyFranchiseRestrictions()) {
            console.log('🔄 User form refreshed - applying restrictions...');
            
            // Set query filter for role dropdown
            frm.set_query('role', 'roles', function() {
                return {
                    filters: {
                        name: ['in', ALLOWED_FRANCHISE_ROLES]
                    }
                };
            });
            
            // Set query filter for module profile dropdown
            frm.set_query('module_profile', function() {
                return {
                    query: 'franchise_portal.franchise_management.get_allowed_module_profiles',
                    filters: {
                        allowed_modules: ALLOWED_FRANCHISE_MODULES
                    }
                };
            });
            
            // Apply visual restrictions with multiple attempts
            setTimeout(() => applyRoleRestrictions(), 500);
            setTimeout(() => applyRoleRestrictions(), 1500);
            setTimeout(() => applyRoleRestrictions(), 3000);
            
            // Apply module restrictions
            setTimeout(() => applyModuleRestrictions(), 800);
            setTimeout(() => applyModuleRestrictions(), 2000);
            
            // Add manual trigger button
            if (!frm.doc.__islocal) {
                frm.add_custom_button('🔧 Apply Role Restrictions', function() {
                    const roleSuccess = applyRoleRestrictions();
                    const moduleSuccess = applyModuleRestrictions();
                    frappe.msgprint({
                        title: (roleSuccess || moduleSuccess) ? 'Success' : 'Failed',
                        message: roleSuccess && moduleSuccess ? 
                            'Role and module restrictions applied successfully!' : 
                            'Some restrictions may not have been applied. Check console for details.',
                        indicator: (roleSuccess || moduleSuccess) ? 'green' : 'red'
                    });
                }, 'Actions');
            }
            
            // Add help button
            frm.add_custom_button('ℹ️ Franchise Restrictions Info', function() {
                frappe.msgprint({
                    title: 'Franchise Partner Restrictions',
                    message: `
                        <p>As a Franchise Partner, you can only assign:</p>
                        <h5>🔐 Roles from these modules:</h5>
                        <ul>
                            <li><strong>Accounts:</strong> Accounts User/Manager, Purchase User, Sales User</li>
                            <li><strong>Assets:</strong> Maintenance User/Manager</li>
                            <li><strong>HR:</strong> HR User/Manager, Employee, Employee Self Service, Leave/Expense Approver</li>
                            <li><strong>Stock:</strong> Stock User/Manager, Item Manager, Quality Manager, Material Manager</li>
                        </ul>
                        <h5>📦 Modules:</h5>
                        <ul>
                            <li>Accounts, Assets, HR, Stock only</li>
                        </ul>
                        <p><small>Contact your System Administrator for other roles or modules.</small></p>
                    `,
                    indicator: 'blue'
                });
            }, 'Help');
        }
    },
    
    before_save: function(frm) {
        if (shouldApplyFranchiseRestrictions()) {
            // Validate roles before saving
            const unauthorizedRoles = [];
            
            (frm.doc.roles || []).forEach(function(roleRow) {
                if (roleRow.role && !ALLOWED_FRANCHISE_ROLES.includes(roleRow.role)) {
                    unauthorizedRoles.push(roleRow.role);
                }
            });
            
            // Validate modules before saving
            const unauthorizedModules = [];
            
            (frm.doc.block_modules || []).forEach(function(moduleRow) {
                if (moduleRow.module && !ALLOWED_FRANCHISE_MODULES.includes(moduleRow.module)) {
                    // If there's a blocked module that's not in allowed list, 
                    // it means the user is trying to enable an unauthorized module
                    // (since block_modules contains modules to BLOCK, not to allow)
                }
            });
            
            // Check if any unauthorized modules are enabled (not in block list)
            if (frm.doc.__onload && frm.doc.__onload.all_modules) {
                const allModules = frm.doc.__onload.all_modules;
                const blockedModules = (frm.doc.block_modules || []).map(row => row.module);
                const enabledModules = allModules.filter(module => !blockedModules.includes(module));
                
                enabledModules.forEach(function(module) {
                    if (!ALLOWED_FRANCHISE_MODULES.includes(module)) {
                        unauthorizedModules.push(module);
                    }
                });
            }
            
            if (unauthorizedRoles.length > 0 || unauthorizedModules.length > 0) {
                frappe.validated = false;
                let errorMessage = '';
                
                if (unauthorizedRoles.length > 0) {
                    errorMessage += `<strong>Unauthorized Roles:</strong> ${unauthorizedRoles.join(', ')}<br><br>`;
                }
                
                if (unauthorizedModules.length > 0) {
                    errorMessage += `<strong>Unauthorized Modules:</strong> ${unauthorizedModules.join(', ')}<br><br>`;
                }
                
                frappe.msgprint({
                    title: 'Unauthorized Assignment Detected',
                    message: errorMessage + 'Please remove these before saving.',
                    indicator: 'red'
                });
                return false;
            }
        }
    }
});

// Child table validation
frappe.ui.form.on('Has Role', {
    role: function(frm, cdt, cdn) {
        if (shouldApplyFranchiseRestrictions()) {
            const row = locals[cdt][cdn];
            if (row.role && !ALLOWED_FRANCHISE_ROLES.includes(row.role)) {
                frappe.msgprint({
                    title: 'Role Not Allowed',
                    message: `You cannot assign the role "${row.role}" as a Franchise Partner.`,
                    indicator: 'red'
                });
                frappe.model.set_value(cdt, cdn, 'role', '');
            }
        }
    }
});

// Global functions for testing
window.testFranchiseRestrictions = function() {
    console.log('🧪 Manual test triggered');
    const roleSuccess = applyRoleRestrictions();
    const moduleSuccess = applyModuleRestrictions();
    return { roles: roleSuccess, modules: moduleSuccess };
};

window.getFranchiseStatus = function() {
    return {
        shouldApply: shouldApplyFranchiseRestrictions(),
        allowedRoles: ALLOWED_FRANCHISE_ROLES,
        allowedModules: ALLOWED_FRANCHISE_MODULES,
        user: frappe.session.user,
        hasRole: frappe.user.has_role('Franchise Partner')
    };
};

console.log('✅ Franchise Portal: Role and module restrictions loaded'); 