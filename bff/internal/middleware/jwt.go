package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
)

type JWTClaims struct {
	UserID     string `json:"user_id"`
	Email      string `json:"email"`
	FullName   string `json:"full_name"`
	EmployeeID string `json:"employee_id"`
	Role       string `json:"role"`
	CompanyID  string `json:"company_id"`
	jwt.RegisteredClaims
}

func GenerateToken(secret string, userID, email, fullName, employeeID, role, companyID string, expiryHours int) (string, error) {
	claims := &JWTClaims{
		UserID:     userID,
		Email:      email,
		FullName:   fullName,
		EmployeeID: employeeID,
		Role:       role,
		CompanyID:  companyID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expiryHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func JWTMiddleware(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				cookie, err := c.Cookie("token")
				if err != nil || cookie.Value == "" {
					return echo.NewHTTPError(http.StatusUnauthorized, "missing authentication token")
				}
				authHeader = "Bearer " + cookie.Value
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenStr == authHeader {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid authorization header")
			}

			claims := &JWTClaims{}
			token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			})

			if err != nil || !token.Valid {
				return echo.NewHTTPError(http.StatusUnauthorized, "invalid or expired token")
			}

			c.Set("user_id", claims.UserID)
			c.Set("user_email", claims.Email)
			c.Set("user_name", claims.FullName)
			c.Set("employee_id", claims.EmployeeID)
			c.Set("user_role", claims.Role)
			c.Set("company_id", claims.CompanyID)

			return next(c)
		}
	}
}
