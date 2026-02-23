import frappe


@frappe.whitelist(allow_guest=False)
def setup_employee_payroll(employee_id, base_salary, housing=0, transport=0):
    """Create a Salary Structure Assignment for an employee using the Thai Standard structure."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    structure_name = "Thai Standard"
    if not frappe.db.exists("Salary Structure", structure_name):
        frappe.throw("Salary Structure 'Thai Standard' not found. Run payroll setup first.")

    base_salary = float(base_salary)
    housing = float(housing)
    transport = float(transport)

    # Check for existing active assignment
    existing = frappe.get_list(
        "Salary Structure Assignment",
        filters={
            "employee": employee_id,
            "salary_structure": structure_name,
            "docstatus": 1,
        },
        limit_page_length=1,
    )
    if existing:
        frappe.throw("Employee already has an active salary structure assignment.")

    # Use the later of: first day of current month or employee joining date
    first_of_month = frappe.utils.get_first_day(frappe.utils.nowdate())
    joining_date = frappe.db.get_value("Employee", employee_id, "date_of_joining")
    if joining_date and str(joining_date) > str(first_of_month):
        from_date = joining_date
    else:
        from_date = first_of_month

    doc = frappe.get_doc({
        "doctype": "Salary Structure Assignment",
        "employee": employee_id,
        "salary_structure": structure_name,
        "from_date": from_date,
        "base": base_salary,
        "company": frappe.db.get_value("Employee", employee_id, "company"),
    })
    doc.insert(ignore_permissions=True)
    doc.submit()
    frappe.db.commit()

    return {
        "name": doc.name,
        "employee": employee_id,
        "salary_structure": structure_name,
        "base": base_salary,
        "from_date": str(from_date),
    }


@frappe.whitelist(allow_guest=False)
def get_salary_slips(employee_id=None, year=None, month=None):
    """List salary slips filtered by employee and/or period."""
    filters = {}
    if employee_id:
        if not frappe.db.exists("Employee", employee_id):
            frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)
        filters["employee"] = employee_id

    if year and month:
        year = int(year)
        month = int(month)
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        filters["start_date"] = [">=", f"{year}-{month:02d}-01"]
        filters["end_date"] = ["<=", f"{year}-{month:02d}-{last_day}"]
    elif year:
        year = int(year)
        filters["start_date"] = [">=", f"{year}-01-01"]
        filters["end_date"] = ["<=", f"{year}-12-31"]

    slips = frappe.get_list(
        "Salary Slip",
        fields=[
            "name", "employee", "employee_name",
            "start_date", "end_date",
            "gross_pay", "total_deduction", "net_pay",
            "docstatus", "posting_date",
        ],
        filters=filters,
        order_by="start_date desc",
        limit_page_length=0,
    )

    # Map docstatus to human-readable status
    for slip in slips:
        if slip.docstatus == 0:
            slip["status"] = "Draft"
        elif slip.docstatus == 1:
            slip["status"] = "Submitted"
        elif slip.docstatus == 2:
            slip["status"] = "Cancelled"
        slip["start_date"] = str(slip["start_date"])
        slip["end_date"] = str(slip["end_date"])
        slip["posting_date"] = str(slip["posting_date"]) if slip.get("posting_date") else None
        slip["gross_pay"] = float(slip["gross_pay"] or 0)
        slip["total_deduction"] = float(slip["total_deduction"] or 0)
        slip["net_pay"] = float(slip["net_pay"] or 0)

    return slips


@frappe.whitelist(allow_guest=False)
def get_salary_slip_detail(slip_id):
    """Get full salary slip with earnings and deductions breakdown."""
    if not frappe.db.exists("Salary Slip", slip_id):
        frappe.throw(f"Salary Slip {slip_id} not found", frappe.DoesNotExistError)

    doc = frappe.get_doc("Salary Slip", slip_id)

    earnings = []
    for e in doc.earnings:
        earnings.append({
            "salary_component": e.salary_component,
            "amount": float(e.amount or 0),
            "formula": e.formula,
        })

    deductions = []
    for d in doc.deductions:
        deductions.append({
            "salary_component": d.salary_component,
            "amount": float(d.amount or 0),
            "formula": d.formula,
        })

    status_map = {0: "Draft", 1: "Submitted", 2: "Cancelled"}

    return {
        "name": doc.name,
        "employee": doc.employee,
        "employee_name": doc.employee_name,
        "start_date": str(doc.start_date),
        "end_date": str(doc.end_date),
        "posting_date": str(doc.posting_date) if doc.posting_date else None,
        "gross_pay": float(doc.gross_pay or 0),
        "total_deduction": float(doc.total_deduction or 0),
        "net_pay": float(doc.net_pay or 0),
        "status": status_map.get(doc.docstatus, "Unknown"),
        "earnings": earnings,
        "deductions": deductions,
    }


@frappe.whitelist(allow_guest=False)
def generate_salary_slip(employee_id, month, year):
    """Generate a single salary slip for an employee for a given month."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    month = int(month)
    year = int(year)
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month:02d}-{last_day}"

    # Check if slip already exists for this period
    existing = frappe.get_list(
        "Salary Slip",
        filters={
            "employee": employee_id,
            "start_date": start_date,
            "end_date": end_date,
            "docstatus": ["!=", 2],  # Not cancelled
        },
        limit_page_length=1,
    )
    if existing:
        frappe.throw(f"Salary slip already exists for {employee_id} for {year}-{month:02d}")

    # Check active salary structure assignment
    assignment = frappe.get_list(
        "Salary Structure Assignment",
        filters={
            "employee": employee_id,
            "docstatus": 1,
            "from_date": ["<=", end_date],
        },
        fields=["salary_structure"],
        order_by="from_date desc",
        limit_page_length=1,
    )
    if not assignment:
        frappe.throw(f"No active salary structure assignment for {employee_id}")

    doc = frappe.get_doc({
        "doctype": "Salary Slip",
        "employee": employee_id,
        "salary_structure": assignment[0].salary_structure,
        "start_date": start_date,
        "end_date": end_date,
        "posting_date": end_date,
    })
    doc.insert(ignore_permissions=True)

    # Apply OT/SSO/PVD/Tax components
    _apply_payroll_components(doc, month, year)
    frappe.db.commit()

    return {
        "name": doc.name,
        "employee": doc.employee,
        "employee_name": doc.employee_name,
        "start_date": str(doc.start_date),
        "end_date": str(doc.end_date),
        "gross_pay": float(doc.gross_pay or 0),
        "total_deduction": float(doc.total_deduction or 0),
        "net_pay": float(doc.net_pay or 0),
        "status": "Draft",
    }


@frappe.whitelist(allow_guest=False)
def process_payroll(month, year, company=None):
    """Create salary slips for all active employees with salary structure assignments."""
    month = int(month)
    year = int(year)
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month:02d}-{last_day}"

    # Get all active employees with salary structure assignments
    assignments = frappe.get_list(
        "Salary Structure Assignment",
        filters={
            "docstatus": 1,
            "from_date": ["<=", end_date],
        },
        fields=["employee", "employee_name", "salary_structure", "company"],
        order_by="from_date desc",
        limit_page_length=0,
    )

    if company:
        assignments = [a for a in assignments if a.company == company]

    # Deduplicate - keep latest assignment per employee
    seen = set()
    unique_assignments = []
    for a in assignments:
        if a.employee not in seen:
            seen.add(a.employee)
            unique_assignments.append(a)

    created = []
    skipped = []
    errors = []

    for a in unique_assignments:
        # Check if employee is active
        emp_status = frappe.db.get_value("Employee", a.employee, "status")
        if emp_status != "Active":
            skipped.append({"employee": a.employee, "reason": "Not active"})
            continue

        # Check if slip already exists
        existing = frappe.get_list(
            "Salary Slip",
            filters={
                "employee": a.employee,
                "start_date": start_date,
                "end_date": end_date,
                "docstatus": ["!=", 2],
            },
            limit_page_length=1,
        )
        if existing:
            skipped.append({"employee": a.employee, "reason": "Slip already exists"})
            continue

        try:
            doc = frappe.get_doc({
                "doctype": "Salary Slip",
                "employee": a.employee,
                "salary_structure": a.salary_structure,
                "start_date": start_date,
                "end_date": end_date,
                "posting_date": end_date,
            })
            doc.insert(ignore_permissions=True)

            # Apply OT/SSO/PVD/Tax components
            _apply_payroll_components(doc, month, year)
            created.append({
                "name": doc.name,
                "employee": a.employee,
                "employee_name": a.employee_name,
                "gross_pay": float(doc.gross_pay or 0),
                "total_deduction": float(doc.total_deduction or 0),
                "net_pay": float(doc.net_pay or 0),
            })
        except Exception as e:
            errors.append({"employee": a.employee, "error": str(e)})

    frappe.db.commit()

    total_gross = sum(s["gross_pay"] for s in created)
    total_deduction = sum(s["total_deduction"] for s in created)
    total_net = sum(s["net_pay"] for s in created)

    return {
        "month": month,
        "year": year,
        "created_count": len(created),
        "skipped_count": len(skipped),
        "error_count": len(errors),
        "total_gross": total_gross,
        "total_deduction": total_deduction,
        "total_net": total_net,
        "slips": created,
        "skipped": skipped,
        "errors": errors,
    }


@frappe.whitelist(allow_guest=False)
def submit_payroll(month, year, company=None):
    """Submit all draft salary slips for a given month."""
    month = int(month)
    year = int(year)
    import calendar
    last_day = calendar.monthrange(year, month)[1]
    start_date = f"{year}-{month:02d}-01"
    end_date = f"{year}-{month:02d}-{last_day}"

    filters = {
        "start_date": start_date,
        "end_date": end_date,
        "docstatus": 0,  # Draft only
    }

    slips = frappe.get_list(
        "Salary Slip",
        filters=filters,
        fields=["name", "employee", "employee_name", "net_pay"],
        limit_page_length=0,
    )

    submitted = []
    errors = []

    for slip in slips:
        try:
            doc = frappe.get_doc("Salary Slip", slip.name)
            doc.submit()
            submitted.append({
                "name": slip.name,
                "employee": slip.employee,
                "employee_name": slip.employee_name,
                "net_pay": float(slip.net_pay or 0),
            })
        except Exception as e:
            errors.append({"name": slip.name, "employee": slip.employee, "error": str(e)})

    frappe.db.commit()

    return {
        "submitted_count": len(submitted),
        "error_count": len(errors),
        "submitted": submitted,
        "errors": errors,
    }


def _apply_payroll_components(doc, month, year):
    """Apply OT earning and SSO/PVD/Tax deductions to a salary slip.

    Order:
    1. Calculate OT → add/update "Overtime" earning
    2. Calculate SSO → set "Social Security" deduction
    3. Calculate PVD → set "Provident Fund" deduction
    4. Calculate Tax (after knowing gross + all deductions) → set "Personal Income Tax" deduction
    5. Save + recalculate
    """
    employee_id = doc.employee

    # 1. Overtime earning
    try:
        from hr_core_ext.api.overtime import calculate_ot_pay
        ot = calculate_ot_pay(employee_id, month, year)
        ot_amount = float(ot.get("total_amount", 0))
        if ot_amount > 0:
            _set_salary_detail(doc, "earnings", "Overtime", ot_amount)
    except Exception:
        pass

    # 2. Social Security deduction
    try:
        from hr_core_ext.api.social_security import calculate_sso_contribution
        sso = calculate_sso_contribution(employee_id, month, year)
        sso_amount = float(sso.get("employee_contribution", 0))
        if sso_amount > 0:
            _set_salary_detail(doc, "deductions", "Social Security", sso_amount)
    except Exception:
        pass

    # 3. Provident Fund deduction
    try:
        from hr_core_ext.api.provident_fund import calculate_pvd_contribution
        pvd = calculate_pvd_contribution(employee_id, month, year)
        pvd_amount = float(pvd.get("employee_contribution", 0))
        if pvd_amount > 0:
            _set_salary_detail(doc, "deductions", "Provident Fund", pvd_amount)
    except Exception:
        pass

    # 4. Tax (calculated after all other components)
    try:
        from hr_core_ext.api.tax import calculate_monthly_withholding
        tax = calculate_monthly_withholding(employee_id, month, year)
        tax_amount = float(tax.get("monthly_withholding", 0))
        if tax_amount > 0:
            _set_salary_detail(doc, "deductions", "Personal Income Tax", tax_amount)
    except Exception:
        pass

    # 5. Save to recalculate totals
    doc.save(ignore_permissions=True)


def _set_salary_detail(doc, detail_type, component_name, amount):
    """Set or update a salary component amount on a salary slip."""
    details = doc.earnings if detail_type == "earnings" else doc.deductions

    # Try to find existing component
    for detail in details:
        if detail.salary_component == component_name:
            detail.amount = amount
            detail.default_amount = amount
            return

    # Add new component row
    row = doc.append(detail_type, {})
    row.salary_component = component_name
    row.amount = amount
    row.default_amount = amount
