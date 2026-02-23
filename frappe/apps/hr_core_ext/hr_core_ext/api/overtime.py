import frappe


# ── OT Settings ──────────────────────────────────────────────

def _get_ot_settings():
    """Get OT settings or Thai labour law defaults."""
    defaults = {
        "weekday_ot_rate": 1.5,        # Overtime on regular working day
        "holiday_work_monthly": 1.0,    # Holiday work for monthly-paid employees
        "holiday_work_daily": 2.0,      # Holiday work for daily-paid employees
        "holiday_ot_rate": 3.0,         # Overtime on holidays
        "standard_hours_per_day": 8,
        "standard_working_days": 26,
    }
    stored = {}
    try:
        rows = frappe.db.sql(
            "SELECT field, value FROM tabSingles WHERE doctype='OT Settings'",
            as_dict=True
        )
        for r in rows:
            stored[r["field"]] = r["value"]
    except Exception:
        pass

    return {
        "weekday_ot_rate": float(stored.get("weekday_ot_rate", defaults["weekday_ot_rate"])),
        "holiday_work_monthly": float(stored.get("holiday_work_monthly", defaults["holiday_work_monthly"])),
        "holiday_work_daily": float(stored.get("holiday_work_daily", defaults["holiday_work_daily"])),
        "holiday_ot_rate": float(stored.get("holiday_ot_rate", defaults["holiday_ot_rate"])),
        "standard_hours_per_day": int(float(stored.get("standard_hours_per_day", defaults["standard_hours_per_day"]))),
        "standard_working_days": int(float(stored.get("standard_working_days", defaults["standard_working_days"]))),
    }


def _save_ot_settings(settings):
    """Save OT settings to Singles table."""
    for key, value in settings.items():
        existing = frappe.db.sql(
            "SELECT value FROM tabSingles WHERE doctype='OT Settings' AND field=%s",
            (key,), as_dict=True
        )
        if existing:
            frappe.db.sql(
                "UPDATE tabSingles SET value=%s WHERE doctype='OT Settings' AND field=%s",
                (str(value), key)
            )
        else:
            frappe.db.sql(
                "INSERT INTO tabSingles (doctype, field, value) VALUES ('OT Settings', %s, %s)",
                (key, str(value))
            )


@frappe.whitelist(allow_guest=False)
def get_ot_config():
    """Get OT configuration."""
    return _get_ot_settings()


@frappe.whitelist(allow_guest=False)
def update_ot_config(**kwargs):
    """Update OT configuration."""
    settings = _get_ot_settings()

    for key in settings:
        if key in kwargs and kwargs[key] is not None:
            if key in ("standard_hours_per_day", "standard_working_days"):
                settings[key] = int(float(kwargs[key]))
            else:
                settings[key] = float(kwargs[key])

    _save_ot_settings(settings)
    frappe.db.commit()
    return settings


# ── OT Requests (stored in custom table via Singles pattern) ──

@frappe.whitelist(allow_guest=False)
def create_ot_request(employee_id, ot_date, ot_type, hours, reason=None):
    """Create an OT request.

    ot_type: weekday_ot | holiday_work | holiday_ot
    """
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    valid_types = ("weekday_ot", "holiday_work", "holiday_ot")
    if ot_type not in valid_types:
        frappe.throw(f"ot_type must be one of: {', '.join(valid_types)}")

    hours = float(hours)
    if hours <= 0 or hours > 24:
        frappe.throw("Hours must be between 0 and 24")

    emp = frappe.get_doc("Employee", employee_id)

    # Use Additional Salary as a storage mechanism for OT requests
    # with a custom naming pattern
    doc = frappe.get_doc({
        "doctype": "Additional Salary",
        "employee": employee_id,
        "salary_component": "Overtime",
        "payroll_date": ot_date,
        "amount": 0,  # Will be calculated on approval
        "company": emp.company,
        "type": "Earning",
        "overwrite_salary_structure_amount": 0,
        "ref_doctype": "",
        "ref_docname": "",
        "notes": frappe.as_json({
            "ot_type": ot_type,
            "hours": hours,
            "reason": reason or "",
            "status": "Pending",
            "approved_by": "",
        }),
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    return {
        "name": doc.name,
        "employee": employee_id,
        "employee_name": emp.employee_name,
        "ot_date": ot_date,
        "ot_type": ot_type,
        "hours": hours,
        "reason": reason or "",
        "status": "Pending",
    }


@frappe.whitelist(allow_guest=False)
def get_ot_requests(employee_id=None, status=None, month=None, year=None):
    """List OT requests."""
    filters = {
        "salary_component": "Overtime",
        "docstatus": ["!=", 2],
    }
    if employee_id:
        filters["employee"] = employee_id

    requests = frappe.get_list(
        "Additional Salary",
        filters=filters,
        fields=["name", "employee", "employee_name", "payroll_date", "amount", "notes", "docstatus"],
        order_by="payroll_date desc",
        limit_page_length=0,
    )

    result = []
    for r in requests:
        try:
            meta = frappe.parse_json(r.notes or "{}")
        except Exception:
            meta = {}

        req_status = meta.get("status", "Pending")
        if status and req_status != status:
            continue

        if month and year:
            from datetime import date
            rd = r.payroll_date
            if hasattr(rd, 'month'):
                if rd.month != int(month) or rd.year != int(year):
                    continue

        result.append({
            "name": r.name,
            "employee": r.employee,
            "employee_name": r.employee_name,
            "ot_date": str(r.payroll_date),
            "ot_type": meta.get("ot_type", ""),
            "hours": meta.get("hours", 0),
            "reason": meta.get("reason", ""),
            "status": req_status,
            "approved_by": meta.get("approved_by", ""),
            "amount": float(r.amount or 0),
        })

    return result


@frappe.whitelist(allow_guest=False)
def approve_ot_request(request_id):
    """Approve an OT request and calculate OT pay."""
    if not frappe.db.exists("Additional Salary", request_id):
        frappe.throw(f"OT Request {request_id} not found", frappe.DoesNotExistError)

    doc = frappe.get_doc("Additional Salary", request_id)
    meta = frappe.parse_json(doc.notes or "{}")

    if meta.get("status") != "Pending":
        frappe.throw("Can only approve pending OT requests")

    # Calculate OT amount
    settings = _get_ot_settings()
    from hr_core_ext.api.social_security import _get_employee_base_salary

    payroll_date = doc.payroll_date
    month = payroll_date.month if hasattr(payroll_date, 'month') else int(str(payroll_date).split('-')[1])
    year = payroll_date.year if hasattr(payroll_date, 'year') else int(str(payroll_date).split('-')[0])

    base_salary = _get_employee_base_salary(doc.employee, month, year)
    hourly_rate = base_salary / (settings["standard_working_days"] * settings["standard_hours_per_day"])

    ot_type = meta.get("ot_type", "weekday_ot")
    hours = float(meta.get("hours", 0))

    multiplier_map = {
        "weekday_ot": settings["weekday_ot_rate"],
        "holiday_work": settings["holiday_work_monthly"],
        "holiday_ot": settings["holiday_ot_rate"],
    }
    multiplier = multiplier_map.get(ot_type, 1.5)

    amount = round(hourly_rate * multiplier * hours, 2)

    meta["status"] = "Approved"
    meta["approved_by"] = frappe.session.user
    doc.notes = frappe.as_json(meta)
    doc.amount = amount
    doc.save(ignore_permissions=True)
    doc.submit()
    frappe.db.commit()

    return {
        "name": doc.name,
        "status": "Approved",
        "amount": amount,
        "hourly_rate": round(hourly_rate, 2),
        "multiplier": multiplier,
        "hours": hours,
    }


@frappe.whitelist(allow_guest=False)
def reject_ot_request(request_id):
    """Reject an OT request."""
    if not frappe.db.exists("Additional Salary", request_id):
        frappe.throw(f"OT Request {request_id} not found", frappe.DoesNotExistError)

    doc = frappe.get_doc("Additional Salary", request_id)
    meta = frappe.parse_json(doc.notes or "{}")

    if meta.get("status") != "Pending":
        frappe.throw("Can only reject pending OT requests")

    meta["status"] = "Rejected"
    meta["approved_by"] = frappe.session.user
    doc.notes = frappe.as_json(meta)
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "name": doc.name,
        "status": "Rejected",
    }


@frappe.whitelist(allow_guest=False)
def cancel_ot_request(request_id):
    """Cancel a pending OT request."""
    if not frappe.db.exists("Additional Salary", request_id):
        frappe.throw(f"OT Request {request_id} not found", frappe.DoesNotExistError)

    doc = frappe.get_doc("Additional Salary", request_id)
    meta = frappe.parse_json(doc.notes or "{}")

    if meta.get("status") != "Pending":
        frappe.throw("Can only cancel pending OT requests")

    meta["status"] = "Cancelled"
    doc.notes = frappe.as_json(meta)
    doc.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "name": doc.name,
        "status": "Cancelled",
    }


@frappe.whitelist(allow_guest=False)
def calculate_ot_pay(employee_id, month, year):
    """Calculate total OT pay for an employee for a given month."""
    month = int(month)
    year = int(year)

    requests = get_ot_requests(employee_id=employee_id, status="Approved", month=month, year=year)

    total_hours = 0.0
    total_amount = 0.0
    for r in requests:
        total_hours += float(r.get("hours", 0))
        total_amount += float(r.get("amount", 0))

    return {
        "employee": employee_id,
        "month": month,
        "year": year,
        "total_hours": round(total_hours, 2),
        "total_amount": round(total_amount, 2),
        "request_count": len(requests),
    }
