package model

type AttendanceRecord struct {
	Date         string  `json:"date"`
	Status       string  `json:"status"`
	WorkingHours float64 `json:"working_hours"`
	LeaveType    string  `json:"leave_type,omitempty"`
}

type AttendanceSummary struct {
	TotalDays int `json:"total_days"`
	Present   int `json:"present"`
	Absent    int `json:"absent"`
	OnLeave   int `json:"on_leave"`
}
