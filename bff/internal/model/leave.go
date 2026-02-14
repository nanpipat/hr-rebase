package model

type LeaveApplication struct {
	ID           string  `json:"id"`
	EmployeeName string  `json:"employee_name"`
	LeaveType    string  `json:"leave_type"`
	FromDate     string  `json:"from_date"`
	ToDate       string  `json:"to_date"`
	TotalDays    float64 `json:"total_days"`
	Status       string  `json:"status"`
	PostingDate  string  `json:"posting_date"`
	Description  string  `json:"description,omitempty"`
}

type LeaveBalance struct {
	LeaveType      string  `json:"leave_type"`
	TotalAllocated float64 `json:"total_allocated"`
	Used           float64 `json:"used"`
	Remaining      float64 `json:"remaining"`
}

type LeaveAllocation struct {
	LeaveType      string  `json:"leave_type"`
	TotalAllocated float64 `json:"total_allocated"`
	Used           float64 `json:"used"`
	Remaining      float64 `json:"remaining"`
	FromDate       string  `json:"from_date"`
	ToDate         string  `json:"to_date"`
}

type CreateLeaveRequest struct {
	LeaveType string `json:"leave_type"`
	FromDate  string `json:"from_date"`
	ToDate    string `json:"to_date"`
	Reason    string `json:"reason"`
}

type UpdateLeaveRequest struct {
	LeaveType *string `json:"leave_type,omitempty"`
	FromDate  *string `json:"from_date,omitempty"`
	ToDate    *string `json:"to_date,omitempty"`
	Reason    *string `json:"reason,omitempty"`
}
