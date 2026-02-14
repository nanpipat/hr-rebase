import frappe


@frappe.whitelist(allow_guest=False)
def get_employee_documents(employee_id):
    """Get files attached to an employee."""
    employee = employee_id  # employee_id IS the Frappe name (e.g. HR-EMP-00001)
    if not frappe.db.exists("Employee", employee):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    files = frappe.get_list(
        "File",
        fields=[
            "name", "file_name", "file_url", "file_size",
            "creation", "modified", "owner",
        ],
        filters={
            "attached_to_doctype": "Employee",
            "attached_to_name": employee,
            "is_private": 1,
        },
        order_by="creation desc",
        limit_page_length=0,
    )

    return files


@frappe.whitelist(allow_guest=False)
def upload_employee_document(employee_id, filename, content, doc_type=None):
    """Upload a file and attach it to an employee.

    content should be base64-encoded file data.
    doc_type is an optional label (e.g. 'ID Card', 'Contract').
    """
    import base64

    employee = employee_id  # employee_id IS the Frappe name (e.g. HR-EMP-00001)
    if not frappe.db.exists("Employee", employee):
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    file_data = base64.b64decode(content)

    file_doc = frappe.get_doc({
        "doctype": "File",
        "file_name": filename,
        "content": file_data,
        "attached_to_doctype": "Employee",
        "attached_to_name": employee,
        "is_private": 1,
        "folder": "Home/Attachments",
    })
    file_doc.save(ignore_permissions=True)
    frappe.db.commit()

    return {
        "name": file_doc.name,
        "file_name": file_doc.file_name,
        "file_url": file_doc.file_url,
    }


@frappe.whitelist(allow_guest=False)
def delete_employee_document(file_name):
    """Delete a file attached to an employee.

    file_name is the Frappe File doctype 'name' field (e.g. 'abc123').
    """
    file_doc = frappe.get_doc("File", file_name)

    if file_doc.attached_to_doctype != "Employee":
        frappe.throw("This file is not attached to an employee")

    file_doc.delete(ignore_permissions=True)
    frappe.db.commit()

    return {"status": "deleted", "name": file_name}
