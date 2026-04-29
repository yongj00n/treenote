import { useState, useEffect } from 'react';
import { type TreeNodeData } from '../hooks/useNodes';

interface NodeItemProps {
  node: TreeNodeData;
  level: number;
  selectedId: string | null;
  newlyAddedId: string | null;
  forceOpenVer: number;
  forceCloseVer: number;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClearNewlyAdded: () => void;
}

function NodeItem({
  node, level, selectedId, newlyAddedId, forceOpenVer, forceCloseVer,
  onSelect, onAddChild, onRename, onDelete, onClearNewlyAdded,
}: NodeItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.name);

  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  // 새로 추가된 노드면 즉시 편집 모드로
  useEffect(() => {
    if (newlyAddedId === node.id) {
      setIsEditing(true);
      setEditValue(node.name);
      onClearNewlyAdded();
    }
  }, [newlyAddedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (forceOpenVer > 0) setIsOpen(true); }, [forceOpenVer]);
  useEffect(() => { if (forceCloseVer > 0) setIsOpen(false); }, [forceCloseVer]);
  useEffect(() => { setEditValue(node.name); }, [node.name]);

  function submitRename() {
    onRename(node.id, editValue);
    setIsEditing(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const msg = hasChildren
      ? `"${node.name}" 과 하위 노드를 모두 삭제할까요?`
      : `"${node.name}" 을 삭제할까요?`;
    if (!window.confirm(msg)) return;
    await onDelete(node.id);
  }

  return (
    <div>
      <div
        className={`group flex items-center gap-1 py-1.5 pr-1 rounded-lg cursor-pointer transition-colors ${
          isSelected
            ? 'bg-indigo-50'
            : 'hover:bg-gray-100 active:bg-gray-200'
        }`}
        style={{ paddingLeft: level * 16 + 6 }}
        onClick={() => onSelect(node.id)}
      >
        {/* 펼침 토글 — 클릭 영역 넉넉하게 */}
        <button
          className={`w-6 h-6 shrink-0 flex items-center justify-center rounded transition-colors
            text-gray-400 hover:text-gray-700 hover:bg-gray-200 active:bg-gray-300
            ${!hasChildren ? 'opacity-30 pointer-events-none' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setIsOpen((v) => !v);
          }}
          tabIndex={-1}
        >
          <svg
            className={`w-3 h-3 transition-transform duration-150 ${isOpen && hasChildren ? 'rotate-90' : ''}`}
            viewBox="0 0 6 10" fill="currentColor"
          >
            <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* 제목 or 편집 인풋 */}
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') { setEditValue(node.name); setIsEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm px-1.5 py-0.5 border border-indigo-400 rounded outline-none bg-white shadow-sm"
          />
        ) : (
          <span
            className={`flex-1 text-sm truncate select-none ${
              isSelected ? 'text-indigo-700 font-medium' : 'text-gray-700'
            }`}
            onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
          >
            {node.name}
          </span>
        )}

        {/* 액션 버튼 — hover 시 표시, 크기 키움 */}
        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
              title="하위 노드 추가"
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400
                hover:text-indigo-600 hover:bg-indigo-100 active:bg-indigo-200 transition-colors text-base leading-none"
            >
              +
            </button>
            <button
              onClick={handleDelete}
              title="삭제"
              className="w-6 h-6 flex items-center justify-center rounded text-gray-400
                hover:text-red-500 hover:bg-red-100 active:bg-red-200 transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* 자식 노드 */}
      {isOpen && node.children.map((child) => (
        <NodeItem
          key={child.id}
          node={child}
          level={level + 1}
          selectedId={selectedId}
          newlyAddedId={newlyAddedId}
          forceOpenVer={forceOpenVer}
          forceCloseVer={forceCloseVer}
          onSelect={onSelect}
          onAddChild={onAddChild}
          onRename={onRename}
          onDelete={onDelete}
          onClearNewlyAdded={onClearNewlyAdded}
        />
      ))}
    </div>
  );
}

interface TreePanelProps {
  treeData: TreeNodeData[];
  selectedId: string | null;
  newlyAddedId: string | null;
  forceOpenVer: number;
  forceCloseVer: number;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClearNewlyAdded: () => void;
}

export function TreePanel({
  treeData, selectedId, newlyAddedId, forceOpenVer, forceCloseVer,
  onSelect, onAddChild, onRename, onDelete, onClearNewlyAdded,
}: TreePanelProps) {
  if (treeData.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-gray-400">아직 노드가 없어요</p>
          <p className="text-xs text-gray-300 mt-1">아래 버튼으로 첫 노드를 추가하세요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-1 px-1">
      {treeData.map((node) => (
        <NodeItem
          key={node.id}
          node={node}
          level={0}
          selectedId={selectedId}
          newlyAddedId={newlyAddedId}
          forceOpenVer={forceOpenVer}
          forceCloseVer={forceCloseVer}
          onSelect={onSelect}
          onAddChild={onAddChild}
          onRename={onRename}
          onDelete={onDelete}
          onClearNewlyAdded={onClearNewlyAdded}
        />
      ))}
    </div>
  );
}
