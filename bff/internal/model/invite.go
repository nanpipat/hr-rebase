package model

import "time"

type Invite struct {
	ID               string     `db:"id" json:"id"`
	Token            string     `db:"token" json:"-"`
	Email            string     `db:"email" json:"email"`
	Role             UserRole   `db:"role" json:"role"`
	CompanyID        string     `db:"company_id" json:"company_id"`
	InvitedBy        string     `db:"invited_by" json:"invited_by"`
	FrappeEmployeeID *string    `db:"frappe_employee_id" json:"frappe_employee_id,omitempty"`
	AcceptedAt       *time.Time `db:"accepted_at" json:"accepted_at,omitempty"`
	ExpiresAt        time.Time  `db:"expires_at" json:"expires_at"`
	Revoked          bool       `db:"revoked" json:"revoked"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
}

type CreateInviteRequest struct {
	Email            string   `json:"email"`
	Role             UserRole `json:"role"`
	FullName         string   `json:"full_name"`
	FrappeEmployeeID string   `json:"frappe_employee_id,omitempty"`
}

type AcceptInviteRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
}
