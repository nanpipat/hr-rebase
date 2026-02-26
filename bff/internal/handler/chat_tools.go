package handler

import (
	"encoding/json"
	"fmt"
	"strconv"

	"hr-platform/bff/internal/client"

	"github.com/anthropics/anthropic-sdk-go"
	openai "github.com/openai/openai-go"
	"github.com/openai/openai-go/shared"
)

// ToolContext carries per-request caller info for tool execution.
type ToolContext struct {
	EmployeeID string
	UserRole   string
}

// ToolDef is a provider-agnostic tool definition.
type ToolDef struct {
	Name        string
	Description string
	Properties  map[string]any // JSON Schema properties (nil = no params)
	Required    []string
	// Roles that may use this tool. nil/empty = all roles.
	Roles []string
}

var (
	rolesAll        = []string{"admin", "hr", "manager", "employee"}
	rolesManagement = []string{"admin", "hr", "manager"} // approve actions
	rolesAdminHR    = []string{"admin", "hr"}
)

// allTools defines every HR assistant tool in one place.
// To add a new tool: (1) add ToolDef here, (2) add a case in executeTool.
func allTools() []ToolDef {
	return []ToolDef{
		// ── Leave ──────────────────────────────────────────────────────
		{
			Name:        "get_leave_balance",
			Description: "ดึงข้อมูลยอดวันลาคงเหลือของพนักงาน แยกตามประเภทการลา (Annual, Sick, Casual, ฯลฯ)",
			Roles:       rolesAll,
		},
		{
			Name:        "get_leave_applications",
			Description: "ดึงรายการใบลาของพนักงาน พร้อมสถานะ (รอพิจารณา/อนุมัติ/ปฏิเสธ)",
			Roles:       rolesAll,
		},
		{
			Name:        "create_leave_application",
			Description: "สร้างใบลาใหม่ ก่อนสร้างต้องถามยืนยันรายละเอียดจากผู้ใช้ก่อนเสมอ",
			Properties: map[string]any{
				"leave_type": map[string]any{"type": "string", "description": "ประเภทการลา เช่น Casual Leave, Sick Leave, Annual Leave"},
				"from_date":  map[string]any{"type": "string", "description": "วันที่เริ่มลา (YYYY-MM-DD)"},
				"to_date":    map[string]any{"type": "string", "description": "วันที่สิ้นสุดการลา (YYYY-MM-DD)"},
				"reason":     map[string]any{"type": "string", "description": "เหตุผลการลา"},
			},
			Required: []string{"leave_type", "from_date", "to_date"},
			Roles:    rolesAll,
		},
		{
			Name:        "cancel_leave_application",
			Description: "ยกเลิกใบลาของตัวเองที่อยู่ในสถานะรอพิจารณา ต้องถามยืนยันก่อนยกเลิก",
			Properties: map[string]any{
				"leave_id": map[string]any{"type": "string", "description": "รหัสใบลาที่ต้องการยกเลิก"},
			},
			Required: []string{"leave_id"},
			Roles:    rolesAll,
		},
		{
			Name:        "approve_leave_application",
			Description: "อนุมัติหรือปฏิเสธใบลาของพนักงาน (สำหรับผู้จัดการ/HR/Admin)",
			Properties: map[string]any{
				"leave_id": map[string]any{"type": "string", "description": "รหัสใบลา"},
				"status":   map[string]any{"type": "string", "description": "\"Approved\" หรือ \"Rejected\""},
			},
			Required: []string{"leave_id", "status"},
			Roles:    rolesManagement,
		},

		// ── Attendance / Check-in ──────────────────────────────────────
		{
			Name:        "get_today_checkin",
			Description: "ดูสถานะเช็คอิน/เช็คเอาท์วันนี้ รวมเวลาเข้า-ออกและชั่วโมงทำงาน",
			Roles:       rolesAll,
		},
		{
			Name:        "checkin",
			Description: "บันทึกเช็คอินเข้างาน ณ เวลาปัจจุบัน (ต้องถามยืนยันก่อนเช็คอิน)",
			Roles:       rolesAll,
		},
		{
			Name:        "checkout",
			Description: "บันทึกเช็คเอาท์ออกงาน ณ เวลาปัจจุบัน (ต้องถามยืนยันก่อนเช็คเอาท์)",
			Roles:       rolesAll,
		},
		{
			Name:        "get_checkin_history",
			Description: "ดูประวัติการเช็คอิน/เช็คเอาท์ช่วงวันที่ที่ระบุ",
			Properties: map[string]any{
				"from_date": map[string]any{"type": "string", "description": "วันเริ่มต้น (YYYY-MM-DD)"},
				"to_date":   map[string]any{"type": "string", "description": "วันสิ้นสุด (YYYY-MM-DD)"},
			},
			Roles: rolesAll,
		},
		{
			Name:        "get_attendance_summary",
			Description: "ดูสรุปการเข้างาน (วันมาทำงาน ขาดงาน ลา) สำหรับช่วงเวลาที่ระบุ",
			Properties: map[string]any{
				"from_date": map[string]any{"type": "string", "description": "วันเริ่มต้น (YYYY-MM-DD) ถ้าไม่ระบุจะใช้ต้นเดือนปัจจุบัน"},
				"to_date":   map[string]any{"type": "string", "description": "วันสิ้นสุด (YYYY-MM-DD) ถ้าไม่ระบุจะใช้วันนี้"},
			},
			Roles: rolesAll,
		},
		{
			Name:        "create_attendance_correction",
			Description: "ขอแก้ไขเวลาเข้างาน/ออกงาน เมื่อลืมเช็คอินหรือมีปัญหา",
			Properties: map[string]any{
				"attendance_date": map[string]any{"type": "string", "description": "วันที่ต้องการแก้ไข (YYYY-MM-DD)"},
				"reason":          map[string]any{"type": "string", "description": "เหตุผลที่ขอแก้ไข"},
			},
			Required: []string{"attendance_date", "reason"},
			Roles:    rolesAll,
		},
		{
			Name:        "get_attendance_requests",
			Description: "ดูรายการคำขอแก้ไขเวลาเข้างาน (ของตัวเองหรือทีม ขึ้นอยู่กับบทบาท)",
			Roles:       rolesAll,
		},
		{
			Name:        "approve_attendance_request",
			Description: "อนุมัติหรือปฏิเสธคำขอแก้ไขเวลาเข้างาน (สำหรับผู้จัดการ/HR/Admin)",
			Properties: map[string]any{
				"request_id": map[string]any{"type": "string", "description": "รหัสคำขอแก้ไข"},
				"action":     map[string]any{"type": "string", "description": "\"approve\" หรือ \"reject\""},
			},
			Required: []string{"request_id", "action"},
			Roles:    rolesManagement,
		},

		// ── Shift ──────────────────────────────────────────────────────
		{
			Name:        "get_my_shift",
			Description: "ดูข้อมูลกะทำงานปัจจุบัน (ชื่อกะ เวลาเข้า-ออก ช่วงเวลาที่มอบหมาย)",
			Roles:       rolesAll,
		},
		{
			Name:        "get_shift_types",
			Description: "ดูรายการกะทำงานทั้งหมดที่มีในระบบ (ชื่อกะ เวลาเข้า-ออก)",
			Roles:       rolesAll,
		},
		{
			Name:        "get_shift_requests",
			Description: "ดูรายการคำขอเปลี่ยนกะ (ของตัวเองหรือทีม ขึ้นอยู่กับบทบาท)",
			Roles:       rolesAll,
		},
		{
			Name:        "create_shift_request",
			Description: "ส่งคำขอเปลี่ยนกะทำงาน ต้องยืนยันรายละเอียดก่อนส่งคำขอ",
			Properties: map[string]any{
				"shift_type": map[string]any{"type": "string", "description": "ชื่อกะที่ต้องการเปลี่ยนไป"},
				"from_date":  map[string]any{"type": "string", "description": "วันเริ่มต้น (YYYY-MM-DD)"},
				"to_date":    map[string]any{"type": "string", "description": "วันสิ้นสุด (YYYY-MM-DD)"},
			},
			Required: []string{"shift_type", "from_date", "to_date"},
			Roles:    rolesAll,
		},
		{
			Name:        "approve_shift_request",
			Description: "อนุมัติหรือปฏิเสธคำขอเปลี่ยนกะ (สำหรับผู้จัดการ/HR/Admin)",
			Properties: map[string]any{
				"request_id": map[string]any{"type": "string", "description": "รหัสคำขอเปลี่ยนกะ"},
				"action":     map[string]any{"type": "string", "description": "\"approve\" หรือ \"reject\""},
			},
			Required: []string{"request_id", "action"},
			Roles:    rolesManagement,
		},
		{
			Name:        "assign_shift",
			Description: "มอบหมายกะทำงานให้พนักงาน (สำหรับ HR/Admin)",
			Properties: map[string]any{
				"employee_id": map[string]any{"type": "string", "description": "รหัสพนักงาน"},
				"shift_type":  map[string]any{"type": "string", "description": "ชื่อกะ"},
				"start_date":  map[string]any{"type": "string", "description": "วันที่เริ่มกะ (YYYY-MM-DD)"},
				"end_date":    map[string]any{"type": "string", "description": "วันที่สิ้นสุดกะ (YYYY-MM-DD) ถ้าไม่ระบุจะไม่มีวันหมดอายุ"},
			},
			Required: []string{"employee_id", "shift_type", "start_date"},
			Roles:    rolesAdminHR,
		},

		// ── Overtime ───────────────────────────────────────────────────
		{
			Name:        "create_overtime_request",
			Description: "สร้างคำขอทำงานล่วงเวลา (OT) ต้องยืนยันรายละเอียดก่อนส่งคำขอ",
			Properties: map[string]any{
				"ot_date": map[string]any{"type": "string", "description": "วันที่ทำ OT (YYYY-MM-DD)"},
				"ot_type": map[string]any{"type": "string", "description": "ประเภท OT เช่น Weekday OT, Holiday OT"},
				"hours":   map[string]any{"type": "string", "description": "จำนวนชั่วโมง OT (เช่น 2, 3)"},
				"reason":  map[string]any{"type": "string", "description": "เหตุผลที่ทำ OT"},
			},
			Required: []string{"ot_date", "ot_type", "hours"},
			Roles:    rolesAll,
		},
		{
			Name:        "get_overtime_requests",
			Description: "ดูรายการคำขอ OT (กรองตามสถานะ เดือน ปี ได้)",
			Properties: map[string]any{
				"status": map[string]any{"type": "string", "description": "สถานะ: Pending, Approved, Rejected (ถ้าไม่ระบุจะดึงทั้งหมด)"},
				"month":  map[string]any{"type": "string", "description": "เดือน (1-12)"},
				"year":   map[string]any{"type": "string", "description": "ปี (YYYY)"},
			},
			Roles: rolesAll,
		},
		{
			Name:        "cancel_overtime_request",
			Description: "ยกเลิกคำขอ OT ของตัวเองที่ยังรอพิจารณา ต้องยืนยันก่อนยกเลิก",
			Properties: map[string]any{
				"request_id": map[string]any{"type": "string", "description": "รหัสคำขอ OT"},
			},
			Required: []string{"request_id"},
			Roles:    rolesAll,
		},
		{
			Name:        "approve_overtime_request",
			Description: "อนุมัติหรือปฏิเสธคำขอ OT (สำหรับผู้จัดการ/HR/Admin)",
			Properties: map[string]any{
				"request_id": map[string]any{"type": "string", "description": "รหัสคำขอ OT"},
				"action":     map[string]any{"type": "string", "description": "\"approve\" หรือ \"reject\""},
			},
			Required: []string{"request_id", "action"},
			Roles:    rolesManagement,
		},

		// ── Payroll ────────────────────────────────────────────────────
		{
			Name:        "get_payroll_slips",
			Description: "ดูรายการสลิปเงินเดือน กรองตามปีและเดือนได้",
			Properties: map[string]any{
				"year":  map[string]any{"type": "string", "description": "ปี (YYYY)"},
				"month": map[string]any{"type": "string", "description": "เดือน (1-12)"},
			},
			Roles: rolesAll,
		},
		{
			Name:        "get_payroll_slip_detail",
			Description: "ดูรายละเอียดสลิปเงินเดือน รายการรายได้ รายการหัก และยอดสุทธิ",
			Properties: map[string]any{
				"slip_id": map[string]any{"type": "string", "description": "รหัสสลิปเงินเดือน (ได้จาก get_payroll_slips)"},
			},
			Required: []string{"slip_id"},
			Roles:    rolesAll,
		},
		{
			Name:        "process_payroll",
			Description: "ประมวลผลเงินเดือนประจำเดือน สร้างสลิปสำหรับพนักงานทุกคน (สำหรับ HR/Admin)",
			Properties: map[string]any{
				"month": map[string]any{"type": "string", "description": "เดือน (1-12)"},
				"year":  map[string]any{"type": "string", "description": "ปี (YYYY)"},
			},
			Required: []string{"month", "year"},
			Roles:    rolesAdminHR,
		},

		// ── Tax ────────────────────────────────────────────────────────
		{
			Name:        "get_tax_summary",
			Description: "ดูสรุปภาษีประจำปีของตัวเอง รายได้รวม ค่าลดหย่อน และภาษีที่ต้องจ่าย",
			Properties: map[string]any{
				"year": map[string]any{"type": "string", "description": "ปี (YYYY) เช่น 2025"},
			},
			Required: []string{"year"},
			Roles:    rolesAll,
		},
		{
			Name:        "get_tax_deductions",
			Description: "ดูรายการค่าลดหย่อนภาษีปัจจุบัน เช่น ประกันชีวิต กองทุนสำรองเลี้ยงชีพ บุตร",
			Roles:       rolesAll,
		},
		{
			Name:        "get_pnd1_report",
			Description: "ดูรายงาน ภ.ง.ด.1 สำหรับเดือนและปีที่ระบุ (สำหรับ HR/Admin)",
			Properties: map[string]any{
				"month": map[string]any{"type": "string", "description": "เดือน (1-12)"},
				"year":  map[string]any{"type": "string", "description": "ปี (YYYY)"},
			},
			Required: []string{"month", "year"},
			Roles:    rolesAdminHR,
		},

		// ── Benefits (SSO / PVD) ───────────────────────────────────────
		{
			Name:        "get_social_security_info",
			Description: "ดูข้อมูลประกันสังคม เลขที่ผู้ประกันตน และสถานะการส่งสมทบ",
			Roles:       rolesAll,
		},
		{
			Name:        "get_provident_fund_info",
			Description: "ดูข้อมูลกองทุนสำรองเลี้ยงชีพ (PVD) อัตราสะสมของลูกจ้างและนายจ้าง",
			Roles:       rolesAll,
		},

		// ── Employee Management (HR/Admin) ─────────────────────────────
		{
			Name:        "list_employees",
			Description: "ดูรายชื่อพนักงานทั้งหมดในบริษัท กรองตามแผนกหรือสถานะได้ (สำหรับ HR/Admin)",
			Properties: map[string]any{
				"department": map[string]any{"type": "string", "description": "กรองตามแผนก (ถ้าไม่ระบุจะดึงทั้งหมด)"},
				"status":     map[string]any{"type": "string", "description": "สถานะ: Active, Left (ถ้าไม่ระบุจะดึงเฉพาะ Active)"},
				"search":     map[string]any{"type": "string", "description": "ค้นหาชื่อพนักงาน"},
			},
			Roles: rolesAdminHR,
		},
		{
			Name:        "get_employee_detail",
			Description: "ดูข้อมูลพนักงานโดยละเอียด ตำแหน่ง แผนก วันเริ่มงาน ผู้จัดการ (สำหรับ HR/Admin)",
			Properties: map[string]any{
				"employee_id": map[string]any{"type": "string", "description": "รหัสพนักงาน"},
			},
			Required: []string{"employee_id"},
			Roles:    rolesAdminHR,
		},

		// ── Reports (HR/Admin) ─────────────────────────────────────────
		{
			Name:        "get_attendance_report",
			Description: "ดูรายงานการเข้างานรายเดือนของพนักงานทั้งบริษัท (สำหรับ HR/Admin)",
			Properties: map[string]any{
				"month": map[string]any{"type": "string", "description": "เดือน (1-12)"},
				"year":  map[string]any{"type": "string", "description": "ปี (YYYY)"},
			},
			Required: []string{"month", "year"},
			Roles:    rolesAdminHR,
		},
		{
			Name:        "get_leave_report",
			Description: "ดูรายงานการลาประจำปีของพนักงานทั้งบริษัท (สำหรับ HR/Admin)",
			Properties: map[string]any{
				"year": map[string]any{"type": "string", "description": "ปี (YYYY)"},
			},
			Required: []string{"year"},
			Roles:    rolesAdminHR,
		},
		{
			Name:        "get_payroll_report",
			Description: "ดูรายงานเงินเดือนรายเดือน ยอดรวมรายได้และหัก (สำหรับ HR/Admin)",
			Properties: map[string]any{
				"month": map[string]any{"type": "string", "description": "เดือน (1-12)"},
				"year":  map[string]any{"type": "string", "description": "ปี (YYYY)"},
			},
			Required: []string{"month", "year"},
			Roles:    rolesAdminHR,
		},

		// ── Org Chart ──────────────────────────────────────────────────
		{
			Name:        "get_org_chart",
			Description: "ดูโครงสร้างองค์กร ลำดับผู้บังคับบัญชา และแผนกต่างๆ",
			Roles:       rolesAll,
		},
	}
}

// toolsForRole filters allTools() to only those the given role may use.
func toolsForRole(role string) []ToolDef {
	all := allTools()
	out := make([]ToolDef, 0, len(all))
	for _, t := range all {
		if len(t.Roles) == 0 {
			out = append(out, t)
			continue
		}
		for _, r := range t.Roles {
			if r == role {
				out = append(out, t)
				break
			}
		}
	}
	return out
}

// canUseToolRole checks if a role is allowed to execute a given tool name.
func canUseToolRole(role, toolName string) bool {
	for _, t := range allTools() {
		if t.Name == toolName {
			if len(t.Roles) == 0 {
				return true
			}
			for _, r := range t.Roles {
				if r == role {
					return true
				}
			}
			return false
		}
	}
	return false
}

// toAnthropicTools converts ToolDef slice to Anthropic SDK format.
func toAnthropicTools(defs []ToolDef) []anthropic.ToolUnionParam {
	tools := make([]anthropic.ToolUnionParam, len(defs))
	for i, d := range defs {
		props := d.Properties
		if props == nil {
			props = map[string]any{}
		}
		tools[i] = anthropic.ToolUnionParam{
			OfTool: &anthropic.ToolParam{
				Name:        d.Name,
				Description: anthropic.String(d.Description),
				InputSchema: anthropic.ToolInputSchemaParam{
					Type:       "object",
					Properties: props,
					Required:   d.Required,
				},
			},
		}
	}
	return tools
}

// toOpenAITools converts ToolDef slice to OpenAI SDK format.
func toOpenAITools(defs []ToolDef) []openai.ChatCompletionToolParam {
	tools := make([]openai.ChatCompletionToolParam, len(defs))
	for i, d := range defs {
		props := d.Properties
		if props == nil {
			props = map[string]any{}
		}
		params := shared.FunctionParameters{"type": "object", "properties": props}
		if len(d.Required) > 0 {
			params["required"] = d.Required
		}
		tools[i] = openai.ChatCompletionToolParam{
			Function: shared.FunctionDefinitionParam{
				Name:        d.Name,
				Description: openai.String(d.Description),
				Parameters:  params,
			},
		}
	}
	return tools
}

// executeTool runs a tool call against Frappe and returns a JSON string result.
// Server-side role check prevents privilege escalation even if the model misbehaves.
func executeTool(frappe *client.FrappeClient, tctx ToolContext, toolName string, input json.RawMessage) string {
	// Server-side permission guard
	if !canUseToolRole(tctx.UserRole, toolName) {
		return fmt.Sprintf(`{"error": "permission denied: role %q cannot use tool %q"}`, tctx.UserRole, toolName)
	}

	empID := tctx.EmployeeID

	switch toolName {

	// ── Leave ─────────────────────────────────────────────────────────
	case "get_leave_balance":
		data, err := frappe.CallMethod("hr_core_ext.api.leave.get_leave_allocations", map[string]string{"employee_id": empID})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_leave_applications":
		data, err := frappe.CallMethod("hr_core_ext.api.leave.get_leave_applications", map[string]string{"employee_id": empID})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "create_leave_application":
		var args struct {
			LeaveType string `json:"leave_type"`
			FromDate  string `json:"from_date"`
			ToDate    string `json:"to_date"`
			Reason    string `json:"reason"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethodPost("hr_core_ext.api.leave.create_leave_application", map[string]string{
			"employee_id": empID,
			"leave_type":  args.LeaveType,
			"from_date":   args.FromDate,
			"to_date":     args.ToDate,
			"reason":      args.Reason,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "cancel_leave_application":
		var args struct {
			LeaveID string `json:"leave_id"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethodPost("hr_core_ext.api.leave.cancel_leave_application", map[string]string{
			"leave_id": args.LeaveID,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "approve_leave_application":
		var args struct {
			LeaveID string `json:"leave_id"`
			Status  string `json:"status"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethodPost("hr_core_ext.api.leave.approve_leave_application", map[string]string{
			"leave_id": args.LeaveID,
			"status":   args.Status,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	// ── Attendance / Check-in ─────────────────────────────────────────
	case "get_today_checkin":
		data, err := frappe.CallMethod("hr_core_ext.api.attendance.get_today_checkin", map[string]string{"employee_id": empID})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "checkin":
		data, err := frappe.CallMethodPost("hr_core_ext.api.attendance.checkin", map[string]string{"employee_id": empID})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "checkout":
		data, err := frappe.CallMethodPost("hr_core_ext.api.attendance.checkout", map[string]string{"employee_id": empID})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_checkin_history":
		params := map[string]string{"employee_id": empID}
		var args struct {
			FromDate string `json:"from_date"`
			ToDate   string `json:"to_date"`
		}
		if err := json.Unmarshal(input, &args); err == nil {
			if args.FromDate != "" {
				params["from_date"] = args.FromDate
			}
			if args.ToDate != "" {
				params["to_date"] = args.ToDate
			}
		}
		data, err := frappe.CallMethod("hr_core_ext.api.attendance.get_checkin_history", params)
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_attendance_summary":
		params := map[string]string{"employee_id": empID}
		var args struct {
			FromDate string `json:"from_date"`
			ToDate   string `json:"to_date"`
		}
		if err := json.Unmarshal(input, &args); err == nil {
			if args.FromDate != "" {
				params["from_date"] = args.FromDate
			}
			if args.ToDate != "" {
				params["to_date"] = args.ToDate
			}
		}
		data, err := frappe.CallMethod("hr_core_ext.api.attendance.get_attendance_summary", params)
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "create_attendance_correction":
		var args struct {
			AttendanceDate string `json:"attendance_date"`
			Reason         string `json:"reason"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethodPost("hr_core_ext.api.attendance.create_attendance_request", map[string]string{
			"employee_id":     empID,
			"attendance_date": args.AttendanceDate,
			"reason":          args.Reason,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_attendance_requests":
		params := map[string]string{}
		if tctx.UserRole == "employee" {
			params["employee_id"] = empID
		}
		data, err := frappe.CallMethod("hr_core_ext.api.attendance.get_attendance_requests", params)
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "approve_attendance_request":
		var args struct {
			RequestID string `json:"request_id"`
			Action    string `json:"action"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethodPost("hr_core_ext.api.attendance.approve_attendance_request", map[string]string{
			"request_id": args.RequestID,
			"action":     args.Action,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	// ── Shift ─────────────────────────────────────────────────────────
	case "get_my_shift":
		data, err := frappe.CallMethod("hr_core_ext.api.shift.get_employee_current_shift", map[string]string{"employee_id": empID})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_shift_types":
		data, err := frappe.CallMethod("hr_core_ext.api.shift.get_shift_types", map[string]string{})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_shift_requests":
		params := map[string]string{}
		if tctx.UserRole == "employee" {
			params["employee_id"] = empID
		}
		data, err := frappe.CallMethod("hr_core_ext.api.shift.get_shift_requests", params)
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "create_shift_request":
		var args struct {
			ShiftType string `json:"shift_type"`
			FromDate  string `json:"from_date"`
			ToDate    string `json:"to_date"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethodPost("hr_core_ext.api.shift.create_shift_request", map[string]string{
			"employee_id": empID,
			"shift_type":  args.ShiftType,
			"from_date":   args.FromDate,
			"to_date":     args.ToDate,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "approve_shift_request":
		var args struct {
			RequestID string `json:"request_id"`
			Action    string `json:"action"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethodPost("hr_core_ext.api.shift.approve_shift_request", map[string]string{
			"request_id": args.RequestID,
			"action":     args.Action,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "assign_shift":
		var args struct {
			EmployeeID string `json:"employee_id"`
			ShiftType  string `json:"shift_type"`
			StartDate  string `json:"start_date"`
			EndDate    string `json:"end_date"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		params := map[string]string{
			"employee_id": args.EmployeeID,
			"shift_type":  args.ShiftType,
			"start_date":  args.StartDate,
		}
		if args.EndDate != "" {
			params["end_date"] = args.EndDate
		}
		data, err := frappe.CallMethodPost("hr_core_ext.api.shift.assign_shift", params)
		if err != nil {
			return toolError(err)
		}
		return string(data)

	// ── Overtime ──────────────────────────────────────────────────────
	case "create_overtime_request":
		var args struct {
			OTDate string `json:"ot_date"`
			OTType string `json:"ot_type"`
			Hours  string `json:"hours"`
			Reason string `json:"reason"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		// validate hours is numeric
		if _, err := strconv.Atoi(args.Hours); err != nil {
			return `{"error": "hours must be a numeric string e.g. \"2\""}`
		}
		data, err := frappe.CallMethodPost("hr_core_ext.api.overtime.create_ot_request", map[string]string{
			"employee_id": empID,
			"ot_date":     args.OTDate,
			"ot_type":     args.OTType,
			"hours":       args.Hours,
			"reason":      args.Reason,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_overtime_requests":
		params := map[string]string{"employee_id": empID}
		var args struct {
			Status string `json:"status"`
			Month  string `json:"month"`
			Year   string `json:"year"`
		}
		if err := json.Unmarshal(input, &args); err == nil {
			if args.Status != "" {
				params["status"] = args.Status
			}
			if args.Month != "" {
				params["month"] = args.Month
			}
			if args.Year != "" {
				params["year"] = args.Year
			}
		}
		// Manager/admin/hr see all; employee sees only own
		if tctx.UserRole != "employee" {
			delete(params, "employee_id")
		}
		data, err := frappe.CallMethod("hr_core_ext.api.overtime.get_ot_requests", params)
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "cancel_overtime_request":
		var args struct {
			RequestID string `json:"request_id"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethodPost("hr_core_ext.api.overtime.cancel_ot_request", map[string]string{
			"request_id": args.RequestID,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "approve_overtime_request":
		var args struct {
			RequestID string `json:"request_id"`
			Action    string `json:"action"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		method := "hr_core_ext.api.overtime.approve_ot_request"
		if args.Action == "reject" {
			method = "hr_core_ext.api.overtime.reject_ot_request"
		}
		data, err := frappe.CallMethodPost(method, map[string]string{
			"request_id": args.RequestID,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	// ── Payroll ───────────────────────────────────────────────────────
	case "get_payroll_slips":
		params := map[string]string{"employee_id": empID}
		var args struct {
			Year  string `json:"year"`
			Month string `json:"month"`
		}
		if err := json.Unmarshal(input, &args); err == nil {
			if args.Year != "" {
				params["year"] = args.Year
			}
			if args.Month != "" {
				params["month"] = args.Month
			}
		}
		data, err := frappe.CallMethod("hr_core_ext.api.payroll.get_salary_slips", params)
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_payroll_slip_detail":
		var args struct {
			SlipID string `json:"slip_id"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethod("hr_core_ext.api.payroll.get_salary_slip_detail", map[string]string{
			"slip_id": args.SlipID,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "process_payroll":
		var args struct {
			Month string `json:"month"`
			Year  string `json:"year"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethodPost("hr_core_ext.api.payroll.process_payroll", map[string]string{
			"month": args.Month,
			"year":  args.Year,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	// ── Tax ───────────────────────────────────────────────────────────
	case "get_tax_summary":
		var args struct {
			Year string `json:"year"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethod("hr_core_ext.api.tax.get_employee_tax_summary", map[string]string{
			"employee_id": empID,
			"year":        args.Year,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_tax_deductions":
		data, err := frappe.CallMethod("hr_core_ext.api.tax.get_employee_tax_deductions", map[string]string{
			"employee_id": empID,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_pnd1_report":
		var args struct {
			Month string `json:"month"`
			Year  string `json:"year"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethod("hr_core_ext.api.tax.get_pnd1_data", map[string]string{
			"month": args.Month,
			"year":  args.Year,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	// ── Benefits ──────────────────────────────────────────────────────
	case "get_social_security_info":
		data, err := frappe.CallMethod("hr_core_ext.api.social_security.get_employee_sso_number", map[string]string{
			"employee_id": empID,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_provident_fund_info":
		data, err := frappe.CallMethod("hr_core_ext.api.provident_fund.get_employee_pvd", map[string]string{
			"employee_id": empID,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	// ── Employee Management ────────────────────────────────────────────
	case "list_employees":
		params := map[string]string{}
		var args struct {
			Department string `json:"department"`
			Status     string `json:"status"`
			Search     string `json:"search"`
		}
		if err := json.Unmarshal(input, &args); err == nil {
			if args.Department != "" {
				params["department"] = args.Department
			}
			if args.Status != "" {
				params["status"] = args.Status
			}
			if args.Search != "" {
				params["search"] = args.Search
			}
		}
		data, err := frappe.CallMethod("hr_core_ext.api.employee.get_employees", params)
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_employee_detail":
		var args struct {
			EmployeeID string `json:"employee_id"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethod("hr_core_ext.api.employee.get_employee", map[string]string{
			"employee_id": args.EmployeeID,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	// ── Reports ───────────────────────────────────────────────────────
	case "get_attendance_report":
		var args struct {
			Month string `json:"month"`
			Year  string `json:"year"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethod("hr_core_ext.api.reports.get_attendance_report", map[string]string{
			"month": args.Month,
			"year":  args.Year,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_leave_report":
		var args struct {
			Year string `json:"year"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethod("hr_core_ext.api.reports.get_leave_report", map[string]string{
			"year": args.Year,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	case "get_payroll_report":
		var args struct {
			Month string `json:"month"`
			Year  string `json:"year"`
		}
		if err := json.Unmarshal(input, &args); err != nil {
			return toolError(err)
		}
		data, err := frappe.CallMethod("hr_core_ext.api.reports.get_payroll_report", map[string]string{
			"month": args.Month,
			"year":  args.Year,
		})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	// ── Org Chart ─────────────────────────────────────────────────────
	case "get_org_chart":
		data, err := frappe.CallMethod("hr_core_ext.api.orgchart.get_org_tree", map[string]string{})
		if err != nil {
			return toolError(err)
		}
		return string(data)

	default:
		return fmt.Sprintf(`{"error": "unknown tool: %s"}`, toolName)
	}
}

func toolError(err error) string {
	msg, _ := json.Marshal(err.Error())
	return fmt.Sprintf(`{"error": %s}`, string(msg))
}
