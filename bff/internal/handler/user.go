package handler

import (
	"net/http"

	"hr-platform/bff/internal/model"
	"hr-platform/bff/internal/repository"

	"github.com/labstack/echo/v4"
)

type UserHandler struct {
	userRepo  *repository.UserRepository
	auditRepo *repository.AuditRepository
}

func NewUserHandler(userRepo *repository.UserRepository, auditRepo *repository.AuditRepository) *UserHandler {
	return &UserHandler{userRepo: userRepo, auditRepo: auditRepo}
}

// List returns all users in the caller's company.
func (h *UserHandler) List(c echo.Context) error {
	companyID := c.Get("company_id").(string)

	users, err := h.userRepo.ListByCompany(c.Request().Context(), companyID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to list users")
	}

	// Strip password hashes from response
	type userResponse struct {
		ID               string          `json:"id"`
		Email            string          `json:"email"`
		FullName         string          `json:"full_name"`
		Role             model.UserRole  `json:"role"`
		Status           model.UserStatus `json:"status"`
		FrappeEmployeeID *string         `json:"frappe_employee_id,omitempty"`
		LastLoginAt      interface{}     `json:"last_login_at,omitempty"`
		CreatedAt        interface{}     `json:"created_at"`
	}

	var result []userResponse
	for _, u := range users {
		result = append(result, userResponse{
			ID:               u.ID,
			Email:            u.Email,
			FullName:         u.FullName,
			Role:             u.Role,
			Status:           u.Status,
			FrappeEmployeeID: u.FrappeEmployeeID,
			LastLoginAt:      u.LastLoginAt,
			CreatedAt:        u.CreatedAt,
		})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"data": result})
}

// Get returns a single user by ID.
func (h *UserHandler) Get(c echo.Context) error {
	userID := c.Param("id")
	companyID := c.Get("company_id").(string)

	user, err := h.userRepo.GetByID(c.Request().Context(), userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}

	if user.CompanyID != companyID {
		return echo.NewHTTPError(http.StatusForbidden, "user belongs to another company")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"data": map[string]interface{}{
			"id":                 user.ID,
			"email":              user.Email,
			"full_name":          user.FullName,
			"role":               user.Role,
			"status":             user.Status,
			"frappe_employee_id": user.FrappeEmployeeID,
			"last_login_at":      user.LastLoginAt,
			"created_at":         user.CreatedAt,
		},
	})
}

// ChangeRole changes the role of a user (admin only).
func (h *UserHandler) ChangeRole(c echo.Context) error {
	targetID := c.Param("id")
	companyID := c.Get("company_id").(string)
	actorID := c.Get("user_id").(string)

	var req struct {
		Role model.UserRole `json:"role"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Role != model.RoleAdmin && req.Role != model.RoleHR && req.Role != model.RoleManager && req.Role != model.RoleEmployee {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid role")
	}

	// Prevent self-demotion
	if targetID == actorID {
		return echo.NewHTTPError(http.StatusBadRequest, "cannot change your own role")
	}

	user, err := h.userRepo.GetByID(c.Request().Context(), targetID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}

	if user.CompanyID != companyID {
		return echo.NewHTTPError(http.StatusForbidden, "user belongs to another company")
	}

	oldRole := user.Role
	if err := h.userRepo.UpdateRole(c.Request().Context(), targetID, req.Role); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update role")
	}

	_ = h.auditRepo.Log(c.Request().Context(), actorID, companyID, "user.role_changed", "user", targetID, map[string]string{
		"old_role": string(oldRole),
		"new_role": string(req.Role),
	})

	return c.JSON(http.StatusOK, map[string]string{"message": "role updated"})
}

// ChangeStatus suspends or disables a user (admin/HR).
func (h *UserHandler) ChangeStatus(c echo.Context) error {
	targetID := c.Param("id")
	companyID := c.Get("company_id").(string)
	actorID := c.Get("user_id").(string)

	var req struct {
		Status model.UserStatus `json:"status"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Status != model.StatusActive && req.Status != model.StatusSuspended && req.Status != model.StatusDisabled {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid status")
	}

	if targetID == actorID {
		return echo.NewHTTPError(http.StatusBadRequest, "cannot change your own status")
	}

	user, err := h.userRepo.GetByID(c.Request().Context(), targetID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}

	if user.CompanyID != companyID {
		return echo.NewHTTPError(http.StatusForbidden, "user belongs to another company")
	}

	oldStatus := user.Status
	if err := h.userRepo.UpdateStatus(c.Request().Context(), targetID, req.Status); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update status")
	}

	_ = h.auditRepo.Log(c.Request().Context(), actorID, companyID, "user.status_changed", "user", targetID, map[string]string{
		"old_status": string(oldStatus),
		"new_status": string(req.Status),
	})

	return c.JSON(http.StatusOK, map[string]string{"message": "status updated"})
}

// LinkEmployee links a user to a Frappe employee (admin/HR).
func (h *UserHandler) LinkEmployee(c echo.Context) error {
	targetID := c.Param("id")
	companyID := c.Get("company_id").(string)
	actorID := c.Get("user_id").(string)

	var req struct {
		FrappeEmployeeID string `json:"frappe_employee_id"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.FrappeEmployeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "frappe_employee_id is required")
	}

	user, err := h.userRepo.GetByID(c.Request().Context(), targetID)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "user not found")
	}

	if user.CompanyID != companyID {
		return echo.NewHTTPError(http.StatusForbidden, "user belongs to another company")
	}

	if err := h.userRepo.LinkEmployee(c.Request().Context(), targetID, req.FrappeEmployeeID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to link employee")
	}

	_ = h.auditRepo.Log(c.Request().Context(), actorID, companyID, "user.employee_linked", "user", targetID, map[string]string{
		"frappe_employee_id": req.FrappeEmployeeID,
	})

	return c.JSON(http.StatusOK, map[string]string{"message": "employee linked"})
}
