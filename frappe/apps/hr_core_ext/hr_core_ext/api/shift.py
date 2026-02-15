import frappe
from frappe.utils import today, getdate, get_datetime


@frappe.whitelist(allow_guest=False)
def get_shift_types():
    """List all shift types."""
    shifts = frappe.get_list(
        "Shift Type",
        fields=[
            "name", "start_time", "end_time", "holiday_list",
            "late_entry_grace_period", "early_exit_grace_period",
            "enable_auto_attendance",
            "working_hours_threshold_for_half_day",
            "working_hours_threshold_for_absent",
        ],
        order_by="name asc",
    )
    for s in shifts:
        s["start_time"] = str(s["start_time"])
        s["end_time"] = str(s["end_time"])
    return shifts


@frappe.whitelist(allow_guest=False)
def create_shift_type(name, start_time, end_time,
                      late_entry_grace_period=15,
                      early_exit_grace_period=15,
                      holiday_list=None):
    """Create a new shift type."""
    if frappe.db.exists("Shift Type", name):
        frappe.throw(f"Shift Type '{name}' already exists")

    doc_data = {
        "doctype": "Shift Type",
        "__newname": name,
        "start_time": start_time,
        "end_time": end_time,
        "enable_auto_attendance": 1,
        "determine_check_in_and_check_out": "Alternating entries as IN and OUT during the same shift",
        "begin_check_in_before_shift_start_time": 60,
        "allow_check_out_after_shift_end_time": 60,
        "late_entry_grace_period": int(late_entry_grace_period),
        "early_exit_grace_period": int(early_exit_grace_period),
        "working_hours_threshold_for_half_day": 4.0,
        "working_hours_threshold_for_absent": 2.0,
    }
    if holiday_list:
        doc_data["holiday_list"] = holiday_list

    doc = frappe.get_doc(doc_data)
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "name": doc.name,
        "start_time": str(doc.start_time),
        "end_time": str(doc.end_time),
    }


@frappe.whitelist(allow_guest=False)
def update_shift_type(shift_type_name, start_time=None, end_time=None,
                      late_entry_grace_period=None, early_exit_grace_period=None):
    """Update an existing shift type."""
    if not frappe.db.exists("Shift Type", shift_type_name):
        frappe.throw(f"Shift Type '{shift_type_name}' not found", frappe.DoesNotExistError)

    doc = frappe.get_doc("Shift Type", shift_type_name)
    if start_time is not None:
        doc.start_time = start_time
    if end_time is not None:
        doc.end_time = end_time
    if late_entry_grace_period is not None:
        doc.late_entry_grace_period = int(late_entry_grace_period)
    if early_exit_grace_period is not None:
        doc.early_exit_grace_period = int(early_exit_grace_period)

    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "name": doc.name,
        "start_time": str(doc.start_time),
        "end_time": str(doc.end_time),
        "late_entry_grace_period": doc.late_entry_grace_period,
        "early_exit_grace_period": doc.early_exit_grace_period,
    }


@frappe.whitelist(allow_guest=False)
def get_shift_assignments(employee_id=None, shift_type=None, date=None, company=None):
    """List shift assignments with optional filters."""
    filters = {"docstatus": 1}

    if employee_id:
        filters["employee"] = employee_id
    if shift_type:
        filters["shift_type"] = shift_type
    if company:
        filters["company"] = company

    assignments = frappe.get_list(
        "Shift Assignment",
        filters=filters,
        fields=[
            "name", "employee", "employee_name", "shift_type",
            "start_date", "end_date", "company", "docstatus",
        ],
        order_by="start_date desc",
        limit_page_length=100,
    )

    # If date filter provided, filter in Python (Frappe doesn't support complex date logic in filters easily)
    if date:
        target = getdate(date)
        assignments = [
            a for a in assignments
            if getdate(a["start_date"]) <= target
            and (not a["end_date"] or getdate(a["end_date"]) >= target)
        ]

    for a in assignments:
        a["start_date"] = str(a["start_date"])
        a["end_date"] = str(a["end_date"]) if a["end_date"] else None
        a["status"] = "Active" if a["docstatus"] == 1 else "Cancelled"

    return assignments


@frappe.whitelist(allow_guest=False)
def assign_shift(employee_id, shift_type, start_date, end_date=None, company=None):
    """Assign an employee to a shift type for a date range."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee '{employee_id}' not found", frappe.DoesNotExistError)

    emp = frappe.get_doc("Employee", employee_id)
    if emp.status != "Active":
        frappe.throw(f"Employee '{employee_id}' is not Active")

    if not frappe.db.exists("Shift Type", shift_type):
        frappe.throw(f"Shift Type '{shift_type}' not found", frappe.DoesNotExistError)

    # Get company from employee if not provided
    if not company:
        company = emp.company

    # Check for overlapping active assignments
    overlap_filters = {
        "employee": employee_id,
        "docstatus": 1,
        "start_date": ["<=", end_date or "9999-12-31"],
    }
    existing = frappe.get_list("Shift Assignment", filters=overlap_filters, fields=["name", "start_date", "end_date"])
    start_dt = getdate(start_date)
    end_dt = getdate(end_date) if end_date else None

    for ex in existing:
        ex_start = getdate(ex["start_date"])
        ex_end = getdate(ex["end_date"]) if ex["end_date"] else None

        # Check overlap
        if end_dt:
            if ex_end:
                if ex_start <= end_dt and ex_end >= start_dt:
                    frappe.throw(f"Overlapping shift assignment exists: {ex['name']}")
            else:
                if ex_start <= end_dt:
                    frappe.throw(f"Overlapping shift assignment exists: {ex['name']}")
        else:
            if ex_end:
                if ex_end >= start_dt:
                    frappe.throw(f"Overlapping shift assignment exists: {ex['name']}")
            else:
                frappe.throw(f"Overlapping shift assignment exists: {ex['name']}")

    doc = frappe.get_doc({
        "doctype": "Shift Assignment",
        "employee": employee_id,
        "shift_type": shift_type,
        "start_date": start_date,
        "end_date": end_date,
        "company": company,
    })
    doc.insert(ignore_permissions=True)
    doc.submit()
    frappe.db.commit()

    return {
        "name": doc.name,
        "employee": employee_id,
        "employee_name": emp.employee_name,
        "shift_type": shift_type,
        "start_date": str(doc.start_date),
        "end_date": str(doc.end_date) if doc.end_date else None,
    }


@frappe.whitelist(allow_guest=False)
def unassign_shift(assignment_id):
    """Cancel a shift assignment."""
    if not frappe.db.exists("Shift Assignment", assignment_id):
        frappe.throw(f"Shift Assignment '{assignment_id}' not found", frappe.DoesNotExistError)

    doc = frappe.get_doc("Shift Assignment", assignment_id)
    if doc.docstatus != 1:
        frappe.throw("Only submitted assignments can be cancelled")

    doc.cancel()
    frappe.db.commit()

    return {"name": doc.name, "status": "Cancelled"}


@frappe.whitelist(allow_guest=False)
def get_shift_requests(employee_id=None, status=None):
    """List shift change requests."""
    filters = {}
    if employee_id:
        filters["employee"] = employee_id
    if status:
        filters["status"] = status

    requests = frappe.get_list(
        "Shift Request",
        filters=filters,
        fields=[
            "name", "employee", "employee_name", "shift_type",
            "from_date", "to_date", "status", "approver",
        ],
        order_by="creation desc",
        limit_page_length=100,
    )

    for r in requests:
        r["from_date"] = str(r["from_date"])
        r["to_date"] = str(r["to_date"])

    return requests


@frappe.whitelist(allow_guest=False)
def create_shift_request(employee_id, shift_type, from_date, to_date, approver=None):
    """Employee submits a shift change request."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee '{employee_id}' not found", frappe.DoesNotExistError)

    emp = frappe.get_doc("Employee", employee_id)
    if emp.status != "Active":
        frappe.throw(f"Employee '{employee_id}' is not Active")

    if not frappe.db.exists("Shift Type", shift_type):
        frappe.throw(f"Shift Type '{shift_type}' not found", frappe.DoesNotExistError)

    # Use reports_to's User email if no approver specified
    if not approver and emp.reports_to:
        mgr = frappe.get_doc("Employee", emp.reports_to)
        if mgr.user_id:
            approver = mgr.user_id

    # Fallback: find any HR Manager user in the company
    if not approver:
        hr_users = frappe.db.sql("""
            SELECT DISTINCT e.user_id FROM tabEmployee e
            INNER JOIN `tabHas Role` r ON r.parent = e.user_id
            WHERE e.company = %s AND e.status = 'Active'
            AND e.user_id IS NOT NULL AND e.user_id != ''
            AND r.role IN ('HR Manager', 'HR User')
            LIMIT 1
        """, (emp.company,), as_dict=True)
        if hr_users:
            approver = hr_users[0]["user_id"]

    # Last fallback: use Administrator
    if not approver:
        approver = "Administrator"

    doc_data = {
        "doctype": "Shift Request",
        "employee": employee_id,
        "shift_type": shift_type,
        "from_date": from_date,
        "to_date": to_date,
        "company": emp.company,
        "status": "Draft",
        "approver": approver,
    }

    doc = frappe.get_doc(doc_data)
    doc.flags.ignore_validate = True
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "name": doc.name,
        "status": doc.status,
        "shift_type": shift_type,
    }


@frappe.whitelist(allow_guest=False)
def approve_shift_request(request_id, action):
    """Approve or reject a shift request."""
    if action not in ("approve", "reject"):
        frappe.throw("action must be 'approve' or 'reject'")

    if not frappe.db.exists("Shift Request", request_id):
        frappe.throw(f"Shift Request '{request_id}' not found", frappe.DoesNotExistError)

    doc = frappe.get_doc("Shift Request", request_id)
    doc.flags.ignore_validate = True

    if action == "approve":
        doc.status = "Approved"
        doc.save(ignore_permissions=True)
        doc.submit()
    else:
        doc.status = "Rejected"
        doc.save(ignore_permissions=True)

    frappe.db.commit()

    return {"name": doc.name, "action": action, "status": doc.status}


@frappe.whitelist(allow_guest=False)
def get_employee_current_shift(employee_id):
    """Get the current/active shift assignment for an employee."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee '{employee_id}' not found", frappe.DoesNotExistError)

    today_date = today()

    assignments = frappe.get_list(
        "Shift Assignment",
        filters={
            "employee": employee_id,
            "docstatus": 1,
            "start_date": ["<=", today_date],
        },
        fields=["name", "shift_type", "start_date", "end_date"],
        order_by="start_date desc",
        limit_page_length=5,
    )

    # Filter for active on today
    for a in assignments:
        if not a["end_date"] or getdate(a["end_date"]) >= getdate(today_date):
            # Get shift type details
            shift = frappe.get_doc("Shift Type", a["shift_type"])
            return {
                "has_shift": True,
                "shift_type": a["shift_type"],
                "start_time": str(shift.start_time),
                "end_time": str(shift.end_time),
                "assignment_start": str(a["start_date"]),
                "assignment_end": str(a["end_date"]) if a["end_date"] else None,
                "assignment_name": a["name"],
                "late_entry_grace_period": shift.late_entry_grace_period,
                "early_exit_grace_period": shift.early_exit_grace_period,
            }

    return {"has_shift": False}


@frappe.whitelist(allow_guest=False)
def process_auto_attendance(date=None, company=None):
    """Process check-in data against shift assignments to generate Attendance records.

    This is a manual trigger for admin/HR to run auto-attendance for a specific date.
    """
    from datetime import datetime as dt, timedelta

    if not date:
        # Default to yesterday
        date = str(getdate(today()) - timedelta(days=1))

    target_date = getdate(date)

    # Get all active shift assignments for this date
    filters = {
        "docstatus": 1,
        "start_date": ["<=", str(target_date)],
    }
    if company:
        filters["company"] = company

    assignments = frappe.get_list(
        "Shift Assignment",
        filters=filters,
        fields=["name", "employee", "employee_name", "shift_type", "start_date", "end_date", "company"],
    )

    # Filter for active on target date
    active_assignments = []
    for a in assignments:
        if not a["end_date"] or getdate(a["end_date"]) >= target_date:
            active_assignments.append(a)

    created = []
    skipped = []
    errors = []
    late_count = 0
    early_exit_count = 0

    for assignment in active_assignments:
        emp_id = assignment["employee"]
        emp_name = assignment["employee_name"]
        shift_name = assignment["shift_type"]

        try:
            # Check if attendance already exists
            existing = frappe.db.exists("Attendance", {
                "employee": emp_id,
                "attendance_date": str(target_date),
                "docstatus": ["!=", 2],
            })
            if existing:
                skipped.append({"employee": emp_id, "employee_name": emp_name, "reason": "Attendance already exists"})
                continue

            # Get shift type details
            shift = frappe.get_doc("Shift Type", shift_name)
            shift_start = shift.start_time  # timedelta
            shift_end = shift.end_time      # timedelta
            grace_late = shift.late_entry_grace_period or 0
            grace_early = shift.early_exit_grace_period or 0
            half_day_threshold = shift.working_hours_threshold_for_half_day or 4.0
            absent_threshold = shift.working_hours_threshold_for_absent or 2.0

            # Get employee checkins for this date
            checkins = frappe.get_list(
                "Employee Checkin",
                filters={
                    "employee": emp_id,
                    "time": ["between", [f"{target_date} 00:00:00", f"{target_date} 23:59:59"]],
                },
                fields=["name", "time", "log_type"],
                order_by="time asc",
            )

            if not checkins:
                # No checkins = Absent
                att = frappe.get_doc({
                    "doctype": "Attendance",
                    "employee": emp_id,
                    "attendance_date": str(target_date),
                    "status": "Absent",
                    "company": assignment["company"],
                    "shift": shift_name,
                })
                att.insert(ignore_permissions=True)
                att.submit()
                created.append({
                    "employee": emp_id,
                    "employee_name": emp_name,
                    "status": "Absent",
                    "working_hours": 0,
                    "late_entry": False,
                    "early_exit": False,
                })
                continue

            # Pair IN/OUT and calculate working hours
            total_hours = 0.0
            first_in = None
            last_out = None

            ins = [c for c in checkins if c["log_type"] == "IN"]
            outs = [c for c in checkins if c["log_type"] == "OUT"]

            if ins:
                first_in = get_datetime(ins[0]["time"])

            if outs:
                last_out = get_datetime(outs[-1]["time"])

            # Calculate hours from paired IN/OUT
            for i, in_log in enumerate(ins):
                in_time = get_datetime(in_log["time"])
                # Find corresponding OUT
                matching_out = None
                for out_log in outs:
                    out_time = get_datetime(out_log["time"])
                    if out_time > in_time:
                        matching_out = out_time
                        break
                if matching_out:
                    total_hours += (matching_out - in_time).total_seconds() / 3600.0

            # If we have IN but no OUT, use shift end time as estimate
            if ins and not outs:
                total_hours = 0.0  # Can't determine without OUT

            # Determine status
            if total_hours >= half_day_threshold:
                status = "Present"
            elif total_hours >= absent_threshold:
                status = "Half Day"
            else:
                status = "Absent"

            # Determine late entry
            late_entry = False
            if first_in and shift_start is not None:
                # Convert shift_start timedelta to datetime for comparison
                shift_start_dt = dt.combine(target_date, dt.min.time()) + shift_start
                grace_dt = shift_start_dt + timedelta(minutes=grace_late)
                if first_in > grace_dt:
                    late_entry = True
                    late_count += 1

            # Determine early exit
            early_exit = False
            if last_out and shift_end is not None:
                shift_end_dt = dt.combine(target_date, dt.min.time()) + shift_end
                # Handle cross-midnight shifts
                if shift_end < shift_start:
                    shift_end_dt += timedelta(days=1)
                grace_dt = shift_end_dt - timedelta(minutes=grace_early)
                if last_out < grace_dt:
                    early_exit = True
                    early_exit_count += 1

            att = frappe.get_doc({
                "doctype": "Attendance",
                "employee": emp_id,
                "attendance_date": str(target_date),
                "status": status,
                "working_hours": round(total_hours, 2),
                "late_entry": late_entry,
                "early_exit": early_exit,
                "company": assignment["company"],
                "shift": shift_name,
            })
            att.insert(ignore_permissions=True)
            att.submit()

            created.append({
                "employee": emp_id,
                "employee_name": emp_name,
                "status": status,
                "working_hours": round(total_hours, 2),
                "late_entry": late_entry,
                "early_exit": early_exit,
            })

        except Exception as e:
            errors.append({"employee": emp_id, "employee_name": emp_name, "error": str(e)})

    frappe.db.commit()

    return {
        "date": str(target_date),
        "processed_count": len(created),
        "skipped_count": len(skipped),
        "error_count": len(errors),
        "late_count": late_count,
        "early_exit_count": early_exit_count,
        "created": created,
        "skipped": skipped,
        "errors": errors,
    }
