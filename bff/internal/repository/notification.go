package repository

import (
	"context"
	"encoding/json"

	"hr-platform/bff/internal/model"

	"github.com/jmoiron/sqlx"
)

type NotificationRepository struct {
	db *sqlx.DB
}

func NewNotificationRepository(db *sqlx.DB) *NotificationRepository {
	return &NotificationRepository{db: db}
}

func (r *NotificationRepository) Create(ctx context.Context, n *model.Notification) error {
	query := `INSERT INTO notifications (user_id, company_id, type, title, message, metadata)
	          VALUES ($1, $2, $3, $4, $5, $6)
	          RETURNING id, created_at`
	return r.db.QueryRowContext(ctx, query,
		n.UserID, n.CompanyID, n.Type, n.Title, n.Message, n.Metadata,
	).Scan(&n.ID, &n.CreatedAt)
}

func (r *NotificationRepository) CreateForCompanyUsers(ctx context.Context, companyID, notifType, title, message string, metadata map[string]interface{}) error {
	metaJSON, _ := json.Marshal(metadata)
	metaStr := string(metaJSON)

	_, err := r.db.ExecContext(ctx, `
		INSERT INTO notifications (user_id, company_id, type, title, message, metadata)
		SELECT id, company_id, $2, $3, $4, $5
		FROM users
		WHERE company_id = $1 AND status = 'active'
	`, companyID, notifType, title, message, metaStr)
	return err
}

func (r *NotificationRepository) ListByUser(ctx context.Context, userID string, limit, offset int) ([]model.Notification, error) {
	var notifications []model.Notification
	err := r.db.SelectContext(ctx, &notifications, `
		SELECT id, user_id, company_id, type, title, message, metadata, read, created_at
		FROM notifications
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)
	return notifications, err
}

func (r *NotificationRepository) CountUnread(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.db.GetContext(ctx, &count, `
		SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE
	`, userID)
	return count, err
}

func (r *NotificationRepository) MarkAsRead(ctx context.Context, id int64, userID string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2
	`, id, userID)
	return err
}

func (r *NotificationRepository) MarkAllAsRead(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE
	`, userID)
	return err
}

func (r *NotificationRepository) CreateForUser(ctx context.Context, userID, companyID, notifType, title, message string) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO notifications (user_id, company_id, type, title, message)
		VALUES ($1, $2, $3, $4, $5)
	`, userID, companyID, notifType, title, message)
	return err
}
