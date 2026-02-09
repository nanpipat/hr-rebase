package repository

import (
	"context"
	"encoding/json"

	"github.com/jmoiron/sqlx"
)

type AuditRepository struct {
	db *sqlx.DB
}

func NewAuditRepository(db *sqlx.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) Log(ctx context.Context, actorID, companyID, action, targetType, targetID string, details interface{}) error {
	var detailsJSON []byte
	if details != nil {
		var err error
		detailsJSON, err = json.Marshal(details)
		if err != nil {
			detailsJSON = nil
		}
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO audit_log (actor_id, company_id, action, target_type, target_id, details)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		actorID, companyID, action, targetType, targetID, detailsJSON)
	return err
}
