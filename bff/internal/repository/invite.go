package repository

import (
	"context"

	"hr-platform/bff/internal/model"

	"github.com/jmoiron/sqlx"
)

type InviteRepository struct {
	db *sqlx.DB
}

func NewInviteRepository(db *sqlx.DB) *InviteRepository {
	return &InviteRepository{db: db}
}

func (r *InviteRepository) Create(ctx context.Context, inv *model.Invite) error {
	query := `INSERT INTO invites (token, email, role, company_id, invited_by, frappe_employee_id, expires_at)
	          VALUES ($1, $2, $3, $4, $5, $6, $7)
	          RETURNING id, created_at`
	return r.db.QueryRowContext(ctx, query,
		inv.Token, inv.Email, inv.Role, inv.CompanyID, inv.InvitedBy, inv.FrappeEmployeeID, inv.ExpiresAt,
	).Scan(&inv.ID, &inv.CreatedAt)
}

func (r *InviteRepository) GetByToken(ctx context.Context, token string) (*model.Invite, error) {
	var inv model.Invite
	err := r.db.GetContext(ctx, &inv, `SELECT * FROM invites WHERE token = $1`, token)
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (r *InviteRepository) ListByCompany(ctx context.Context, companyID string) ([]model.Invite, error) {
	var invites []model.Invite
	err := r.db.SelectContext(ctx, &invites,
		`SELECT * FROM invites WHERE company_id = $1 ORDER BY created_at DESC`, companyID)
	return invites, err
}

func (r *InviteRepository) MarkAccepted(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE invites SET accepted_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *InviteRepository) Revoke(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE invites SET revoked = TRUE WHERE id = $1`, id)
	return err
}
