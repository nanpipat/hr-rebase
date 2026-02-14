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

type AttendanceDetailSummary struct {
	TotalDays int `json:"total_days"`
	Present   int `json:"present"`
	Absent    int `json:"absent"`
	OnLeave   int `json:"on_leave"`
	LateDays  int `json:"late_days"`
}

type AttendanceCheckin struct {
	Time    string `json:"time"`
	LogType string `json:"log_type"`
}

type AttendanceRequest struct {
	Name         string `json:"name"`
	Employee     string `json:"employee"`
	EmployeeName string `json:"employee_name"`
	FromDate     string `json:"from_date"`
	ToDate       string `json:"to_date"`
	Reason       string `json:"reason"`
	Status       string `json:"status"`
	HalfDay      int    `json:"half_day"`
}

type CreateAttendanceRequestBody struct {
	AttendanceDate string `json:"attendance_date"`
	Reason         string `json:"reason"`
	Status         string `json:"status"`
}

type ApproveAttendanceRequestBody struct {
	Action string `json:"action"` // "approve" or "reject"
}
