import crypto from 'crypto';
import { db, getSetting, setSetting, getSystemNowIso } from '../db/database';

export interface EmailTemplate {
  key: string;
  name: string;
  subject: string;
  body: string;
}

export const DEFAULT_TEMPLATES: Record<string, EmailTemplate> = {
  supplement_request: {
    key: 'supplement_request',
    name: 'Yêu cầu bổ sung hồ sơ',
    subject: '[C-res Recruit] Yêu cầu bổ sung thông tin hồ sơ ứng tuyển CTV',
    body: 'Chào {{full_name}},\n\nBan Nhân sự CLB C-res đã tiếp nhận hồ sơ của bạn nhưng phát hiện còn thiếu các trường thông tin: {{missing_fields}}.\n\nVui lòng truy cập đường dẫn {{link}} để bổ sung trước hạn chót {{deadline}}. Quá thời hạn trên, hệ thống sẽ tự động đóng hồ sơ.\n\nTrân trọng,\nBan Nhân sự CLB C-res - ĐH Kinh tế ĐHĐN',
  },
  docs_rejected: {
    key: 'docs_rejected',
    name: 'Thông báo hồ sơ không đạt',
    subject: '[C-res Recruit] Thông báo kết quả vòng Hồ sơ đợt tuyển CTV',
    body: 'Chào {{full_name}},\n\nCảm ơn bạn đã quan tâm và gửi hồ sơ ứng tuyển CTV sự kiện của CLB C-res. Sau khi đánh giá theo tiêu chí của đợt tuyển, rất tiếc hồ sơ của bạn chưa phù hợp ở đợt này ({{reason}}).\n\nHẹn gặp lại bạn ở các chương trình tiếp theo của CLB C-res!\n\nTrân trọng,\nCLB C-res - ĐH Kinh tế ĐHĐN',
  },
  schedule_link: {
    key: 'schedule_link',
    name: 'Mời đặt lịch phỏng vấn',
    subject: '[C-res Recruit] Chúc mừng vượt qua vòng Hồ sơ — Mời chọn lịch phỏng vấn',
    body: 'Chào {{full_name}},\n\nChúc mừng bạn đã vượt qua vòng Hồ sơ đợt tuyển CTV của CLB C-res! Mời bạn truy cập {{link}} để chủ động chọn khung giờ phỏng vấn phù hợp trước {{deadline}}.\n\nLưu ý: Khung giờ có giới hạn chỗ ngồi, vui lòng đặt sớm.\n\nTrân trọng,\nBan Nhân sự CLB C-res',
  },
  schedule_reminder: {
    key: 'schedule_reminder',
    name: 'Nhắc nhở đặt lịch phỏng vấn (Sau 1 ngày)',
    subject: '[C-res Recruit] Nhắc nhở: Bạn chưa chọn khung giờ phỏng vấn CTV',
    body: 'Chào {{full_name}},\n\nHệ thống ghi nhận bạn đã nhận link đặt lịch phỏng vấn hơn 1 ngày nhưng chưa chọn khung giờ. Vui lòng truy cập {{link}} để đặt lịch trước hạn chót {{deadline}}.\n\nSau thời hạn trên, hệ thống sẽ tự động gạch tên khỏi danh sách phỏng vấn.\n\nTrân trọng,\nBan Nhân sự CLB C-res',
  },
  removed_no_booking: {
    key: 'removed_no_booking',
    name: 'Thông báo hủy tư cách do không đặt lịch (Sau 2 ngày)',
    subject: '[C-res Recruit] Thông báo kết thúc hồ sơ do quá hạn đặt lịch phỏng vấn',
    body: 'Chào {{full_name}},\n\nDo đã quá thời hạn 2 ngày ({{deadline}}) kể từ khi gửi lời mời mà bạn chưa chọn khung giờ phỏng vấn, hệ thống xác nhận bạn không tham gia vòng phỏng vấn đợt này.\n\nCảm ơn sự quan tâm của bạn dành cho CLB C-res.\n\nTrân trọng,\nBan Nhân sự CLB C-res',
  },
  result_pass: {
    key: 'result_pass',
    name: 'Thông báo Đậu phỏng vấn & Mời xác nhận',
    subject: '[C-res Recruit] CHÚC MỪNG BẠN ĐÃ TRÚNG TUYỂN CTV CLB C-RES!',
    body: 'Chào {{full_name}},\n\nBan Chủ nhiệm CLB C-res trân trọng chúc mừng bạn đã xuất sắc vượt qua vòng Phỏng vấn đợt tuyển CTV sự kiện!\n\nVui lòng truy cập {{link}} để bấm "Xác nhận tham gia" và nhận link nhóm sinh hoạt chung của CLB.\n\nTrân trọng,\nBan Chủ nhiệm CLB C-res - ĐH Kinh tế ĐHĐN',
  },
  result_fail: {
    key: 'result_fail',
    name: 'Thông báo Không đạt vòng phỏng vấn',
    subject: '[C-res Recruit] Thông báo kết quả vòng Phỏng vấn CTV CLB C-res',
    body: 'Chào {{full_name}},\n\nCảm ơn bạn đã dành thời gian tham gia buổi phỏng vấn cùng Ban Chủ nhiệm CLB C-res. Dù rất ấn tượng với sự nhiệt huyết của bạn, do chỉ tiêu sự kiện có hạn nên CLB chưa thể đồng hành cùng bạn trong đợt này.\n\nChúc bạn luôn giữ vững ngọn lửa năng động tại DUE!\n\nTrân trọng,\nBan Chủ nhiệm CLB C-res',
  },
  assignment_info: {
    key: 'assignment_info',
    name: 'Thông báo Phân công Ban chính thức',
    subject: '[C-res Recruit] Thông báo phân công Ban chính thức — {{department}}',
    body: 'Chào {{full_name}},\n\nChào mừng bạn chính thức trở thành Cộng tác viên của **{{department}}** tại CLB C-res!\n\nHãy kiểm tra thông tin chi tiết và tham gia nhóm truyền thông nội bộ tại {{link}}. Buổi họp Onboarding đầu tiên sẽ được thông báo trong nhóm.\n\nTrân trọng,\nBan Nhân sự & Ban Chủ nhiệm CLB C-res',
  },
  withdrawn_ack: {
    key: 'withdrawn_ack',
    name: 'Xác nhận đã rút đơn ứng tuyển',
    subject: '[C-res Recruit] Xác nhận yêu cầu rút đơn ứng tuyển CTV',
    body: 'Chào {{full_name}},\n\nHệ thống C-res Recruit đã ghi nhận yêu cầu rút đơn ứng tuyển của bạn vào lúc {{deadline}}. Toàn bộ lịch trình và bộ đếm giờ liên quan đến hồ sơ của bạn đã được hủy.\n\nCảm ơn bạn và hẹn gặp lại ở các hoạt động khác của CLB C-res!\n\nTrân trọng,\nCLB C-res',
  },
  expired_supplement: {
    key: 'expired_supplement',
    name: 'Thông báo loại hồ sơ do quá hạn bổ sung',
    subject: '[C-res Recruit] Thông báo đóng hồ sơ do quá hạn bổ sung thông tin',
    body: 'Chào {{full_name}},\n\nDo đã quá thời hạn bổ sung thông tin ({{deadline}}) hoặc sau số lần bổ sung tối đa mà hồ sơ vẫn chưa đầy đủ các trường bắt buộc, hệ thống đã tự động khép lại hồ sơ ứng tuyển của bạn.\n\nCảm ơn bạn đã quan tâm đến CLB C-res.\n\nTrân trọng,\nBan Nhân sự CLB C-res',
  },
};

export class NotificationService {
  static getTemplates(): Record<string, EmailTemplate> {
    const raw = getSetting('email_templates', '');
    if (!raw) return DEFAULT_TEMPLATES;
    try {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_TEMPLATES, ...parsed };
    } catch {
      return DEFAULT_TEMPLATES;
    }
  }

  static saveTemplates(templates: Record<string, EmailTemplate>): void {
    setSetting('email_templates', JSON.stringify(templates));
  }

  static send(params: {
    applicationId: string;
    toEmail: string;
    templateKey: keyof typeof DEFAULT_TEMPLATES | string;
    variables: Record<string, string>;
    createdAt?: string;
  }): { id: string; subject: string; body: string } {
    const templates = this.getTemplates();
    const tpl = templates[params.templateKey] || DEFAULT_TEMPLATES.supplement_request;

    let subject = tpl.subject;
    let body = tpl.body;

    for (const [k, v] of Object.entries(params.variables)) {
      const regex = new RegExp(`\\{\\{${k}\\}\\}`, 'g');
      subject = subject.replace(regex, v ?? '');
      body = body.replace(regex, v ?? '');
    }

    const id = crypto.randomUUID();
    const createdAt = params.createdAt || getSystemNowIso();

    db.prepare(`
      INSERT INTO notifications (id, application_id, template_key, to_email, subject, body, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'sent', ?)
    `).run(id, params.applicationId, params.templateKey, params.toEmail, subject, body, createdAt);

    return { id, subject, body };
  }
}
