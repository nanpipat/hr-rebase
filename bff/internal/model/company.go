package model

import "time"

type Company struct {
	ID                string    `db:"id" json:"id"`
	Name              string    `db:"name" json:"name"`
	Slug              string    `db:"slug" json:"slug"`
	FrappeCompanyName string    `db:"frappe_company_name" json:"frappe_company_name,omitempty"`
	Industry          string    `db:"industry" json:"industry,omitempty"`
	Size              string    `db:"size" json:"size,omitempty"`
	CreatedAt         time.Time `db:"created_at" json:"created_at"`
	UpdatedAt         time.Time `db:"updated_at" json:"updated_at"`
}

type SignupRequest struct {
	CompanyName string `json:"company_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
	FullName    string `json:"full_name"`
	Industry    string `json:"industry,omitempty"`
	Size        string `json:"size,omitempty"`
}
