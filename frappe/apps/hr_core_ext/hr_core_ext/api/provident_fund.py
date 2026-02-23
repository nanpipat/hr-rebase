import frappe


# ── PVD Settings ─────────────────────────────────────────────

def _get_pvd_settings():
    """Get PVD settings or defaults."""
    defaults = {
        "min_rate": 3.0,
        "max_rate": 15.0,
        "default_employee_rate": 5.0,
        "default_employer_rate": 5.0,
    }
    stored = {}
    try:
        rows = frappe.db.sql(
            "SELECT field, value FROM tabSingles WHERE doctype='PVD Settings'",
            as_dict=True
        )
        for r in rows:
            stored[r["field"]] = r["value"]
    except Exception:
        pass

    return {
        "min_rate": float(stored.get("min_rate", defaults["min_rate"])),
        "max_rate": float(stored.get("max_rate", defaults["max_rate"])),
        "default_employee_rate": float(stored.get("default_employee_rate", defaults["default_employee_rate"])),
        "default_employer_rate": float(stored.get("default_employer_rate", defaults["default_employer_rate"])),
    }


def _save_pvd_settings(settings):
    """Save PVD settings to Singles table."""
    for key, value in settings.items():
        existing = frappe.db.sql(
            "SELECT value FROM tabSingles WHERE doctype='PVD Settings' AND field=%s",
            (key,), as_dict=True
        )
        if existing:
            frappe.db.sql(
                "UPDATE tabSingles SET value=%s WHERE doctype='PVD Settings' AND field=%s",
                (str(value), key)
            )
        else:
            frappe.db.sql(
                "INSERT INTO tabSingles (doctype, field, value) VALUES ('PVD Settings', %s, %s)",
                (key, str(value))
            )


@frappe.whitelist(allow_guest=False)
def get_pvd_config():
    """Get PVD configuration."""
    return _get_pvd_settings()


@frappe.whitelist(allow_guest=False)
def update_pvd_config(min_rate=None, max_rate=None, default_employee_rate=None, default_employer_rate=None):
    """Update PVD configuration."""
    settings = _get_pvd_settings()

    if min_rate is not None:
        settings["min_rate"] = float(min_rate)
    if max_rate is not None:
        settings["max_rate"] = float(max_rate)
    if default_employee_rate is not None:
        settings["default_employee_rate"] = float(default_employee_rate)
    if default_employer_rate is not None:
        settings["default_employer_rate"] = float(default_employer_rate)

    _save_pvd_settings(settings)
    frappe.db.commit()
    return settings


@frappe.whitelist(allow_guest=False)
def enroll_employee_pvd(employee_id, employee_rate=None, employer_rate=None):
    """Enroll an employee in provident fund."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    settings = _get_pvd_settings()
    emp_rate = float(employee_rate) if employee_rate else settings["default_employee_rate"]
    emr_rate = float(employer_rate) if employer_rate else settings["default_employer_rate"]

    if emp_rate < settings["min_rate"] or emp_rate > settings["max_rate"]:
        frappe.throw(f"Employee rate must be between {settings['min_rate']}% and {settings['max_rate']}%")
    if emr_rate < settings["min_rate"] or emr_rate > settings["max_rate"]:
        frappe.throw(f"Employer rate must be between {settings['min_rate']}% and {settings['max_rate']}%")

    frappe.db.set_value("Employee", employee_id, {
        "pvd_enrolled": 1,
        "pvd_employee_rate": emp_rate,
        "pvd_employer_rate": emr_rate,
        "pvd_enrollment_date": frappe.utils.nowdate(),
    })
    frappe.db.commit()

    return {
        "employee": employee_id,
        "pvd_enrolled": True,
        "pvd_employee_rate": emp_rate,
        "pvd_employer_rate": emr_rate,
        "pvd_enrollment_date": frappe.utils.nowdate(),
    }


@frappe.whitelist(allow_guest=False)
def update_employee_pvd(employee_id, employee_rate=None, employer_rate=None):
    """Update employee's PVD rates."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    settings = _get_pvd_settings()
    updates = {}

    if employee_rate is not None:
        emp_rate = float(employee_rate)
        if emp_rate < settings["min_rate"] or emp_rate > settings["max_rate"]:
            frappe.throw(f"Employee rate must be between {settings['min_rate']}% and {settings['max_rate']}%")
        updates["pvd_employee_rate"] = emp_rate

    if employer_rate is not None:
        emr_rate = float(employer_rate)
        if emr_rate < settings["min_rate"] or emr_rate > settings["max_rate"]:
            frappe.throw(f"Employer rate must be between {settings['min_rate']}% and {settings['max_rate']}%")
        updates["pvd_employer_rate"] = emr_rate

    if updates:
        frappe.db.set_value("Employee", employee_id, updates)
        frappe.db.commit()

    emp = frappe.get_doc("Employee", employee_id)
    return {
        "employee": employee_id,
        "pvd_enrolled": bool(getattr(emp, "pvd_enrolled", 0)),
        "pvd_employee_rate": float(getattr(emp, "pvd_employee_rate", 0)),
        "pvd_employer_rate": float(getattr(emp, "pvd_employer_rate", 0)),
    }


@frappe.whitelist(allow_guest=False)
def unenroll_employee_pvd(employee_id):
    """Remove employee from provident fund."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    frappe.db.set_value("Employee", employee_id, {
        "pvd_enrolled": 0,
        "pvd_employee_rate": 0,
        "pvd_employer_rate": 0,
    })
    frappe.db.commit()

    return {
        "employee": employee_id,
        "pvd_enrolled": False,
    }


@frappe.whitelist(allow_guest=False)
def get_employee_pvd(employee_id):
    """Get employee PVD enrollment details."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    emp = frappe.get_doc("Employee", employee_id)
    return {
        "employee": employee_id,
        "employee_name": emp.employee_name,
        "pvd_enrolled": bool(getattr(emp, "pvd_enrolled", 0)),
        "pvd_employee_rate": float(getattr(emp, "pvd_employee_rate", 0)),
        "pvd_employer_rate": float(getattr(emp, "pvd_employer_rate", 0)),
        "pvd_enrollment_date": str(getattr(emp, "pvd_enrollment_date", "")) or None,
    }


@frappe.whitelist(allow_guest=False)
def calculate_pvd_contribution(employee_id, month, year):
    """Calculate PVD contribution for an employee."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    month = int(month)
    year = int(year)

    emp = frappe.get_doc("Employee", employee_id)
    if not getattr(emp, "pvd_enrolled", 0):
        return {
            "employee": employee_id,
            "pvd_enrolled": False,
            "employee_contribution": 0,
            "employer_contribution": 0,
        }

    from hr_core_ext.api.social_security import _get_employee_base_salary
    base_salary = _get_employee_base_salary(employee_id, month, year)

    emp_rate = float(getattr(emp, "pvd_employee_rate", 0)) / 100.0
    emr_rate = float(getattr(emp, "pvd_employer_rate", 0)) / 100.0

    return {
        "employee": employee_id,
        "pvd_enrolled": True,
        "base_salary": base_salary,
        "employee_rate": float(getattr(emp, "pvd_employee_rate", 0)),
        "employer_rate": float(getattr(emp, "pvd_employer_rate", 0)),
        "employee_contribution": round(base_salary * emp_rate, 2),
        "employer_contribution": round(base_salary * emr_rate, 2),
    }


@frappe.whitelist(allow_guest=False)
def get_pvd_report(month, year):
    """Get PVD report for all enrolled employees."""
    month = int(month)
    year = int(year)

    employees = frappe.get_list(
        "Employee",
        filters={"status": "Active", "pvd_enrolled": 1},
        fields=["name", "employee_name", "pvd_employee_rate", "pvd_employer_rate"],
        limit_page_length=0,
    )

    report = []
    total_employee = 0.0
    total_employer = 0.0

    for emp in employees:
        try:
            calc = calculate_pvd_contribution(emp.name, month, year)
            total_employee += calc["employee_contribution"]
            total_employer += calc["employer_contribution"]
            report.append({
                "employee": emp.name,
                "employee_name": emp.employee_name,
                "employee_rate": float(emp.pvd_employee_rate or 0),
                "employer_rate": float(emp.pvd_employer_rate or 0),
                "employee_contribution": calc["employee_contribution"],
                "employer_contribution": calc["employer_contribution"],
            })
        except Exception:
            pass

    return {
        "month": month,
        "year": year,
        "employees": report,
        "total_employee_contribution": round(total_employee, 2),
        "total_employer_contribution": round(total_employer, 2),
        "enrolled_count": len(report),
    }
