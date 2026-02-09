package model

type Employee struct {
	EmployeeID   string `json:"employee_id"`
	EmployeeName string `json:"employee_name"`
	Department   string `json:"department"`
	Designation  string `json:"designation"`
	Status       string `json:"status"`
	Company      string `json:"company"`
	DateOfJoining string `json:"date_of_joining,omitempty"`
	Image        string `json:"image,omitempty"`
}
