package model

type PromotionDetail struct {
	Property  string `json:"property"`
	Current   string `json:"current"`
	New       string `json:"new"`
	FieldName string `json:"fieldname"`
}

type Promotion struct {
	Name          string            `json:"name"`
	PromotionDate string            `json:"promotion_date"`
	Details       []PromotionDetail `json:"details"`
}
