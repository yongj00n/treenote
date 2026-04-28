import { useState } from 'react';
import { type Subject } from '../db/database';
import { useNodes } from '../hooks/useNodes';
import { TreePanel } from './TreePanel';

interface Props {
  subject: Subject;
  onBack: () => void;
}

export function NodeView({ subject, onBack }: Props) {
  const { treeData, addNode, renameNode, deleteNode } = useNodes(subject.id);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [forceOpenVer, setForceOpenVer] = useState(0);
  const [forceCloseVer, setForceCloseVer] = useState(0);

  async function handleAddRoot() {
    const id = await addNode(null);
    setSelectedNodeId(id);
  }

  async function handleAddChild(parentId: string) {
    const id = await addNode(parentId);
    setSelectedNodeId(id);
  }

  async function handleDelete(id: string) {
    if (selectedNodeId === id) setSelectedNodeId(null);
    await deleteNode(id);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* ── 왼쪽: 노드 트리 패널 ── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-gray-200 bg-gray-50">

        {/* 헤더: 뒤로가기 + 과목명 */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-gray-700 transition-colors text-lg leading-none"
            title="과목 목록으로"
          >
            ←
          </button>
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: subject.color }}
          />
          <span className="font-semibold text-gray-800 text-sm truncate flex-1">
            {subject.name}
          </span>
        </div>

        {/* 전체 펼침 / 전체 접힘 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setForceOpenVer((v) => v + 1)}
            className="flex-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 py-1.5 transition-colors"
          >
            전체 펼침
          </button>
          <div className="w-px bg-gray-200" />
          <button
            onClick={() => setForceCloseVer((v) => v + 1)}
            className="flex-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 py-1.5 transition-colors"
          >
            전체 접힘
          </button>
        </div>

        {/* 트리 */}
        <TreePanel
          treeData={treeData}
          selectedId={selectedNodeId}
          forceOpenVer={forceOpenVer}
          forceCloseVer={forceCloseVer}
          onSelect={setSelectedNodeId}
          onAddChild={handleAddChild}
          onRename={renameNode}
          onDelete={handleDelete}
        />

        {/* 루트 노드 추가 버튼 */}
        <div className="p-2 border-t border-gray-200">
          <button
            onClick={handleAddRoot}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors"
          >
            <span className="text-base leading-none">+</span>
            노드 추가
          </button>
        </div>
      </div>

      {/* ── 오른쪽: 콘텐츠 패널 ── */}
      <main className="flex-1 overflow-y-auto flex items-center justify-center">
        {selectedNodeId ? (
          <div className="text-center space-y-2 text-gray-400">
            <p className="text-4xl">📝</p>
            <p className="text-sm">Week 4에서 리치 텍스트 에디터가 들어올 자리입니다</p>
          </div>
        ) : (
          <div className="text-center space-y-2">
            <p className="text-3xl">👈</p>
            <p className="text-gray-500 text-sm">왼쪽에서 노드를 선택하세요</p>
          </div>
        )}
      </main>
    </div>
  );
}
