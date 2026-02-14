import frappe


@frappe.whitelist(allow_guest=False)
def get_employees(company=None, employee_id=None, filters=None, limit_page_length=20, limit_start=0):
    """Get list of employees with basic fields."""
    f = filters or {}
    if company:
        f["company"] = company
    if employee_id:
        f["name"] = employee_id

    employees = frappe.get_list(
        "Employee",
        fields=[
            "name",
            "employee_name",
            "department",
            "designation",
            "status",
            "company",
            "date_of_joining",
            "image",
        ],
        filters=f,
        limit_page_length=int(limit_page_length),
        limit_start=int(limit_start),
        order_by="employee_name asc",
    )
    # Map 'name' to 'employee_id' for frontend consistency
    for emp in employees:
        emp["employee_id"] = emp["name"]
    return employees


@frappe.whitelist(allow_guest=False)
def get_employee(employee_id):
    """Get single employee detail."""
    employee = frappe.get_doc("Employee", employee_id)
    return {
        "employee_id": employee.name,
        "employee_name": employee.employee_name,
        "department": employee.department,
        "designation": employee.designation,
        "status": employee.status,
        "company": employee.company,
        "date_of_joining": str(employee.date_of_joining) if employee.date_of_joining else None,
        "date_of_birth": str(employee.date_of_birth) if employee.date_of_birth else None,
        "gender": employee.gender,
        "cell_phone": employee.cell_number,
        "personal_email": employee.personal_email,
        "company_email": employee.company_email,
        "image": employee.image,
    }


@frappe.whitelist(allow_guest=False)
def get_employee_full(employee_id):
    """Get full employee profile with all fields for the tab-based view."""
    employee = frappe.get_doc("Employee", employee_id)

    # Get reporting manager info
    reports_to_name = None
    reports_to_employee_name = None
    if employee.reports_to:
        mgr = frappe.get_value("Employee", employee.reports_to,
                               ["name", "employee_name"], as_dict=True)
        if mgr:
            reports_to_name = mgr.name
            reports_to_employee_name = mgr.employee_name

    # Get leave approver info
    leave_approver = employee.leave_approver or None
    leave_approver_name = None
    if leave_approver:
        leave_approver_name = frappe.get_value("Employee",
                                               {"user_id": leave_approver}, "employee_name")

    return {
        # Basic
        "employee_id": employee.name,
        "employee_name": employee.employee_name,
        "name": employee.name,
        "status": employee.status,
        "company": employee.company,
        "image": employee.image,
        # Personal
        "date_of_birth": str(employee.date_of_birth) if employee.date_of_birth else None,
        "gender": employee.gender,
        "marital_status": employee.marital_status,
        "blood_group": employee.blood_group,
        # Contact
        "cell_phone": employee.cell_number,
        "personal_email": employee.personal_email,
        "company_email": employee.company_email,
        "current_address": employee.current_address,
        "permanent_address": employee.permanent_address,
        # Emergency
        "emergency_phone": employee.emergency_phone_number,
        "person_to_be_contacted": employee.person_to_be_contacted,
        "relation": employee.relation,
        # Employment
        "department": employee.department,
        "designation": employee.designation,
        "employment_type": getattr(employee, "employment_type", None),
        "date_of_joining": str(employee.date_of_joining) if employee.date_of_joining else None,
        "date_of_retirement": str(employee.date_of_retirement) if employee.date_of_retirement else None,
        "branch": getattr(employee, "branch", None),
        # Reporting
        "reports_to": reports_to_name,
        "reports_to_name": reports_to_employee_name,
        "leave_approver": leave_approver,
        "leave_approver_name": leave_approver_name,
        # Meta
        "created": str(employee.creation) if employee.creation else None,
        "modified": str(employee.modified) if employee.modified else None,
    }


@frappe.whitelist(allow_guest=False)
def update_employee(employee_id, **kwargs):
    """Update employee fields. Only specified fields are changed."""
    employee = frappe.get_doc("Employee", employee_id)

    # Map frontend field names to Frappe field names
    field_map = {"cell_phone": "cell_number"}
    mapped = {}
    for k, v in kwargs.items():
        mapped[field_map.get(k, k)] = v

    # Prevent editing non-active employees (except status change itself)
    non_status_changes = {k: v for k, v in mapped.items() if k != "status" and v is not None}
    if employee.status != "Active" and non_status_changes:
        frappe.throw(f"Cannot edit employee with status '{employee.status}'. Change status to Active first.")

    allowed_fields = [
        "employee_name", "department", "designation", "employment_type",
        "branch", "reports_to", "leave_approver", "status",
        "cell_number", "personal_email", "company_email",
        "current_address", "permanent_address",
        "emergency_phone_number", "person_to_be_contacted", "relation",
        "date_of_birth", "gender", "marital_status", "blood_group",
    ]

    for field in allowed_fields:
        if field in mapped and mapped[field] is not None:
            # For reports_to, convert employee_id to Frappe name
            if field == "reports_to" and mapped[field]:
                if not frappe.db.exists("Employee", mapped[field]):
                    frappe.throw(f"Manager {mapped[field]} not found")
                employee.reports_to = mapped[field]
            else:
                setattr(employee, field, mapped[field])

    employee.save(ignore_permissions=True)
    frappe.db.commit()
    return {"employee_id": employee.name, "status": "updated"}


@frappe.whitelist(allow_guest=False)
def validate_manager(employee_id, manager_id):
    """Check if assigning manager_id as manager of employee_id would create a circular chain."""
    if employee_id == manager_id:
        return {"valid": False, "reason": "Employee cannot be their own manager"}

    # Walk up the reporting chain from manager_id
    visited = {employee_id}
    current = manager_id
    max_depth = 20

    for _ in range(max_depth):
        if not current:
            break
        if current in visited:
            return {"valid": False, "reason": "Circular reporting chain detected"}
        visited.add(current)

        # Get the manager's manager
        if not frappe.db.exists("Employee", current):
            break
        reports_to = frappe.get_value("Employee", current, "reports_to")
        if not reports_to:
            break
        current = reports_to

    return {"valid": True}


@frappe.whitelist(allow_guest=False)
def update_employee_contact(employee_id, **kwargs):
    """Update limited contact fields. Intended for employee self-edit."""
    employee = frappe.get_doc("Employee", employee_id)

    # Map frontend field names to Frappe field names
    field_map = {"cell_phone": "cell_number"}
    mapped = {}
    for k, v in kwargs.items():
        mapped[field_map.get(k, k)] = v

    self_edit_fields = [
        "cell_number", "personal_email",
        "current_address", "permanent_address",
        "emergency_phone_number", "person_to_be_contacted", "relation",
    ]

    for field in self_edit_fields:
        if field in mapped and mapped[field] is not None:
            setattr(employee, field, mapped[field])

    employee.save(ignore_permissions=True)
    frappe.db.commit()
    return {"employee_id": employee.name, "status": "updated"}


@frappe.whitelist(allow_guest=False)
def get_employee_timeline(employee_id, limit=50):
    """Get timeline events for an employee (status changes, leave, attendance)."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)
    employee_name = employee_id  # name IS the employee_id

    events = []

    # Version log (field changes tracked by Frappe)
    versions = frappe.get_list(
        "Version",
        fields=["name", "creation", "owner", "data"],
        filters={
            "ref_doctype": "Employee",
            "ref_docname": employee_name,
        },
        order_by="creation desc",
        limit_page_length=int(limit),
    )

    for v in versions:
        import json as _json
        try:
            data = _json.loads(v.data) if isinstance(v.data, str) else v.data
        except Exception:
            continue
        changed = data.get("changed", [])
        for ch in changed:
            if len(ch) >= 3:
                events.append({
                    "type": "field_change",
                    "date": str(v.creation),
                    "actor": v.owner,
                    "field": ch[0],
                    "old_value": str(ch[1]) if ch[1] else "",
                    "new_value": str(ch[2]) if ch[2] else "",
                })

    # Leave applications
    leaves = frappe.get_list(
        "Leave Application",
        fields=["name", "leave_type", "from_date", "to_date", "status", "posting_date"],
        filters={"employee": employee_name},
        order_by="posting_date desc",
        limit_page_length=20,
    )
    for l in leaves:
        events.append({
            "type": "leave",
            "date": str(l.posting_date),
            "actor": "",
            "description": f"{l.leave_type}: {l.from_date} to {l.to_date} ({l.status})",
            "status": l.status,
        })

    # Sort all events by date descending
    events.sort(key=lambda e: e.get("date", ""), reverse=True)

    return events[:int(limit)]
