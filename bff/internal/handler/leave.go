package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/model"
	"hr-platform/bff/internal/repository"

	"github.com/labstack/echo/v4"
)

// frappeHTTPError returns an echo HTTP error that surfaces the Frappe error message if available.
func frappeHTTPError(err error, fallback string) *echo.HTTPError {
	var fe *client.FrappeError
	if errors.As(err, &fe) {
		return echo.NewHTTPError(http.StatusBadGateway, fe.Message)
	}
	return echo.NewHTTPError(http.StatusBadGateway, fallback)
}

type LeaveHandler struct {
	frappe    *client.FrappeClient
	notifRepo *repository.NotificationRepository
	userRepo  *repository.UserRepository
}

func NewLeaveHandler(frappe *client.FrappeClient, notifRepo *repository.NotificationRepository, userRepo *repository.UserRepository) *LeaveHandler {
	return &LeaveHandler{frappe: frappe, notifRepo: notifRepo, userRepo: userRepo}
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
		return frappeHTTPError(err, "failed to verify leave balance")
	}

	// Create leave application via Frappe
	payload := map[string]string{
		"employee_id": employeeID,
		"leave_type":  req.LeaveType,
		"from_date":   req.FromDate,
		"to_date":     req.ToDate,
		"reason":      req.Reason,
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.leave.create_leave_application", payload)
	if err != nil {
		return frappeHTTPError(err, "failed to create leave application")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": json.RawMessage(data),
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
		return frappeHTTPError(err, "failed to fetch leave applications")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Approve approves or rejects a leave application (admin/HR/manager).
func (h *LeaveHandler) Approve(c echo.Context) error {
	leaveID := c.Param("id")

	var req struct {
		Status     string `json:"status"`      // "Approved" or "Rejected"
		EmployeeID string `json:"employee_id"` // optional, for notification
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

	_, err := h.frappe.CallMethodPost("hr_core_ext.api.leave.approve_leave_application", params)
	if err != nil {
		return frappeHTTPError(err, "failed to update leave status")
	}

	// Send notification to the leave requester
	if h.notifRepo != nil && req.EmployeeID != "" {
		go func() {
			companyID := c.Get("company_id").(string)
			u, err := h.userRepo.GetByFrappeEmployeeID(context.Background(), companyID, req.EmployeeID)
			if err == nil && u != nil {
				title := "Leave " + req.Status
				msg := "Your leave request has been " + req.Status
				_ = h.notifRepo.CreateForUser(context.Background(), u.ID, companyID, "leave_approval", title, msg)
			}
		}()
	}

	return c.JSON(http.StatusOK, map[string]string{
		"message": "leave application " + req.Status,
	})
}

// Update edits an open leave application (before approval).
func (h *LeaveHandler) Update(c echo.Context) error {
	leaveID := c.Param("id")

	var req model.UpdateLeaveRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	params := map[string]string{"leave_id": leaveID}
	if req.LeaveType != nil {
		params["leave_type"] = *req.LeaveType
	}
	if req.FromDate != nil {
		params["from_date"] = *req.FromDate
	}
	if req.ToDate != nil {
		params["to_date"] = *req.ToDate
	}
	if req.Reason != nil {
		params["reason"] = *req.Reason
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.leave.update_leave_application", params)
	if err != nil {
		return frappeHTTPError(err, "failed to update leave application")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Cancel cancels an open leave application.
func (h *LeaveHandler) Cancel(c echo.Context) error {
	leaveID := c.Param("id")

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.leave.cancel_leave_application", map[string]string{
		"leave_id": leaveID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to cancel leave application")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Balance returns leave balance for the current user.
func (h *LeaveHandler) Balance(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	if employeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.leave.get_leave_allocations", map[string]string{
		"employee_id": employeeID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch leave balance")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}
