package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/model"

	"github.com/labstack/echo/v4"
)

type PayrollHandler struct {
	frappe *client.FrappeClient
}

func NewPayrollHandler(frappe *client.FrappeClient) *PayrollHandler {
	return &PayrollHandler{frappe: frappe}
}

// ListSlips returns salary slips. Employees see only their own; admin/HR see all.
func (h *PayrollHandler) ListSlips(c echo.Context) error {
	employeeID := c.Get("employee_id").(string)
	role := model.UserRole(c.Get("user_role").(string))

	params := map[string]string{}

	// Employee can only see own slips
	if role == model.RoleEmployee || role == model.RoleManager {
		if employeeID == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
		}
		params["employee_id"] = employeeID
	}

	if year := c.QueryParam("year"); year != "" {
		params["year"] = year
	}
	if month := c.QueryParam("month"); month != "" {
		params["month"] = month
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.payroll.get_salary_slips", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch salary slips")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// GetSlip returns a single salary slip detail.
func (h *PayrollHandler) GetSlip(c echo.Context) error {
	slipID := c.QueryParam("id")
	if slipID == "" {
		slipID = c.Param("id")
	}
	employeeID := c.Get("employee_id").(string)
	role := model.UserRole(c.Get("user_role").(string))

	data, err := h.frappe.CallMethod("hr_core_ext.api.payroll.get_salary_slip_detail", map[string]string{
		"slip_id": slipID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch salary slip")
	}

	// For non-admin roles, verify the slip belongs to this employee
	if role == model.RoleEmployee || role == model.RoleManager {
		var slip struct {
			Employee string `json:"employee"`
		}
		if err := json.Unmarshal(data, &slip); err == nil {
			if slip.Employee != employeeID {
				return echo.NewHTTPError(http.StatusForbidden, "access denied")
			}
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// SetupEmployee creates a salary structure assignment for an employee (admin/HR only).
func (h *PayrollHandler) SetupEmployee(c echo.Context) error {
	employeeID := c.Param("id")

	var req model.SetupEmployeePayrollRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.BaseSalary <= 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "base_salary is required and must be positive")
	}

	params := map[string]string{
		"employee_id": employeeID,
		"base_salary": fmt.Sprintf("%.2f", req.BaseSalary),
		"housing":     fmt.Sprintf("%.2f", req.Housing),
		"transport":   fmt.Sprintf("%.2f", req.Transport),
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.payroll.setup_employee_payroll", params)
	if err != nil {
		return frappeHTTPError(err, "failed to setup employee payroll")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Process creates salary slips for all employees for a given month (admin/HR only).
func (h *PayrollHandler) Process(c echo.Context) error {
	var req model.ProcessPayrollRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Month < 1 || req.Month > 12 || req.Year < 2000 {
		return echo.NewHTTPError(http.StatusBadRequest, "valid month (1-12) and year are required")
	}

	params := map[string]string{
		"month": fmt.Sprintf("%d", req.Month),
		"year":  fmt.Sprintf("%d", req.Year),
	}
	if req.Company != "" {
		params["company"] = req.Company
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.payroll.process_payroll", params)
	if err != nil {
		return frappeHTTPError(err, "failed to process payroll")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Submit submits all draft salary slips for a given month (admin/HR only).
func (h *PayrollHandler) Submit(c echo.Context) error {
	var req model.SubmitPayrollRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Month < 1 || req.Month > 12 || req.Year < 2000 {
		return echo.NewHTTPError(http.StatusBadRequest, "valid month (1-12) and year are required")
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.payroll.submit_payroll", map[string]string{
		"month": fmt.Sprintf("%d", req.Month),
		"year":  fmt.Sprintf("%d", req.Year),
	})
	if err != nil {
		return frappeHTTPError(err, "failed to submit payroll")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// GenerateSlip generates a single salary slip for an employee (admin/HR only).
func (h *PayrollHandler) GenerateSlip(c echo.Context) error {
	employeeID := c.Param("id")

	var req model.GenerateSalarySlipRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Month < 1 || req.Month > 12 || req.Year < 2000 {
		return echo.NewHTTPError(http.StatusBadRequest, "valid month (1-12) and year are required")
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.payroll.generate_salary_slip", map[string]string{
		"employee_id": employeeID,
		"month":       fmt.Sprintf("%d", req.Month),
		"year":        fmt.Sprintf("%d", req.Year),
	})
	if err != nil {
		return frappeHTTPError(err, "failed to generate salary slip")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}
