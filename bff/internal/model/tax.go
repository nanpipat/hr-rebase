package model

type UpdateTaxDeductionsRequest struct {
	TaxID                  *string  `json:"tax_id,omitempty"`
	PersonalAllowance      *float64 `json:"personal_allowance,omitempty"`
	SpouseAllowance        *float64 `json:"spouse_allowance,omitempty"`
	ChildrenCount          *int     `json:"children_count,omitempty"`
	LifeInsurancePremium   *float64 `json:"life_insurance_premium,omitempty"`
	HealthInsurancePremium *float64 `json:"health_insurance_premium,omitempty"`
	HousingLoanInterest    *float64 `json:"housing_loan_interest,omitempty"`
	DonationDeduction      *float64 `json:"donation_deduction,omitempty"`
}
