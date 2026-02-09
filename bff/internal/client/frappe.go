package client

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type FrappeClient struct {
	BaseURL    string
	APIKey     string
	APISecret  string
	HTTPClient *http.Client
}

func NewFrappeClient(baseURL, apiKey, apiSecret string) *FrappeClient {
	return &FrappeClient{
		BaseURL:   strings.TrimRight(baseURL, "/"),
		APIKey:    apiKey,
		APISecret: apiSecret,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (c *FrappeClient) doRequest(method, path string, body io.Reader) ([]byte, error) {
	reqURL := fmt.Sprintf("%s%s", c.BaseURL, path)
	req, err := http.NewRequest(method, reqURL, body)
	if err != nil {
		return nil, fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("token %s:%s", c.APIKey, c.APISecret))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("executing request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("reading response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("frappe API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// Login authenticates a user against Frappe and returns user info.
func (c *FrappeClient) Login(username, password string) (map[string]interface{}, error) {
	data := url.Values{}
	data.Set("usr", username)
	data.Set("pwd", password)

	reqURL := fmt.Sprintf("%s/api/method/login", c.BaseURL)
	req, err := http.NewRequest("POST", reqURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("login failed with status %d", resp.StatusCode)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return result, nil
}

// CallMethod calls a whitelisted Frappe method.
func (c *FrappeClient) CallMethod(method string, params map[string]string) (json.RawMessage, error) {
	query := url.Values{}
	for k, v := range params {
		query.Set(k, v)
	}

	path := fmt.Sprintf("/api/method/%s?%s", method, query.Encode())
	body, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Message json.RawMessage `json:"message"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}

	return resp.Message, nil
}

// CreateCompany creates a new company in Frappe. Returns the Frappe company name.
func (c *FrappeClient) CreateCompany(name, abbr, country string) (string, error) {
	payload := map[string]string{
		"company_name": name,
		"abbr":         abbr,
		"country":      country,
	}

	result, err := c.CallMethod("hr_core_ext.api.company.create_company", payload)
	if err != nil {
		return "", fmt.Errorf("creating Frappe company: %w", err)
	}

	var resp struct {
		Name string `json:"name"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return name, nil // fallback to input name
	}
	if resp.Name == "" {
		return name, nil
	}
	return resp.Name, nil
}

// CreateEmployee creates a new employee in Frappe. Returns the employee_id.
func (c *FrappeClient) CreateEmployee(employeeName, company string) (string, error) {
	payload := map[string]string{
		"employee_name": employeeName,
		"company":       company,
	}

	result, err := c.CallMethod("hr_core_ext.api.company.create_employee", payload)
	if err != nil {
		return "", fmt.Errorf("creating Frappe employee: %w", err)
	}

	var resp struct {
		EmployeeID string `json:"employee_id"`
	}
	if err := json.Unmarshal(result, &resp); err != nil {
		return "", fmt.Errorf("decoding employee response: %w", err)
	}
	return resp.EmployeeID, nil
}

// GetResource fetches a list of Frappe resources.
func (c *FrappeClient) GetResource(doctype string, filters map[string]string, fields []string, limit int) (json.RawMessage, error) {
	query := url.Values{}
	if len(filters) > 0 {
		filtersJSON, _ := json.Marshal(filters)
		query.Set("filters", string(filtersJSON))
	}
	if len(fields) > 0 {
		fieldsJSON, _ := json.Marshal(fields)
		query.Set("fields", string(fieldsJSON))
	}
	query.Set("limit_page_length", fmt.Sprintf("%d", limit))

	path := fmt.Sprintf("/api/resource/%s?%s", doctype, query.Encode())
	body, err := c.doRequest("GET", path, nil)
	if err != nil {
		return nil, err
	}

	var resp struct {
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("decoding response: %w", err)
	}

	return resp.Data, nil
}
