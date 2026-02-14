package model

type EmployeeDocument struct {
	Name     string `json:"name"`
	FileName string `json:"file_name"`
	FileURL  string `json:"file_url"`
	FileSize int64  `json:"file_size"`
	Creation string `json:"creation"`
	Modified string `json:"modified"`
	Owner    string `json:"owner"`
}
