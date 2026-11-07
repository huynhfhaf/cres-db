import { GoogleGenAI, Type } from '@google/genai';
import { fallbackAssignmentSuggestion } from '../rules/rulesEngine.ts';

export interface CandidateForAiAssignment {
  applicationId: string;
  fullName: string;
  totalScore: number;
  firstChoiceDeptId: string;
  firstChoiceName: string;
  secondChoiceDeptId?: string | null;
  secondChoiceName?: string | null;
  experience: string;
  criteriaScores?: Record<string, number>;
}

export interface DepartmentQuotaInfo {
  id: string;
  name: string;
  remainingQuota: number;
  description: string;
}

export interface AssignmentSuggestionItem {
  applicationId: string;
  departmentId: string;
  reason: string;
  source: 'gemini' | 'fallback_rule';
}

export type AiAssignmentGenerator = (
  candidates: CandidateForAiAssignment[],
  departments: DepartmentQuotaInfo[]
) => Promise<Array<{ applicationId: string; departmentId: string; reason: string }>>;

let mockAiGenerator: AiAssignmentGenerator | null = null;

export function setMockAiGenerator(generator: AiAssignmentGenerator | null): void {
  mockAiGenerator = generator;
}

export async function generateDepartmentAssignments(
  candidates: CandidateForAiAssignment[],
  departments: DepartmentQuotaInfo[]
): Promise<{
  suggestions: AssignmentSuggestionItem[];
  usedAi: boolean;
  aiMessage: string;
}> {
  if (candidates.length === 0) {
    return {
      suggestions: [],
      usedAi: false,
      aiMessage: 'Không có ứng viên nào đang chờ phân công ban.',
    };
  }

  const isTestMode = process.env.CRES_TEST_MODE === 'true';
  const apiKey = isTestMode ? '' : process.env.GEMINI_API_KEY;
  const hasValidKey = Boolean(
    mockAiGenerator || (apiKey && apiKey !== 'MY_GEMINI_API_KEY' && apiKey.trim().length > 10)
  );

  if (hasValidKey) {
    try {
      let parsed: Array<{
        applicationId: string;
        departmentId: string;
        reason: string;
      }>;

      if (mockAiGenerator) {
        parsed = await mockAiGenerator(candidates, departments);
      } else {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

      const prompt = `Bạn là chuyên gia nhân sự hỗ trợ Ban Nhân sự Câu lạc bộ Thương mại C-RES (Đại học Kinh tế - Đại học Đà Nẵng) phân công Cộng tác viên (CTV) mới vào 3 ban: Ban Truyền thông, Ban Nhân sự, Ban Kinh doanh.

Danh sách các ban và chỉ tiêu còn lại (TUYỆT ĐỐI KHÔNG vượt quá remainingQuota của mỗi ban):
${JSON.stringify(departments, null, 2)}

Danh sách ứng viên đã xác nhận tham gia cần phân ban:
${JSON.stringify(candidates, null, 2)}

Yêu cầu:
1. Phân công mỗi ứng viên vào đúng 1 ban (departmentId phải nằm trong danh sách các ban ở trên).
2. Ưu tiên nguyện vọng 1 (firstChoiceDeptId), sau đó nguyện vọng 2 (secondChoiceDeptId), kết hợp điểm phỏng vấn (totalScore) và kinh nghiệm (experience).
3. Tổng số ứng viên được gợi ý vào mỗi ban KHÔNG ĐƯỢC VƯỢT QUÁ remainingQuota của ban đó.
4. Viết lý do (reason) ngắn gọn, thân thiện bằng tiếng Việt (1-2 câu) giải thích vì sao gợi ý ban đó.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                applicationId: {
                  type: Type.STRING,
                  description: 'ID của hồ sơ ứng viên',
                },
                departmentId: {
                  type: Type.STRING,
                  description: 'ID của ban được gợi ý',
                },
                reason: {
                  type: Type.STRING,
                  description: 'Lý do gợi ý phân công bằng tiếng Việt',
                },
              },
              required: ['applicationId', 'departmentId', 'reason'],
            },
          },
        },
      });

      const rawText = (response.text ?? '[]').trim();
      parsed = JSON.parse(rawText) as Array<{
        applicationId: string;
        departmentId: string;
        reason: string;
      }>;
      }

      // Validate completeness & quota constraints strictly by code
      const validDeptIds = new Set(departments.map((d) => d.id));
      const quotaCounts = new Map<string, number>();
      for (const d of departments) {
        quotaCounts.set(d.id, d.remainingQuota);
      }

      const candidateIds = new Set(candidates.map((c) => c.applicationId));
      const seenCandidates = new Set<string>();
      let isValid = Array.isArray(parsed) && parsed.length === candidates.length;

      if (isValid) {
        for (const item of parsed) {
          if (
            !item.applicationId ||
            !candidateIds.has(item.applicationId) ||
            seenCandidates.has(item.applicationId) ||
            !validDeptIds.has(item.departmentId) ||
            !item.reason
          ) {
            isValid = false;
            break;
          }
          seenCandidates.add(item.applicationId);
          const rem = (quotaCounts.get(item.departmentId) ?? 0) - 1;
          if (rem < 0) {
            isValid = false;
            break;
          }
          quotaCounts.set(item.departmentId, rem);
        }
      }

      if (isValid) {
        return {
          suggestions: parsed.map((p) => ({
            ...p,
            source: 'gemini',
          })),
          usedAi: true,
          aiMessage: 'Đã cập nhật gợi ý phân ban phù hợp với nguyện vọng và năng lực của từng bạn.',
        };
      }
    } catch (err) {
      // Fallback to deterministic algorithm below
      console.warn('Gemini AI suggestion fallback triggered:', err instanceof Error ? err.message : err);
    }
  }

  const fallback = fallbackAssignmentSuggestion(candidates, departments);
  const unassignedCount = fallback.filter((f) => !f.departmentId).length;
  return {
    suggestions: fallback.map((f) => ({
      ...f,
      source: 'fallback_rule',
    })),
    usedAi: false,
    aiMessage:
      unassignedCount > 0
        ? `Chưa thể phân công ${unassignedCount} ứng viên do tất cả các ban đã hết chỉ tiêu nhận CTV.`
        : 'Đã gợi ý phân ban dựa trên nguyện vọng đăng ký, điểm phỏng vấn và chỉ tiêu của 3 Ban.',
  };
}
