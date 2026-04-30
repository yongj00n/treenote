import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { type TreeNodeData } from '../hooks/useNodes';
import { type Subject } from '../db/database';
import { InkCanvas, type InkCanvasHandle } from './InkCanvas';

const DEBOUNCE_MS = 800;

// hex → "r, g, b" 문자열 변환
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return isNaN(r + g + b) ? '99,102,241' : `${r},${g},${b}`;
}

interface DocumentViewProps {
  subject: Subject;
  onBack: () => void;
  onAddRootNode: () => void;
  newlyAddedId: string | null;
  onClearNewlyAdded: () => void;
  treeData: TreeNodeData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
  onSave: (id: string, json: object) => Promise<void>;
  onAddSibling: (id: string) => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onReorderSiblings: (parentId: string | null, orderedIds: string[]) => Promise<void>;
  onRenameSubject: (name: string) => Promise<void>;
  onUpdateSubjectColor: (color: string) => Promise<void>;
}

function levelPrefix(level: number, index: number): string {
  const n = index + 1;
  if (level === 0) return `${n}.`;
  if (level === 1) return `${n})`;
  return '●';
}

interface NodeSectionProps {
  node: TreeNodeData;
  level: number;
  index: number;
  subjectRgb: string;
  selectedId: string | null;
  newlyAddedId: string | null;
  onClearNewlyAdded: () => void;
  levelVer: number;
  levelDepth: number;
  spellCheck: boolean;
  activeEditorRef: React.MutableRefObject<TiptapEditor | null>;
  refreshToolbar: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => Promise<void>;
  onSave: (id: string, json: object) => Promise<void>;
  onAddSibling: (id: string) => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onReorderSiblings: (parentId: string | null, orderedIds: string[]) => Promise<void>;
}

const INK_COLORS = ['#1a1a1a', '#ef4444', '#3b82f6', '#22c55e', '#f97316', '#8b5cf6'];

// 레벨별 배경 투명도 (단계 깊어질수록 옅어짐)
const LEVEL_BG_OPACITY   = [0.14, 0.09, 0.055, 0.03];
const LEVEL_BORDER_OPACITY = [0.28, 0.20, 0.13, 0.08];
function levelOpacity(level: number, arr: number[]) {
  return arr[Math.min(level, arr.length - 1)];
}

/* ── 에디터 인스턴스 분리 컴포넌트 (필요할 때만 마운트) ── */

interface NodeEditorPaneProps {
  nodeId: string;
  initialContent: object;
  spellCheck: boolean;
  activeEditorRef: React.MutableRefObject<TiptapEditor | null>;
  refreshToolbar: () => void;
  onSave: (id: string, json: object) => Promise<void>;
  onSelect: (id: string) => void;
  onFocus: () => void;
  onBlur: (isEmpty: boolean) => void;
  onIsEmptyChange: (isEmpty: boolean) => void;
}

const NodeEditorPane = memo(function NodeEditorPane({
  nodeId, initialContent, spellCheck,
  activeEditorRef, refreshToolbar,
  onSave, onSelect, onFocus, onBlur, onIsEmptyChange,
}: NodeEditorPaneProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSaveRef = useRef(onSave);
  latestSaveRef.current = onSave;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: '내용을 입력하세요...' }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: isValidDoc(initialContent) ? initialContent : undefined,
    editorProps: { attributes: { class: 'outline-none', spellcheck: String(spellCheck) } },
    onCreate: ({ editor: ed }) => { onIsEmptyChange(ed.isEmpty); },
    onFocus: ({ editor: ed }) => {
      activeEditorRef.current = ed;
      onFocus();
      refreshToolbar();
      onSelect(nodeId);
    },
    onBlur: ({ editor: ed }) => {
      onBlur(ed.isEmpty);
      refreshToolbar();
    },
    onSelectionUpdate: () => refreshToolbar(),
    onUpdate: ({ editor: ed }) => {
      onIsEmptyChange(ed.isEmpty);
      refreshToolbar();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        await latestSaveRef.current(nodeId, ed.getJSON());
      }, DEBOUNCE_MS);
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.view.dom.setAttribute('spellcheck', String(spellCheck));
  }, [spellCheck, editor]);

  // 언마운트 시 pending 저장 플러시
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        if (editor) latestSaveRef.current(nodeId, editor.getJSON());
      }
    };
  }, [editor]); // eslint-disable-line

  return (
    <div className="node-editor" onClick={() => editor?.commands.focus()}>
      {editor && <EditorContent editor={editor}/>}
    </div>
  );
});

const NodeSection = memo(function NodeSection({
  node, level, index, subjectRgb, selectedId, newlyAddedId, onClearNewlyAdded,
  levelVer, levelDepth, spellCheck,
  activeEditorRef, refreshToolbar,
  onSelect, onRename, onSave, onAddSibling, onAddChild, onDelete, onReorderSiblings,
}: NodeSectionProps) {
  const [isChildrenOpen, setIsChildrenOpen] = useState(true);
  const [isContentOpen, setIsContentOpen] = useState(true);
  const [showInk, setShowInk] = useState(false);
  const [inkTool, setInkTool]   = useState<'pen' | 'eraser'>('pen');
  const [inkColor, setInkColor] = useState('#1a1a1a');
  const [inkSize, setInkSize]   = useState(2);
  const inkClearRef = useRef<InkCanvasHandle>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(node.name);
  const [isFocused, setIsFocused] = useState(false);
  const [isEmpty, setIsEmpty] = useState(() => !isValidDoc(node.body_json));
  const prevVerRef = useRef(0);

  // NodeEditorPane 콜백 (안정적인 참조 유지)
  const handleEditorFocus = useCallback(() => setIsFocused(true), []);
  const handleEditorBlur = useCallback((empty: boolean) => {
    setIsFocused(false);
    setIsEmpty(empty);
  }, []);
  const handleIsEmptyChange = useCallback((empty: boolean) => setIsEmpty(empty), []);

  // 에디터가 마운트되지 않은 상태에서 DB 변경 시 isEmpty 동기화
  useEffect(() => {
    setIsEmpty(!isValidDoc(node.body_json));
  }, [node.body_json]);

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: node.id });

  const dragStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 10 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  const childSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const isSelected = selectedId === node.id;
  const hasChildren = node.children.length > 0;
  const prefix = levelPrefix(level, index);
  const showEditor = isSelected || (isContentOpen && (!isEmpty || isFocused));

  // 레벨 신호 → 두 상태 동시 업데이트
  useEffect(() => {
    if (levelVer === prevVerRef.current) return;
    prevVerRef.current = levelVer;
    const open = level < levelDepth;
    setIsChildrenOpen(open);
    setIsContentOpen(open);
  }, [levelVer, levelDepth, level]);

  // 새 노드 → 제목 편집 모드 자동 진입
  useEffect(() => {
    if (node.id === newlyAddedId) {
      setIsEditingTitle(true);
      onClearNewlyAdded();
    }
  }, [node.id, newlyAddedId]); // eslint-disable-line

  useEffect(() => {
    if (!isEditingTitle) setTitleValue(node.name);
  }, [node.name]); // eslint-disable-line

  useEffect(() => {
    if (isSelected) {
      document.getElementById(`section-${node.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]); // eslint-disable-line

  function submitTitleRename() {
    onRename(node.id, titleValue);
    setIsEditingTitle(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const msg = hasChildren
      ? `"${node.name}" 과 하위 노드를 모두 삭제할까요?`
      : `"${node.name}" 을 삭제할까요?`;
    if (!window.confirm(msg)) return;
    await onDelete(node.id);
  }

  function handleAddChild() {
    setIsChildrenOpen(true);
    onAddChild(node.id);
  }

  function handleHeaderKeyDown(e: React.KeyboardEvent) {
    if (isEditingTitle) return;
    if (e.key === 'Tab') {
      e.preventDefault();
      e.shiftKey ? onAddSibling(node.id) : handleAddChild();
    }
  }

  function handleChildDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = node.children.map((c) => c.id);
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onReorderSiblings(node.id, arrayMove(ids, oldIdx, newIdx));
  }

  // 과목 색상 기반 레벨별 배경
  const bgOpacity = levelOpacity(level, LEVEL_BG_OPACITY);
  const borderOpacity = levelOpacity(level, LEVEL_BORDER_OPACITY);
  const sectionStyle: React.CSSProperties = {
    ...dragStyle,
    backgroundColor: `rgba(${subjectRgb}, ${bgOpacity})`,
    borderColor: `rgba(${subjectRgb}, ${borderOpacity})`,
  };

  // 선택된 헤더도 과목 색 기반
  const headerStyle: React.CSSProperties = isSelected
    ? { backgroundColor: `rgba(${subjectRgb}, 0.22)` }
    : {};

  const sharedChildProps = {
    subjectRgb, selectedId, newlyAddedId, onClearNewlyAdded,
    levelVer, levelDepth, spellCheck,
    activeEditorRef, refreshToolbar,
    onSelect, onRename, onSave, onAddSibling, onAddChild, onDelete, onReorderSiblings,
  };

  return (
    <div ref={setNodeRef} style={sectionStyle} id={`section-${node.id}`}
      className={`rounded-lg mb-1.5 border ${level === 0 ? 'shadow-sm' : ''}`}>

      {/* ── 헤더 ── */}
      <div
        tabIndex={0}
        style={headerStyle}
        className={`group flex items-center gap-1 py-0.5 px-2 pr-1.5 cursor-default rounded-lg select-none transition-colors focus:outline-none ${
          isSelected ? '' : 'hover:bg-black/[0.05]'
        }`}
        onClick={() => onSelect(node.id)}
        onKeyDown={handleHeaderKeyDown}
      >
        {/* 드래그 핸들 */}
        <span
          {...attributes} {...listeners}
          title="드래그하여 순서 변경"
          className="w-3 h-5 shrink-0 flex items-center justify-center rounded cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-30 hover:!opacity-70 text-gray-400 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 6 10" width="6" height="10" fill="currentColor">
            <circle cx="1.5" cy="1.5" r="1.2"/><circle cx="4.5" cy="1.5" r="1.2"/>
            <circle cx="1.5" cy="5"   r="1.2"/><circle cx="4.5" cy="5"   r="1.2"/>
            <circle cx="1.5" cy="8.5" r="1.2"/><circle cx="4.5" cy="8.5" r="1.2"/>
          </svg>
        </span>

        {/* ▶ 자식 + 내용 동시 펼침/접힘 */}
        {hasChildren ? (
          <button tabIndex={-1}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              const next = !isChildrenOpen;
              setIsChildrenOpen(next);
              setIsContentOpen(next);
            }}
            className="w-4 h-4 shrink-0 flex items-center justify-center rounded transition-colors hover:bg-black/10"
            style={{ color: `rgba(${subjectRgb}, ${levelOpacity(level, [0.7, 0.55, 0.4, 0.3])})` }}>
            <svg className={`w-2.5 h-2.5 transition-transform duration-150 ${isChildrenOpen ? 'rotate-90' : ''}`}
              viewBox="0 0 8 8" fill="currentColor">
              <path d="M2 1l4 3-4 3z"/>
            </svg>
          </button>
        ) : (
          <span className="w-4 h-4 shrink-0 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ backgroundColor: `rgba(${subjectRgb}, 0.35)` }}/>
          </span>
        )}

        {/* 레벨 접두사 (클릭 = 내용만 독립 펼침/접힘) */}
        <button tabIndex={-1}
          title={isContentOpen ? '내용 접기' : '내용 펼치기'}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); setIsContentOpen((v) => !v); }}
          className={`shrink-0 font-mono text-xs w-5 text-right leading-none transition-opacity cursor-pointer hover:opacity-60 ${
            isContentOpen ? '' : 'opacity-35'
          }`}
          style={{ color: `rgba(${subjectRgb}, ${levelOpacity(level, [0.85, 0.65, 0.45, 0.3])})` }}>
          {prefix}
        </button>

        {/* 제목 또는 편집 인풋 */}
        {isEditingTitle ? (
          <input autoFocus value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={submitTitleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitTitleRename();
              if (e.key === 'Escape') { setTitleValue(node.name); setIsEditingTitle(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 px-1 py-0 border border-indigo-400 rounded outline-none bg-white/80 shadow-sm text-sm font-bold text-gray-800"
          />
        ) : (
          <span
            className="flex-1 min-w-0 truncate text-sm font-bold text-gray-800"
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditingTitle(true); }}>
            {node.name}
          </span>
        )}

        {/* 본문 존재 점 */}
        {!isEmpty && (
          <span className="w-1.5 h-1.5 rounded-full shrink-0" title="본문 있음"
            style={{ backgroundColor: `rgba(${subjectRgb}, 0.7)` }}/>
        )}

        {/* ✏ 필기 토글 — 항상 표시 */}
        {!isEditingTitle && (
          <button tabIndex={-1} onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setShowInk((v) => !v); }}
            title="필기 열기/닫기"
            className={`h-5 w-5 flex items-center justify-center text-xs rounded shrink-0 transition-colors ${
              showInk ? 'text-indigo-500 bg-indigo-100' : 'text-gray-300 hover:text-indigo-400 hover:bg-white/60'}`}>
            ✏
          </button>
        )}

        {/* 액션 버튼 — hover 시만 */}
        {!isEditingTitle && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button tabIndex={-1} onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onAddSibling(node.id); }}
              title="형제 노드 추가 (Shift+Tab)"
              className="h-5 px-1 text-xs rounded text-gray-400 hover:text-indigo-500 hover:bg-white/60 active:bg-white/80 transition-colors">
              +형제
            </button>
            <button tabIndex={-1} onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); handleAddChild(); }}
              title="하위 노드 추가 (Tab)"
              className="h-5 px-1 text-xs rounded text-gray-400 hover:text-indigo-500 hover:bg-white/60 active:bg-white/80 transition-colors">
              +하위
            </button>
            <button tabIndex={-1} onMouseDown={(e) => e.stopPropagation()}
              onClick={handleDelete} title="삭제"
              className="h-5 w-5 flex items-center justify-center text-sm rounded text-gray-400 hover:text-red-500 hover:bg-red-50 active:bg-red-100 transition-all">
              ×
            </button>
          </div>
        )}
      </div>

      {/* ── 필기 툴바 (showInk일 때만) ── */}
      {showInk && (
        <div className="flex items-center gap-1 px-2 py-0.5 border-t border-black/5 flex-wrap">
          <button onClick={() => setInkTool('pen')} title="펜"
            className={`h-5 w-6 flex items-center justify-center text-xs rounded ${
              inkTool === 'pen' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'
            }`}>✏</button>
          <button onClick={() => setInkTool('eraser')} title="지우개"
            className={`h-5 w-6 flex items-center justify-center text-xs rounded ${
              inkTool === 'eraser' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'
            }`}>◻</button>
          <div className="w-px h-3 bg-gray-300 mx-0.5"/>
          {INK_COLORS.map((c) => (
            <button key={c} onClick={() => setInkColor(c)}
              style={{ backgroundColor: c }}
              className={`w-3.5 h-3.5 rounded-full transition-transform hover:scale-110 ${
                inkColor === c ? 'ring-2 ring-offset-1 ring-indigo-400' : ''
              }`}/>
          ))}
          <div className="w-px h-3 bg-gray-300 mx-0.5"/>
          <span className="rounded-full shrink-0 inline-block"
            style={{
              width:  Math.max(2, Math.min(inkSize, 14)),
              height: Math.max(2, Math.min(inkSize, 14)),
              backgroundColor: inkTool === 'eraser' ? '#d1d5db' : inkColor,
            }}/>
          <input type="range" min={1} max={24} step={1} value={inkSize}
            onChange={(e) => setInkSize(Number(e.target.value))}
            title={`굵기: ${inkSize}px`}
            className="w-20 h-1 accent-indigo-500 cursor-pointer"/>
          <div className="w-px h-3 bg-gray-300 mx-0.5"/>
          <button onClick={() => inkClearRef.current?.clearAll()} title="전체 지우기"
            className="h-5 px-1.5 text-xs rounded text-gray-400 hover:text-red-500 hover:bg-red-50">
            전체삭제
          </button>
        </div>
      )}

      {/* ── 콘텐츠 영역: 텍스트 위에 필기 오버레이 ── */}
      {isContentOpen && (
        <div
          className="relative"
          style={{ paddingLeft: '26px', paddingRight: '8px', minHeight: showInk ? '80px' : undefined }}
          onClick={(e) => e.stopPropagation()}
        >
          {showEditor && (
            <div className="cursor-text">
              <NodeEditorPane
                nodeId={node.id}
                initialContent={node.body_json}
                spellCheck={spellCheck}
                activeEditorRef={activeEditorRef}
                refreshToolbar={refreshToolbar}
                onSave={onSave}
                onSelect={onSelect}
                onFocus={handleEditorFocus}
                onBlur={handleEditorBlur}
                onIsEmptyChange={handleIsEmptyChange}
              />
            </div>
          )}
          <InkCanvas
            ref={inkClearRef}
            nodeId={node.id}
            isActive={showInk}
            tool={inkTool}
            color={inkColor}
            size={inkSize}
          />
        </div>
      )}

      {/* ── 자식 노드 ── */}
      {isChildrenOpen && hasChildren && (
        <div className="ml-4" style={{ borderLeft: `2px solid rgba(${subjectRgb}, ${borderOpacity * 0.6})` }}>
          <DndContext sensors={childSensors} collisionDetection={closestCenter} onDragEnd={handleChildDragEnd}>
            <SortableContext items={node.children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              {node.children.map((child, i) => (
                <NodeSection key={child.id} node={child} level={level + 1} index={i} {...sharedChildProps}/>
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
});

/* ── DocumentView ── */

export function DocumentView({
  subject, onBack, onAddRootNode,
  newlyAddedId, onClearNewlyAdded,
  treeData, selectedId, onSelect, onRename, onSave,
  onAddSibling, onAddChild, onDelete, onReorderSiblings,
  onRenameSubject, onUpdateSubjectColor,
}: DocumentViewProps) {
  const [levelVer, setLevelVer] = useState(0);
  const [levelDepth, setLevelDepth] = useState(99);
  const [spellCheck, setSpellCheck] = useState(false);
  const [columns, setColumns] = useState<1 | 2 | 3>(1);
  const [toolbarTick, setToolbarTick] = useState(0);

  // 과목명 편집
  const [isEditingSubjectName, setIsEditingSubjectName] = useState(false);
  const [subjectNameValue, setSubjectNameValue] = useState(subject.name);
  useEffect(() => {
    if (!isEditingSubjectName) setSubjectNameValue(subject.name);
  }, [subject.name]); // eslint-disable-line

  // 과목 색상 (즉각 미리보기용 로컬 상태 + 300ms 디바운스 DB 저장)
  const [localColor, setLocalColor] = useState(subject.color);
  const colorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocalColor(subject.color); }, [subject.color]);

  function handleColorChange(c: string) {
    setLocalColor(c);
    if (colorDebounceRef.current) clearTimeout(colorDebounceRef.current);
    colorDebounceRef.current = setTimeout(() => onUpdateSubjectColor(c), 300);
  }

  function submitSubjectRename() {
    onRenameSubject(subjectNameValue);
    setIsEditingSubjectName(false);
  }

  const subjectRgb = hexToRgb(localColor);

  const activeEditorRef = useRef<TiptapEditor | null>(null);
  const refreshToolbar = useCallback(() => setToolbarTick((t) => t + 1), []);

  const rootSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const _tick = toolbarTick;
  const ae = activeEditorRef.current;
  const canUndo  = _tick >= 0 && (ae?.can().undo()  ?? false);
  const canRedo  = _tick >= 0 && (ae?.can().redo()  ?? false);
  const isBold    = ae?.isActive('bold')      ?? false;
  const isItalic  = ae?.isActive('italic')    ?? false;
  const isUnder   = ae?.isActive('underline') ?? false;
  const isH1      = ae?.isActive('heading', { level: 1 }) ?? false;
  const isH2      = ae?.isActive('heading', { level: 2 }) ?? false;
  const isH3      = ae?.isActive('heading', { level: 3 }) ?? false;
  const isBullet  = ae?.isActive('bulletList')  ?? false;
  const isOrdered = ae?.isActive('orderedList') ?? false;
  const isTask    = ae?.isActive('taskList')    ?? false;
  const isInTable = ae?.isActive('table')       ?? false;

  function cmd(fn: (e: TiptapEditor) => void) {
    if (activeEditorRef.current) fn(activeEditorRef.current);
  }

  function triggerLevel(depth: number) {
    setLevelDepth(depth);
    setLevelVer((v) => v + 1);
  }

  function handleRootDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = treeData.map((n) => n.id);
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onReorderSiblings(null, arrayMove(ids, oldIdx, newIdx));
  }

  const gridClass =
    columns === 2 ? 'grid grid-cols-2 gap-3 items-start' :
    columns === 3 ? 'grid grid-cols-3 gap-3 items-start' :
    'max-w-4xl mx-auto';

  const sharedProps = {
    subjectRgb, selectedId, newlyAddedId, onClearNewlyAdded,
    levelVer, levelDepth, spellCheck,
    activeEditorRef, refreshToolbar,
    onSelect, onRename, onSave, onAddSibling, onAddChild, onDelete, onReorderSiblings,
  };

  return (
    <div className="flex flex-col h-full bg-stone-50">
      {/* ── 글로벌 툴바 ── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-stone-200 bg-stone-100 flex-wrap shrink-0">

        {/* 뒤로가기 */}
        <button onClick={onBack} title="과목 목록으로"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400
            hover:text-gray-700 hover:bg-stone-200 active:bg-stone-300 transition-colors text-base">
          ←
        </button>

        {/* 과목 색상 (클릭 → 색상 변경) */}
        <div className="relative ml-0.5">
          <span
            className="block w-3.5 h-3.5 rounded-full cursor-pointer ring-1 ring-white hover:ring-2 hover:scale-110 transition-transform"
            style={{ backgroundColor: localColor }}
            onClick={() => colorInputRef.current?.click()}
            title="색상 변경"
          />
          <input ref={colorInputRef} type="color" value={localColor}
            onChange={(e) => handleColorChange(e.target.value)}
            className="sr-only"/>
        </div>

        {/* 과목명 (더블클릭 → 편집) */}
        {isEditingSubjectName ? (
          <input autoFocus value={subjectNameValue}
            onChange={(e) => setSubjectNameValue(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={submitSubjectRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitSubjectRename();
              if (e.key === 'Escape') { setSubjectNameValue(subject.name); setIsEditingSubjectName(false); }
            }}
            className="ml-1 mr-2 w-28 px-1.5 py-0.5 text-sm font-semibold border border-indigo-400 rounded outline-none bg-white shadow-sm"
          />
        ) : (
          <span
            className="ml-1 mr-2 font-semibold text-gray-700 text-sm truncate max-w-[120px] cursor-pointer hover:text-indigo-600 transition-colors"
            onDoubleClick={() => setIsEditingSubjectName(true)}
            title="더블클릭으로 과목명 수정">
            {subject.name}
          </span>
        )}

        <TSep />
        <TBtn onClick={() => cmd((e) => e.chain().focus().undo().run())}
              active={false} muted={!canUndo} title="실행 취소 (Ctrl+Z)">↩</TBtn>
        <TBtn onClick={() => cmd((e) => e.chain().focus().redo().run())}
              active={false} muted={!canRedo} title="다시 실행 (Ctrl+Y)">↪</TBtn>
        <TSep />
        <TBtn onClick={() => cmd((e) => e.chain().focus().toggleBold().run())}
              active={isBold} title="굵게 (Ctrl+B)"><strong>B</strong></TBtn>
        <TBtn onClick={() => cmd((e) => e.chain().focus().toggleItalic().run())}
              active={isItalic} title="기울임 (Ctrl+I)"><em>I</em></TBtn>
        <TBtn onClick={() => cmd((e) => e.chain().focus().toggleUnderline().run())}
              active={isUnder} title="밑줄 (Ctrl+U)"><span className="underline">U</span></TBtn>
        <TSep />
        <TBtn onClick={() => cmd((e) => e.chain().focus().toggleHeading({ level: 1 }).run())}
              active={isH1} title="제목 1">H1</TBtn>
        <TBtn onClick={() => cmd((e) => e.chain().focus().toggleHeading({ level: 2 }).run())}
              active={isH2} title="제목 2">H2</TBtn>
        <TBtn onClick={() => cmd((e) => e.chain().focus().toggleHeading({ level: 3 }).run())}
              active={isH3} title="제목 3">H3</TBtn>
        <TSep />
        <TBtn onClick={() => cmd((e) => e.chain().focus().toggleBulletList().run())}
              active={isBullet} title="불릿 목록">•≡</TBtn>
        <TBtn onClick={() => cmd((e) => e.chain().focus().toggleOrderedList().run())}
              active={isOrdered} title="번호 목록">1≡</TBtn>
        <TBtn onClick={() => cmd((e) => e.chain().focus().toggleTaskList().run())}
              active={isTask} title="체크리스트">☑</TBtn>
        <TSep />
        <TBtn
          onClick={() => cmd((e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
          active={false} title="표 삽입 (3×3)">⊞</TBtn>
        {isInTable && (
          <>
            <TBtn onClick={() => cmd((e) => e.chain().focus().addRowBefore().run())}
                  active={false} title="위에 행 추가">+↑</TBtn>
            <TBtn onClick={() => cmd((e) => e.chain().focus().addRowAfter().run())}
                  active={false} title="아래에 행 추가">+↓</TBtn>
            <TBtn onClick={() => cmd((e) => e.chain().focus().deleteRow().run())}
                  active={false} title="행 삭제">✕행</TBtn>
            <TSep />
            <TBtn onClick={() => cmd((e) => e.chain().focus().addColumnBefore().run())}
                  active={false} title="왼쪽에 열 추가">+←</TBtn>
            <TBtn onClick={() => cmd((e) => e.chain().focus().addColumnAfter().run())}
                  active={false} title="오른쪽에 열 추가">+→</TBtn>
            <TBtn onClick={() => cmd((e) => e.chain().focus().deleteColumn().run())}
                  active={false} title="열 삭제">✕열</TBtn>
            <TSep />
            <TBtn onClick={() => cmd((e) => e.chain().focus().deleteTable().run())}
                  active={false} title="표 삭제">표✕</TBtn>
          </>
        )}
        <TSep />
        <TBtn onClick={() => setSpellCheck((v) => !v)} active={spellCheck} title="맞춤법 검사">맞</TBtn>
        <TSep />
        {([1, 2, 3] as const).map((d) => (
          <button key={d} onClick={() => triggerLevel(d - 1)}
            className="h-7 px-2 rounded text-xs font-medium transition-colors text-gray-500
              hover:bg-stone-200 hover:text-gray-800 active:bg-stone-300">
            {d}단계
          </button>
        ))}
        <button onClick={() => triggerLevel(99)}
          className="h-7 px-2 rounded text-xs font-medium transition-colors text-gray-500
            hover:bg-stone-200 hover:text-gray-800 active:bg-stone-300">
          전체
        </button>
        <TSep />
        {([1, 2, 3] as const).map((c) => (
          <button key={c} onClick={() => setColumns(c)}
            className={`h-7 px-2 rounded text-xs font-medium transition-colors ${
              columns === c
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-500 hover:bg-stone-200 hover:text-gray-800 active:bg-stone-300'
            }`}>
            {c}열
          </button>
        ))}
      </div>

      {/* ── 문서 본문 ── */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {treeData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <p className="text-3xl">🌱</p>
              <p className="text-gray-600 font-medium">아직 노드가 없어요</p>
              <p className="text-sm text-gray-400">아래 <strong>노드 추가</strong> 버튼으로 시작하세요</p>
            </div>
          </div>
        ) : (
          <DndContext sensors={rootSensors} collisionDetection={closestCenter} onDragEnd={handleRootDragEnd}>
            <SortableContext items={treeData.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              <div className={gridClass}>
                {treeData.map((node, i) => (
                  <NodeSection key={node.id} node={node} level={0} index={i} {...sharedProps}/>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        <div className={`pt-2 pb-4 ${columns === 1 ? 'max-w-4xl mx-auto' : ''}`}>
          <button onClick={onAddRootNode}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg
              border-2 border-dashed border-gray-300 text-sm text-gray-400
              hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50
              active:bg-indigo-100 active:border-indigo-500 transition-colors">
            <span className="text-base leading-none font-bold">+</span>
            노드 추가
          </button>
        </div>
      </div>
    </div>
  );
}

function TBtn({ onClick, active, title, children, muted = false }: {
  onClick: () => void; active: boolean; title: string;
  children: React.ReactNode; muted?: boolean;
}) {
  return (
    <button onMouseDown={(e) => { e.preventDefault(); onClick(); }} title={title}
      className={`h-7 min-w-[1.75rem] px-1.5 rounded text-sm font-medium transition-colors ${
        muted ? 'text-gray-300 cursor-default'
        : active ? 'bg-indigo-100 text-indigo-700'
        : 'text-gray-500 hover:bg-stone-200 hover:text-gray-800 active:bg-stone-300'
      }`}>
      {children}
    </button>
  );
}

function TSep() {
  return <div className="w-px h-5 bg-stone-300 mx-0.5 shrink-0"/>;
}

function isValidDoc(content: object): boolean {
  return 'type' in content && (content as Record<string, unknown>).type === 'doc';
}
