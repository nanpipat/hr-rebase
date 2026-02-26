package config

import "os"

type Config struct {
	Port            string
	FrappeURL       string
	FrappeAPIKey    string
	FrappeAPISecret string
	JWTSecret       string
	JWTExpiryHours  string
	DatabaseURL     string
	AnthropicAPIKey string
	AnthropicModel  string
	OpenAIAPIKey    string
	OpenAIModel     string
	LLMProvider     string
}

func Load() *Config {
	return &Config{
		Port:            getEnv("BFF_PORT", getEnv("PORT", "8080")),
		FrappeURL:       getEnv("BFF_FRAPPE_URL", "http://frappe:8000"),
		FrappeAPIKey:    getEnv("BFF_FRAPPE_API_KEY", ""),
		FrappeAPISecret: getEnv("BFF_FRAPPE_API_SECRET", ""),
		JWTSecret:       getEnv("JWT_SECRET", "change-me"),
		JWTExpiryHours:  getEnv("JWT_EXPIRY_HOURS", "24"),
		DatabaseURL:     getEnv("BFF_DATABASE_URL", "postgres://bff:bff_secret@postgres:5432/bff?sslmode=disable"),
		AnthropicAPIKey: getEnv("ANTHROPIC_API_KEY", ""),
		AnthropicModel:  getEnv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"),
		OpenAIAPIKey:    getEnv("OPENAI_API_KEY", ""),
		OpenAIModel:     getEnv("OPENAI_MODEL", "gpt-4o"),
		LLMProvider:     getEnv("LLM_PROVIDER", "anthropic"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
