import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Node } from '../db/database';

export interface TreeNodeData {
  id: string;
  name: string;
  children: TreeNodeData[];
}

function buildTree(nodes: Node[], parentId: string | null): TreeNodeData[] {
  return nodes
    .filter((n) => n.parent_id === parentId)
    .sort((a, b) => a.order - b.order)
    .map((n) => ({
      id: n.id,
      name: n.title,
      children: buildTree(nodes, n.id),
    }));
}

function collectDescendantIds(nodes: Node[], parentId: string): string[] {
  const children = nodes.filter((n) => n.parent_id === parentId);
  return children.flatMap((c) => [c.id, ...collectDescendantIds(nodes, c.id)]);
}

export function useNodes(subjectId: string) {
  const nodes = useLiveQuery(
    () => db.nodes.where('subject_id').equals(subjectId).toArray(),
    [subjectId],
  ) ?? [];

  const treeData = buildTree(nodes, null);

  async function addNode(parentId: string | null): Promise<string> {
    const siblings = nodes.filter((n) => n.parent_id === parentId);
    const now = Date.now();
    const id = crypto.randomUUID();
    await db.nodes.add({
      id,
      parent_id: parentId,
      subject_id: subjectId,
      order: siblings.length,
      title: '새 노드',
      body_json: {},
      is_collapsed: false,
      created_at: now,
      updated_at: now,
    });
    return id;
  }

  async function renameNode(id: string, title: string) {
    await db.nodes.update(id, {
      title: title.trim() || '새 노드',
      updated_at: Date.now(),
    });
  }

  async function deleteNode(id: string) {
    const allNodes = await db.nodes.where('subject_id').equals(subjectId).toArray();
    const idsToDelete = [id, ...collectDescendantIds(allNodes, id)];

    const inkPages = await db.ink_pages.where('node_id').anyOf(idsToDelete).toArray();
    const inkPageIds = inkPages.map((p) => p.id);

    await db.transaction('rw', db.nodes, db.ink_pages, db.strokes, async () => {
      if (inkPageIds.length) await db.strokes.where('ink_page_id').anyOf(inkPageIds).delete();
      await db.ink_pages.where('node_id').anyOf(idsToDelete).delete();
      await db.nodes.bulkDelete(idsToDelete);
    });
  }

  return { treeData, addNode, renameNode, deleteNode };
}
