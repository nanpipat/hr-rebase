import frappe


@frappe.whitelist(allow_guest=False)
def create_company(company_name, abbr, country="Thailand"):
    """Create a new company in Frappe."""
    if frappe.db.exists("Company", company_name):
        return {"name": company_name}

    company = frappe.get_doc({
        "doctype": "Company",
        "company_name": company_name,
        "abbr": abbr,
        "country": country,
        "default_currency": "THB",
    })
    company.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": company.name}


@frappe.whitelist(allow_guest=False)
def create_employee(employee_name, company, gender=None, date_of_birth=None, date_of_joining=None, **kwargs):
    """Create a new employee in Frappe."""
    # Split employee_name into first_name (required by Frappe Employee)
    name_parts = employee_name.strip().split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""

    # Ensure gender exists, default to "Other" if not specified
    if not gender or not frappe.db.exists("Gender", gender):
        # Try common defaults
        for g in ["Other", "Male", "Prefer not to say"]:
            if frappe.db.exists("Gender", g):
                gender = g
                break
        else:
            # Create "Other" if no gender exists at all
            frappe.get_doc({"doctype": "Gender", "gender": "Other"}).insert(ignore_permissions=True)
            gender = "Other"

    employee_data = {
        "doctype": "Employee",
        "first_name": first_name,
        "last_name": last_name,
        "employee_name": employee_name,
        "company": company,
        "gender": gender,
        "date_of_birth": date_of_birth or "1990-01-01",
        "date_of_joining": date_of_joining or frappe.utils.nowdate(),
    }
    doc = frappe.get_doc(employee_data)
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    # Auto-allocate leaves for the new employee
    try:
        allocate_leaves_for_employee(doc.name)
    except Exception:
        pass  # Don't fail employee creation if allocation fails

    return {"employee_id": doc.name, "name": doc.name}


def allocate_leaves_for_employee(employee_id):
    """Create leave allocations for an employee for the current year."""
    import datetime
    yr = datetime.date.today().year
    year_start = f"{yr}-01-01"
    year_end = f"{yr}-12-31"

    # Thai labor law defaults
    leave_types = {
        "Annual Leave": 12,
        "Sick Leave": 30,
        "Personal Leave": 6,
    }

    for lt_name, days in leave_types.items():
        if not frappe.db.exists("Leave Type", lt_name):
            continue

        # Respect max_leaves_allowed on the Leave Type (update if needed)
        lt_doc = frappe.get_doc("Leave Type", lt_name)
        if lt_doc.max_leaves_allowed and lt_doc.max_leaves_allowed < days:
            lt_doc.max_leaves_allowed = days
            lt_doc.save(ignore_permissions=True)

        # Check if allocation already exists for this employee+type+period
        existing = frappe.db.exists("Leave Allocation", {
            "employee": employee_id,
            "leave_type": lt_name,
            "from_date": year_start,
            "to_date": year_end,
            "docstatus": ["!=", 2],  # not cancelled
        })
        if existing:
            continue

        alloc = frappe.get_doc({
            "doctype": "Leave Allocation",
            "employee": employee_id,
            "leave_type": lt_name,
            "from_date": year_start,
            "to_date": year_end,
            "new_leaves_allocated": days,
        })
        alloc.insert(ignore_permissions=True)
        alloc.submit()

    frappe.db.commit()


@frappe.whitelist(allow_guest=False)
def ensure_leave_allocations(employee_id):
    """API endpoint to create leave allocations for an employee if missing."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found")

    allocate_leaves_for_employee(employee_id)
    return {"status": "ok", "employee_id": employee_id}
