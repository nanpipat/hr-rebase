package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"hr-platform/bff/internal/client"
	"hr-platform/bff/internal/config"

	"github.com/labstack/echo/v4"
)

type ChatHandler struct {
	frappe   *client.FrappeClient
	provider LLMProvider
}

func NewChatHandler(frappe *client.FrappeClient, cfg *config.Config) *ChatHandler {
	return &ChatHandler{
		frappe:   frappe,
		provider: NewLLMProvider(cfg),
	}
}

type chatRequest struct {
	Messages []chatMessage `json:"messages"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func (h *ChatHandler) Chat(c echo.Context) error {
	var req chatRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if len(req.Messages) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "messages required")
	}

	employeeID, _ := c.Get("employee_id").(string)
	userName, _ := c.Get("full_name").(string)
	userRole, _ := c.Get("user_role").(string)

	if employeeID == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "employee not linked to this user")
	}

	tctx := ToolContext{
		EmployeeID: employeeID,
		UserRole:   userRole,
	}

	// Filter tools to only what this role can use
	tools := toolsForRole(userRole)

	systemPrompt := buildSystemPrompt(userName, employeeID, userRole, time.Now())

	provMessages := make([]ProviderMessage, 0, len(req.Messages))
	for _, m := range req.Messages {
		if m.Role == "user" || m.Role == "assistant" {
			provMessages = append(provMessages, ProviderMessage{Role: m.Role, Content: m.Content})
		}
	}
	// Trim oldest messages to avoid token overflow (keep last 20)
	const maxMessages = 20
	if len(provMessages) > maxMessages {
		provMessages = provMessages[len(provMessages)-maxMessages:]
		for len(provMessages) > 0 && provMessages[0].Role != "user" {
			provMessages = provMessages[1:]
		}
	}

	// Set SSE headers
	w := c.Response()
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)

	h.provider.StreamChat(c.Request().Context(), systemPrompt, provMessages, tctx, tools, h.frappe, StreamCB{
		OnTextDelta: func(text string) { sseWrite(w, "text_delta", map[string]string{"text": text}) },
		OnToolUse:   func(name string) { sseWrite(w, "tool_use", map[string]string{"name": name}) },
		OnStop:      func() { sseWrite(w, "message_stop", nil) },
		OnError:     func(msg string) { sseWrite(w, "error", map[string]string{"message": msg}) },
	})

	return nil
}

// buildSystemPrompt returns a role-aware system prompt.
func buildSystemPrompt(userName, employeeID, userRole string, now time.Time) string {
	loc, _ := time.LoadLocation("Asia/Bangkok")
	if loc != nil {
		now = now.In(loc)
	}
	today := now.Format("2006-01-02")          // YYYY-MM-DD
	dayName := now.Format("Monday")            // weekday name
	thaiDay := thaiWeekday(now.Weekday())

	base := fmt.Sprintf(`คุณเป็น HR AI Assistant ของระบบ HR Platform ชื่อ "HR Assistant"
คุณช่วยพนักงานและ HR จัดการเรื่อง HR ได้ครบทุกฟังก์ชัน

วันที่และเวลาปัจจุบัน (ใช้สำหรับคำนวณวันที่ทุกครั้ง):
- วันนี้: %s (%s / %s)
- เวลา: %s (Asia/Bangkok)

ข้อมูลผู้ใช้ปัจจุบัน:
- ชื่อ: %s
- รหัสพนักงาน: %s
- บทบาท: %s`, today, dayName, thaiDay, now.Format("15:04"), userName, employeeID, userRole)

	var roleDesc string
	switch userRole {
	case "admin":
		roleDesc = `
สิทธิ์ของคุณ (Admin - เข้าถึงได้ทุกอย่าง):
- ดูและจัดการพนักงานทั้งหมด
- อนุมัติ/ปฏิเสธ: การลา, คำขอ OT, คำขอเปลี่ยนกะ, คำขอแก้ไขเวลา
- ประมวลผลเงินเดือน, ดูรายงานทุกประเภท
- ดูรายงาน ภ.ง.ด.1, รายงานประกันสังคม, กองทุนสำรองฯ`
	case "hr":
		roleDesc = `
สิทธิ์ของคุณ (HR - จัดการงานบุคคล):
- ดูและจัดการพนักงานทั้งหมด
- อนุมัติ/ปฏิเสธ: การลา, คำขอ OT, คำขอเปลี่ยนกะ, คำขอแก้ไขเวลา
- ประมวลผลเงินเดือน, ดูรายงานทุกประเภท
- ดูรายงาน ภ.ง.ด.1, รายงานประกันสังคม, กองทุนสำรองฯ`
	case "manager":
		roleDesc = `
สิทธิ์ของคุณ (Manager - จัดการทีม):
- ดูข้อมูลทีมของตัวเอง
- อนุมัติ/ปฏิเสธ: การลา, คำขอ OT, คำขอเปลี่ยนกะ, คำขอแก้ไขเวลาของทีม
- ดูเช็คอิน/ออกของตัวเอง และสรุปการเข้างาน`
	default: // employee
		roleDesc = `
สิทธิ์ของคุณ (Employee - จัดการข้อมูลตัวเอง):
- ดูยอดวันลา, สร้างใบลา, ยกเลิกใบลาของตัวเอง
- เช็คอิน/เช็คเอาท์, ดูประวัติการเข้างาน
- ส่งคำขอ OT, คำขอเปลี่ยนกะ, คำขอแก้ไขเวลาของตัวเอง
- ดูสลิปเงินเดือน, ข้อมูลภาษี, ประกันสังคม, กองทุนสำรองฯ`
	}

	rules := `

กฎสำคัญ:
1. ตอบเป็นภาษาเดียวกับที่ผู้ใช้พิมพ์มา (ไทยหรืออังกฤษ)
2. ใช้ tools ดึงข้อมูลจริงจากระบบ อย่าเดาหรือแต่งข้อมูล
3. สำหรับ action ที่มีผล (สร้างใบลา, เช็คอิน, อนุมัติ ฯลฯ) ต้องถามยืนยันรายละเอียดก่อนเสมอ
4. แสดงข้อมูลตัวเลขอย่างชัดเจน ใช้ bullet points หรือตารางเมื่อเหมาะสม
5. ถ้าผู้ใช้ขอทำสิ่งที่เกินสิทธิ์ของบทบาท ให้แจ้งอย่างสุภาพว่าไม่มีสิทธิ์
6. ตอบกระชับ ไม่ยาวเกินไป`

	return base + roleDesc + rules
}

func thaiWeekday(d time.Weekday) string {
	names := [7]string{"อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"}
	return "วัน" + names[d]
}

func sseWrite(w *echo.Response, event string, data interface{}) {
	var payload []byte
	if data != nil {
		payload, _ = json.Marshal(data)
	} else {
		payload = []byte("{}")
	}
	fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, string(payload))
	w.Flush()
}
