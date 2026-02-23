package repository

import (
	"context"

	"hr-platform/bff/internal/model"

	"github.com/jmoiron/sqlx"
)

type UserRepository struct {
	db *sqlx.DB
}

func NewUserRepository(db *sqlx.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(ctx context.Context, u *model.User) error {
	query := `INSERT INTO users (email, password_hash, full_name, role, status, company_id, frappe_employee_id)
	          VALUES ($1, $2, $3, $4, $5, $6, $7)
	          RETURNING id, created_at, updated_at`
	return r.db.QueryRowContext(ctx, query,
		u.Email, u.PasswordHash, u.FullName, u.Role, u.Status, u.CompanyID, u.FrappeEmployeeID,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
}

func (r *UserRepository) GetByID(ctx context.Context, id string) (*model.User, error) {
	var u model.User
	err := r.db.GetContext(ctx, &u, `SELECT * FROM users WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) GetByEmail(ctx context.Context, email string) (*model.User, error) {
	var u model.User
	err := r.db.GetContext(ctx, &u, `SELECT * FROM users WHERE email = $1`, email)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) ListByCompany(ctx context.Context, companyID string) ([]model.User, error) {
	var users []model.User
	err := r.db.SelectContext(ctx, &users,
		`SELECT * FROM users WHERE company_id = $1 ORDER BY created_at`, companyID)
	return users, err
}

func (r *UserRepository) UpdateRole(ctx context.Context, id string, role model.UserRole) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`, role, id)
	return err
}

func (r *UserRepository) UpdateStatus(ctx context.Context, id string, status model.UserStatus) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`, status, id)
	return err
}

func (r *UserRepository) UpdateLastLogin(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET last_login_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *UserRepository) GetByFrappeEmployeeID(ctx context.Context, companyID, frappeEmployeeID string) (*model.User, error) {
	var u model.User
	err := r.db.GetContext(ctx, &u, `SELECT * FROM users WHERE company_id = $1 AND frappe_employee_id = $2`, companyID, frappeEmployeeID)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *UserRepository) LinkEmployee(ctx context.Context, id string, frappeEmployeeID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET frappe_employee_id = $1, updated_at = NOW() WHERE id = $2`,
		frappeEmployeeID, id)
	return err
}
