package model

type PVDConfigRequest struct {
	MinRate             *float64 `json:"min_rate,omitempty"`
	MaxRate             *float64 `json:"max_rate,omitempty"`
	DefaultEmployeeRate *float64 `json:"default_employee_rate,omitempty"`
	DefaultEmployerRate *float64 `json:"default_employer_rate,omitempty"`
}

type EnrollPVDRequest struct {
	EmployeeRate *float64 `json:"employee_rate,omitempty"`
	EmployerRate *float64 `json:"employer_rate,omitempty"`
}
