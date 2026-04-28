import { useState } from 'react';
import { type GradeLevel, GRADE_LEVEL_LABELS, GRADE_LEVEL_ORDER } from '../db/database';

const COLOR_PRESETS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

interface Props {
  onClose: () => void;
  onAdd: (data: { name: string; grade_level: GradeLevel | null; color: string }) => Promise<void>;
}

export function AddSubjectModal({ onClose, onAdd }: Props) {
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState<GradeLevel | null>(null);
  const [color, setColor] = useState(COLOR_PRESETS[4]); // 파란색 기본값
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    await onAdd({ name: name.trim(), grade_level: gradeLevel, color });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">과목 추가</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 과목명 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              과목명 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 수학, 영어, 화학..."
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* 학교급 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">
              학교급 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {GRADE_LEVEL_ORDER.map((gl) => (
                <button
                  key={gl}
                  type="button"
                  onClick={() => setGradeLevel(gradeLevel === gl ? null : gl)}
                  className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                    gradeLevel === gl
                      ? 'bg-indigo-500 text-white border-indigo-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {GRADE_LEVEL_LABELS[gl]}
                </button>
              ))}
            </div>
          </div>

          {/* 색상 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">색상</label>
            <div className="flex gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? '#1e1e1e' : 'transparent',
                  }}
                />
              ))}
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="flex-1 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 transition-colors disabled:opacity-40"
            >
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
