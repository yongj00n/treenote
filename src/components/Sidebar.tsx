import { useState } from 'react';
import {
  GRADE_LEVEL_LABELS,
  GRADE_LEVEL_ORDER,
  type GradeLevel,
  type Subject,
} from '../db/database';
import { AddSubjectModal } from './AddSubjectModal';

interface Props {
  subjects: Subject[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (data: { name: string; grade_level: GradeLevel | null; color: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function Sidebar({ subjects, selectedId, onSelect, onAdd, onDelete }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 학교급별로 그룹핑 (null → OTHER 취급)
  const grouped = GRADE_LEVEL_ORDER.reduce<Record<string, Subject[]>>((acc, gl) => {
    acc[gl] = subjects.filter((s) => (s.grade_level ?? 'OTHER') === gl);
    return acc;
  }, {} as Record<string, Subject[]>);

  function toggleGroup(gl: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(gl) ? next.delete(gl) : next.add(gl);
      return next;
    });
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (!window.confirm('이 과목을 삭제할까요? 안에 있는 모든 노드도 함께 삭제됩니다.')) return;
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  }

  return (
    <>
      <aside className="w-64 shrink-0 h-screen bg-gray-50 border-r border-gray-200 flex flex-col">
        {/* 헤더 */}
        <div className="px-4 py-4 border-b border-gray-200">
          <span className="text-lg font-bold text-indigo-600">Tree Note</span>
        </div>

        {/* 과목 목록 */}
        <nav className="flex-1 overflow-y-auto py-2">
          {subjects.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">아직 과목이 없어요</p>
              <p className="text-xs text-gray-300 mt-1">아래 버튼으로 첫 과목을 만들어보세요</p>
            </div>
          ) : (
            GRADE_LEVEL_ORDER.map((gl) => {
              const items = grouped[gl];
              if (items.length === 0) return null;
              const isCollapsed = collapsedGroups.has(gl);
              return (
                <div key={gl} className="mb-1">
                  {/* 그룹 헤더 */}
                  <button
                    onClick={() => toggleGroup(gl)}
                    className="w-full flex items-center gap-1 px-3 py-1 text-xs font-semibold text-gray-400 hover:text-gray-600 uppercase tracking-wide"
                  >
                    <span className="transition-transform duration-150" style={{ display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▾</span>
                    {GRADE_LEVEL_LABELS[gl as GradeLevel]}
                  </button>

                  {/* 과목 아이템 */}
                  {!isCollapsed && items.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => onSelect(s.id)}
                      disabled={deletingId === s.id}
                      className={`group w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg mx-1 transition-colors ${
                        selectedId === s.id
                          ? 'bg-indigo-50 text-indigo-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      style={{ width: 'calc(100% - 8px)' }}
                    >
                      {/* 색상 점 */}
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      {/* 과목명 */}
                      <span className="flex-1 text-left truncate">{s.name}</span>
                      {/* 삭제 버튼 (hover 시 표시) */}
                      <span
                        onClick={(e) => handleDelete(e, s.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 transition-opacity text-base leading-none px-0.5"
                        title="삭제"
                      >
                        ×
                      </span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </nav>

        {/* 하단 과목 추가 버튼 */}
        <div className="p-3 border-t border-gray-200">
          <button
            onClick={() => setModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors"
          >
            <span className="text-lg leading-none">+</span>
            과목 추가
          </button>
        </div>
      </aside>

      {modalOpen && (
        <AddSubjectModal
          onClose={() => setModalOpen(false)}
          onAdd={onAdd}
        />
      )}
    </>
  );
}
