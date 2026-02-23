package model

type CreateOTRequestBody struct {
	EmployeeID string  `json:"employee_id"`
	OTDate     string  `json:"ot_date"`
	OTType     string  `json:"ot_type"`
	Hours      float64 `json:"hours"`
	Reason     string  `json:"reason"`
}

type ApproveOTRequestBody struct {
	Action string `json:"action"` // "approve" or "reject"
}

type OTConfigRequest struct {
	WeekdayOTRate      *float64 `json:"weekday_ot_rate,omitempty"`
	HolidayWorkMonthly *float64 `json:"holiday_work_monthly,omitempty"`
	HolidayWorkDaily   *float64 `json:"holiday_work_daily,omitempty"`
	HolidayOTRate      *float64 `json:"holiday_ot_rate,omitempty"`
	StandardHoursPerDay *int    `json:"standard_hours_per_day,omitempty"`
	StandardWorkingDays *int    `json:"standard_working_days,omitempty"`
}
