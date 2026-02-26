package handler

import (
	"database/sql"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"hr-platform/bff/internal/auth"
	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/config"
	"hr-platform/bff/internal/middleware"
	"hr-platform/bff/internal/model"
	"hr-platform/bff/internal/repository"

	"github.com/labstack/echo/v4"
)

type AuthHandler struct {
	userRepo    *repository.UserRepository
	companyRepo *repository.CompanyRepository
	auditRepo   *repository.AuditRepository
	frappe      *client.FrappeClient
	cfg         *config.Config
}

func NewAuthHandler(
	userRepo *repository.UserRepository,
	companyRepo *repository.CompanyRepository,
	auditRepo *repository.AuditRepository,
	frappe *client.FrappeClient,
	cfg *config.Config,
) *AuthHandler {
	return &AuthHandler{
		userRepo:    userRepo,
		companyRepo: companyRepo,
		auditRepo:   auditRepo,
		frappe:      frappe,
		cfg:         cfg,
	}
}

func (h *AuthHandler) Login(c echo.Context) error {
	var req model.LoginRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Email == "" || req.Password == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "email and password are required")
	}

	user, err := h.userRepo.GetByEmail(c.Request().Context(), req.Email)
	if err != nil {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid credentials")
	}

	if user.Status != model.StatusActive {
		return echo.NewHTTPError(http.StatusUnauthorized, "account is not active")
	}

	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		return echo.NewHTTPError(http.StatusUnauthorized, "invalid credentials")
	}

	company, err := h.companyRepo.GetByID(c.Request().Context(), user.CompanyID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load company")
	}

	token, err := h.generateToken(user)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to generate token")
	}

	_ = h.userRepo.UpdateLastLogin(c.Request().Context(), user.ID)

	h.setTokenCookie(c, token)

	return c.JSON(http.StatusOK, model.LoginResponse{
		Token: token,
		User:  userToInfo(user, company.Name),
	})
}

func (h *AuthHandler) Signup(c echo.Context) error {
	var req model.SignupRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.CompanyName == "" || req.Email == "" || req.Password == "" || req.FullName == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "company_name, email, password, and full_name are required")
	}

	if len(req.Password) < 8 {
		return echo.NewHTTPError(http.StatusBadRequest, "password must be at least 8 characters")
	}

	ctx := c.Request().Context()

	// Check email uniqueness
	if _, err := h.userRepo.GetByEmail(ctx, req.Email); err == nil {
		return echo.NewHTTPError(http.StatusConflict, "email already registered")
	}

	// Check company name uniqueness
	if _, err := h.companyRepo.GetByName(ctx, req.CompanyName); err == nil {
		return echo.NewHTTPError(http.StatusConflict, "company name already taken")
	}

	// Create company in BFF DB
	company := &model.Company{
		Name:     req.CompanyName,
		Slug:     slugify(req.CompanyName),
		Industry: req.Industry,
		Size:     req.Size,
	}
	if err := h.companyRepo.Create(ctx, company); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create company")
	}

	// Create company in Frappe
	abbr := abbreviate(req.CompanyName)
	frappeCompanyName, err := h.frappe.CreateCompany(req.CompanyName, abbr, "Thailand")
	if err != nil {
		frappeCompanyName = req.CompanyName
	}
	company.FrappeCompanyName = frappeCompanyName
	_ = h.companyRepo.Update(ctx, company)

	// Hash password
	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to process password")
	}

	// Create admin user
	user := &model.User{
		Email:        req.Email,
		PasswordHash: hash,
		FullName:     req.FullName,
		Role:         model.RoleAdmin,
		Status:       model.StatusActive,
		CompanyID:    company.ID,
	}
	if err := h.userRepo.Create(ctx, user); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create user")
	}

	// Create employee in Frappe for admin
	employeeID, err := h.frappe.CreateEmployee(req.FullName, frappeCompanyName, "", "")
	if err == nil && employeeID != "" {
		user.FrappeEmployeeID = &employeeID
		_ = h.userRepo.LinkEmployee(ctx, user.ID, employeeID)
	}

	_ = h.auditRepo.Log(ctx, user.ID, company.ID, "company.created", "company", company.ID, nil)

	token, err := h.generateToken(user)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to generate token")
	}

	h.setTokenCookie(c, token)

	return c.JSON(http.StatusCreated, model.LoginResponse{
		Token: token,
		User:  userToInfo(user, company.Name),
	})
}

func (h *AuthHandler) Me(c echo.Context) error {
	userID := c.Get("user_id").(string)

	user, err := h.userRepo.GetByID(c.Request().Context(), userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusUnauthorized, "user not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load user")
	}

	company, err := h.companyRepo.GetByID(c.Request().Context(), user.CompanyID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to load company")
	}

	return c.JSON(http.StatusOK, userToInfo(user, company.Name))
}

func (h *AuthHandler) Logout(c echo.Context) error {
	c.SetCookie(&http.Cookie{
		Name:     "token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})
	return c.JSON(http.StatusOK, map[string]string{"message": "logged out"})
}

// --- helpers ---

func (h *AuthHandler) generateToken(user *model.User) (string, error) {
	expiryHours, _ := strconv.Atoi(h.cfg.JWTExpiryHours)
	if expiryHours == 0 {
		expiryHours = 24
	}

	employeeID := ""
	if user.FrappeEmployeeID != nil {
		employeeID = *user.FrappeEmployeeID
	}

	return middleware.GenerateToken(
		h.cfg.JWTSecret,
		user.ID,
		user.Email,
		user.FullName,
		employeeID,
		string(user.Role),
		user.CompanyID,
		expiryHours,
	)
}

func (h *AuthHandler) setTokenCookie(c echo.Context, token string) {
	expiryHours, _ := strconv.Atoi(h.cfg.JWTExpiryHours)
	if expiryHours == 0 {
		expiryHours = 24
	}
	c.SetCookie(&http.Cookie{
		Name:     "token",
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().Add(time.Duration(expiryHours) * time.Hour),
	})
}

func userToInfo(user *model.User, companyName string) model.UserInfo {
	employeeID := ""
	if user.FrappeEmployeeID != nil {
		employeeID = *user.FrappeEmployeeID
	}
	return model.UserInfo{
		ID:               user.ID,
		Email:            user.Email,
		FullName:         user.FullName,
		Role:             user.Role,
		CompanyID:        user.CompanyID,
		CompanyName:      companyName,
		FrappeEmployeeID: employeeID,
	}
}

var nonAlphaNum = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(name string) string {
	slug := strings.ToLower(name)
	slug = nonAlphaNum.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	return slug
}

func abbreviate(name string) string {
	words := strings.Fields(name)
	abbr := ""
	for _, w := range words {
		if len(w) > 0 {
			abbr += strings.ToUpper(w[:1])
		}
	}
	if len(abbr) < 2 {
		abbr = strings.ToUpper(name)
		if len(abbr) > 4 {
			abbr = abbr[:4]
		}
	}
	return abbr
}
