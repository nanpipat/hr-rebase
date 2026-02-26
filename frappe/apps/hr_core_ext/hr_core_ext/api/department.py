import frappe


@frappe.whitelist(allow_guest=False)
def get_departments(company=None):
    """Get list of departments with employee counts."""
    filters = {}
    if company:
        filters["company"] = company

    departments = frappe.get_list(
        "Department",
        filters=filters,
        fields=["name", "department_name", "parent_department", "company", "is_group"],
        limit_page_length=0,
        order_by="department_name asc",
    )

    # Fetch employee counts per department
    emp_counts = {}
    emp_filter = {"status": "Active"}
    if company:
        emp_filter["company"] = company

    employees = frappe.get_list(
        "Employee",
        filters=emp_filter,
        fields=["department"],
        limit_page_length=0,
    )
    for emp in employees:
        dept = emp.get("department") or ""
        if dept:
            emp_counts[dept] = emp_counts.get(dept, 0) + 1

    result = []
    for dept in departments:
        result.append({
            "name": dept.name,
            "department_name": dept.department_name,
            "parent_department": dept.parent_department or "",
            "company": dept.company or "",
            "is_group": dept.is_group or 0,
            "employee_count": emp_counts.get(dept.name, 0),
        })

    return {"departments": result, "total": len(result)}


@frappe.whitelist(allow_guest=False)
def get_department(name):
    """Get a single department with its employee list."""
    dept = frappe.get_doc("Department", name)

    # Get all employees in this department
    employees = frappe.get_list(
        "Employee",
        filters={"department": name, "status": "Active"},
        fields=["name", "employee_name", "designation", "image", "status"],
        limit_page_length=0,
        order_by="employee_name asc",
    )
    emp_list = []
    for emp in employees:
        emp_list.append({
            "employee_id": emp.name,
            "employee_name": emp.employee_name,
            "designation": emp.designation or "",
            "image": emp.image or "",
            "status": emp.status or "",
        })

    return {
        "department": {
            "name": dept.name,
            "department_name": dept.department_name,
            "parent_department": dept.parent_department or "",
            "company": dept.company or "",
            "is_group": dept.is_group or 0,
        },
        "employees": emp_list,
    }


@frappe.whitelist(allow_guest=False)
def create_department(department_name, parent_department=None, company=None):
    """Create a new Department."""
    doc = frappe.new_doc("Department")
    doc.department_name = department_name
    if parent_department:
        doc.parent_department = parent_department
    if company:
        doc.company = company
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "department_name": doc.department_name}


@frappe.whitelist(allow_guest=False)
def update_department(name, department_name=None, parent_department=None):
    """Update an existing Department."""
    doc = frappe.get_doc("Department", name)
    if department_name:
        doc.department_name = department_name
    if parent_department is not None:
        doc.parent_department = parent_department if parent_department else None
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {
        "name": doc.name,
        "department_name": doc.department_name,
        "parent_department": doc.parent_department or "",
    }


@frappe.whitelist(allow_guest=False)
def delete_department(name):
    """Delete a Department."""
    # Check if any active employees are assigned
    count = frappe.db.count("Employee", {"department": name, "status": "Active"})
    if count > 0:
        frappe.throw(f"Cannot delete department with {count} active employee(s).")
    frappe.delete_doc("Department", name, ignore_permissions=True)
    frappe.db.commit()
    return {"message": "Department deleted"}
