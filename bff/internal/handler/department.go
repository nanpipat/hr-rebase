package handler

import (
	"encoding/json"
	"net/http"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/repository"

	"github.com/labstack/echo/v4"
)

type DepartmentHandler struct {
	frappe      *client.FrappeClient
	companyRepo *repository.CompanyRepository
}

func NewDepartmentHandler(frappe *client.FrappeClient, companyRepo *repository.CompanyRepository) *DepartmentHandler {
	return &DepartmentHandler{frappe: frappe, companyRepo: companyRepo}
}

// frappeCompanyName looks up the Frappe company name from the JWT company_id.
func (h *DepartmentHandler) frappeCompanyName(c echo.Context) (string, error) {
	companyID := c.Get("company_id").(string)
	company, err := h.companyRepo.GetByID(c.Request().Context(), companyID)
	if err != nil {
		return "", err
	}
	return company.FrappeCompanyName, nil
}

// List returns all departments scoped to the caller's company.
func (h *DepartmentHandler) List(c echo.Context) error {
	frappeCompany, err := h.frappeCompanyName(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load company")
	}

	params := map[string]string{}
	if frappeCompany != "" {
		params["company"] = frappeCompany
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.department.get_departments", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch departments")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Get returns a single department with its employees.
func (h *DepartmentHandler) Get(c echo.Context) error {
	name := c.Param("id")
	if name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "department id required")
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.department.get_department", map[string]string{
		"name": name,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch department")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Create creates a new department scoped to the caller's company (admin/HR only).
func (h *DepartmentHandler) Create(c echo.Context) error {
	var body struct {
		DepartmentName   string `json:"department_name"`
		ParentDepartment string `json:"parent_department"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if body.DepartmentName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "department_name required")
	}

	frappeCompany, err := h.frappeCompanyName(c)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load company")
	}

	params := map[string]string{
		"department_name": body.DepartmentName,
	}
	if body.ParentDepartment != "" {
		params["parent_department"] = body.ParentDepartment
	}
	if frappeCompany != "" {
		params["company"] = frappeCompany
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.department.create_department", params)
	if err != nil {
		return frappeHTTPError(err, "failed to create department")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Update modifies an existing department (admin/HR only).
func (h *DepartmentHandler) Update(c echo.Context) error {
	name := c.Param("id")
	if name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "department id required")
	}

	var body struct {
		DepartmentName   string `json:"department_name"`
		ParentDepartment string `json:"parent_department"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	params := map[string]string{
		"name": name,
	}
	if body.DepartmentName != "" {
		params["department_name"] = body.DepartmentName
	}
	if body.ParentDepartment != "" {
		params["parent_department"] = body.ParentDepartment
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.department.update_department", params)
	if err != nil {
		return frappeHTTPError(err, "failed to update department")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Delete removes a department (admin/HR only).
func (h *DepartmentHandler) Delete(c echo.Context) error {
	name := c.Param("id")
	if name == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "department id required")
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.department.delete_department", map[string]string{
		"name": name,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to delete department")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}
