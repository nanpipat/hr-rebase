import frappe


@frappe.whitelist(allow_guest=False)
def get_attendance_summary(employee_id, from_date=None, to_date=None):
    """Get attendance summary for an employee."""
    employee = frappe.get_value("Employee", {"employee_id": employee_id}, "name")
    if not employee:
        frappe.throw(f"Employee {employee_id} not found", frappe.DoesNotExistError)

    if not from_date:
        from_date = frappe.utils.get_first_day(frappe.utils.nowdate())
    if not to_date:
        to_date = frappe.utils.nowdate()

    records = frappe.get_list(
        "Attendance",
        fields=["attendance_date", "status", "working_hours", "leave_type"],
        filters={
            "employee": employee,
            "attendance_date": ["between", [from_date, to_date]],
            "docstatus": 1,
        },
        order_by="attendance_date desc",
        limit_page_length=0,
    )

    present = sum(1 for r in records if r.status == "Present")
    absent = sum(1 for r in records if r.status == "Absent")
    on_leave = sum(1 for r in records if r.status == "On Leave")

    return {
        "records": records,
        "summary": {
            "total_days": len(records),
            "present": present,
            "absent": absent,
            "on_leave": on_leave,
        },
    }
