import { useState, useEffect } from 'react';
import { type TreeNodeData } from '../hooks/useNodes';

interface NodeItemProps {
  node: TreeNodeData;
  level: number;
  selectedId: string | null;
  forceOpenVer: number;
  forceCloseVer: number;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function NodeItem({
  node, level, selectedId, forceOpenVer, forceCloseVer,
  onSelect, onAddChild, onRename, onDelete,
}: NodeItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.name);

  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  // 전체 펼침 / 전체 접힘 버튼에 반응
  useEffect(() => { if (forceOpenVer > 0) setIsOpen(true); }, [forceOpenVer]);
  useEffect(() => { if (forceCloseVer > 0) setIsOpen(false); }, [forceCloseVer]);

  // DB에서 이름이 바뀌면 편집 인풋도 동기화
  useEffect(() => { setEditValue(node.name); }, [node.name]);

  function submitRename() {
    onRename(node.id, editValue);
    setIsEditing(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const hasDesc = hasChildren;
    const msg = hasDesc
      ? `"${node.name}" 노드와 하위 노드를 모두 삭제할까요?`
      : `"${node.name}" 노드를 삭제할까요?`;
    if (!window.confirm(msg)) return;
    await onDelete(node.id);
  }

  return (
    <div>
      {/* 행 */}
      <div
        className={`group flex items-center gap-1 py-1 pr-1 rounded-lg cursor-pointer transition-colors ${
          isSelected ? 'bg-indigo-50' : 'hover:bg-gray-100'
        }`}
        style={{ paddingLeft: level * 16 + 8 }}
        onClick={() => onSelect(node.id)}
      >
        {/* 펼침 토글 */}
        <button
          className="w-4 h-4 shrink-0 flex items-center justify-center text-xs text-gray-400 hover:text-gray-600"
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setIsOpen((v) => !v);
          }}
        >
          {hasChildren ? (isOpen ? '▾' : '▸') : '·'}
        </button>

        {/* 제목 or 편집 인풋 */}
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitRename();
              if (e.key === 'Escape') { setEditValue(node.name); setIsEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm px-1 py-0 border border-indigo-300 rounded outline-none bg-white"
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

        {/* 액션 버튼 (hover 시 표시) */}
        {!isEditing && (
          <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(node.id); }}
              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-indigo-500 transition-colors text-base leading-none"
              title="하위 노드 추가"
            >+</button>
            <button
              onClick={handleDelete}
              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors"
              title="삭제"
            >×</button>
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
          forceOpenVer={forceOpenVer}
          forceCloseVer={forceCloseVer}
          onSelect={onSelect}
          onAddChild={onAddChild}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

interface TreePanelProps {
  treeData: TreeNodeData[];
  selectedId: string | null;
  forceOpenVer: number;
  forceCloseVer: number;
  onSelect: (id: string) => void;
  onAddChild: (parentId: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TreePanel({
  treeData, selectedId, forceOpenVer, forceCloseVer,
  onSelect, onAddChild, onRename, onDelete,
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
          forceOpenVer={forceOpenVer}
          forceCloseVer={forceCloseVer}
          onSelect={onSelect}
          onAddChild={onAddChild}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
