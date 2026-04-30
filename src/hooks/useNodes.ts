import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Node } from '../db/database';

export interface TreeNodeData {
  id: string;
  name: string;
  parent_id: string | null;
  body_json: object;
  children: TreeNodeData[];
}

function buildTree(nodes: Node[], parentId: string | null): TreeNodeData[] {
  return nodes
    .filter((n) => n.parent_id === parentId)
    .sort((a, b) => a.order - b.order)
    .map((n) => ({
      id: n.id,
      name: n.title,
      parent_id: n.parent_id,
      body_json: n.body_json,
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

  async function addNode(parentId: string | null, afterNodeId?: string): Promise<string> {
    const siblings = nodes
      .filter((n) => n.parent_id === parentId)
      .sort((a, b) => a.order - b.order);

    // Use actual order values (not array indices) to avoid collision after deletions
    const lastOrder = siblings.length > 0 ? siblings[siblings.length - 1].order : -1;
    let insertOrder: number;
    if (afterNodeId) {
      const afterNode = siblings.find((n) => n.id === afterNodeId);
      insertOrder = afterNode != null ? afterNode.order + 1 : lastOrder + 1;
    } else {
      insertOrder = lastOrder + 1;
    }

    const now = Date.now();
    const id = crypto.randomUUID();

    // Shift all siblings whose order >= insertOrder
    const toShift = siblings.filter((n) => n.order >= insertOrder);
    if (toShift.length > 0) {
      await db.transaction('rw', db.nodes, async () => {
        for (const n of toShift) {
          await db.nodes.update(n.id, { order: n.order + 1 });
        }
        await db.nodes.add({
          id,
          parent_id: parentId,
          subject_id: subjectId,
          order: insertOrder,
          title: '새 노드',
          body_json: {},
          is_collapsed: false,
          created_at: now,
          updated_at: now,
        });
      });
    } else {
      await db.nodes.add({
        id,
        parent_id: parentId,
        subject_id: subjectId,
        order: insertOrder,
        title: '새 노드',
        body_json: {},
        is_collapsed: false,
        created_at: now,
        updated_at: now,
      });
    }
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

  async function updateBodyJson(id: string, bodyJson: object) {
    await db.nodes.update(id, { body_json: bodyJson, updated_at: Date.now() });
  }

  // 같은 부모를 공유하는 형제들의 순서를 orderedIds 배열 기준으로 재정렬
  async function reorderSiblings(_parentId: string | null, orderedIds: string[]) {
    const now = Date.now();
    await db.transaction('rw', db.nodes, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        await db.nodes.update(orderedIds[i], { order: i, updated_at: now });
      }
    });
  }

  // 특정 노드의 상위 노드 경로를 루트 → 부모 순서로 반환
  function getAncestors(nodeId: string): Node[] {
    const result: Node[] = [];
    let current = nodes.find((n) => n.id === nodeId);
    while (current?.parent_id) {
      const parent = nodes.find((n) => n.id === current!.parent_id);
      if (!parent) break;
      result.unshift(parent);
      current = parent;
    }
    return result;
  }

  return { nodes, treeData, addNode, renameNode, deleteNode, updateBodyJson, reorderSiblings, getAncestors };
}
