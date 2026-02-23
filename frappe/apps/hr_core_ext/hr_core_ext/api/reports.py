import frappe


@frappe.whitelist(allow_guest=False)
def get_employee_summary(company=None):
    """Get employee headcount, department breakdown, turnover rate."""
    filters = {}
    if company:
        filters["company"] = company

    all_employees = frappe.get_list(
        "Employee",
        filters=filters,
        fields=["name", "status", "department", "date_of_joining", "relieving_date"],
        limit_page_length=0,
    )

    total = len(all_employees)
    active = sum(1 for e in all_employees if e.status == "Active")
    inactive = total - active

    # Department breakdown
    dept_map = {}
    for e in all_employees:
        dept = e.department or "Unassigned"
        if dept not in dept_map:
            dept_map[dept] = {"total": 0, "active": 0}
        dept_map[dept]["total"] += 1
        if e.status == "Active":
            dept_map[dept]["active"] += 1

    departments = [
        {"department": k, "total": v["total"], "active": v["active"]}
        for k, v in sorted(dept_map.items())
    ]

    # Turnover rate (employees who left this year)
    import datetime
    current_year = datetime.date.today().year
    left_this_year = sum(
        1 for e in all_employees
        if e.relieving_date and hasattr(e.relieving_date, 'year') and e.relieving_date.year == current_year
    )
    turnover_rate = round((left_this_year / active * 100) if active > 0 else 0, 1)

    return {
        "total_employees": total,
        "active_employees": active,
        "inactive_employees": inactive,
        "turnover_rate": turnover_rate,
        "left_this_year": left_this_year,
        "departments": departments,
    }


@frappe.whitelist(allow_guest=False)
def get_attendance_report(month, year, company=None):
    """Get attendance report for a given month."""
    month = int(month)
    year = int(year)
    import calendar
    last_day = calendar.monthrange(year, month)[1]

    filters = {
        "attendance_date": ["between", [f"{year}-{month:02d}-01", f"{year}-{month:02d}-{last_day}"]],
        "docstatus": 1,
    }
    if company:
        filters["company"] = company

    records = frappe.get_list(
        "Attendance",
        filters=filters,
        fields=["employee", "employee_name", "status", "attendance_date", "working_hours", "late_entry", "early_exit"],
        limit_page_length=0,
    )

    # Aggregate per employee
    emp_map = {}
    for r in records:
        eid = r.employee
        if eid not in emp_map:
            emp_map[eid] = {
                "employee": eid,
                "employee_name": r.employee_name,
                "present": 0, "absent": 0, "half_day": 0, "on_leave": 0,
                "late": 0, "early_exit": 0, "total_hours": 0,
            }
        status = r.status
        if status == "Present":
            emp_map[eid]["present"] += 1
        elif status == "Absent":
            emp_map[eid]["absent"] += 1
        elif status == "Half Day":
            emp_map[eid]["half_day"] += 1
        elif status == "On Leave":
            emp_map[eid]["on_leave"] += 1
        if r.late_entry:
            emp_map[eid]["late"] += 1
        if r.early_exit:
            emp_map[eid]["early_exit"] += 1
        emp_map[eid]["total_hours"] += float(r.working_hours or 0)

    employees = sorted(emp_map.values(), key=lambda x: x["employee_name"])
    for e in employees:
        e["total_hours"] = round(e["total_hours"], 1)

    return {
        "month": month,
        "year": year,
        "working_days": last_day,
        "employees": employees,
        "total_records": len(records),
    }


@frappe.whitelist(allow_guest=False)
def get_leave_report(year, company=None):
    """Get leave usage report for a year."""
    year = int(year)

    filters = {
        "from_date": [">=", f"{year}-01-01"],
        "to_date": ["<=", f"{year}-12-31"],
        "status": "Approved",
        "docstatus": 1,
    }
    if company:
        filters["company"] = company

    applications = frappe.get_list(
        "Leave Application",
        filters=filters,
        fields=["employee", "employee_name", "leave_type", "total_leave_days", "from_date", "to_date"],
        limit_page_length=0,
    )

    # By type
    type_map = {}
    for a in applications:
        lt = a.leave_type
        if lt not in type_map:
            type_map[lt] = {"leave_type": lt, "total_days": 0, "count": 0}
        type_map[lt]["total_days"] += float(a.total_leave_days or 0)
        type_map[lt]["count"] += 1

    by_type = sorted(type_map.values(), key=lambda x: x["total_days"], reverse=True)

    # By employee
    emp_map = {}
    for a in applications:
        eid = a.employee
        if eid not in emp_map:
            emp_map[eid] = {"employee": eid, "employee_name": a.employee_name, "total_days": 0, "count": 0}
        emp_map[eid]["total_days"] += float(a.total_leave_days or 0)
        emp_map[eid]["count"] += 1

    by_employee = sorted(emp_map.values(), key=lambda x: x["total_days"], reverse=True)

    return {
        "year": year,
        "by_type": by_type,
        "by_employee": by_employee,
        "total_applications": len(applications),
        "total_days": round(sum(float(a.total_leave_days or 0) for a in applications), 1),
    }


@frappe.whitelist(allow_guest=False)
def get_payroll_report(year, month=None, company=None):
    """Get payroll summary report."""
    year = int(year)

    filters = {
        "start_date": [">=", f"{year}-01-01"],
        "end_date": ["<=", f"{year}-12-31"],
        "docstatus": ["in", [0, 1]],
    }
    if month:
        month = int(month)
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        filters["start_date"] = [">=", f"{year}-{month:02d}-01"]
        filters["end_date"] = ["<=", f"{year}-{month:02d}-{last_day}"]

    slips = frappe.get_list(
        "Salary Slip",
        filters=filters,
        fields=["name", "employee", "employee_name", "gross_pay", "total_deduction", "net_pay", "docstatus", "start_date"],
        limit_page_length=0,
    )

    total_gross = sum(float(s.gross_pay or 0) for s in slips)
    total_deduction = sum(float(s.total_deduction or 0) for s in slips)
    total_net = sum(float(s.net_pay or 0) for s in slips)
    draft_count = sum(1 for s in slips if s.docstatus == 0)
    submitted_count = sum(1 for s in slips if s.docstatus == 1)

    return {
        "year": year,
        "month": month,
        "total_slips": len(slips),
        "draft_count": draft_count,
        "submitted_count": submitted_count,
        "total_gross": round(total_gross, 2),
        "total_deduction": round(total_deduction, 2),
        "total_net": round(total_net, 2),
    }


@frappe.whitelist(allow_guest=False)
def get_tax_report(year, month=None):
    """Get tax summary report."""
    from hr_core_ext.api.tax import get_pnd1_data

    year = int(year)

    if month:
        return get_pnd1_data(int(month), year)

    # Annual summary
    monthly_totals = []
    annual_tax = 0.0
    annual_income = 0.0

    for m in range(1, 13):
        try:
            pnd1 = get_pnd1_data(m, year)
            monthly_totals.append({
                "month": m,
                "total_income": pnd1["total_income"],
                "total_tax": pnd1["total_tax"],
                "employee_count": pnd1["employee_count"],
            })
            annual_tax += pnd1["total_tax"]
            annual_income += pnd1["total_income"]
        except Exception:
            monthly_totals.append({"month": m, "total_income": 0, "total_tax": 0, "employee_count": 0})

    return {
        "year": year,
        "monthly_totals": monthly_totals,
        "annual_income": round(annual_income, 2),
        "annual_tax": round(annual_tax, 2),
    }


@frappe.whitelist(allow_guest=False)
def export_report_csv(report_type, year=None, month=None, company=None):
    """Export report data as CSV-ready arrays."""
    import datetime
    if not year:
        year = datetime.date.today().year

    if report_type == "employee":
        data = get_employee_summary(company=company)
        headers = ["Department", "Total", "Active"]
        rows = [[d["department"], d["total"], d["active"]] for d in data["departments"]]

    elif report_type == "attendance":
        if not month:
            month = datetime.date.today().month
        data = get_attendance_report(month, year, company=company)
        headers = ["Employee", "Name", "Present", "Absent", "Half Day", "Late", "Early Exit", "Total Hours"]
        rows = [
            [e["employee"], e["employee_name"], e["present"], e["absent"], e["half_day"], e["late"], e["early_exit"], e["total_hours"]]
            for e in data["employees"]
        ]

    elif report_type == "leave":
        data = get_leave_report(year, company=company)
        headers = ["Employee", "Name", "Total Days", "Count"]
        rows = [[e["employee"], e["employee_name"], e["total_days"], e["count"]] for e in data["by_employee"]]

    elif report_type == "payroll":
        data = get_payroll_report(year, month=month, company=company)
        headers = ["Total Slips", "Draft", "Submitted", "Total Gross", "Total Deduction", "Total Net"]
        rows = [[data["total_slips"], data["draft_count"], data["submitted_count"],
                 data["total_gross"], data["total_deduction"], data["total_net"]]]

    else:
        frappe.throw(f"Unknown report type: {report_type}")

    return {
        "headers": headers,
        "rows": rows,
        "report_type": report_type,
    }
