package handler

import (
	"encoding/json"
	"net/http"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/model"

	"github.com/labstack/echo/v4"
)

type LeaveHandler struct {
	frappe *client.FrappeClient
}

func NewLeaveHandler(frappe *client.FrappeClient) *LeaveHandler {
	return &LeaveHandler{frappe: frappe}
}

func (h *LeaveHandler) Create(c echo.Context) error {
	var req model.CreateLeaveRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	employeeID := c.Get("employee_id").(string)
	if employeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
	}

	params := map[string]string{
		"employee_id": employeeID,
	}
	_, err := h.frappe.CallMethod("hr_core_ext.api.leave.get_leave_balance", params)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "failed to verify leave balance")
	}

	// Create leave application via Frappe
	payload := map[string]string{
		"employee_id": employeeID,
		"leave_type":  req.LeaveType,
		"from_date":   req.FromDate,
		"to_date":     req.ToDate,
		"reason":      req.Reason,
	}

	_, err = h.frappe.CallMethod("hr_core_ext.api.leave.create_leave_application", payload)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "failed to create leave application")
	}

	return c.JSON(http.StatusCreated, map[string]string{
		"message": "leave application created",
	})
}

// List returns leave applications filtered by role.
func (h *LeaveHandler) List(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	role := model.UserRole(c.Get("user_role").(string))

	params := map[string]string{}

	// Employee: only own leaves. Admin/HR/Manager: all or filtered.
	if role == model.RoleEmployee && employeeID != "" {
		params["employee_id"] = employeeID
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.leave.get_leave_applications", params)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "failed to fetch leave applications")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Approve approves or rejects a leave application (admin/HR/manager).
func (h *LeaveHandler) Approve(c echo.Context) error {
	leaveID := c.Param("id")

	var req struct {
		Status string `json:"status"` // "Approved" or "Rejected"
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Status != "Approved" && req.Status != "Rejected" {
		return echo.NewHTTPError(http.StatusBadRequest, "status must be 'Approved' or 'Rejected'")
	}

	params := map[string]string{
		"leave_id": leaveID,
		"status":   req.Status,
	}

	_, err := h.frappe.CallMethod("hr_core_ext.api.leave.approve_leave_application", params)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "failed to update leave status")
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "leave application " + req.Status,
	})
}
