package model

import "time"

type UserRole string

const (
	RoleAdmin    UserRole = "admin"
	RoleHR       UserRole = "hr"
	RoleManager  UserRole = "manager"
	RoleEmployee UserRole = "employee"
)

type UserStatus string

const (
	StatusInvited   UserStatus = "invited"
	StatusActive    UserStatus = "active"
	StatusSuspended UserStatus = "suspended"
	StatusDisabled  UserStatus = "disabled"
)

type User struct {
	ID               string     `db:"id" json:"id"`
	Email            string     `db:"email" json:"email"`
	PasswordHash     string     `db:"password_hash" json:"-"`
	FullName         string     `db:"full_name" json:"full_name"`
	Role             UserRole   `db:"role" json:"role"`
	Status           UserStatus `db:"status" json:"status"`
	CompanyID        string     `db:"company_id" json:"company_id"`
	FrappeEmployeeID *string    `db:"frappe_employee_id" json:"frappe_employee_id,omitempty"`
	LastLoginAt      *time.Time `db:"last_login_at" json:"last_login_at,omitempty"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at" json:"updated_at"`
}

type UserInfo struct {
	ID               string   `json:"id"`
	Email            string   `json:"email"`
	FullName         string   `json:"full_name"`
	Role             UserRole `json:"role"`
	CompanyID        string   `json:"company_id"`
	CompanyName      string   `json:"company_name"`
	FrappeEmployeeID string   `json:"frappe_employee_id,omitempty"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string   `json:"token"`
	User  UserInfo `json:"user"`
}
