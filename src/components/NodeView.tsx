import { useState, Fragment } from 'react';
import { type Subject } from '../db/database';
import { useNodes } from '../hooks/useNodes';
import { TreePanel } from './TreePanel';
import { Editor } from './Editor';

interface Props {
  subject: Subject;
  onBack: () => void;
}

export function NodeView({ subject, onBack }: Props) {
  const { nodes, treeData, addNode, renameNode, deleteNode, updateBodyJson, getAncestors } = useNodes(subject.id);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [forceOpenVer, setForceOpenVer] = useState(0);
  const [forceCloseVer, setForceCloseVer] = useState(0);

  // 노드 추가 공통 핸들러 — 추가 후 즉시 편집 상태로
  async function handleAddNode(parentId: string | null) {
    const id = await addNode(parentId);
    setSelectedNodeId(id);
    setNewlyAddedId(id);
  }

  async function handleDelete(id: string) {
    if (selectedNodeId === id) setSelectedNodeId(null);
    await deleteNode(id);
  }

  // 현재 선택된 노드 정보
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const ancestors = selectedNodeId ? getAncestors(selectedNodeId) : [];

  return (
    <div className="flex h-screen overflow-hidden bg-white">

      {/* ── 왼쪽: 트리 패널 ── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-gray-200 bg-gray-50">

        {/* 과목 헤더 */}
        <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-200">
          <button
            onClick={onBack}
            title="과목 목록으로"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400
              hover:text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition-colors text-base"
          >
            ←
          </button>
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
          <span className="font-semibold text-gray-800 text-sm truncate flex-1">{subject.name}</span>
        </div>

        {/* 전체 펼침 / 접힘 */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setForceOpenVer((v) => v + 1)}
            className="flex-1 text-xs text-gray-500 py-1.5
              hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            전체 펼침
          </button>
          <div className="w-px bg-gray-200" />
          <button
            onClick={() => setForceCloseVer((v) => v + 1)}
            className="flex-1 text-xs text-gray-500 py-1.5
              hover:text-gray-800 hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            전체 접힘
          </button>
        </div>

        {/* 트리 */}
        <TreePanel
          treeData={treeData}
          selectedId={selectedNodeId}
          newlyAddedId={newlyAddedId}
          forceOpenVer={forceOpenVer}
          forceCloseVer={forceCloseVer}
          onSelect={setSelectedNodeId}
          onAddChild={(parentId) => handleAddNode(parentId)}
          onRename={renameNode}
          onDelete={handleDelete}
          onClearNewlyAdded={() => setNewlyAddedId(null)}
        />

        {/* 루트 노드 추가 */}
        <div className="p-2 border-t border-gray-200">
          <button
            onClick={() => handleAddNode(null)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg
              border-2 border-dashed border-gray-300 text-sm text-gray-400
              hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50
              active:bg-indigo-100 active:border-indigo-500
              transition-colors"
          >
            <span className="text-base leading-none font-bold">+</span>
            노드 추가
          </button>
        </div>
      </div>

      {/* ── 오른쪽: 콘텐츠 패널 ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {selectedNode ? (
          <>
            {/* 경로(브레드크럼) + 노드 제목 + 빠른 노드 추가 */}
            <div className="border-b border-gray-100 px-6 py-4 shrink-0">
              {/* 브레드크럼: 과목 › 상위노드... › 현재노드 */}
              <div className="flex items-center gap-1 text-xs flex-wrap mb-2">
                <button
                  onClick={onBack}
                  className="font-medium hover:underline transition-colors"
                  style={{ color: subject.color }}
                >
                  {subject.name}
                </button>
                {ancestors.map((a) => (
                  <Fragment key={a.id}>
                    <span className="text-gray-300">›</span>
                    <button
                      onClick={() => setSelectedNodeId(a.id)}
                      className="text-gray-400 hover:text-gray-700 hover:underline transition-colors"
                    >
                      {a.title}
                    </button>
                  </Fragment>
                ))}
                <span className="text-gray-300">›</span>
                <span className="text-gray-600 font-medium">{selectedNode.title}</span>
              </div>

              {/* 노드 제목 + 빠른 추가 버튼 */}
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-gray-800 truncate">{selectedNode.title}</h2>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleAddNode(selectedNode.parent_id)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500
                      hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50
                      active:bg-indigo-100 active:border-indigo-400
                      transition-colors"
                  >
                    + 형제 노드
                  </button>
                  <button
                    onClick={() => handleAddNode(selectedNode.id)}
                    className="text-xs px-3 py-1.5 rounded-lg
                      bg-indigo-50 border border-indigo-200 text-indigo-600
                      hover:bg-indigo-100 hover:border-indigo-400
                      active:bg-indigo-200
                      transition-colors"
                  >
                    + 하위 노드
                  </button>
                </div>
              </div>
            </div>

            {/* 본문 에디터 — 노드가 바뀔 때마다 key로 완전 리셋 */}
            <div className="flex-1 overflow-hidden">
              <Editor
                key={selectedNode.id}
                initialContent={selectedNode.body_json as object}
                onSave={(json) => updateBodyJson(selectedNode.id, json)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            {treeData.length === 0 ? (
              <div className="text-center space-y-3">
                <p className="text-3xl">🌱</p>
                <p className="text-gray-600 font-medium">아직 노드가 없어요</p>
                <p className="text-sm text-gray-400">왼쪽 아래 <strong>노드 추가</strong> 버튼으로 시작하세요</p>
              </div>
            ) : (
              <div className="text-center space-y-2">
                <p className="text-3xl">👈</p>
                <p className="text-gray-500 text-sm">왼쪽에서 노드를 선택하세요</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
