package handler

import (
	"encoding/json"
	"net/http"

	"hr-platform/bff/internal/client"

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
		return echo.NewHTTPError(http.StatusBadGateway, "failed to fetch attendance")
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
		return echo.NewHTTPError(http.StatusBadGateway, "failed to fetch attendance")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}
