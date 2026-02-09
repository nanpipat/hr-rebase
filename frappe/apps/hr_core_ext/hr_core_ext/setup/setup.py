import frappe
import os


def run_setup():
    """Run initial setup after site creation."""
    ensure_warehouse_types()
    create_company()
    create_service_user()
    setup_leave_types()
    frappe.db.commit()
    print("Initial setup completed successfully.")


def ensure_warehouse_types():
    """Create required warehouse types for ERPNext company setup."""
    warehouse_types = ["Transit", "Store", "Rejected"]
    for wt in warehouse_types:
        if not frappe.db.exists("Warehouse Type", wt):
            frappe.get_doc({
                "doctype": "Warehouse Type",
                "name": wt,
            }).insert(ignore_permissions=True)
            print(f"Warehouse type '{wt}' created.")


def create_company():
    """Create default company if not exists."""
    company_name = os.environ.get("DEFAULT_COMPANY_NAME", "My Company")
    company_abbr = os.environ.get("DEFAULT_COMPANY_ABBR", "MC")
    country = os.environ.get("DEFAULT_COMPANY_COUNTRY", "Thailand")

    if frappe.db.exists("Company", company_name):
        print(f"Company '{company_name}' already exists.")
        return

    company = frappe.get_doc({
        "doctype": "Company",
        "company_name": company_name,
        "abbr": company_abbr,
        "country": country,
        "default_currency": "THB",
    })
    company.insert(ignore_permissions=True)
    print(f"Company '{company_name}' created.")


def create_service_user():
    """Create BFF service user with API access."""
    email = "bff-service@hr.localhost"

    if frappe.db.exists("User", email):
        print(f"Service user '{email}' already exists.")
        return

    user = frappe.get_doc({
        "doctype": "User",
        "email": email,
        "first_name": "BFF",
        "last_name": "Service",
        "enabled": 1,
        "user_type": "System User",
        "roles": [
            {"role": "HR Manager"},
            {"role": "HR User"},
        ],
    })
    user.insert(ignore_permissions=True)

    # Generate API keys
    api_key = frappe.generate_hash(length=15)
    user.api_key = api_key
    user.save(ignore_permissions=True)

    print(f"Service user created: {email}")
    print(f"API Key: {api_key}")
    print(f"Note: Retrieve API secret from Frappe admin panel")


def setup_leave_types():
    """Create basic leave types for Thailand."""
    leave_types = [
        {"name": "Annual Leave", "max_leaves_allowed": 6, "is_earned_leave": 0},
        {"name": "Sick Leave", "max_leaves_allowed": 30, "is_earned_leave": 0},
        {"name": "Personal Leave", "max_leaves_allowed": 3, "is_earned_leave": 0},
    ]

    for lt in leave_types:
        if frappe.db.exists("Leave Type", lt["name"]):
            continue
        doc = frappe.get_doc({
            "doctype": "Leave Type",
            "leave_type_name": lt["name"],
            "max_leaves_allowed": lt["max_leaves_allowed"],
            "is_earned_leave": lt["is_earned_leave"],
        })
        doc.insert(ignore_permissions=True)
        print(f"Leave type '{lt['name']}' created.")
