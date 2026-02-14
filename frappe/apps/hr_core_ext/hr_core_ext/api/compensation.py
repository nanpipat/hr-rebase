import frappe


@frappe.whitelist(allow_guest=False)
def get_salary_structure(employee_id):
    """Get the current salary structure assignment and its components for an employee."""
    employee = employee_id  # employee_id IS the Frappe name (e.g. HR-EMP-00001)
    if not frappe.db.exists("Employee", employee):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    today = frappe.utils.nowdate()

    # Get the active salary structure assignment
    assignment = frappe.get_list(
        "Salary Structure Assignment",
        fields=["name", "salary_structure", "from_date", "base", "variable"],
        filters={
            "employee": employee,
            "docstatus": 1,
            "from_date": ["<=", today],
        },
        order_by="from_date desc",
        limit_page_length=1,
    )

    if not assignment:
        return {"structure": None, "components": [], "assignment": None}

    assignment = assignment[0]

    # Get salary structure details (earnings + deductions)
    structure_name = assignment.salary_structure
    earnings = frappe.get_list(
        "Salary Detail",
        fields=["salary_component", "amount", "formula", "amount_based_on_formula"],
        filters={
            "parenttype": "Salary Structure",
            "parent": structure_name,
            "parentfield": "earnings",
        },
        order_by="idx asc",
        limit_page_length=0,
    )

    deductions = frappe.get_list(
        "Salary Detail",
        fields=["salary_component", "amount", "formula", "amount_based_on_formula"],
        filters={
            "parenttype": "Salary Structure",
            "parent": structure_name,
            "parentfield": "deductions",
        },
        order_by="idx asc",
        limit_page_length=0,
    )

    return {
        "assignment": {
            "name": assignment.name,
            "from_date": str(assignment.from_date),
            "base": assignment.base,
            "variable": assignment.variable,
        },
        "structure": structure_name,
        "earnings": earnings,
        "deductions": deductions,
    }
