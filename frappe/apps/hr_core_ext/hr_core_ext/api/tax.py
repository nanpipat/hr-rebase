import frappe


# ── Thai Tax Slabs (uses existing Income Tax Slab doctype) ───

@frappe.whitelist(allow_guest=False)
def get_tax_slabs():
    """Get current income tax slabs."""
    import datetime
    year = datetime.date.today().year

    slabs = frappe.get_list(
        "Income Tax Slab",
        filters={"effective_from": ["<=", f"{year}-12-31"]},
        fields=["name", "effective_from"],
        order_by="effective_from desc",
        limit_page_length=1,
    )

    if not slabs:
        return {"slabs": [], "name": ""}

    slab_doc = frappe.get_doc("Income Tax Slab", slabs[0].name)
    result = []
    for s in slab_doc.slabs:
        result.append({
            "from_amount": float(s.from_amount or 0),
            "to_amount": float(s.to_amount or 0),
            "percent_deduction": float(s.percent_deduction or 0),
        })

    return {
        "name": slab_doc.name,
        "effective_from": str(slab_doc.effective_from),
        "slabs": result,
    }


@frappe.whitelist(allow_guest=False)
def get_employee_tax_deductions(employee_id):
    """Get employee's tax deduction information."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    emp = frappe.get_doc("Employee", employee_id)

    return {
        "employee": employee_id,
        "employee_name": emp.employee_name,
        "tax_id": getattr(emp, "tax_id", "") or "",
        "personal_allowance": float(getattr(emp, "personal_allowance", 60000) or 60000),
        "spouse_allowance": float(getattr(emp, "spouse_allowance", 0) or 0),
        "children_count": int(float(getattr(emp, "children_count", 0) or 0)),
        "life_insurance_premium": float(getattr(emp, "life_insurance_premium", 0) or 0),
        "health_insurance_premium": float(getattr(emp, "health_insurance_premium", 0) or 0),
        "housing_loan_interest": float(getattr(emp, "housing_loan_interest", 0) or 0),
        "donation_deduction": float(getattr(emp, "donation_deduction", 0) or 0),
    }


@frappe.whitelist(allow_guest=False)
def update_employee_tax_deductions(employee_id, **kwargs):
    """Update employee's tax deduction information."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    allowed_fields = [
        "tax_id", "personal_allowance", "spouse_allowance", "children_count",
        "life_insurance_premium", "health_insurance_premium",
        "housing_loan_interest", "donation_deduction",
    ]

    updates = {}
    for field in allowed_fields:
        if field in kwargs and kwargs[field] is not None:
            if field == "tax_id":
                updates[field] = str(kwargs[field])
            elif field == "children_count":
                updates[field] = int(float(kwargs[field]))
            else:
                updates[field] = float(kwargs[field])

    if updates:
        frappe.db.set_value("Employee", employee_id, updates)
        frappe.db.commit()

    return get_employee_tax_deductions(employee_id)


@frappe.whitelist(allow_guest=False)
def calculate_monthly_withholding(employee_id, month, year):
    """Calculate monthly tax withholding for an employee.

    Steps:
    1. Estimate annual income = monthly gross × 12
    2. Deduct expense allowance: 50% of income, max 100,000
    3. Deduct personal allowances (personal, spouse, children, insurance, PVD, SSO)
    4. Calculate tax using progressive slabs
    5. Monthly withholding = annual tax / 12
    """
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    month = int(month)
    year = int(year)

    from hr_core_ext.api.social_security import _get_employee_base_salary, calculate_sso_contribution
    from hr_core_ext.api.provident_fund import calculate_pvd_contribution

    base_salary = _get_employee_base_salary(employee_id, month, year)

    # Step 1: Estimate annual income
    annual_income = base_salary * 12

    # Include OT if available
    try:
        from hr_core_ext.api.overtime import calculate_ot_pay
        ot = calculate_ot_pay(employee_id, month, year)
        # Rough estimate: use current month OT × 12 (simplified)
        annual_income += float(ot.get("total_amount", 0)) * 12
    except Exception:
        pass

    # Step 2: Expense deduction (50%, max 100,000)
    expense_deduction = min(annual_income * 0.5, 100000)

    # Step 3: Personal allowances
    emp_deductions = get_employee_tax_deductions(employee_id)
    personal_allowance = emp_deductions["personal_allowance"]
    spouse_allowance = emp_deductions["spouse_allowance"]
    children_allowance = emp_deductions["children_count"] * 30000
    life_insurance = min(emp_deductions["life_insurance_premium"], 100000)
    health_insurance = min(emp_deductions["health_insurance_premium"], 25000)
    housing_loan = min(emp_deductions["housing_loan_interest"], 100000)
    donation = emp_deductions["donation_deduction"]

    # SSO annual (max 750 × 12 = 9,000)
    try:
        sso = calculate_sso_contribution(employee_id, month, year)
        annual_sso = sso["employee_contribution"] * 12
    except Exception:
        annual_sso = 0

    # PVD annual
    try:
        pvd = calculate_pvd_contribution(employee_id, month, year)
        annual_pvd = min(pvd["employee_contribution"] * 12, 500000)  # PVD cap for tax deduction
    except Exception:
        annual_pvd = 0

    total_deductions = (
        expense_deduction +
        personal_allowance +
        spouse_allowance +
        children_allowance +
        life_insurance +
        health_insurance +
        housing_loan +
        donation +
        annual_sso +
        annual_pvd
    )

    # Step 4: Taxable income
    taxable_income = max(annual_income - total_deductions, 0)

    # Step 5: Calculate tax using progressive slabs
    annual_tax = _calculate_progressive_tax(taxable_income)

    # Step 6: Monthly withholding
    monthly_tax = round(annual_tax / 12, 2)

    return {
        "employee": employee_id,
        "month": month,
        "year": year,
        "annual_income": round(annual_income, 2),
        "expense_deduction": round(expense_deduction, 2),
        "personal_allowance": personal_allowance,
        "spouse_allowance": spouse_allowance,
        "children_allowance": children_allowance,
        "life_insurance": life_insurance,
        "health_insurance": health_insurance,
        "housing_loan": housing_loan,
        "donation": donation,
        "annual_sso": round(annual_sso, 2),
        "annual_pvd": round(annual_pvd, 2),
        "total_deductions": round(total_deductions, 2),
        "taxable_income": round(taxable_income, 2),
        "annual_tax": round(annual_tax, 2),
        "monthly_withholding": monthly_tax,
    }


def _calculate_progressive_tax(taxable_income):
    """Calculate Thai progressive income tax.

    Thai PIT slabs:
    0 - 150,000: 0%
    150,001 - 300,000: 5%
    300,001 - 500,000: 10%
    500,001 - 750,000: 15%
    750,001 - 1,000,000: 20%
    1,000,001 - 2,000,000: 25%
    2,000,001 - 5,000,000: 30%
    5,000,001+: 35%
    """
    slabs = [
        (150000, 0.00),
        (150000, 0.05),   # 150,001 - 300,000
        (200000, 0.10),   # 300,001 - 500,000
        (250000, 0.15),   # 500,001 - 750,000
        (250000, 0.20),   # 750,001 - 1,000,000
        (1000000, 0.25),  # 1,000,001 - 2,000,000
        (3000000, 0.30),  # 2,000,001 - 5,000,000
        (float('inf'), 0.35),  # 5,000,001+
    ]

    tax = 0.0
    remaining = taxable_income

    for bracket_size, rate in slabs:
        if remaining <= 0:
            break
        taxable_in_bracket = min(remaining, bracket_size)
        tax += taxable_in_bracket * rate
        remaining -= taxable_in_bracket

    return round(tax, 2)


@frappe.whitelist(allow_guest=False)
def get_employee_tax_summary(employee_id, year):
    """Get annual tax summary for an employee."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    year = int(year)
    monthly_data = []
    total_tax = 0.0

    for m in range(1, 13):
        try:
            calc = calculate_monthly_withholding(employee_id, m, year)
            monthly_data.append({
                "month": m,
                "monthly_withholding": calc["monthly_withholding"],
                "taxable_income": calc["taxable_income"],
            })
            total_tax += calc["monthly_withholding"]
        except Exception:
            monthly_data.append({
                "month": m,
                "monthly_withholding": 0,
                "taxable_income": 0,
            })

    return {
        "employee": employee_id,
        "year": year,
        "monthly_data": monthly_data,
        "total_annual_tax": round(total_tax, 2),
    }


@frappe.whitelist(allow_guest=False)
def get_pnd1_data(month, year):
    """Get PND1 (ภ.ง.ด.1) report data for all employees."""
    month = int(month)
    year = int(year)

    employees = frappe.get_list(
        "Employee",
        filters={"status": "Active"},
        fields=["name", "employee_name"],
        limit_page_length=0,
    )

    records = []
    total_income = 0.0
    total_tax = 0.0

    for emp in employees:
        try:
            calc = calculate_monthly_withholding(emp.name, month, year)
            deductions = get_employee_tax_deductions(emp.name)
            monthly_income = calc["annual_income"] / 12

            records.append({
                "employee": emp.name,
                "employee_name": emp.employee_name,
                "tax_id": deductions.get("tax_id", ""),
                "monthly_income": round(monthly_income, 2),
                "tax_withheld": calc["monthly_withholding"],
            })
            total_income += monthly_income
            total_tax += calc["monthly_withholding"]
        except Exception:
            pass

    return {
        "month": month,
        "year": year,
        "records": records,
        "total_income": round(total_income, 2),
        "total_tax": round(total_tax, 2),
        "employee_count": len(records),
    }


@frappe.whitelist(allow_guest=False)
def get_withholding_cert_data(employee_id, year):
    """Get 50 Tawi (หนังสือรับรองภาษีหัก ณ ที่จ่าย) data for an employee."""
    if not frappe.db.exists("Employee", employee_id):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    year = int(year)
    emp = frappe.get_doc("Employee", employee_id)
    deductions = get_employee_tax_deductions(employee_id)
    summary = get_employee_tax_summary(employee_id, year)

    # Get total income from salary slips
    slips = frappe.get_list(
        "Salary Slip",
        filters={
            "employee": employee_id,
            "start_date": [">=", f"{year}-01-01"],
            "end_date": ["<=", f"{year}-12-31"],
            "docstatus": 1,
        },
        fields=["gross_pay", "total_deduction"],
        limit_page_length=0,
    )

    total_income = sum(float(s.gross_pay or 0) for s in slips)
    total_deduction = sum(float(s.total_deduction or 0) for s in slips)

    return {
        "employee": employee_id,
        "employee_name": emp.employee_name,
        "tax_id": deductions.get("tax_id", ""),
        "year": year,
        "total_income": round(total_income, 2),
        "total_deduction": round(total_deduction, 2),
        "total_tax_withheld": summary["total_annual_tax"],
        "monthly_breakdown": summary["monthly_data"],
    }
