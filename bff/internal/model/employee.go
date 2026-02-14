package model

type Employee struct {
	EmployeeID    string `json:"employee_id"`
	EmployeeName  string `json:"employee_name"`
	Department    string `json:"department"`
	Designation   string `json:"designation"`
	Status        string `json:"status"`
	Company       string `json:"company"`
	DateOfJoining string `json:"date_of_joining,omitempty"`
	Image         string `json:"image,omitempty"`
}

type EmployeeFull struct {
	// Basic
	EmployeeID   string `json:"employee_id"`
	EmployeeName string `json:"employee_name"`
	Name         string `json:"name"`
	Status       string `json:"status"`
	Company      string `json:"company"`
	Image        string `json:"image,omitempty"`
	// Personal
	DateOfBirth   string `json:"date_of_birth,omitempty"`
	Gender        string `json:"gender,omitempty"`
	MaritalStatus string `json:"marital_status,omitempty"`
	BloodGroup    string `json:"blood_group,omitempty"`
	// Contact
	CellPhone        string `json:"cell_phone,omitempty"`
	PersonalEmail    string `json:"personal_email,omitempty"`
	CompanyEmail     string `json:"company_email,omitempty"`
	CurrentAddress   string `json:"current_address,omitempty"`
	PermanentAddress string `json:"permanent_address,omitempty"`
	// Emergency
	EmergencyPhone        string `json:"emergency_phone,omitempty"`
	PersonToBeContacted   string `json:"person_to_be_contacted,omitempty"`
	EmergencyContactRelation string `json:"relation,omitempty"`
	// Employment
	Department       string `json:"department,omitempty"`
	Designation      string `json:"designation,omitempty"`
	EmploymentType   string `json:"employment_type,omitempty"`
	DateOfJoining    string `json:"date_of_joining,omitempty"`
	DateOfRetirement string `json:"date_of_retirement,omitempty"`
	Branch           string `json:"branch,omitempty"`
	// Reporting
	ReportsTo            string `json:"reports_to,omitempty"`
	ReportsToName        string `json:"reports_to_name,omitempty"`
	LeaveApprover        string `json:"leave_approver,omitempty"`
	LeaveApproverName    string `json:"leave_approver_name,omitempty"`
	// Meta
	Created  string `json:"created,omitempty"`
	Modified string `json:"modified,omitempty"`
}

type EmployeeUpdate struct {
	EmployeeName       *string `json:"employee_name,omitempty"`
	Department         *string `json:"department,omitempty"`
	Designation        *string `json:"designation,omitempty"`
	EmploymentType     *string `json:"employment_type,omitempty"`
	Branch             *string `json:"branch,omitempty"`
	ReportsTo          *string `json:"reports_to,omitempty"`
	LeaveApprover      *string `json:"leave_approver,omitempty"`
	Status             *string `json:"status,omitempty"`
	CellPhone          *string `json:"cell_phone,omitempty"`
	PersonalEmail      *string `json:"personal_email,omitempty"`
	CompanyEmail       *string `json:"company_email,omitempty"`
	CurrentAddress     *string `json:"current_address,omitempty"`
	PermanentAddress   *string `json:"permanent_address,omitempty"`
	EmergencyPhone     *string `json:"emergency_phone_number,omitempty"`
	PersonToBeContacted *string `json:"person_to_be_contacted,omitempty"`
	Relation           *string `json:"relation,omitempty"`
	DateOfBirth        *string `json:"date_of_birth,omitempty"`
	Gender             *string `json:"gender,omitempty"`
	MaritalStatus      *string `json:"marital_status,omitempty"`
	BloodGroup         *string `json:"blood_group,omitempty"`
}

type ManagerValidation struct {
	Valid  bool   `json:"valid"`
	Reason string `json:"reason,omitempty"`
}
