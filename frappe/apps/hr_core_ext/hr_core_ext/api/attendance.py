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


@frappe.whitelist(allow_guest=False)
def checkin(employee_id, log_type="IN"):
    """Record an employee check-in or check-out."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    emp = frappe.get_doc("Employee", employee_id)
    if emp.status != "Active":
        frappe.throw("Only active employees can check in")

    if log_type not in ("IN", "OUT"):
        frappe.throw("log_type must be 'IN' or 'OUT'")

    today = frappe.utils.nowdate()
    today_start = today + " 00:00:00"
    today_end = today + " 23:59:59"

    # Get today's checkins to validate
    today_checkins = frappe.get_list(
        "Employee Checkin",
        fields=["name", "time", "log_type"],
        filters={
            "employee": employee_id,
            "time": ["between", [today_start, today_end]],
        },
        order_by="time asc",
        limit_page_length=0,
    )

    if log_type == "IN":
        # Prevent double check-in without check-out
        if today_checkins:
            last = today_checkins[-1]
            if last.log_type == "IN":
                frappe.throw("Already checked in. Please check out first.")
    elif log_type == "OUT":
        # Must have checked in first
        if not today_checkins:
            frappe.throw("You haven't checked in today.")
        last = today_checkins[-1]
        if last.log_type == "OUT":
            frappe.throw("Already checked out. Please check in first.")

    now = frappe.utils.now_datetime()
    doc = frappe.get_doc({
        "doctype": "Employee Checkin",
        "employee": employee_id,
        "time": now,
        "log_type": log_type,
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "name": doc.name,
        "time": str(now),
        "log_type": log_type,
    }


@frappe.whitelist(allow_guest=False)
def checkout(employee_id):
    """Shortcut to check out an employee."""
    return checkin(employee_id, log_type="OUT")


@frappe.whitelist(allow_guest=False)
def get_today_checkin(employee_id):
    """Get today's check-in/out status for an employee."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    today = frappe.utils.nowdate()
    today_start = today + " 00:00:00"
    today_end = today + " 23:59:59"

    checkins = frappe.get_list(
        "Employee Checkin",
        fields=["name", "time", "log_type"],
        filters={
            "employee": employee_id,
            "time": ["between", [today_start, today_end]],
        },
        order_by="time asc",
        limit_page_length=0,
    )

    first_in = None
    last_out = None
    is_checked_in = False
    working_hours = 0.0

    if checkins:
        # Find first IN and last OUT
        for c in checkins:
            if c.log_type == "IN" and first_in is None:
                first_in = str(c.time)
            if c.log_type == "OUT":
                last_out = str(c.time)

        # Current status: last log determines if checked in
        is_checked_in = checkins[-1].log_type == "IN"

        # Calculate working hours from paired IN/OUT
        from datetime import datetime
        total_seconds = 0
        current_in = None
        for c in checkins:
            if c.log_type == "IN":
                current_in = c.time
            elif c.log_type == "OUT" and current_in:
                if isinstance(current_in, str):
                    current_in = datetime.fromisoformat(current_in)
                out_time = c.time
                if isinstance(out_time, str):
                    out_time = datetime.fromisoformat(out_time)
                total_seconds += (out_time - current_in).total_seconds()
                current_in = None

        # If still checked in, count time until now
        if is_checked_in and current_in:
            from datetime import datetime as dt
            now = frappe.utils.now_datetime()
            if isinstance(current_in, str):
                current_in = dt.fromisoformat(current_in)
            total_seconds += (now - current_in).total_seconds()

        working_hours = round(total_seconds / 3600, 2)

    return {
        "checkins": [{"time": str(c.time), "log_type": c.log_type} for c in checkins],
        "first_in": first_in,
        "last_out": last_out,
        "working_hours": working_hours,
        "is_checked_in": is_checked_in,
    }


@frappe.whitelist(allow_guest=False)
def get_checkin_history(employee_id, from_date=None, to_date=None):
    """Get check-in history grouped by date."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    if not from_date:
        from_date = frappe.utils.get_first_day(frappe.utils.nowdate())
    if not to_date:
        to_date = frappe.utils.nowdate()

    checkins = frappe.get_list(
        "Employee Checkin",
        fields=["name", "time", "log_type"],
        filters={
            "employee": employee_id,
            "time": ["between", [str(from_date) + " 00:00:00", str(to_date) + " 23:59:59"]],
        },
        order_by="time asc",
        limit_page_length=0,
    )

    # Group by date
    from collections import defaultdict
    from datetime import datetime
    days_map = defaultdict(list)
    for c in checkins:
        t = c.time
        if isinstance(t, str):
            t = datetime.fromisoformat(t)
        date_str = t.strftime("%Y-%m-%d")
        days_map[date_str].append({"time": str(c.time), "log_type": c.log_type})

    # Build daily summaries
    days = []
    for date_str in sorted(days_map.keys(), reverse=True):
        day_checkins = days_map[date_str]
        first_in = None
        last_out = None
        total_seconds = 0
        current_in = None

        for c in day_checkins:
            t = datetime.fromisoformat(c["time"])
            if c["log_type"] == "IN":
                if first_in is None:
                    first_in = c["time"]
                current_in = t
            elif c["log_type"] == "OUT":
                last_out = c["time"]
                if current_in:
                    total_seconds += (t - current_in).total_seconds()
                    current_in = None

        days.append({
            "date": date_str,
            "first_in": first_in,
            "last_out": last_out,
            "working_hours": round(total_seconds / 3600, 2),
            "checkin_count": len(day_checkins),
            "checkins": day_checkins,
        })

    return {"days": days}
