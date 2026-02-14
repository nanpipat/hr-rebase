import frappe


@frappe.whitelist(allow_guest=False)
def get_attendance_summary(employee_id, from_date=None, to_date=None):
    """Get attendance summary for an employee."""
    employee = employee_id  # employee_id IS the Frappe name (e.g. HR-EMP-00001)
    if not frappe.db.exists("Employee", employee):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    if not from_date:
        from_date = frappe.utils.get_first_day(frappe.utils.nowdate())
    if not to_date:
        to_date = frappe.utils.nowdate()

    records = frappe.get_list(
        "Attendance",
        fields=["attendance_date", "status", "working_hours", "leave_type"],
        filters={
            "employee": employee,
            "attendance_date": ["between", [from_date, to_date]],
            "docstatus": 1,
        },
        order_by="attendance_date desc",
        limit_page_length=0,
    )

    present = sum(1 for r in records if r.status == "Present")
    absent = sum(1 for r in records if r.status == "Absent")
    on_leave = sum(1 for r in records if r.status == "On Leave")

    return {
        "records": records,
        "summary": {
            "total_days": len(records),
            "present": present,
            "absent": absent,
            "on_leave": on_leave,
        },
    }


@frappe.whitelist(allow_guest=False)
def get_attendance_detail(employee_id, from_date=None, to_date=None):
    """Get detailed attendance records with checkin data."""
    employee = employee_id  # employee_id IS the Frappe name (e.g. HR-EMP-00001)
    if not frappe.db.exists("Employee", employee):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    if not from_date:
        from_date = frappe.utils.get_first_day(frappe.utils.nowdate())
    if not to_date:
        to_date = frappe.utils.nowdate()

    records = frappe.get_list(
        "Attendance",
        fields=[
            "name", "attendance_date", "status", "working_hours",
            "leave_type", "late_entry", "early_exit",
        ],
        filters={
            "employee": employee,
            "attendance_date": ["between", [from_date, to_date]],
            "docstatus": 1,
        },
        order_by="attendance_date desc",
        limit_page_length=0,
    )

    # Get checkins for the period
    checkins = frappe.get_list(
        "Employee Checkin",
        fields=["time", "log_type"],
        filters={
            "employee": employee,
            "time": ["between", [from_date, to_date + " 23:59:59"]],
        },
        order_by="time desc",
        limit_page_length=0,
    )

    present = sum(1 for r in records if r.status == "Present")
    absent = sum(1 for r in records if r.status == "Absent")
    on_leave = sum(1 for r in records if r.status == "On Leave")
    late_days = sum(1 for r in records if r.get("late_entry"))

    return {
        "records": records,
        "checkins": checkins,
        "summary": {
            "total_days": len(records),
            "present": present,
            "absent": absent,
            "on_leave": on_leave,
            "late_days": late_days,
        },
    }


@frappe.whitelist(allow_guest=False)
def create_attendance_request(employee_id, attendance_date, reason, status="Present"):
    """Create an attendance correction request."""
    employee = employee_id  # employee_id IS the Frappe name (e.g. HR-EMP-00001)
    if not frappe.db.exists("Employee", employee):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    if status not in ("Present", "Work From Home", "Half Day"):
        frappe.throw("Invalid attendance status for request")

    doc = frappe.get_doc({
        "doctype": "Attendance Request",
        "employee": employee,
        "from_date": attendance_date,
        "to_date": attendance_date,
        "reason": reason,
        "half_day": 1 if status == "Half Day" else 0,
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": doc.name, "status": "Open"}


@frappe.whitelist(allow_guest=False)
def get_attendance_requests(employee_id=None, limit_page_length=20):
    """Get attendance correction requests."""
    filters = {}
    if employee_id:
        filters["employee"] = employee_id

    requests = frappe.get_list(
        "Attendance Request",
        fields=[
            "name", "employee", "employee_name",
            "from_date", "to_date", "reason",
            "docstatus", "half_day",
        ],
        filters=filters,
        limit_page_length=int(limit_page_length),
        order_by="creation desc",
    )

    # Map docstatus to human-readable status
    for req in requests:
        if req.docstatus == 0:
            req["status"] = "Pending"
        elif req.docstatus == 1:
            req["status"] = "Approved"
        elif req.docstatus == 2:
            req["status"] = "Rejected"

    return requests


@frappe.whitelist(allow_guest=False)
def approve_attendance_request(request_id, action):
    """Approve or reject an attendance request."""
    if action not in ("approve", "reject"):
        frappe.throw("Action must be 'approve' or 'reject'")

    doc = frappe.get_doc("Attendance Request", request_id)

    if action == "approve":
        doc.submit()
    else:
        doc.docstatus = 2
        doc.save(ignore_permissions=True)

    frappe.db.commit()
    return {"name": doc.name, "action": action}
