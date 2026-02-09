import frappe


@frappe.whitelist(allow_guest=False)
def get_employees(company=None, employee_id=None, filters=None, limit_page_length=20, limit_start=0):
    """Get list of employees with basic fields."""
    f = filters or {}
    if company:
        f["company"] = company
    if employee_id:
        f["employee_id"] = employee_id

    employees = frappe.get_list(
        "Employee",
        fields=[
            "name",
            "employee_name",
            "employee_id",
            "department",
            "designation",
            "status",
            "company",
            "date_of_joining",
            "image",
        ],
        filters=f,
        limit_page_length=int(limit_page_length),
        limit_start=int(limit_start),
        order_by="employee_name asc",
    )
    return employees


@frappe.whitelist(allow_guest=False)
def get_employee(employee_id):
    """Get single employee detail."""
    employee = frappe.get_doc("Employee", {"employee_id": employee_id})
    return {
        "employee_id": employee.employee_id,
        "employee_name": employee.employee_name,
        "department": employee.department,
        "designation": employee.designation,
        "status": employee.status,
        "company": employee.company,
        "date_of_joining": str(employee.date_of_joining) if employee.date_of_joining else None,
        "date_of_birth": str(employee.date_of_birth) if employee.date_of_birth else None,
        "gender": employee.gender,
        "cell_phone": employee.cell_phone,
        "personal_email": employee.personal_email,
        "company_email": employee.company_email,
        "image": employee.image,
    }
