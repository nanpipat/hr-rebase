package handler

import (
	"encoding/json"
	"net/http"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/model"
	"hr-platform/bff/internal/repository"

	"github.com/labstack/echo/v4"
)

type EmployeeHandler struct {
	frappe      *client.FrappeClient
	companyRepo *repository.CompanyRepository
}

func NewEmployeeHandler(frappe *client.FrappeClient, companyRepo *repository.CompanyRepository) *EmployeeHandler {
	return &EmployeeHandler{frappe: frappe, companyRepo: companyRepo}
}

// List returns employees filtered by company and role.
func (h *EmployeeHandler) List(c echo.Context) error {
	companyID := c.Get("company_id").(string)
	role := model.UserRole(c.Get("user_role").(string))
	employeeID := c.Get("employee_id").(string)

	company, err := h.companyRepo.GetByID(c.Request().Context(), companyID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load company")
	}

	params := map[string]string{}
	if company.FrappeCompanyName != "" {
		params["company"] = company.FrappeCompanyName
	}

	// Employee role can only see self
	if role == model.RoleEmployee && employeeID != "" {
		params["employee_id"] = employeeID
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.employee.get_employees", params)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "failed to fetch employees")
	}

	var employees json.RawMessage
	if err := json.Unmarshal(data, &employees); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to parse employee data")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": employees,
	})
}

// Get returns a single employee by Frappe employee_id.
func (h *EmployeeHandler) Get(c echo.Context) error {
	id := c.Param("id")

	params := map[string]string{
		"employee_id": id,
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.employee.get_employee", params)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "failed to fetch employee")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Create creates a new employee in Frappe (admin/HR only).
func (h *EmployeeHandler) Create(c echo.Context) error {
	companyID := c.Get("company_id").(string)

	var req struct {
		EmployeeName string `json:"employee_name"`
		Department   string `json:"department,omitempty"`
		Designation  string `json:"designation,omitempty"`
		Gender       string `json:"gender,omitempty"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.EmployeeName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee_name is required")
	}

	company, err := h.companyRepo.GetByID(c.Request().Context(), companyID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load company")
	}

	companyName := company.FrappeCompanyName
	if companyName == "" {
		companyName = company.Name
	}

	employeeID, err := h.frappe.CreateEmployee(req.EmployeeName, companyName)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadGateway, "failed to create employee in Frappe")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": map[string]string{
			"employee_id": employeeID,
			"message":     "employee created",
		},
	})
}
