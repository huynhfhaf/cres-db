import crypto from 'crypto';
import { db, getSetting, setSetting, getSystemNowIso } from '../db/database.ts';

export interface EmailTemplate {
  key: string;
  name: string;
  subject: string;
  body: string;
}

export const DEFAULT_TEMPLATES: Record<string, EmailTemplate> = {
  supplement_request: {
    key: 'supplement_request',
    name: 'Nhắc bổ sung thông tin hồ sơ',
    subject: '[C-RES] Mời bạn bổ sung thêm thông tin hồ sơ ứng tuyển CTV',
    body: 'Chào {{full_name}},\n\nCảm ơn bạn đã gửi đơn đăng ký ứng tuyển Cộng tác viên Câu lạc bộ Thương mại C-RES! Hiện tại hồ sơ của bạn vẫn còn thiếu một vài thông tin nhỏ: {{missing_fields}}.\n\nBạn vui lòng truy cập {{link}} để cập nhật đầy đủ trước {{deadline}} giúp tụi mình nhé.\n\nThân mến,\nBan Nhân sự Câu lạc bộ Thương mại C-RES\nĐại học Kinh tế - Đại học Đà Nẵng',
  },
  docs_rejected: {
    key: 'docs_rejected',
    name: 'Thông báo kết quả vòng Hồ sơ',
    subject: '[C-RES] Cảm ơn bạn đã tham gia ứng tuyển Cộng tác viên C-RES',
    body: 'Chào {{full_name}},\n\nCảm ơn bạn đã dành tình cảm và gửi hồ sơ ứng tuyển vào Câu lạc bộ Thương mại C-RES. Sau khi xem xét kỹ lưỡng, tụi mình rất tiếc chưa thể đồng hành cùng bạn trong đợt tuyển lần này ({{reason}}).\n\nHy vọng sẽ sớm được gặp lại bạn ở các sự kiện và đợt tuyển tiếp theo của C-RES nhé!\n\nThân mến,\nCâu lạc bộ Thương mại C-RES\nĐại học Kinh tế - Đại học Đà Nẵng',
  },
  schedule_link: {
    key: 'schedule_link',
    name: 'Mời chọn lịch phỏng vấn',
    subject: '[C-RES] Chúc mừng bạn vượt qua vòng Hồ sơ — Mời chọn lịch phỏng vấn!',
    body: 'Chào {{full_name}},\n\nChúc mừng bạn đã xuất sắc vượt qua vòng Hồ sơ đợt tuyển Cộng tác viên của Câu lạc bộ Thương mại C-RES! Bạn hãy truy cập {{link}} để chọn khung giờ phỏng vấn phù hợp nhất với lịch học của mình trước {{deadline}} nhé.\n\nHẹn sớm gặp bạn tại buổi phỏng vấn!\n\nThân mến,\nBan Nhân sự Câu lạc bộ Thương mại C-RES',
  },
  schedule_reminder: {
    key: 'schedule_reminder',
    name: 'Lời nhắc chọn lịch phỏng vấn',
    subject: '[C-RES] Đừng quên chọn khung giờ phỏng vấn cùng C-RES nhé!',
    body: 'Chào {{full_name}},\n\nTụi mình thấy bạn vẫn chưa chọn lịch phỏng vấn cho vòng tiếp theo. Bạn nhớ truy cập {{link}} để chọn ca phỏng vấn phù hợp trước {{deadline}} nha.\n\nNếu cần hỗ trợ thêm, bạn cứ phản hồi ngay cho Ban Nhân sự nhé!\n\nThân mến,\nBan Nhân sự Câu lạc bộ Thương mại C-RES',
  },
  removed_no_booking: {
    key: 'removed_no_booking',
    name: 'Thông báo khép lại hồ sơ do chưa đặt lịch',
    subject: '[C-RES] Hẹn gặp lại bạn ở các đợt tuyển tiếp theo của C-RES',
    body: 'Chào {{full_name}},\n\nDo thời gian đăng ký lịch phỏng vấn ({{deadline}}) đã khép lại mà tụi mình chưa nhận được lịch hẹn từ bạn, Câu lạc bộ Thương mại C-RES xin phép khép lại hồ sơ của bạn trong đợt này.\n\nCảm ơn bạn đã quan tâm tới C-RES và hẹn gặp lại bạn vào dịp gần nhất nhé!\n\nThân mến,\nCâu lạc bộ Thương mại C-RES',
  },
  result_pass: {
    key: 'result_pass',
    name: 'Chúc mừng trúng tuyển phỏng vấn',
    subject: '[C-RES] CHÚC MỪNG BẠN CHÍNH THỨC TRÚNG TUYỂN CỘNG TÁC VIÊN C-RES!',
    body: 'Chào {{full_name}},\n\nChúc mừng bạn đã chinh phục thành công vòng Phỏng vấn và trở thành mảnh ghép mới của Câu lạc bộ Thương mại C-RES!\n\nBạn hãy truy cập {{link}} và nhấn "Xác nhận tham gia" để vào nhóm sinh hoạt chung cùng đại gia đình C-RES nhé.\n\nThân mến,\nBan Chủ nhiệm Câu lạc bộ Thương mại C-RES\nĐại học Kinh tế - Đại học Đà Nẵng',
  },
  result_fail: {
    key: 'result_fail',
    name: 'Thông báo kết quả vòng Phỏng vấn',
    subject: '[C-RES] Cảm ơn bạn đã tham gia phỏng vấn cùng Câu lạc bộ Thương mại C-RES',
    body: 'Chào {{full_name}},\n\nCảm ơn bạn đã dành thời gian đến trò chuyện và chia sẻ cùng Ban Chủ nhiệm Câu lạc bộ Thương mại C-RES. Dù rất ấn tượng với sự năng động của bạn, do số lượng thành viên đợt này có hạn nên tụi mình chưa thể đồng hành cùng bạn.\n\nChúc bạn luôn giữ vững ngọn lửa nhiệt huyết tại Đại học Kinh tế - Đại học Đà Nẵng nhé!\n\nThân mến,\nBan Chủ nhiệm Câu lạc bộ Thương mại C-RES',
  },
  assignment_info: {
    key: 'assignment_info',
    name: 'Thông báo chào mừng & Phân công Ban',
    subject: '[C-RES] Chào mừng bạn về với {{department}} — Câu lạc bộ Thương mại C-RES!',
    body: 'Chào {{full_name}},\n\nChào mừng bạn chính thức gia nhập {{department}} của Câu lạc bộ Thương mại C-RES!\n\nBạn hãy tham gia nhóm sinh hoạt chung tại {{link}} để làm quen với các anh chị và cập nhật lịch họp đầu tiên nhé.\n\nThân mến,\nCâu lạc bộ Thương mại C-RES',
  },
  withdrawn_ack: {
    key: 'withdrawn_ack',
    name: 'Xác nhận rút hồ sơ ứng tuyển',
    subject: '[C-RES] Xác nhận yêu cầu rút hồ sơ ứng tuyển của bạn',
    body: 'Chào {{full_name}},\n\nCâu lạc bộ Thương mại C-RES đã ghi nhận yêu cầu rút hồ sơ ứng tuyển của bạn vào lúc {{deadline}}.\n\nCảm ơn bạn đã quan tâm tới CLB và chúc bạn có một học kỳ thật nhiều niềm vui tại trường nhé!\n\nThân mến,\nCâu lạc bộ Thương mại C-RES',
  },
  expired_supplement: {
    key: 'expired_supplement',
    name: 'Thông báo khép lại hồ sơ do hết hạn bổ sung',
    subject: '[C-RES] Thông báo khép lại hồ sơ ứng tuyển CTV',
    body: 'Chào {{full_name}},\n\nDo đã qua thời hạn bổ sung thông tin ({{deadline}}) mà hồ sơ của bạn vẫn chưa được cập nhật đầy đủ, tụi mình xin phép khép lại hồ sơ trong đợt tuyển này.\n\nHẹn gặp lại bạn ở các hoạt động sắp tới của Câu lạc bộ Thương mại C-RES nhé!\n\nThân mến,\nBan Nhân sự Câu lạc bộ Thương mại C-RES',
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
