import frappe


@frappe.whitelist(allow_guest=False)
def create_company(company_name, abbr, country="Thailand"):
    """Create a new company in Frappe."""
    if frappe.db.exists("Company", company_name):
        return {"name": company_name}

    company = frappe.get_doc({
        "doctype": "Company",
        "company_name": company_name,
        "abbr": abbr,
        "country": country,
        "default_currency": "THB",
    })
    company.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"name": company.name}


@frappe.whitelist(allow_guest=False)
def create_employee(employee_name, company, gender="Male", date_of_joining=None, **kwargs):
    """Create a new employee in Frappe."""
    doc = frappe.get_doc({
        "doctype": "Employee",
        "employee_name": employee_name,
        "company": company,
        "gender": gender,
        "date_of_joining": date_of_joining or frappe.utils.nowdate(),
    })
    doc.insert(ignore_permissions=True)
    frappe.db.commit()
    return {"employee_id": doc.employee_id, "name": doc.name}
