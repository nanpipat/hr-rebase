package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/model"
	"hr-platform/bff/internal/repository"

	"github.com/labstack/echo/v4"
)

type ShiftHandler struct {
	frappe    *client.FrappeClient
	notifRepo *repository.NotificationRepository
	userRepo  *repository.UserRepository
}

func NewShiftHandler(frappe *client.FrappeClient, notifRepo *repository.NotificationRepository, userRepo *repository.UserRepository) *ShiftHandler {
	return &ShiftHandler{frappe: frappe, notifRepo: notifRepo, userRepo: userRepo}
}

// ListShiftTypes returns all shift types.
func (h *ShiftHandler) ListShiftTypes(c echo.Context) error {
	data, err := h.frappe.CallMethod("hr_core_ext.api.shift.get_shift_types", map[string]string{})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch shift types")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// CreateShiftType creates a new shift type (admin/HR only).
func (h *ShiftHandler) CreateShiftType(c echo.Context) error {
	var req model.CreateShiftTypeRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Name == "" || req.StartTime == "" || req.EndTime == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name, start_time, and end_time are required")
	}

	params := map[string]string{
		"name":       req.Name,
		"start_time": req.StartTime,
		"end_time":   req.EndTime,
	}
	if req.LateEntryGracePeriod > 0 {
		params["late_entry_grace_period"] = fmt.Sprintf("%d", req.LateEntryGracePeriod)
	}
	if req.EarlyExitGracePeriod > 0 {
		params["early_exit_grace_period"] = fmt.Sprintf("%d", req.EarlyExitGracePeriod)
	}
	if req.HolidayList != "" {
		params["holiday_list"] = req.HolidayList
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.shift.create_shift_type", params)
	if err != nil {
		return frappeHTTPError(err, "failed to create shift type")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// UpdateShiftType updates an existing shift type (admin/HR only).
func (h *ShiftHandler) UpdateShiftType(c echo.Context) error {
	shiftName := c.Param("name")

	var req model.UpdateShiftTypeRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	params := map[string]string{
		"shift_type_name": shiftName,
	}
	if req.StartTime != nil {
		params["start_time"] = *req.StartTime
	}
	if req.EndTime != nil {
		params["end_time"] = *req.EndTime
	}
	if req.LateEntryGracePeriod != nil {
		params["late_entry_grace_period"] = fmt.Sprintf("%d", *req.LateEntryGracePeriod)
	}
	if req.EarlyExitGracePeriod != nil {
		params["early_exit_grace_period"] = fmt.Sprintf("%d", *req.EarlyExitGracePeriod)
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.shift.update_shift_type", params)
	if err != nil {
		return frappeHTTPError(err, "failed to update shift type")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// ListAssignments returns shift assignments. Employees see only their own.
func (h *ShiftHandler) ListAssignments(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	role := model.UserRole(c.Get("user_role").(string))

	params := map[string]string{}

	// Employee can only see own assignments
	if role == model.RoleEmployee {
		if employeeID == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
		}
		params["employee_id"] = employeeID
	} else if qEmployee := c.QueryParam("employee_id"); qEmployee != "" {
		params["employee_id"] = qEmployee
	}

	if shiftType := c.QueryParam("shift_type"); shiftType != "" {
		params["shift_type"] = shiftType
	}
	if date := c.QueryParam("date"); date != "" {
		params["date"] = date
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.shift.get_shift_assignments", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch shift assignments")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// AssignShift assigns an employee to a shift type (admin/HR only).
func (h *ShiftHandler) AssignShift(c echo.Context) error {
	var req model.AssignShiftRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.EmployeeID == "" || req.ShiftType == "" || req.StartDate == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee_id, shift_type, and start_date are required")
	}

	params := map[string]string{
		"employee_id": req.EmployeeID,
		"shift_type":  req.ShiftType,
		"start_date":  req.StartDate,
	}
	if req.EndDate != "" {
		params["end_date"] = req.EndDate
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.shift.assign_shift", params)
	if err != nil {
		return frappeHTTPError(err, "failed to assign shift")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// UnassignShift cancels a shift assignment (admin/HR only).
func (h *ShiftHandler) UnassignShift(c echo.Context) error {
	assignmentID := c.Param("id")

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.shift.unassign_shift", map[string]string{
		"assignment_id": assignmentID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to unassign shift")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// ListRequests returns shift change requests. Employees see only their own.
func (h *ShiftHandler) ListRequests(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	role := model.UserRole(c.Get("user_role").(string))

	params := map[string]string{}

	if role == model.RoleEmployee {
		if employeeID == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
		}
		params["employee_id"] = employeeID
	}

	if status := c.QueryParam("status"); status != "" {
		params["status"] = status
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.shift.get_shift_requests", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch shift requests")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// CreateRequest submits a shift change request (any employee).
func (h *ShiftHandler) CreateRequest(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	if employeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
	}

	var req model.CreateShiftRequestBody
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.ShiftType == "" || req.FromDate == "" || req.ToDate == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "shift_type, from_date, and to_date are required")
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.shift.create_shift_request", map[string]string{
		"employee_id": employeeID,
		"shift_type":  req.ShiftType,
		"from_date":   req.FromDate,
		"to_date":     req.ToDate,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to create shift request")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// ApproveRequest approves or rejects a shift change request (admin/HR/manager).
func (h *ShiftHandler) ApproveRequest(c echo.Context) error {
	requestID := c.Param("id")

	var req struct {
		Action     string `json:"action"`
		EmployeeID string `json:"employee_id"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Action != "approve" && req.Action != "reject" {
		return echo.NewHTTPError(http.StatusBadRequest, "action must be 'approve' or 'reject'")
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.shift.approve_shift_request", map[string]string{
		"request_id": requestID,
		"action":     req.Action,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to process shift request")
	}

	// Send notification to the shift request owner
	if h.notifRepo != nil && req.EmployeeID != "" {
		go func() {
			companyID := c.Get("company_id").(string)
			u, err := h.userRepo.GetByFrappeEmployeeID(context.Background(), companyID, req.EmployeeID)
			if err == nil && u != nil {
				status := "approved"
				if req.Action == "reject" {
					status = "rejected"
				}
				title := "Shift Request " + status
				msg := "Your shift change request has been " + status
				_ = h.notifRepo.CreateForUser(context.Background(), u.ID, companyID, "shift_approval", title, msg)
			}
		}()
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// GetMyShift returns the current shift assignment for the logged-in employee.
func (h *ShiftHandler) GetMyShift(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	if employeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.shift.get_employee_current_shift", map[string]string{
		"employee_id": employeeID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch current shift")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// ProcessAutoAttendance triggers auto-attendance processing (admin/HR only).
func (h *ShiftHandler) ProcessAutoAttendance(c echo.Context) error {
	var req model.ProcessAutoAttendanceRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	params := map[string]string{}
	if req.Date != "" {
		params["date"] = req.Date
	}
	if req.Company != "" {
		params["company"] = req.Company
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.shift.process_auto_attendance", params)
	if err != nil {
		return frappeHTTPError(err, "failed to process auto attendance")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}
