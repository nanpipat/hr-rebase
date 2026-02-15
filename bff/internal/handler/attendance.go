package handler

import (
	"encoding/json"
	"net/http"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/model"

	"github.com/labstack/echo/v4"
)

type AttendanceHandler struct {
	frappe *client.FrappeClient
}

func NewAttendanceHandler(frappe *client.FrappeClient) *AttendanceHandler {
	return &AttendanceHandler{frappe: frappe}
}

// Me returns attendance for the current user.
func (h *AttendanceHandler) Me(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	if employeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
	}

	fromDate := c.QueryParam("from_date")
	toDate := c.QueryParam("to_date")

	params := map[string]string{
		"employee_id": employeeID,
	}
	if fromDate != "" {
		params["from_date"] = fromDate
	}
	if toDate != "" {
		params["to_date"] = toDate
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.attendance.get_attendance_summary", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch attendance")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// List returns attendance for all employees (admin/HR/manager).
func (h *AttendanceHandler) List(c echo.Context) error {
	fromDate := c.QueryParam("from_date")
	toDate := c.QueryParam("to_date")
	employeeID := c.QueryParam("employee_id")

	params := map[string]string{}
	if employeeID != "" {
		params["employee_id"] = employeeID
	}
	if fromDate != "" {
		params["from_date"] = fromDate
	}
	if toDate != "" {
		params["to_date"] = toDate
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.attendance.get_attendance_summary", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch attendance")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// CreateRequest submits an attendance correction request.
func (h *AttendanceHandler) CreateRequest(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	if employeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
	}

	var req model.CreateAttendanceRequestBody
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.AttendanceDate == "" || req.Reason == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "attendance_date and reason are required")
	}

	params := map[string]string{
		"employee_id":     employeeID,
		"attendance_date": req.AttendanceDate,
		"reason":          req.Reason,
	}
	if req.Status != "" {
		params["status"] = req.Status
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.attendance.create_attendance_request", params)
	if err != nil {
		return frappeHTTPError(err, "failed to create attendance request")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// ListRequests returns attendance requests.
func (h *AttendanceHandler) ListRequests(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	role := model.UserRole(c.Get("user_role").(string))

	params := map[string]string{}

	// Employee can only see own requests
	if role == model.RoleEmployee && employeeID != "" {
		params["employee_id"] = employeeID
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.attendance.get_attendance_requests", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch attendance requests")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Checkin records an employee check-in.
func (h *AttendanceHandler) Checkin(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	if employeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.attendance.checkin", map[string]string{
		"employee_id": employeeID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to check in")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Checkout records an employee check-out.
func (h *AttendanceHandler) Checkout(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	if employeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.attendance.checkout", map[string]string{
		"employee_id": employeeID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to check out")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// TodayCheckin returns today's check-in status for the current user.
func (h *AttendanceHandler) TodayCheckin(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	if employeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.attendance.get_today_checkin", map[string]string{
		"employee_id": employeeID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch today's check-in status")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// CheckinHistory returns check-in history grouped by date.
func (h *AttendanceHandler) CheckinHistory(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	if employeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
	}

	params := map[string]string{
		"employee_id": employeeID,
	}
	if fromDate := c.QueryParam("from_date"); fromDate != "" {
		params["from_date"] = fromDate
	}
	if toDate := c.QueryParam("to_date"); toDate != "" {
		params["to_date"] = toDate
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.attendance.get_checkin_history", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch check-in history")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// ApproveRequest approves or rejects an attendance request.
func (h *AttendanceHandler) ApproveRequest(c echo.Context) error {
	requestID := c.Param("id")

	var req model.ApproveAttendanceRequestBody
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Action != "approve" && req.Action != "reject" {
		return echo.NewHTTPError(http.StatusBadRequest, "action must be 'approve' or 'reject'")
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.attendance.approve_attendance_request", map[string]string{
		"request_id": requestID,
		"action":     req.Action,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to process attendance request")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}
