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
		return frappeHTTPError(err, "failed to fetch employees")
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
		return frappeHTTPError(err, "failed to fetch employee")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// GetFull returns full employee profile for the tab-based view.
func (h *EmployeeHandler) GetFull(c echo.Context) error {
	id := c.Param("id")
	role := model.UserRole(c.Get("user_role").(string))
	employeeID := c.Get("employee_id").(string)

	// Employee can only view self
	if role == model.RoleEmployee && employeeID != id {
		return echo.NewHTTPError(http.StatusForbidden, "you can only view your own profile")
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.employee.get_employee_full", map[string]string{
		"employee_id": id,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch employee profile")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// Update updates employee fields (admin/HR only).
func (h *EmployeeHandler) Update(c echo.Context) error {
	id := c.Param("id")

	var req model.EmployeeUpdate
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	// If reports_to is being changed, validate no circular chain
	if req.ReportsTo != nil && *req.ReportsTo != "" {
		validation, err := h.frappe.CallMethod("hr_core_ext.api.employee.validate_manager", map[string]string{
			"employee_id": id,
			"manager_id":  *req.ReportsTo,
		})
		if err != nil {
			return frappeHTTPError(err, "failed to validate manager")
		}
		var result model.ManagerValidation
		if err := json.Unmarshal(validation, &result); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to parse validation")
		}
		if !result.Valid {
			return echo.NewHTTPError(http.StatusBadRequest, result.Reason)
		}
	}

	// Build params from non-nil fields
	params := map[string]string{"employee_id": id}
	if req.EmployeeName != nil {
		params["employee_name"] = *req.EmployeeName
	}
	if req.Department != nil {
		params["department"] = *req.Department
	}
	if req.Designation != nil {
		params["designation"] = *req.Designation
	}
	if req.EmploymentType != nil {
		params["employment_type"] = *req.EmploymentType
	}
	if req.Branch != nil {
		params["branch"] = *req.Branch
	}
	if req.ReportsTo != nil {
		params["reports_to"] = *req.ReportsTo
	}
	if req.LeaveApprover != nil {
		params["leave_approver"] = *req.LeaveApprover
	}
	if req.Status != nil {
		params["status"] = *req.Status
	}
	if req.CellPhone != nil {
		params["cell_phone"] = *req.CellPhone
	}
	if req.PersonalEmail != nil {
		params["personal_email"] = *req.PersonalEmail
	}
	if req.CompanyEmail != nil {
		params["company_email"] = *req.CompanyEmail
	}
	if req.CurrentAddress != nil {
		params["current_address"] = *req.CurrentAddress
	}
	if req.PermanentAddress != nil {
		params["permanent_address"] = *req.PermanentAddress
	}
	if req.EmergencyPhone != nil {
		params["emergency_phone_number"] = *req.EmergencyPhone
	}
	if req.PersonToBeContacted != nil {
		params["person_to_be_contacted"] = *req.PersonToBeContacted
	}
	if req.Relation != nil {
		params["relation"] = *req.Relation
	}
	if req.DateOfBirth != nil {
		params["date_of_birth"] = *req.DateOfBirth
	}
	if req.Gender != nil {
		params["gender"] = *req.Gender
	}
	if req.MaritalStatus != nil {
		params["marital_status"] = *req.MaritalStatus
	}
	if req.BloodGroup != nil {
		params["blood_group"] = *req.BloodGroup
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.employee.update_employee", params)
	if err != nil {
		return frappeHTTPError(err, "failed to update employee")
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

	employeeID, err := h.frappe.CreateEmployee(req.EmployeeName, companyName, req.Department, req.Designation)
	if err != nil {
		return frappeHTTPError(err, "failed to create employee in Frappe")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": map[string]string{
			"employee_id": employeeID,
			"message":     "employee created",
		},
	})
}

// GetCompensation returns salary structure for an employee.
func (h *EmployeeHandler) GetCompensation(c echo.Context) error {
	id := c.Param("id")

	data, err := h.frappe.CallMethod("hr_core_ext.api.compensation.get_salary_structure", map[string]string{
		"employee_id": id,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch compensation data")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// GetLeave returns leave balance and history for an employee.
func (h *EmployeeHandler) GetLeave(c echo.Context) error {
	id := c.Param("id")
	role := model.UserRole(c.Get("user_role").(string))
	employeeID := c.Get("employee_id").(string)

	// Employee can only view self
	if role == model.RoleEmployee && employeeID != id {
		return echo.NewHTTPError(http.StatusForbidden, "you can only view your own leave data")
	}

	// Get allocations
	allocations, err := h.frappe.CallMethod("hr_core_ext.api.leave.get_leave_allocations", map[string]string{
		"employee_id": id,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch leave allocations")
	}

	// Get leave applications
	applications, err := h.frappe.CallMethod("hr_core_ext.api.leave.get_leave_applications", map[string]string{
		"employee_id": id,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch leave applications")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"allocations":  json.RawMessage(allocations),
			"applications": json.RawMessage(applications),
		},
	})
}

// GetAttendance returns attendance detail for an employee.
func (h *EmployeeHandler) GetAttendance(c echo.Context) error {
	id := c.Param("id")
	role := model.UserRole(c.Get("user_role").(string))
	employeeID := c.Get("employee_id").(string)

	// Employee can only view self
	if role == model.RoleEmployee && employeeID != id {
		return echo.NewHTTPError(http.StatusForbidden, "you can only view your own attendance")
	}

	params := map[string]string{"employee_id": id}
	if from := c.QueryParam("from_date"); from != "" {
		params["from_date"] = from
	}
	if to := c.QueryParam("to_date"); to != "" {
		params["to_date"] = to
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.attendance.get_attendance_detail", params)
	if err != nil {
		return frappeHTTPError(err, "failed to fetch attendance detail")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// GetDocuments returns documents attached to an employee.
func (h *EmployeeHandler) GetDocuments(c echo.Context) error {
	id := c.Param("id")
	role := model.UserRole(c.Get("user_role").(string))
	employeeID := c.Get("employee_id").(string)

	// Employee can only view own documents
	if role == model.RoleEmployee && employeeID != id {
		return echo.NewHTTPError(http.StatusForbidden, "you can only view your own documents")
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.document.get_employee_documents", map[string]string{
		"employee_id": id,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch documents")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// UploadDocument uploads a file to an employee.
func (h *EmployeeHandler) UploadDocument(c echo.Context) error {
	id := c.Param("id")

	var req struct {
		Filename string `json:"filename"`
		Content  string `json:"content"` // base64
		DocType  string `json:"doc_type,omitempty"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Filename == "" || req.Content == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "filename and content are required")
	}

	params := map[string]string{
		"employee_id": id,
		"filename":    req.Filename,
		"content":     req.Content,
	}
	if req.DocType != "" {
		params["doc_type"] = req.DocType
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.document.upload_employee_document", params)
	if err != nil {
		return frappeHTTPError(err, "failed to upload document")
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// UpdateContact allows employee to self-edit limited contact fields.
func (h *EmployeeHandler) UpdateContact(c echo.Context) error {
	id := c.Param("id")
	role := model.UserRole(c.Get("user_role").(string))
	employeeID := c.Get("employee_id").(string)

	// Employee can only edit own contact
	if role == model.RoleEmployee && employeeID != id {
		return echo.NewHTTPError(http.StatusForbidden, "you can only edit your own contact info")
	}

	var req struct {
		CellPhone           *string `json:"cell_phone,omitempty"`
		PersonalEmail       *string `json:"personal_email,omitempty"`
		CurrentAddress      *string `json:"current_address,omitempty"`
		PermanentAddress    *string `json:"permanent_address,omitempty"`
		EmergencyPhone      *string `json:"emergency_phone_number,omitempty"`
		PersonToBeContacted *string `json:"person_to_be_contacted,omitempty"`
		Relation            *string `json:"relation,omitempty"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	params := map[string]string{"employee_id": id}
	if req.CellPhone != nil {
		params["cell_phone"] = *req.CellPhone
	}
	if req.PersonalEmail != nil {
		params["personal_email"] = *req.PersonalEmail
	}
	if req.CurrentAddress != nil {
		params["current_address"] = *req.CurrentAddress
	}
	if req.PermanentAddress != nil {
		params["permanent_address"] = *req.PermanentAddress
	}
	if req.EmergencyPhone != nil {
		params["emergency_phone_number"] = *req.EmergencyPhone
	}
	if req.PersonToBeContacted != nil {
		params["person_to_be_contacted"] = *req.PersonToBeContacted
	}
	if req.Relation != nil {
		params["relation"] = *req.Relation
	}

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.employee.update_employee_contact", params)
	if err != nil {
		return frappeHTTPError(err, "failed to update contact info")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// GetTimeline returns timeline events for an employee.
func (h *EmployeeHandler) GetTimeline(c echo.Context) error {
	id := c.Param("id")
	role := model.UserRole(c.Get("user_role").(string))
	employeeID := c.Get("employee_id").(string)

	if role == model.RoleEmployee && employeeID != id {
		return echo.NewHTTPError(http.StatusForbidden, "you can only view your own timeline")
	}

	data, err := h.frappe.CallMethod("hr_core_ext.api.employee.get_employee_timeline", map[string]string{
		"employee_id": id,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch timeline")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// DeleteDocument deletes a file attached to an employee.
func (h *EmployeeHandler) DeleteDocument(c echo.Context) error {
	docID := c.Param("doc_id")

	data, err := h.frappe.CallMethodPost("hr_core_ext.api.document.delete_employee_document", map[string]string{
		"file_name": docID,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to delete document")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}

// GetPromotions returns promotion history for an employee.
func (h *EmployeeHandler) GetPromotions(c echo.Context) error {
	id := c.Param("id")

	data, err := h.frappe.CallMethod("hr_core_ext.api.promotion.get_promotions", map[string]string{
		"employee_id": id,
	})
	if err != nil {
		return frappeHTTPError(err, "failed to fetch promotions")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": json.RawMessage(data),
	})
}
