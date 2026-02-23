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

type OvertimeHandler struct {
	frappe   *client.FrappeClient
	notifRepo *repository.NotificationRepository
	userRepo  *repository.UserRepository
}

func NewOvertimeHandler(frappe *client.FrappeClient, notifRepo *repository.NotificationRepository, userRepo *repository.UserRepository) *OvertimeHandler {
	return &OvertimeHandler{frappe: frappe, notifRepo: notifRepo, userRepo: userRepo}
}

func (h *OvertimeHandler) GetConfig(c echo.Context) error {
	data, err := h.frappe.CallMethod("hr_core_ext.api.overtime.get_ot_config", map[string]string{})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch OT config")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *OvertimeHandler) UpdateConfig(c echo.Context) error {
	var req model.OTConfigRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	params := map[string]string{}
	if req.WeekdayOTRate != nil {
		params["weekday_ot_rate"] = fmt.Sprintf("%.2f", *req.WeekdayOTRate)
	}
	if req.HolidayWorkMonthly != nil {
		params["holiday_work_monthly"] = fmt.Sprintf("%.2f", *req.HolidayWorkMonthly)
	}
	if req.HolidayWorkDaily != nil {
		params["holiday_work_daily"] = fmt.Sprintf("%.2f", *req.HolidayWorkDaily)
	}
	if req.HolidayOTRate != nil {
		params["holiday_ot_rate"] = fmt.Sprintf("%.2f", *req.HolidayOTRate)
	}
	if req.StandardHoursPerDay != nil {
		params["standard_hours_per_day"] = fmt.Sprintf("%d", *req.StandardHoursPerDay)
	}
	if req.StandardWorkingDays != nil {
		params["standard_working_days"] = fmt.Sprintf("%d", *req.StandardWorkingDays)
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.overtime.update_ot_config", params)
	if err != nil {
		return frappeHTTPError(err, "failed to update OT config")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *OvertimeHandler) Create(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	if employeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
	}

	var req model.CreateOTRequestBody
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.overtime.create_ot_request", map[string]string{
		"employee_id": employeeID,
		"ot_date":     req.OTDate,
		"ot_type":     req.OTType,
		"hours":       fmt.Sprintf("%.2f", req.Hours),
		"reason":      req.Reason,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to create OT request")
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *OvertimeHandler) List(c echo.Context) error {
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
	if month := c.QueryParam("month"); month != "" {
		params["month"] = month
	}
	if year := c.QueryParam("year"); year != "" {
		params["year"] = year
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.overtime.get_ot_requests", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch OT requests")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *OvertimeHandler) Approve(c echo.Context) error {
	requestID := c.Param("id")
	var req model.ApproveOTRequestBody
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	var method string
	if req.Action == "approve" {
		method = "hr_core_ext.api.overtime.approve_ot_request"
	} else if req.Action == "reject" {
		method = "hr_core_ext.api.overtime.reject_ot_request"
	} else {
		return echo.NewHTTPError(http.StatusBadRequest, "action must be 'approve' or 'reject'")
	}

	data, err := h.frappe.CallMethodPost(method, map[string]string{"request_id": requestID})
	if err != nil {
		return frappeHTTPError(err, "failed to process OT request")
	}

	// Send notification to requester (best-effort)
	if h.notifRepo != nil {
		go func() {
			companyID := c.Get("company_id").(string)
			employeeID := c.Get("employee_id").(string)
			// Try to look up the OT requester - for now notify the action taker as confirmation
			if employeeID != "" {
				u, err := h.userRepo.GetByFrappeEmployeeID(context.Background(), companyID, employeeID)
				if err == nil && u != nil {
					status := "approved"
					if req.Action == "reject" {
						status = "rejected"
					}
					_ = h.notifRepo.CreateForUser(context.Background(), u.ID, companyID, "overtime_approval", "OT Request "+status, "Your overtime request has been "+status)
				}
			}
		}()
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *OvertimeHandler) Cancel(c echo.Context) error {
	requestID := c.Param("id")
	data, err := h.frappe.CallMethodPost("hr_core_ext.api.overtime.cancel_ot_request", map[string]string{
		"request_id": requestID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to cancel OT request")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}
