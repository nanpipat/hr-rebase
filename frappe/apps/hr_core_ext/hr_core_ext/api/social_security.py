import frappe


# ── SSO Settings (Single Doctype simulation using site config) ─────

def _get_sso_settings():
    """Get SSO settings from Site Config or return defaults."""
    defaults = {
        "rate": 5.0,            # 5%
        "max_salary": 15000.0,  # Salary cap for SSO calculation
        "max_contribution": 750.0,  # Maximum monthly contribution
    }
    stored = frappe.db.get_singles_dict("SSO Settings") if frappe.db.exists("DocType", "SSO Settings") else {}
    return {
        "rate": float(stored.get("rate", defaults["rate"])),
        "max_salary": float(stored.get("max_salary", defaults["max_salary"])),
        "max_contribution": float(stored.get("max_contribution", defaults["max_contribution"])),
    }


@frappe.whitelist(allow_guest=False)
def get_sso_config():
    """Get current SSO configuration."""
    return _get_sso_settings()


@frappe.whitelist(allow_guest=False)
def update_sso_config(rate=None, max_salary=None, max_contribution=None):
    """Update SSO configuration."""
    settings = _get_sso_settings()

    if rate is not None:
        settings["rate"] = float(rate)
    if max_salary is not None:
        settings["max_salary"] = float(max_salary)
    if max_contribution is not None:
        settings["max_contribution"] = float(max_contribution)

    # Store in Singles table (custom approach using site config or custom doctype)
    _save_sso_settings(settings)
    frappe.db.commit()
    return settings


def _save_sso_settings(settings):
    """Save SSO settings. Uses a simple key-value approach in Singles."""
    for key, value in settings.items():
        existing = frappe.db.sql(
            "SELECT value FROM tabSingles WHERE doctype='SSO Settings' AND field=%s",
            (key,), as_dict=True
        )
        if existing:
            frappe.db.sql(
                "UPDATE tabSingles SET value=%s WHERE doctype='SSO Settings' AND field=%s",
                (str(value), key)
            )
        else:
            frappe.db.sql(
                "INSERT INTO tabSingles (doctype, field, value) VALUES ('SSO Settings', %s, %s)",
                (key, str(value))
            )


@frappe.whitelist(allow_guest=False)
def calculate_sso_contribution(employee_id, month, year):
    """Calculate SSO contribution for an employee for a given month."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    month = int(month)
    year = int(year)

    settings = _get_sso_settings()
    rate = settings["rate"] / 100.0
    max_salary = settings["max_salary"]
    max_contribution = settings["max_contribution"]

    # Get base salary from latest salary structure assignment
    base_salary = _get_employee_base_salary(employee_id, month, year)

    # Calculate: contribution = min(salary, max_salary) × rate, capped at max_contribution
    taxable_salary = min(base_salary, max_salary)
    contribution = min(taxable_salary * rate, max_contribution)

    return {
        "employee": employee_id,
        "month": month,
        "year": year,
        "base_salary": base_salary,
        "rate": settings["rate"],
        "employee_contribution": round(contribution, 2),
        "employer_contribution": round(contribution, 2),  # Employer matches
    }


@frappe.whitelist(allow_guest=False)
def get_sso_report(month, year):
    """Get SSO report for all employees for a given month."""
    month = int(month)
    year = int(year)

    employees = frappe.get_list(
        "Employee",
        filters={"status": "Active"},
        fields=["name", "employee_name", "company"],
        limit_page_length=0,
    )

    report = []
    total_employee = 0.0
    total_employer = 0.0

    for emp in employees:
        try:
            calc = calculate_sso_contribution(emp.name, month, year)
            total_employee += calc["employee_contribution"]
            total_employer += calc["employer_contribution"]
            report.append({
                "employee": emp.name,
                "employee_name": emp.employee_name,
                "base_salary": calc["base_salary"],
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
        "employee_count": len(report),
    }


@frappe.whitelist(allow_guest=False)
def get_employee_sso_number(employee_id):
    """Get employee's SSO number."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    sso_number = frappe.db.get_value("Employee", employee_id, "sso_number") or ""
    return {
        "employee": employee_id,
        "sso_number": sso_number,
    }


@frappe.whitelist(allow_guest=False)
def update_employee_sso_number(employee_id, sso_number):
    """Update employee's SSO number."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    frappe.db.set_value("Employee", employee_id, "sso_number", sso_number)
    frappe.db.commit()
    return {
        "employee": employee_id,
        "sso_number": sso_number,
    }


def _get_employee_base_salary(employee_id, month, year):
    """Get base salary from the latest salary structure assignment."""
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    end_date = f"{year}-{month:02d}-{last_day}"

    assignment = frappe.get_list(
        "Salary Structure Assignment",
        filters={
            "employee": employee_id,
            "docstatus": 1,
            "from_date": ["<=", end_date],
        },
        fields=["base"],
        order_by="from_date desc",
        limit_page_length=1,
    )

    if not assignment:
        return 0.0

    return float(assignment[0].base or 0)
