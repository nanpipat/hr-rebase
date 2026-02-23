package handler

import (
	"net/http"
	"strconv"

	"hr-platform/bff/internal/repository"

	"github.com/labstack/echo/v4"
)

type NotificationHandler struct {
	notifRepo *repository.NotificationRepository
}

func NewNotificationHandler(notifRepo *repository.NotificationRepository) *NotificationHandler {
	return &NotificationHandler{notifRepo: notifRepo}
}

func (h *NotificationHandler) List(c echo.Context) error {
	userID := c.Get("user_id").(string)
	limit := 20
	offset := 0

	if l := c.QueryParam("limit"); l != "" {
		if v, err := strconv.Atoi(l); err == nil {
			limit = v
		}
	}
	if o := c.QueryParam("offset"); o != "" {
		if v, err := strconv.Atoi(o); err == nil {
			offset = v
		}
	}

	notifications, err := h.notifRepo.ListByUser(c.Request().Context(), userID, limit, offset)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch notifications")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"data": notifications})
}

func (h *NotificationHandler) Count(c echo.Context) error {
	userID := c.Get("user_id").(string)

	count, err := h.notifRepo.CountUnread(c.Request().Context(), userID)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to count notifications")
	}

	return c.JSON(http.StatusOK, map[string]interface{}{"count": count})
}

func (h *NotificationHandler) MarkRead(c echo.Context) error {
	userID := c.Get("user_id").(string)
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid notification id")
	}

	if err := h.notifRepo.MarkAsRead(c.Request().Context(), id, userID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to mark notification as read")
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "marked as read"})
}

func (h *NotificationHandler) MarkAllRead(c echo.Context) error {
	userID := c.Get("user_id").(string)

	if err := h.notifRepo.MarkAllAsRead(c.Request().Context(), userID); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to mark all as read")
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "all marked as read"})
}
