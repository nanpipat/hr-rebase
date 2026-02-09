package handler

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"hr-platform/bff/internal/auth"
	"hr-platform/bff/internal/config"
	"hr-platform/bff/internal/middleware"
	"hr-platform/bff/internal/model"
	"hr-platform/bff/internal/repository"

	"github.com/labstack/echo/v4"
)

type InviteHandler struct {
	inviteRepo  *repository.InviteRepository
	userRepo    *repository.UserRepository
	companyRepo *repository.CompanyRepository
	auditRepo   *repository.AuditRepository
	cfg         *config.Config
}

func NewInviteHandler(
	inviteRepo *repository.InviteRepository,
	userRepo *repository.UserRepository,
	companyRepo *repository.CompanyRepository,
	auditRepo *repository.AuditRepository,
	cfg *config.Config,
) *InviteHandler {
	return &InviteHandler{
		inviteRepo:  inviteRepo,
		userRepo:    userRepo,
		companyRepo: companyRepo,
		auditRepo:   auditRepo,
		cfg:         cfg,
	}
}

// Create creates a new invite (admin/HR only).
func (h *InviteHandler) Create(c echo.Context) error {
	var req model.CreateInviteRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Email == "" || req.FullName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "email and full_name are required")
	}

	if req.Role == "" {
		req.Role = model.RoleEmployee
	}

	ctx := c.Request().Context()
	companyID := c.Get("company_id").(string)
	actorID := c.Get("user_id").(string)

	// Check email not already registered
	if _, err := h.userRepo.GetByEmail(ctx, req.Email); err == nil {
		return echo.NewHTTPError(http.StatusConflict, "email already registered")
	}

	// Generate secure token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to generate token")
	}
	token := hex.EncodeToString(tokenBytes)

	var frappeEmpID *string
	if req.FrappeEmployeeID != "" {
		frappeEmpID = &req.FrappeEmployeeID
	}

	invite := &model.Invite{
		Token:            token,
		Email:            req.Email,
		Role:             req.Role,
		CompanyID:        companyID,
		InvitedBy:        actorID,
		FrappeEmployeeID: frappeEmpID,
		ExpiresAt:        time.Now().Add(72 * time.Hour),
	}

	if err := h.inviteRepo.Create(ctx, invite); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create invite")
	}

	_ = h.auditRepo.Log(ctx, actorID, companyID, "invite.created", "invite", invite.ID, map[string]string{
		"email": req.Email,
		"role":  string(req.Role),
	})

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"data": map[string]interface{}{
			"id":         invite.ID,
			"email":      invite.Email,
			"role":       invite.Role,
			"token":      token,
			"expires_at": invite.ExpiresAt,
		},
	})
}

// List returns all invites for the caller's company.
func (h *InviteHandler) List(c echo.Context) error {
	companyID := c.Get("company_id").(string)

	invites, err := h.inviteRepo.ListByCompany(c.Request().Context(), companyID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to list invites")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"data": invites})
}

// Accept accepts an invite (public, no auth needed).
func (h *InviteHandler) Accept(c echo.Context) error {
	var req model.AcceptInviteRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Token == "" || req.Password == "" || req.FullName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "token, password, and full_name are required")
	}

	if len(req.Password) < 8 {
		return echo.NewHTTPError(http.StatusBadRequest, "password must be at least 8 characters")
	}

	ctx := c.Request().Context()

	invite, err := h.inviteRepo.GetByToken(ctx, req.Token)
	if err != nil {
		return echo.NewHTTPError(http.StatusNotFound, "invalid invite token")
	}

	if invite.Revoked {
		return echo.NewHTTPError(http.StatusGone, "invite has been revoked")
	}

	if invite.AcceptedAt != nil {
		return echo.NewHTTPError(http.StatusGone, "invite has already been accepted")
	}

	if time.Now().After(invite.ExpiresAt) {
		return echo.NewHTTPError(http.StatusGone, "invite has expired")
	}

	// Check email not taken (could have been registered between invite and accept)
	if _, err := h.userRepo.GetByEmail(ctx, invite.Email); err == nil {
		return echo.NewHTTPError(http.StatusConflict, "email already registered")
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to process password")
	}

	user := &model.User{
		Email:            invite.Email,
		PasswordHash:     hash,
		FullName:         req.FullName,
		Role:             invite.Role,
		Status:           model.StatusActive,
		CompanyID:        invite.CompanyID,
		FrappeEmployeeID: invite.FrappeEmployeeID,
	}

	if err := h.userRepo.Create(ctx, user); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create user")
	}

	_ = h.inviteRepo.MarkAccepted(ctx, invite.ID)

	company, err := h.companyRepo.GetByID(ctx, invite.CompanyID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load company")
	}

	token, err := h.generateToken(user, h.cfg)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to generate token")
	}

	h.setTokenCookie(c, token)

	return c.JSON(http.StatusOK, model.LoginResponse{
		Token: token,
		User:  userToInfo(user, company.Name),
	})
}

// Revoke revokes an invite (admin/HR only).
func (h *InviteHandler) Revoke(c echo.Context) error {
	inviteID := c.Param("id")
	companyID := c.Get("company_id").(string)
	actorID := c.Get("user_id").(string)

	invite, err := h.inviteRepo.GetByToken(c.Request().Context(), inviteID)
	if err != nil {
		// Try by ID
		invites, listErr := h.inviteRepo.ListByCompany(c.Request().Context(), companyID)
		if listErr != nil {
			return echo.NewHTTPError(http.StatusNotFound, "invite not found")
		}
		found := false
		for _, inv := range invites {
			if inv.ID == inviteID {
				invite = &inv
				found = true
				break
			}
		}
		if !found {
			return echo.NewHTTPError(http.StatusNotFound, "invite not found")
		}
	}

	if invite.CompanyID != companyID {
		return echo.NewHTTPError(http.StatusForbidden, "invite belongs to another company")
	}

	if err := h.inviteRepo.Revoke(c.Request().Context(), invite.ID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to revoke invite")
	}

	_ = h.auditRepo.Log(c.Request().Context(), actorID, companyID, "invite.revoked", "invite", invite.ID, nil)

	return c.JSON(http.StatusOK, map[string]string{"message": "invite revoked"})
}

func (h *InviteHandler) generateToken(user *model.User, cfg *config.Config) (string, error) {
	expiryHours := 24
	employeeID := ""
	if user.FrappeEmployeeID != nil {
		employeeID = *user.FrappeEmployeeID
	}
	return middleware.GenerateToken(
		cfg.JWTSecret, user.ID, user.Email, user.FullName,
		employeeID, string(user.Role), user.CompanyID, expiryHours,
	)
}

func (h *InviteHandler) setTokenCookie(c echo.Context, token string) {
	c.SetCookie(&http.Cookie{
		Name:     "token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(24 * time.Hour),
	})
}
