import frappe


@frappe.whitelist(allow_guest=False)
def get_org_tree(company=None):
    """Build recursive org tree from reports_to field."""
    filters = {"status": "Active"}
    if company:
        filters["company"] = company

    employees = frappe.get_list(
        "Employee",
        filters=filters,
        fields=["name", "employee_name", "designation", "department", "reports_to", "image", "company"],
        limit_page_length=0,
    )

    # Build lookup
    emp_map = {}
    for e in employees:
        emp_map[e.name] = {
            "id": e.name,
            "name": e.employee_name,
            "designation": e.designation or "",
            "department": e.department or "",
            "image": e.image or "",
            "reports_to": e.reports_to or "",
            "children": [],
        }

    # Build tree
    roots = []
    for eid, node in emp_map.items():
        parent_id = node["reports_to"]
        if parent_id and parent_id in emp_map:
            emp_map[parent_id]["children"].append(node)
        else:
            roots.append(node)

    # Remove reports_to from output to keep clean
    def clean_node(node):
        del node["reports_to"]
        for child in node["children"]:
            clean_node(child)
        return node

    for root in roots:
        clean_node(root)

    return {"tree": roots, "total_employees": len(employees)}


@frappe.whitelist(allow_guest=False)
def get_department_tree(company=None):
    """Group employees by department."""
    filters = {"status": "Active"}
    if company:
        filters["company"] = company

    employees = frappe.get_list(
        "Employee",
        filters=filters,
        fields=["name", "employee_name", "designation", "department", "image"],
        limit_page_length=0,
    )

    dept_map = {}
    for e in employees:
        dept = e.department or "Unassigned"
        if dept not in dept_map:
            dept_map[dept] = {"department": dept, "members": [], "count": 0}
        dept_map[dept]["members"].append({
            "id": e.name,
            "name": e.employee_name,
            "designation": e.designation or "",
            "image": e.image or "",
        })
        dept_map[dept]["count"] += 1

    departments = sorted(dept_map.values(), key=lambda x: x["department"])
    return {"departments": departments, "total_departments": len(departments)}
