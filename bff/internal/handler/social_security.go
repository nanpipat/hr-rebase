package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/model"

	"github.com/labstack/echo/v4"
)

type SocialSecurityHandler struct {
	frappe *client.FrappeClient
}

func NewSocialSecurityHandler(frappe *client.FrappeClient) *SocialSecurityHandler {
	return &SocialSecurityHandler{frappe: frappe}
}

func (h *SocialSecurityHandler) GetConfig(c echo.Context) error {
	data, err := h.frappe.CallMethod("hr_core_ext.api.social_security.get_sso_config", map[string]string{})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch SSO config")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *SocialSecurityHandler) UpdateConfig(c echo.Context) error {
	var req model.SSOConfigRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	params := map[string]string{}
	if req.Rate != nil {
		params["rate"] = fmt.Sprintf("%.2f", *req.Rate)
	}
	if req.MaxSalary != nil {
		params["max_salary"] = fmt.Sprintf("%.2f", *req.MaxSalary)
	}
	if req.MaxContribution != nil {
		params["max_contribution"] = fmt.Sprintf("%.2f", *req.MaxContribution)
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.social_security.update_sso_config", params)
	if err != nil {
		return frappeHTTPError(err, "failed to update SSO config")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *SocialSecurityHandler) GetReport(c echo.Context) error {
	month := c.QueryParam("month")
	year := c.QueryParam("year")
	if month == "" || year == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "month and year are required")
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.social_security.get_sso_report", map[string]string{
		"month": month, "year": year,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch SSO report")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *SocialSecurityHandler) GetEmployeeSSO(c echo.Context) error {
	employeeID := c.Param("id")
	data, err := h.frappe.CallMethod("hr_core_ext.api.social_security.get_employee_sso_number", map[string]string{
		"employee_id": employeeID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch employee SSO number")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *SocialSecurityHandler) UpdateEmployeeSSO(c echo.Context) error {
	employeeID := c.Param("id")
	var req model.UpdateSSONumberRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.social_security.update_employee_sso_number", map[string]string{
		"employee_id": employeeID, "sso_number": req.SSONumber,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to update employee SSO number")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}
