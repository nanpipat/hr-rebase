package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/model"

	"github.com/labstack/echo/v4"
)

type ProvidentFundHandler struct {
	frappe *client.FrappeClient
}

func NewProvidentFundHandler(frappe *client.FrappeClient) *ProvidentFundHandler {
	return &ProvidentFundHandler{frappe: frappe}
}

func (h *ProvidentFundHandler) GetConfig(c echo.Context) error {
	data, err := h.frappe.CallMethod("hr_core_ext.api.provident_fund.get_pvd_config", map[string]string{})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch PVD config")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *ProvidentFundHandler) UpdateConfig(c echo.Context) error {
	var req model.PVDConfigRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	params := map[string]string{}
	if req.MinRate != nil {
		params["min_rate"] = fmt.Sprintf("%.2f", *req.MinRate)
	}
	if req.MaxRate != nil {
		params["max_rate"] = fmt.Sprintf("%.2f", *req.MaxRate)
	}
	if req.DefaultEmployeeRate != nil {
		params["default_employee_rate"] = fmt.Sprintf("%.2f", *req.DefaultEmployeeRate)
	}
	if req.DefaultEmployerRate != nil {
		params["default_employer_rate"] = fmt.Sprintf("%.2f", *req.DefaultEmployerRate)
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.provident_fund.update_pvd_config", params)
	if err != nil {
		return frappeHTTPError(err, "failed to update PVD config")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *ProvidentFundHandler) GetEmployee(c echo.Context) error {
	employeeID := c.Param("id")
	data, err := h.frappe.CallMethod("hr_core_ext.api.provident_fund.get_employee_pvd", map[string]string{
		"employee_id": employeeID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch employee PVD")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *ProvidentFundHandler) EnrollEmployee(c echo.Context) error {
	employeeID := c.Param("id")
	var req model.EnrollPVDRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	params := map[string]string{"employee_id": employeeID}
	if req.EmployeeRate != nil {
		params["employee_rate"] = fmt.Sprintf("%.2f", *req.EmployeeRate)
	}
	if req.EmployerRate != nil {
		params["employer_rate"] = fmt.Sprintf("%.2f", *req.EmployerRate)
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.provident_fund.enroll_employee_pvd", params)
	if err != nil {
		return frappeHTTPError(err, "failed to enroll employee in PVD")
	}
	return c.JSON(http.StatusCreated, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *ProvidentFundHandler) UpdateEmployee(c echo.Context) error {
	employeeID := c.Param("id")
	var req model.EnrollPVDRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	params := map[string]string{"employee_id": employeeID}
	if req.EmployeeRate != nil {
		params["employee_rate"] = fmt.Sprintf("%.2f", *req.EmployeeRate)
	}
	if req.EmployerRate != nil {
		params["employer_rate"] = fmt.Sprintf("%.2f", *req.EmployerRate)
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.provident_fund.update_employee_pvd", params)
	if err != nil {
		return frappeHTTPError(err, "failed to update employee PVD")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *ProvidentFundHandler) UnenrollEmployee(c echo.Context) error {
	employeeID := c.Param("id")
	data, err := h.frappe.CallMethodPost("hr_core_ext.api.provident_fund.unenroll_employee_pvd", map[string]string{
		"employee_id": employeeID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to unenroll employee from PVD")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *ProvidentFundHandler) GetReport(c echo.Context) error {
	month := c.QueryParam("month")
	year := c.QueryParam("year")
	if month == "" || year == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "month and year are required")
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.provident_fund.get_pvd_report", map[string]string{
		"month": month, "year": year,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch PVD report")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}
