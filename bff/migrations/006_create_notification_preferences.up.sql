CREATE TABLE notification_preferences (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) UNIQUE,
    leave_approved BOOLEAN NOT NULL DEFAULT TRUE,
    overtime_approved BOOLEAN NOT NULL DEFAULT TRUE,
    payroll_processed BOOLEAN NOT NULL DEFAULT TRUE,
    shift_approved BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
