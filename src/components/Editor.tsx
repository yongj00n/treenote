import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { useState } from 'react';

const DEBOUNCE_MS = 800;

type SaveStatus = 'saved' | 'saving' | 'unsaved';

interface Props {
  initialContent: object;
  onSave: (json: object) => Promise<void>;
  showToolbar?: boolean;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
}

export function Editor({ initialContent, onSave, showToolbar = true, onEditorReady }: Props) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
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
    // TipTap JSON이면 그대로, 빈 객체면 undefined(빈 에디터)
    content: isValidDoc(initialContent) ? initialContent : undefined,
    editorProps: {
      attributes: { class: 'outline-none' },
    },
    onUpdate: ({ editor }) => {
      setSaveStatus('unsaved');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        setSaveStatus('saving');
        await latestSaveRef.current(editor.getJSON());
        setSaveStatus('saved');
      }, DEBOUNCE_MS);
    },
    onCreate: ({ editor }) => {
      onEditorReady?.(editor);
    },
  });

  // 언마운트 시 pending 저장 즉시 플러시
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        if (editor) latestSaveRef.current(editor.getJSON());
      }
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="flex flex-col h-full">
      {/* ── 툴바 ── */}
      {showToolbar && (
        <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-100 bg-white flex-wrap shrink-0">

          <Btn onClick={() => editor.chain().focus().undo().run()}
               active={false} title="실행 취소 (Ctrl+Z)"
               disabled={!editor.can().undo()}>
            ↩
          </Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()}
               active={false} title="다시 실행 (Ctrl+Y)"
               disabled={!editor.can().redo()}>
            ↪
          </Btn>

          <Sep />

          <Btn onClick={() => editor.chain().focus().toggleBold().run()}
               active={editor.isActive('bold')} title="굵게 (Ctrl+B)">
            <strong>B</strong>
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleItalic().run()}
               active={editor.isActive('italic')} title="기울임 (Ctrl+I)">
            <em>I</em>
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleUnderline().run()}
               active={editor.isActive('underline')} title="밑줄 (Ctrl+U)">
            <span className="underline">U</span>
          </Btn>

          <Sep />

          <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
               active={editor.isActive('heading', { level: 1 })} title="제목 1">
            H1
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
               active={editor.isActive('heading', { level: 2 })} title="제목 2">
            H2
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
               active={editor.isActive('heading', { level: 3 })} title="제목 3">
            H3
          </Btn>

          <Sep />

          <Btn onClick={() => editor.chain().focus().toggleBulletList().run()}
               active={editor.isActive('bulletList')} title="불릿 목록">
            •≡
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()}
               active={editor.isActive('orderedList')} title="번호 목록">
            1≡
          </Btn>
          <Btn onClick={() => editor.chain().focus().toggleTaskList().run()}
               active={editor.isActive('taskList')} title="체크리스트">
            ☑
          </Btn>

          <Sep />

          {/* 표 삽입 */}
          <Btn
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            active={false}
            title="표 삽입 (3×3)">
            ⊞
          </Btn>

          {/* 표 안에 커서가 있을 때만 표시되는 조작 버튼 */}
          {editor.isActive('table') && (
            <>
              <Btn onClick={() => editor.chain().focus().addRowBefore().run()}
                   active={false} title="위에 행 추가">
                +↑
              </Btn>
              <Btn onClick={() => editor.chain().focus().addRowAfter().run()}
                   active={false} title="아래에 행 추가">
                +↓
              </Btn>
              <Btn onClick={() => editor.chain().focus().deleteRow().run()}
                   active={false} title="행 삭제">
                ✕행
              </Btn>
              <Sep />
              <Btn onClick={() => editor.chain().focus().addColumnBefore().run()}
                   active={false} title="왼쪽에 열 추가">
                +←
              </Btn>
              <Btn onClick={() => editor.chain().focus().addColumnAfter().run()}
                   active={false} title="오른쪽에 열 추가">
                +→
              </Btn>
              <Btn onClick={() => editor.chain().focus().deleteColumn().run()}
                   active={false} title="열 삭제">
                ✕열
              </Btn>
              <Sep />
              <Btn onClick={() => editor.chain().focus().deleteTable().run()}
                   active={false} title="표 삭제">
                표✕
              </Btn>
            </>
          )}

          {/* 자동 저장 상태 */}
          <div className="ml-auto text-xs text-gray-400 select-none">
            {saveStatus === 'unsaved' && '편집 중...'}
            {saveStatus === 'saving'  && '저장 중...'}
            {saveStatus === 'saved'   && '저장됨'}
          </div>
        </div>
      )}

      {/* ── 본문 ── */}
      <div
        className="flex-1 overflow-y-auto cursor-text"
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

/* ── 내부 컴포넌트 ── */

function Btn({
  onClick, active, title, children, disabled = false,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onMouseDown={(e) => { e.preventDefault(); if (!disabled) onClick(); }}
      title={title}
      disabled={disabled}
      className={`h-7 min-w-[1.75rem] px-1.5 rounded text-sm font-medium transition-colors ${
        disabled
          ? 'text-gray-300 cursor-not-allowed'
          : active
            ? 'bg-indigo-100 text-indigo-700'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 active:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-5 bg-gray-200 mx-1 shrink-0" />;
}

function isValidDoc(content: object): boolean {
  return 'type' in content && (content as Record<string, unknown>).type === 'doc';
}
