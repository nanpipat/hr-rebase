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
	notifRepo := repository.NewNotificationRepository(db)

	// --- Clients ---
	frappeClient := client.NewFrappeClient(cfg.FrappeURL, cfg.FrappeAPIKey, cfg.FrappeAPISecret)

	// --- Handlers ---
	authHandler := handler.NewAuthHandler(userRepo, companyRepo, auditRepo, frappeClient, cfg)
	inviteHandler := handler.NewInviteHandler(inviteRepo, userRepo, companyRepo, auditRepo, cfg)
	userHandler := handler.NewUserHandler(userRepo, auditRepo)
	employeeHandler := handler.NewEmployeeHandler(frappeClient, companyRepo)
	leaveHandler := handler.NewLeaveHandler(frappeClient, notifRepo, userRepo)
	attendanceHandler := handler.NewAttendanceHandler(frappeClient)
	payrollHandler := handler.NewPayrollHandler(frappeClient)
	shiftHandler := handler.NewShiftHandler(frappeClient, notifRepo, userRepo)
	ssoHandler := handler.NewSocialSecurityHandler(frappeClient)
	pvdHandler := handler.NewProvidentFundHandler(frappeClient)
	overtimeHandler := handler.NewOvertimeHandler(frappeClient, notifRepo, userRepo)
	taxHandler := handler.NewTaxHandler(frappeClient)
	notifHandler := handler.NewNotificationHandler(notifRepo)
	reportsHandler := handler.NewReportsHandler(frappeClient)
	orgchartHandler := handler.NewOrgChartHandler(frappeClient)

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

	// Employee routes (all roles, self-filtered in handlers)
	api.GET("/employees", employeeHandler.List)
	api.GET("/employees/:id", employeeHandler.Get)
	api.GET("/employees/:id/full", employeeHandler.GetFull)
	api.GET("/employees/:id/leave", employeeHandler.GetLeave)
	api.GET("/employees/:id/attendance", employeeHandler.GetAttendance)
	api.GET("/employees/:id/documents", employeeHandler.GetDocuments)
	api.PUT("/employees/:id/contact", employeeHandler.UpdateContact)
	api.GET("/employees/:id/timeline", employeeHandler.GetTimeline)

	// Leave routes (all roles)
	api.POST("/leaves", leaveHandler.Create)
	api.GET("/leaves", leaveHandler.List)
	api.GET("/leaves/balance", leaveHandler.Balance)
	api.PUT("/leaves/:id", leaveHandler.Update)
	api.DELETE("/leaves/:id", leaveHandler.Cancel)

	// Check-in / Check-out routes (all roles)
	api.POST("/checkin", attendanceHandler.Checkin)
	api.POST("/checkout", attendanceHandler.Checkout)
	api.GET("/checkin/today", attendanceHandler.TodayCheckin)
	api.GET("/checkin/history", attendanceHandler.CheckinHistory)

	// Attendance routes (all roles)
	api.GET("/attendance/me", attendanceHandler.Me)
	api.POST("/attendance/requests", attendanceHandler.CreateRequest)
	api.GET("/attendance/requests", attendanceHandler.ListRequests)

	// Payroll routes (all roles, self-filtered in handler)
	api.GET("/payroll/slips", payrollHandler.ListSlips)
	api.GET("/payroll/slips/detail", payrollHandler.GetSlip)

	// Shift routes (all roles, self-filtered in handler)
	api.GET("/shifts/types", shiftHandler.ListShiftTypes)
	api.GET("/shifts/me", shiftHandler.GetMyShift)
	api.GET("/shifts/assignments", shiftHandler.ListAssignments)
	api.GET("/shifts/requests", shiftHandler.ListRequests)
	api.POST("/shifts/requests", shiftHandler.CreateRequest)

	// Overtime routes (all roles, self-filtered in handler)
	api.POST("/overtime", overtimeHandler.Create)
	api.GET("/overtime", overtimeHandler.List)
	api.DELETE("/overtime/:id", overtimeHandler.Cancel)

	// Tax routes (all roles, self-filtered in handler)
	api.GET("/tax/slabs", taxHandler.GetSlabs)
	api.GET("/tax/employees/:id/deductions", taxHandler.GetEmployeeDeductions)
	api.PUT("/tax/employees/:id/deductions", taxHandler.UpdateEmployeeDeductions)
	api.GET("/tax/employees/:id/summary", taxHandler.GetEmployeeSummary)

	// SSO routes (all roles can view own)
	api.GET("/sso/config", ssoHandler.GetConfig)
	api.GET("/sso/employees/:id", ssoHandler.GetEmployeeSSO)

	// PVD routes (all roles can view own)
	api.GET("/pvd/config", pvdHandler.GetConfig)
	api.GET("/pvd/employees/:id", pvdHandler.GetEmployee)

	// Notification routes (all roles)
	api.GET("/notifications", notifHandler.List)
	api.GET("/notifications/count", notifHandler.Count)
	api.PUT("/notifications/:id/read", notifHandler.MarkRead)
	api.PUT("/notifications/read-all", notifHandler.MarkAllRead)

	// Org chart routes (all roles)
	api.GET("/orgchart/tree", orgchartHandler.GetTree)
	api.GET("/orgchart/departments", orgchartHandler.GetDepartments)

	// Admin/HR/Manager routes
	api.PUT("/leaves/:id/approve", leaveHandler.Approve, middleware.RequireRole(model.RoleAdmin, model.RoleHR, model.RoleManager))
	api.GET("/attendance", attendanceHandler.List, middleware.RequireRole(model.RoleAdmin, model.RoleHR, model.RoleManager))
	api.PUT("/attendance/requests/:id/approve", attendanceHandler.ApproveRequest, middleware.RequireRole(model.RoleAdmin, model.RoleHR, model.RoleManager))
	api.PUT("/shifts/requests/:id/approve", shiftHandler.ApproveRequest, middleware.RequireRole(model.RoleAdmin, model.RoleHR, model.RoleManager))
	api.PUT("/overtime/:id/approve", overtimeHandler.Approve, middleware.RequireRole(model.RoleAdmin, model.RoleHR, model.RoleManager))

	// Admin/HR only routes
	admin := api.Group("", middleware.RequireAdminOrHR())
	admin.POST("/employees", employeeHandler.Create)
	admin.PUT("/employees/:id", employeeHandler.Update)
	admin.GET("/employees/:id/compensation", employeeHandler.GetCompensation)
	admin.GET("/employees/:id/promotions", employeeHandler.GetPromotions)
	admin.POST("/employees/:id/documents", employeeHandler.UploadDocument)
	admin.DELETE("/employees/:id/documents/:doc_id", employeeHandler.DeleteDocument)
	admin.GET("/users", userHandler.List)
	admin.GET("/users/:id", userHandler.Get)
	admin.PUT("/users/:id/role", userHandler.ChangeRole)
	admin.PUT("/users/:id/status", userHandler.ChangeStatus)
	admin.PUT("/users/:id/employee", userHandler.LinkEmployee)
	admin.POST("/invites", inviteHandler.Create)
	admin.GET("/invites", inviteHandler.List)
	admin.DELETE("/invites/:id", inviteHandler.Revoke)
	admin.POST("/payroll/employees/:id/setup", payrollHandler.SetupEmployee)
	admin.POST("/payroll/employees/:id/generate", payrollHandler.GenerateSlip)
	admin.POST("/payroll/process", payrollHandler.Process)
	admin.POST("/payroll/submit", payrollHandler.Submit)
	admin.POST("/shifts/types", shiftHandler.CreateShiftType)
	admin.PUT("/shifts/types/:name", shiftHandler.UpdateShiftType)
	admin.POST("/shifts/assignments", shiftHandler.AssignShift)
	admin.DELETE("/shifts/assignments/:id", shiftHandler.UnassignShift)
	admin.POST("/shifts/auto-attendance", shiftHandler.ProcessAutoAttendance)

	// SSO admin routes
	admin.PUT("/sso/config", ssoHandler.UpdateConfig)
	admin.PUT("/sso/employees/:id", ssoHandler.UpdateEmployeeSSO)
	admin.GET("/sso/report", ssoHandler.GetReport)

	// PVD admin routes
	admin.PUT("/pvd/config", pvdHandler.UpdateConfig)
	admin.POST("/pvd/employees/:id", pvdHandler.EnrollEmployee)
	admin.PUT("/pvd/employees/:id", pvdHandler.UpdateEmployee)
	admin.DELETE("/pvd/employees/:id", pvdHandler.UnenrollEmployee)
	admin.GET("/pvd/report", pvdHandler.GetReport)

	// OT admin routes
	admin.GET("/overtime/config", overtimeHandler.GetConfig)
	admin.PUT("/overtime/config", overtimeHandler.UpdateConfig)

	// Tax admin routes
	admin.GET("/tax/pnd1", taxHandler.GetPND1)
	admin.GET("/tax/withholding-cert/:id", taxHandler.GetWithholdingCert)

	// Reports routes (admin/HR only)
	admin.GET("/reports/employees", reportsHandler.EmployeeSummary)
	admin.GET("/reports/attendance", reportsHandler.AttendanceReport)
	admin.GET("/reports/leave", reportsHandler.LeaveReport)
	admin.GET("/reports/payroll", reportsHandler.PayrollReport)
	admin.GET("/reports/tax", reportsHandler.TaxReport)
	admin.GET("/reports/export", reportsHandler.ExportCSV)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("BFF server starting on %s", addr)
	log.Fatal(e.Start(addr))
}
