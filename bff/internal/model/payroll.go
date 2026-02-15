package model

type SetupEmployeePayrollRequest struct {
	BaseSalary float64 `json:"base_salary"`
	Housing    float64 `json:"housing"`
	Transport  float64 `json:"transport"`
}

type ProcessPayrollRequest struct {
	Month   int    `json:"month"`
	Year    int    `json:"year"`
	Company string `json:"company,omitempty"`
}

type SubmitPayrollRequest struct {
	Month int `json:"month"`
	Year  int `json:"year"`
}

type GenerateSalarySlipRequest struct {
	Month int `json:"month"`
	Year  int `json:"year"`
}
