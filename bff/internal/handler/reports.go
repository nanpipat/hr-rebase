package handler

import (
	"encoding/json"
	"net/http"

	"hr-platform/bff/internal/client"

	"github.com/labstack/echo/v4"
)

type ReportsHandler struct {
	frappe *client.FrappeClient
}

func NewReportsHandler(frappe *client.FrappeClient) *ReportsHandler {
	return &ReportsHandler{frappe: frappe}
}

func (h *ReportsHandler) EmployeeSummary(c echo.Context) error {
	params := map[string]string{}
	if company := c.QueryParam("company"); company != "" {
		params["company"] = company
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.reports.get_employee_summary", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch employee summary")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *ReportsHandler) AttendanceReport(c echo.Context) error {
	month := c.QueryParam("month")
	year := c.QueryParam("year")
	if month == "" || year == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "month and year are required")
	}

	params := map[string]string{"month": month, "year": year}
	if company := c.QueryParam("company"); company != "" {
		params["company"] = company
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.reports.get_attendance_report", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch attendance report")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *ReportsHandler) LeaveReport(c echo.Context) error {
	year := c.QueryParam("year")
	if year == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "year is required")
	}

	params := map[string]string{"year": year}
	if company := c.QueryParam("company"); company != "" {
		params["company"] = company
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.reports.get_leave_report", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch leave report")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *ReportsHandler) PayrollReport(c echo.Context) error {
	year := c.QueryParam("year")
	if year == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "year is required")
	}

	params := map[string]string{"year": year}
	if month := c.QueryParam("month"); month != "" {
		params["month"] = month
	}
	if company := c.QueryParam("company"); company != "" {
		params["company"] = company
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.reports.get_payroll_report", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch payroll report")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *ReportsHandler) TaxReport(c echo.Context) error {
	year := c.QueryParam("year")
	if year == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "year is required")
	}

	params := map[string]string{"year": year}
	if month := c.QueryParam("month"); month != "" {
		params["month"] = month
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.reports.get_tax_report", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch tax report")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *ReportsHandler) ExportCSV(c echo.Context) error {
	reportType := c.QueryParam("type")
	if reportType == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "report type is required")
	}

	params := map[string]string{"report_type": reportType}
	if year := c.QueryParam("year"); year != "" {
		params["year"] = year
	}
	if month := c.QueryParam("month"); month != "" {
		params["month"] = month
	}
	if company := c.QueryParam("company"); company != "" {
		params["company"] = company
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.reports.export_report_csv", params)
	if err != nil {
		return frappeHTTPError(err, "failed to export report")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}
