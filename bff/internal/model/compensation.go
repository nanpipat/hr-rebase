package model

type SalaryComponent struct {
	SalaryComponent      string  `json:"salary_component"`
	Amount               float64 `json:"amount"`
	Formula              string  `json:"formula,omitempty"`
	AmountBasedOnFormula int     `json:"amount_based_on_formula"`
}

type SalaryAssignment struct {
	Name     string  `json:"name"`
	FromDate string  `json:"from_date"`
	Base     float64 `json:"base"`
	Variable float64 `json:"variable"`
}

type SalaryStructureResponse struct {
	Assignment *SalaryAssignment `json:"assignment"`
	Structure  string            `json:"structure"`
	Earnings   []SalaryComponent `json:"earnings"`
	Deductions []SalaryComponent `json:"deductions"`
}
