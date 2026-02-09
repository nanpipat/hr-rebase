package middleware

import (
	"net/http"

	"hr-platform/bff/internal/model"

	"github.com/labstack/echo/v4"
)

func RequireRole(allowed ...model.UserRole) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			roleStr, ok := c.Get("user_role").(string)
			if !ok {
				return echo.NewHTTPError(http.StatusForbidden, "role not found in token")
			}
			role := model.UserRole(roleStr)
			for _, r := range allowed {
				if role == r {
					return next(c)
				}
			}
			return echo.NewHTTPError(http.StatusForbidden, "insufficient permissions")
		}
	}
}

func RequireAdminOrHR() echo.MiddlewareFunc {
	return RequireRole(model.RoleAdmin, model.RoleHR)
}
