package model

// CreateShiftTypeRequest is the body for creating a new shift type.
type CreateShiftTypeRequest struct {
	Name                 string `json:"name"`
	StartTime            string `json:"start_time"`
	EndTime              string `json:"end_time"`
	LateEntryGracePeriod int    `json:"late_entry_grace_period"`
	EarlyExitGracePeriod int    `json:"early_exit_grace_period"`
	HolidayList          string `json:"holiday_list,omitempty"`
}

// UpdateShiftTypeRequest is the body for updating a shift type.
type UpdateShiftTypeRequest struct {
	StartTime            *string `json:"start_time,omitempty"`
	EndTime              *string `json:"end_time,omitempty"`
	LateEntryGracePeriod *int    `json:"late_entry_grace_period,omitempty"`
	EarlyExitGracePeriod *int    `json:"early_exit_grace_period,omitempty"`
}

// AssignShiftRequest is the body for assigning a shift to an employee.
type AssignShiftRequest struct {
	EmployeeID string `json:"employee_id"`
	ShiftType  string `json:"shift_type"`
	StartDate  string `json:"start_date"`
	EndDate    string `json:"end_date,omitempty"`
}

// CreateShiftRequestBody is the body for an employee requesting a shift change.
type CreateShiftRequestBody struct {
	ShiftType string `json:"shift_type"`
	FromDate  string `json:"from_date"`
	ToDate    string `json:"to_date"`
}

// ApproveShiftRequestBody is the body for approving/rejecting a shift request.
type ApproveShiftRequestBody struct {
	Action string `json:"action"`
}

// ProcessAutoAttendanceRequest is the body for triggering auto-attendance.
type ProcessAutoAttendanceRequest struct {
	Date    string `json:"date,omitempty"`
	Company string `json:"company,omitempty"`
}
