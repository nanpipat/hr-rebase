import frappe


@frappe.whitelist(allow_guest=False)
def get_leave_balance(employee_id):
    """Get leave balance for an employee."""
    from hrms.hr.doctype.leave_application.leave_application import get_leave_details

    employee = employee_id  # employee_id IS the Frappe name (e.g. HR-EMP-00001)
    if not frappe.db.exists("Employee", employee):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    leave_details = get_leave_details(employee, frappe.utils.nowdate())
    return leave_details


@frappe.whitelist(allow_guest=False)
def get_leave_applications(employee_id=None, status=None, limit_page_length=20):
    """Get leave applications with optional filters."""
    filters = {}
    if employee_id:
        filters["employee"] = employee_id
    if status:
        filters["status"] = status

    applications = frappe.get_list(
        "Leave Application",
        fields=[
            "name",
            "employee",
            "employee_name",
            "leave_type",
            "from_date",
            "to_date",
            "total_leave_days",
            "status",
            "posting_date",
            "description",
        ],
        filters=filters,
        limit_page_length=int(limit_page_length),
        order_by="posting_date desc",
    )
    return applications


@frappe.whitelist(allow_guest=False)
def create_leave_application(employee_id, leave_type, from_date, to_date, reason=None):
    """Create a leave application."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    emp_status = frappe.get_value("Employee", employee_id, "status")
    if emp_status not in ("Active",):
        frappe.throw(f"Cannot create leave for employee with status '{emp_status}'")

    employee = employee_id

    doc = frappe.get_doc({
        "doctype": "Leave Application",
        "employee": employee,
        "leave_type": leave_type,
        "from_date": from_date,
        "to_date": to_date,
        "description": reason or "",
        "status": "Open",
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "status": doc.status}


@frappe.whitelist(allow_guest=False)
def approve_leave_application(leave_id, status):
    """Approve or reject a leave application."""
    if status not in ("Approved", "Rejected"):
        frappe.throw("Status must be 'Approved' or 'Rejected'")

    doc = frappe.get_doc("Leave Application", leave_id)
    doc.status = status
    doc.save(ignore_permissions=True)

    if status == "Approved":
        doc.submit()

    frappe.db.commit()
    return {"name": doc.name, "status": doc.status}


@frappe.whitelist(allow_guest=False)
def get_leave_allocations(employee_id):
    """Get leave allocations for an employee - balance by leave type."""
    employee = employee_id  # employee_id IS the Frappe name (e.g. HR-EMP-00001)
    if not frappe.db.exists("Employee", employee):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    today = frappe.utils.nowdate()

    allocations = frappe.get_list(
        "Leave Allocation",
        fields=[
            "name",
            "leave_type",
            "total_leaves_allocated",
            "new_leaves_allocated",
            "from_date",
            "to_date",
        ],
        filters={
            "employee": employee,
            "docstatus": 1,
            "from_date": ["<=", today],
            "to_date": [">=", today],
        },
        order_by="leave_type asc",
    )

    # Calculate used leaves per type
    result = []
    for alloc in allocations:
        used = frappe.db.sql("""
            SELECT IFNULL(SUM(total_leave_days), 0) as used
            FROM `tabLeave Application`
            WHERE employee = %s
            AND leave_type = %s
            AND status = 'Approved'
            AND docstatus = 1
            AND from_date >= %s
            AND to_date <= %s
        """, (employee, alloc.leave_type, alloc.from_date, alloc.to_date), as_dict=True)

        used_days = used[0].used if used else 0
        result.append({
            "leave_type": alloc.leave_type,
            "total_allocated": alloc.total_leaves_allocated,
            "used": used_days,
            "remaining": alloc.total_leaves_allocated - used_days,
            "from_date": str(alloc.from_date),
            "to_date": str(alloc.to_date),
        })

    return result


@frappe.whitelist(allow_guest=False)
def cancel_leave_application(leave_id):
    """Cancel an open leave application."""
    doc = frappe.get_doc("Leave Application", leave_id)
    if doc.status not in ("Open",):
        frappe.throw("Can only cancel Open leave applications")

    doc.status = "Cancelled"
    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "status": doc.status}


@frappe.whitelist(allow_guest=False)
def update_leave_application(leave_id, leave_type=None, from_date=None, to_date=None, reason=None):
    """Update an open leave application."""
    doc = frappe.get_doc("Leave Application", leave_id)
    if doc.status != "Open":
        frappe.throw("Can only edit Open leave applications")

    if leave_type:
        doc.leave_type = leave_type
    if from_date:
        doc.from_date = from_date
    if to_date:
        doc.to_date = to_date
    if reason is not None:
        doc.description = reason

    doc.save(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "status": doc.status}
