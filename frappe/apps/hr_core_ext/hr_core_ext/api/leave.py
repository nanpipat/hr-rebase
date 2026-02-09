import frappe


@frappe.whitelist(allow_guest=False)
def get_leave_balance(employee_id):
    """Get leave balance for an employee."""
    from hrms.hr.doctype.leave_application.leave_application import get_leave_details

    employee = frappe.get_value("Employee", {"employee_id": employee_id}, "name")
    if not employee:
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    leave_details = get_leave_details(employee, frappe.utils.nowdate())
    return leave_details


@frappe.whitelist(allow_guest=False)
def get_leave_applications(employee_id=None, status=None, limit_page_length=20):
    """Get leave applications with optional filters."""
    filters = {}
    if employee_id:
        employee = frappe.get_value("Employee", {"employee_id": employee_id}, "name")
        if employee:
            filters["employee"] = employee
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
        ],
        filters=filters,
        limit_page_length=int(limit_page_length),
        order_by="posting_date desc",
    )
    return applications


@frappe.whitelist(allow_guest=False)
def create_leave_application(employee_id, leave_type, from_date, to_date, reason=None):
    """Create a leave application."""
    employee = frappe.get_value("Employee", {"employee_id": employee_id}, "name")
    if not employee:
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

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
