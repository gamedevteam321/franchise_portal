import frappe

@frappe.whitelist()
def get_assignable_roles():
    """
    Returns a list of roles that the 'Franchise Partner' can assign.
    Only specific roles are allowed for Franchise Partners to delegate.
    Administrator accounts are never restricted.
    """
    if "Franchise Partner" in frappe.get_roles() and frappe.session.user != "Administrator":
        # Return only the specific roles that Franchise Partners can assign
        return [
            # Accounts Module
            "Accounts User",
            "Accounts Manager",
            "Purchase User",
            "Sales User",
            
            # Assets Module
            "Maintenance User", 
            "Maintenance Manager",
            
            # HR & Attendance Module
            "HR User",
            "HR Manager",
            "Employee",
            "Employee Self Service",
            "Leave Approver",
            "Expense Approver",
            
            # Stock Module
            "Stock User",
            "Stock Manager", 
            "Item Manager",
            "Quality Manager",
            "Material Manager"
        ]
    else:
        # Return all roles for other users like System Manager
        return [role.name for role in frappe.get_all("Role")]

@frappe.whitelist()
def get_franchise_assignable_roles_filters():
    """
    Returns filters for roles that Franchise Partners can assign.
    This is used by the client script to filter the role dropdown.
    Administrator accounts are never restricted.
    """
    if "Franchise Partner" in frappe.get_roles() and frappe.session.user != "Administrator":
        # Return only the specific roles that Franchise Partners can assign
        allowed_roles = [
            # Accounts Module
            "Accounts User",
            "Accounts Manager", 
            "Purchase User",
            "Sales User",
            
            # Assets Module
            "Maintenance User",
            "Maintenance Manager",
            
            # HR & Attendance Module
            "HR User",
            "HR Manager",
            "Employee",
            "Employee Self Service", 
            "Leave Approver",
            "Expense Approver",
            
            # Stock Module
            "Stock User",
            "Stock Manager",
            "Item Manager", 
            "Quality Manager",
            "Material Manager"
        ]
        return {
            "name": ["in", allowed_roles]
        }
    else:
        # No filter for other users - they can see all roles
        return {}

@frappe.whitelist()
def get_allowed_module_profiles(doctype, txt, searchfield, start, page_len, filters):
    """
    Returns Module Profiles that only contain modules allowed for Franchise Partners.
    For Franchise Partners, only shows profiles that restrict access to unauthorized modules.
    Administrator accounts are never restricted.
    """
    if "Franchise Partner" in frappe.get_roles() and frappe.session.user != "Administrator":
        # Allowed modules for Franchise Partners
        allowed_modules = ["Accounts", "Assets", "HR", "Stock"]
        
        # Get all modules in the system
        all_modules = [module.name for module in frappe.get_all("Module Def", fields=["name"])]
        
        # Calculate which modules should be blocked (all modules except allowed ones)
        modules_to_block = [module for module in all_modules if module not in allowed_modules]
        
        # Find Module Profiles that block all unauthorized modules
        # A valid profile for franchise partners should block all non-allowed modules
        
        conditions = []
        values = []
        
        if txt:
            conditions.append("mp.module_profile_name LIKE %s")
            values.append(f"%{txt}%")
        
        # Build the query to find profiles that contain all required blocked modules
        query = f"""
            SELECT DISTINCT mp.name, mp.module_profile_name
            FROM `tabModule Profile` mp
            WHERE mp.name NOT IN (
                SELECT mp2.name 
                FROM `tabModule Profile` mp2
                LEFT JOIN `tabBlock Module` bm ON bm.parent = mp2.name
                WHERE bm.module NOT IN ({','.join(['%s'] * len(modules_to_block))})
                OR bm.module IS NULL
            )
        """
        
        if conditions:
            query += " AND " + " AND ".join(conditions)
        
        query += f" ORDER BY mp.module_profile_name LIMIT {start}, {page_len}"
        
        # Add the modules_to_block to values
        values = modules_to_block + values
        
        return frappe.db.sql(query, values, as_dict=True)
    
    else:
        # For non-franchise partners, return all module profiles
        conditions = []
        values = []
        
        if txt:
            conditions.append("module_profile_name LIKE %s")
            values.append(f"%{txt}%")
        
        where_clause = ""
        if conditions:
            where_clause = "WHERE " + " AND ".join(conditions)
        
        query = f"""
            SELECT name, module_profile_name
            FROM `tabModule Profile`
            {where_clause}
            ORDER BY module_profile_name
            LIMIT {start}, {page_len}
        """
        
        return frappe.db.sql(query, values, as_dict=True) 