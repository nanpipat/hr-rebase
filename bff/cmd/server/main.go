package main

import (
	"fmt"
	"log"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/config"
	"hr-platform/bff/internal/database"
	"hr-platform/bff/internal/handler"
	"hr-platform/bff/internal/middleware"
	"hr-platform/bff/internal/model"
	"hr-platform/bff/internal/repository"
	"hr-platform/bff/migrations"

	"github.com/labstack/echo/v4"
	echomw "github.com/labstack/echo/v4/middleware"
)

func main() {
	cfg := config.Load()

	// --- Database ---
	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	log.Println("Running database migrations...")
	if err := database.RunMigrations(cfg.DatabaseURL, migrations.FS); err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	log.Println("Database migrations complete.")

	// --- Repositories ---
	companyRepo := repository.NewCompanyRepository(db)
	userRepo := repository.NewUserRepository(db)
	inviteRepo := repository.NewInviteRepository(db)
	auditRepo := repository.NewAuditRepository(db)

	// --- Clients ---
	frappeClient := client.NewFrappeClient(cfg.FrappeURL, cfg.FrappeAPIKey, cfg.FrappeAPISecret)

	// --- Handlers ---
	authHandler := handler.NewAuthHandler(userRepo, companyRepo, auditRepo, frappeClient, cfg)
	inviteHandler := handler.NewInviteHandler(inviteRepo, userRepo, companyRepo, auditRepo, cfg)
	userHandler := handler.NewUserHandler(userRepo, auditRepo)
	employeeHandler := handler.NewEmployeeHandler(frappeClient, companyRepo)
	leaveHandler := handler.NewLeaveHandler(frappeClient)
	attendanceHandler := handler.NewAttendanceHandler(frappeClient)

	// --- Echo ---
	e := echo.New()
	e.HideBanner = true

	// Global middleware
	e.Use(echomw.Logger())
	e.Use(echomw.Recover())
	e.Use(echomw.CORSWithConfig(echomw.CORSConfig{
		AllowOrigins:     []string{"http://localhost:5009", "http://localhost", "http://localhost:3000"},
		AllowCredentials: true,
	}))

	// Health check
	e.GET("/api/health", func(c echo.Context) error {
		return c.JSON(200, map[string]string{"status": "ok"})
	})

	// Public routes
	e.POST("/api/auth/login", authHandler.Login)
	e.POST("/api/auth/signup", authHandler.Signup)
	e.POST("/api/invites/accept", inviteHandler.Accept)

	// Protected routes (all roles)
	api := e.Group("/api", middleware.JWTMiddleware(cfg.JWTSecret))
	api.GET("/me", authHandler.Me)
	api.POST("/auth/logout", authHandler.Logout)
	api.GET("/employees", employeeHandler.List)
	api.GET("/employees/:id", employeeHandler.Get)
	api.POST("/leaves", leaveHandler.Create)
	api.GET("/leaves", leaveHandler.List)
	api.GET("/attendance/me", attendanceHandler.Me)

	// Admin/HR/Manager routes
	api.PUT("/leaves/:id/approve", leaveHandler.Approve, middleware.RequireRole(model.RoleAdmin, model.RoleHR, model.RoleManager))
	api.GET("/attendance", attendanceHandler.List, middleware.RequireRole(model.RoleAdmin, model.RoleHR, model.RoleManager))

	// Admin/HR only routes
	admin := api.Group("", middleware.RequireAdminOrHR())
	admin.POST("/employees", employeeHandler.Create)
	admin.GET("/users", userHandler.List)
	admin.GET("/users/:id", userHandler.Get)
	admin.PUT("/users/:id/role", userHandler.ChangeRole)
	admin.PUT("/users/:id/status", userHandler.ChangeStatus)
	admin.PUT("/users/:id/employee", userHandler.LinkEmployee)
	admin.POST("/invites", inviteHandler.Create)
	admin.GET("/invites", inviteHandler.List)
	admin.DELETE("/invites/:id", inviteHandler.Revoke)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("BFF server starting on %s", addr)
	log.Fatal(e.Start(addr))
}
