import frappe
import os


def run_setup():
    """Run initial setup after site creation."""
    ensure_warehouse_types()
    ensure_gender_types()
    create_company()
    create_service_user()
    setup_leave_types()
    setup_holiday_list()
    frappe.db.commit()
    print("Initial setup completed successfully.")


def ensure_gender_types():
    """Create required gender values for employee creation."""
    genders = ["Male", "Female", "Other", "Prefer not to say"]
    for g in genders:
        if not frappe.db.exists("Gender", g):
            frappe.get_doc({"doctype": "Gender", "gender": g}).insert(ignore_permissions=True)
            print(f"Gender '{g}' created.")


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
    """Create basic leave types for Thailand (Thai labor law defaults)."""
    leave_types = [
        {"name": "Annual Leave", "max_leaves_allowed": 12, "is_earned_leave": 0},
        {"name": "Sick Leave", "max_leaves_allowed": 30, "is_earned_leave": 0},
        {"name": "Personal Leave", "max_leaves_allowed": 6, "is_earned_leave": 0},
    ]

    for lt in leave_types:
        if frappe.db.exists("Leave Type", lt["name"]):
            # Update max_leaves_allowed if it's too low
            doc = frappe.get_doc("Leave Type", lt["name"])
            if doc.max_leaves_allowed < lt["max_leaves_allowed"]:
                doc.max_leaves_allowed = lt["max_leaves_allowed"]
                doc.save(ignore_permissions=True)
                print(f"Leave type '{lt['name']}' updated max to {lt['max_leaves_allowed']}.")
            continue
        doc = frappe.get_doc({
            "doctype": "Leave Type",
            "leave_type_name": lt["name"],
            "max_leaves_allowed": lt["max_leaves_allowed"],
            "is_earned_leave": lt["is_earned_leave"],
        })
        doc.insert(ignore_permissions=True)
        print(f"Leave type '{lt['name']}' created.")


def setup_holiday_list():
    """Create a default Holiday List for the current year and assign to company."""
    import datetime
    year = datetime.date.today().year
    list_name = f"Thailand {year}"
    company_name = os.environ.get("DEFAULT_COMPANY_NAME", "My Company")

    if frappe.db.exists("Holiday List", list_name):
        print(f"Holiday List '{list_name}' already exists.")
    else:
        # Thai public holidays (standard)
        holidays = [
            (f"{year}-01-01", "New Year's Day"),
            (f"{year}-02-26", "Makha Bucha Day"),
            (f"{year}-04-06", "Chakri Memorial Day"),
            (f"{year}-04-13", "Songkran Festival"),
            (f"{year}-04-14", "Songkran Festival"),
            (f"{year}-04-15", "Songkran Festival"),
            (f"{year}-05-01", "Labour Day"),
            (f"{year}-05-04", "Coronation Day"),
            (f"{year}-05-22", "Visakha Bucha Day"),
            (f"{year}-06-03", "Queen Suthida's Birthday"),
            (f"{year}-07-20", "Asanha Bucha Day"),
            (f"{year}-07-28", "King's Birthday"),
            (f"{year}-08-12", "Queen Sirikit's Birthday / Mother's Day"),
            (f"{year}-10-13", "King Bhumibol Memorial Day"),
            (f"{year}-10-23", "Chulalongkorn Day"),
            (f"{year}-12-05", "King Bhumibol's Birthday / Father's Day"),
            (f"{year}-12-10", "Constitution Day"),
            (f"{year}-12-31", "New Year's Eve"),
        ]

        doc = frappe.get_doc({
            "doctype": "Holiday List",
            "holiday_list_name": list_name,
            "from_date": f"{year}-01-01",
            "to_date": f"{year}-12-31",
            "holidays": [
                {"holiday_date": date, "description": desc}
                for date, desc in holidays
            ],
        })
        doc.insert(ignore_permissions=True)
        print(f"Holiday List '{list_name}' created with {len(holidays)} holidays.")

    # Set as default for company
    if frappe.db.exists("Company", company_name):
        company = frappe.get_doc("Company", company_name)
        if not company.default_holiday_list:
            company.default_holiday_list = list_name
            company.save(ignore_permissions=True)
            print(f"Set '{list_name}' as default holiday list for '{company_name}'.")
