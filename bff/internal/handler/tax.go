package handler

import (
	"encoding/json"
	"fmt"
	"net/http"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/model"

	"github.com/labstack/echo/v4"
)

type TaxHandler struct {
	frappe *client.FrappeClient
}

func NewTaxHandler(frappe *client.FrappeClient) *TaxHandler {
	return &TaxHandler{frappe: frappe}
}

func (h *TaxHandler) GetSlabs(c echo.Context) error {
	data, err := h.frappe.CallMethod("hr_core_ext.api.tax.get_tax_slabs", map[string]string{})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch tax slabs")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *TaxHandler) GetEmployeeDeductions(c echo.Context) error {
	employeeID := c.Param("id")
	role := model.UserRole(c.Get("user_role").(string))

	// Employees can only see their own
	if role == model.RoleEmployee {
		myEmployeeID := c.Get("employee_id").(string)
		if employeeID != myEmployeeID {
			return echo.NewHTTPError(http.StatusForbidden, "access denied")
		}
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.tax.get_employee_tax_deductions", map[string]string{
		"employee_id": employeeID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch tax deductions")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *TaxHandler) UpdateEmployeeDeductions(c echo.Context) error {
	employeeID := c.Param("id")
	role := model.UserRole(c.Get("user_role").(string))

	// Employees can update their own deductions
	if role == model.RoleEmployee {
		myEmployeeID := c.Get("employee_id").(string)
		if employeeID != myEmployeeID {
			return echo.NewHTTPError(http.StatusForbidden, "access denied")
		}
	}

	var req model.UpdateTaxDeductionsRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	params := map[string]string{"employee_id": employeeID}
	if req.TaxID != nil {
		params["tax_id"] = *req.TaxID
	}
	if req.PersonalAllowance != nil {
		params["personal_allowance"] = fmt.Sprintf("%.2f", *req.PersonalAllowance)
	}
	if req.SpouseAllowance != nil {
		params["spouse_allowance"] = fmt.Sprintf("%.2f", *req.SpouseAllowance)
	}
	if req.ChildrenCount != nil {
		params["children_count"] = fmt.Sprintf("%d", *req.ChildrenCount)
	}
	if req.LifeInsurancePremium != nil {
		params["life_insurance_premium"] = fmt.Sprintf("%.2f", *req.LifeInsurancePremium)
	}
	if req.HealthInsurancePremium != nil {
		params["health_insurance_premium"] = fmt.Sprintf("%.2f", *req.HealthInsurancePremium)
	}
	if req.HousingLoanInterest != nil {
		params["housing_loan_interest"] = fmt.Sprintf("%.2f", *req.HousingLoanInterest)
	}
	if req.DonationDeduction != nil {
		params["donation_deduction"] = fmt.Sprintf("%.2f", *req.DonationDeduction)
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.tax.update_employee_tax_deductions", params)
	if err != nil {
		return frappeHTTPError(err, "failed to update tax deductions")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *TaxHandler) GetEmployeeSummary(c echo.Context) error {
	employeeID := c.Param("id")
	year := c.QueryParam("year")
	if year == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "year is required")
	}

	role := model.UserRole(c.Get("user_role").(string))
	if role == model.RoleEmployee {
		myEmployeeID := c.Get("employee_id").(string)
		if employeeID != myEmployeeID {
			return echo.NewHTTPError(http.StatusForbidden, "access denied")
		}
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.tax.get_employee_tax_summary", map[string]string{
		"employee_id": employeeID, "year": year,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch tax summary")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *TaxHandler) GetPND1(c echo.Context) error {
	month := c.QueryParam("month")
	year := c.QueryParam("year")
	if month == "" || year == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "month and year are required")
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.tax.get_pnd1_data", map[string]string{
		"month": month, "year": year,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch PND1 data")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *TaxHandler) GetWithholdingCert(c echo.Context) error {
	employeeID := c.Param("id")
	year := c.QueryParam("year")
	if year == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "year is required")
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.tax.get_withholding_cert_data", map[string]string{
		"employee_id": employeeID, "year": year,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch withholding certificate data")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}
