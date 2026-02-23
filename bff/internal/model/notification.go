package model

import "time"

type Notification struct {
	ID        int64     `db:"id" json:"id"`
	UserID    string    `db:"user_id" json:"user_id"`
	CompanyID string    `db:"company_id" json:"company_id"`
	Type      string    `db:"type" json:"type"`
	Title     string    `db:"title" json:"title"`
	Message   string    `db:"message" json:"message"`
	Metadata  *string   `db:"metadata" json:"metadata,omitempty"`
	Read      bool      `db:"read" json:"read"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

type NotificationPreferences struct {
	ID               int64  `db:"id" json:"id"`
	UserID           string `db:"user_id" json:"user_id"`
	LeaveApproved    bool   `db:"leave_approved" json:"leave_approved"`
	OvertimeApproved bool   `db:"overtime_approved" json:"overtime_approved"`
	PayrollProcessed bool   `db:"payroll_processed" json:"payroll_processed"`
	ShiftApproved    bool   `db:"shift_approved" json:"shift_approved"`
}

type UpdateNotificationPreferencesRequest struct {
	LeaveApproved    *bool `json:"leave_approved,omitempty"`
	OvertimeApproved *bool `json:"overtime_approved,omitempty"`
	PayrollProcessed *bool `json:"payroll_processed,omitempty"`
	ShiftApproved    *bool `json:"shift_approved,omitempty"`
}
