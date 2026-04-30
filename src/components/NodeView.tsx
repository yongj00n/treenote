import { useState } from 'react';
import { db, type Subject } from '../db/database';
import { useNodes } from '../hooks/useNodes';
import { DocumentView } from './DocumentView';

interface Props {
  subject: Subject;
  onBack: () => void;
}

export function NodeView({ subject, onBack }: Props) {
  const { nodes, treeData, addNode, renameNode, deleteNode, updateBodyJson, reorderSiblings } = useNodes(subject.id);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  async function handleAddNode(parentId: string | null, afterNodeId?: string) {
    const id = await addNode(parentId, afterNodeId);
    setSelectedNodeId(id);
    setNewlyAddedId(id);
  }

  async function handleDelete(id: string) {
    if (selectedNodeId === id) setSelectedNodeId(null);
    await deleteNode(id);
  }

  function handleAddSibling(id: string) {
    const node = nodes.find((n) => n.id === id);
    handleAddNode(node?.parent_id ?? null, id);
  }

  function handleAddChild(id: string) {
    handleAddNode(id);
  }

  async function handleRenameSubject(name: string) {
    await db.subjects.update(subject.id, { name: name.trim() || subject.name, updated_at: Date.now() });
  }

  async function handleUpdateSubjectColor(color: string) {
    await db.subjects.update(subject.id, { color, updated_at: Date.now() });
  }

  return (
    <div className="h-full overflow-hidden">
      <DocumentView
        subject={subject}
        onBack={onBack}
        onAddRootNode={() => handleAddNode(null)}
        newlyAddedId={newlyAddedId}
        onClearNewlyAdded={() => setNewlyAddedId(null)}
        treeData={treeData}
        selectedId={selectedNodeId}
        onSelect={setSelectedNodeId}
        onRename={renameNode}
        onSave={updateBodyJson}
        onAddSibling={handleAddSibling}
        onAddChild={handleAddChild}
        onDelete={handleDelete}
        onReorderSiblings={reorderSiblings}
        onRenameSubject={handleRenameSubject}
        onUpdateSubjectColor={handleUpdateSubjectColor}
      />
    </div>
  );
}
