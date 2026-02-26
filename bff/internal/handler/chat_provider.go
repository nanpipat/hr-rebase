package handler

import (
	"context"
	"encoding/json"
	"log"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/config"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
	openai "github.com/openai/openai-go"
	openaiopt "github.com/openai/openai-go/option"
)

// StreamCB holds callbacks for the SSE event stream.
type StreamCB struct {
	OnTextDelta func(text string)
	OnToolUse   func(name string)
	OnStop      func()
	OnError     func(msg string)
}

// ProviderMessage is a provider-agnostic message.
type ProviderMessage struct {
	Role    string // "user" | "assistant"
	Content string
}

// LLMProvider streams a chat completion with tool use.
type LLMProvider interface {
	StreamChat(
		ctx context.Context,
		systemPrompt string,
		messages []ProviderMessage,
		tctx ToolContext,
		tools []ToolDef,
		frappe *client.FrappeClient,
		cb StreamCB,
	)
}

// NewLLMProvider creates the provider based on config.
func NewLLMProvider(cfg *config.Config) LLMProvider {
	switch cfg.LLMProvider {
	case "openai":
		c := openai.NewClient(openaiopt.WithAPIKey(cfg.OpenAIAPIKey))
		return &openAIProvider{client: &c, model: cfg.OpenAIModel}
	default: // "anthropic"
		c := anthropic.NewClient(option.WithAPIKey(cfg.AnthropicAPIKey))
		return &anthropicProvider{client: &c, model: anthropic.Model(cfg.AnthropicModel)}
	}
}

// ── Anthropic ──────────────────────────────────────────────

type anthropicProvider struct {
	client *anthropic.Client
	model  anthropic.Model
}

func (p *anthropicProvider) StreamChat(ctx context.Context, systemPrompt string, messages []ProviderMessage, tctx ToolContext, tools []ToolDef, frappe *client.FrappeClient, cb StreamCB) {
	anthMessages := make([]anthropic.MessageParam, 0, len(messages))
	for _, m := range messages {
		switch m.Role {
		case "user":
			anthMessages = append(anthMessages, anthropic.NewUserMessage(anthropic.NewTextBlock(m.Content)))
		case "assistant":
			anthMessages = append(anthMessages, anthropic.NewAssistantMessage(anthropic.NewTextBlock(m.Content)))
		}
	}

	anthTools := toAnthropicTools(tools)

	for loop := 0; loop < 10; loop++ {
		stream := p.client.Messages.NewStreaming(ctx, anthropic.MessageNewParams{
			Model:     p.model,
			MaxTokens: 4096,
			System:    []anthropic.TextBlockParam{{Text: systemPrompt}},
			Messages:  anthMessages,
			Tools:     anthTools,
		})

		message := anthropic.Message{}
		for stream.Next() {
			event := stream.Current()
			message.Accumulate(event)
			switch event.Type {
			case "content_block_delta":
				if event.Delta.Text != "" {
					cb.OnTextDelta(event.Delta.Text)
				}
			case "content_block_start":
				if event.ContentBlock.Type == "tool_use" {
					cb.OnToolUse(event.ContentBlock.Name)
				}
			}
		}
		if err := stream.Err(); err != nil {
			log.Printf("anthropic stream error: %v", err)
			cb.OnError("AI processing error")
			return
		}

		if message.StopReason == "tool_use" {
			anthMessages = append(anthMessages, message.ToParam())
			var toolResults []anthropic.ContentBlockParamUnion
			for _, block := range message.Content {
				if block.Type == "tool_use" {
					result := executeTool(frappe, tctx, block.Name, block.Input)
					toolResults = append(toolResults, anthropic.ContentBlockParamUnion{
						OfToolResult: &anthropic.ToolResultBlockParam{
							ToolUseID: block.ID,
							Content:   []anthropic.ToolResultBlockParamContentUnion{{OfText: &anthropic.TextBlockParam{Text: result}}},
						},
					})
				}
			}
			anthMessages = append(anthMessages, anthropic.MessageParam{Role: "user", Content: toolResults})
			continue
		}
		break
	}
	cb.OnStop()
}

// ── OpenAI ─────────────────────────────────────────────────

type openAIProvider struct {
	client *openai.Client
	model  string
}

func (p *openAIProvider) StreamChat(ctx context.Context, systemPrompt string, messages []ProviderMessage, tctx ToolContext, tools []ToolDef, frappe *client.FrappeClient, cb StreamCB) {
	oaiMessages := []openai.ChatCompletionMessageParamUnion{
		openai.SystemMessage(systemPrompt),
	}
	for _, m := range messages {
		switch m.Role {
		case "user":
			oaiMessages = append(oaiMessages, openai.UserMessage(m.Content))
		case "assistant":
			oaiMessages = append(oaiMessages, openai.AssistantMessage(m.Content))
		}
	}

	oaiTools := toOpenAITools(tools)

	for loop := 0; loop < 10; loop++ {
		stream := p.client.Chat.Completions.NewStreaming(ctx, openai.ChatCompletionNewParams{
			Model:    p.model,
			Messages: oaiMessages,
			Tools:    oaiTools,
		})

		acc := openai.ChatCompletionAccumulator{}
		for stream.Next() {
			chunk := stream.Current()
			acc.AddChunk(chunk)

			if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
				cb.OnTextDelta(chunk.Choices[0].Delta.Content)
			}
			if len(chunk.Choices) > 0 {
				for _, tc := range chunk.Choices[0].Delta.ToolCalls {
					if tc.Function.Name != "" {
						cb.OnToolUse(tc.Function.Name)
					}
				}
			}
		}
		if err := stream.Err(); err != nil {
			log.Printf("openai stream error: %v", err)
			cb.OnError("AI processing error")
			return
		}

		if len(acc.Choices) == 0 || acc.Choices[0].FinishReason != "tool_calls" {
			break
		}

		oaiMessages = append(oaiMessages, acc.Choices[0].Message.ToParam())
		for _, tc := range acc.Choices[0].Message.ToolCalls {
			result := executeTool(frappe, tctx, tc.Function.Name, json.RawMessage(tc.Function.Arguments))
			oaiMessages = append(oaiMessages, openai.ToolMessage(result, tc.ID))
		}
	}
	cb.OnStop()
}
