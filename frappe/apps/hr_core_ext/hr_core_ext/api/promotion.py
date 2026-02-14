import frappe


@frappe.whitelist(allow_guest=False)
def get_promotions(employee_id):
    """Get promotion history for an employee."""
    employee = employee_id  # employee_id IS the Frappe name (e.g. HR-EMP-00001)
    if not frappe.db.exists("Employee", employee):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    promotions = frappe.get_list(
        "Employee Promotion",
        fields=["name", "promotion_date", "promotion_details"],
        filters={
            "employee": employee,
            "docstatus": 1,
        },
        order_by="promotion_date desc",
        limit_page_length=0,
    )

    result = []
    for promo in promotions:
        # Get promotion detail child rows (property changes)
        details = frappe.get_list(
            "Employee Property History",
            fields=["property", "current", "new", "fieldname"],
            filters={
                "parent": promo.name,
                "parenttype": "Employee Promotion",
            },
            order_by="idx asc",
            limit_page_length=0,
        )

        result.append({
            "name": promo.name,
            "promotion_date": str(promo.promotion_date),
            "details": details,
        })

    return result
