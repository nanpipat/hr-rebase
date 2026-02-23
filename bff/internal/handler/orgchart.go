package handler

import (
	"encoding/json"
	"net/http"

	"hr-platform/bff/internal/client"

	"github.com/labstack/echo/v4"
)

type OrgChartHandler struct {
	frappe *client.FrappeClient
}

func NewOrgChartHandler(frappe *client.FrappeClient) *OrgChartHandler {
	return &OrgChartHandler{frappe: frappe}
}

func (h *OrgChartHandler) GetTree(c echo.Context) error {
	params := map[string]string{}
	if company := c.QueryParam("company"); company != "" {
		params["company"] = company
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.orgchart.get_org_tree", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch org tree")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}

func (h *OrgChartHandler) GetDepartments(c echo.Context) error {
	params := map[string]string{}
	if company := c.QueryParam("company"); company != "" {
		params["company"] = company
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.orgchart.get_department_tree", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch department tree")
	}
	return c.JSON(http.StatusOK, map[string]interface{}{"data": json.RawMessage(data)})
}
