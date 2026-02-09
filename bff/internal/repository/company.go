package repository

import (
	"context"

	"hr-platform/bff/internal/model"

	"github.com/jmoiron/sqlx"
)

type CompanyRepository struct {
	db *sqlx.DB
}

func NewCompanyRepository(db *sqlx.DB) *CompanyRepository {
	return &CompanyRepository{db: db}
}

func (r *CompanyRepository) Create(ctx context.Context, c *model.Company) error {
	query := `INSERT INTO companies (name, slug, frappe_company_name, industry, size)
	          VALUES ($1, $2, $3, $4, $5)
	          RETURNING id, created_at, updated_at`
	return r.db.QueryRowContext(ctx, query,
		c.Name, c.Slug, c.FrappeCompanyName, c.Industry, c.Size,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *CompanyRepository) GetByID(ctx context.Context, id string) (*model.Company, error) {
	var c model.Company
	err := r.db.GetContext(ctx, &c, `SELECT * FROM companies WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *CompanyRepository) GetBySlug(ctx context.Context, slug string) (*model.Company, error) {
	var c model.Company
	err := r.db.GetContext(ctx, &c, `SELECT * FROM companies WHERE slug = $1`, slug)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *CompanyRepository) GetByName(ctx context.Context, name string) (*model.Company, error) {
	var c model.Company
	err := r.db.GetContext(ctx, &c, `SELECT * FROM companies WHERE name = $1`, name)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *CompanyRepository) Update(ctx context.Context, c *model.Company) error {
	query := `UPDATE companies SET name = $1, slug = $2, frappe_company_name = $3,
	          industry = $4, size = $5, updated_at = NOW()
	          WHERE id = $6`
	_, err := r.db.ExecContext(ctx, query,
		c.Name, c.Slug, c.FrappeCompanyName, c.Industry, c.Size, c.ID)
	return err
}
