package model

type SSOConfigRequest struct {
	Rate            *float64 `json:"rate,omitempty"`
	MaxSalary       *float64 `json:"max_salary,omitempty"`
	MaxContribution *float64 `json:"max_contribution,omitempty"`
}

type UpdateSSONumberRequest struct {
	SSONumber string `json:"sso_number"`
}
