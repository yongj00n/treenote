import { useLiveQuery } from 'dexie-react-hooks';
import { db, type GradeLevel, type Subject } from '../db/database';

export function useSubjects() {
  const subjects = useLiveQuery(
    () => db.subjects.orderBy('order').toArray(),
    [],
  ) ?? [];

  async function addSubject(data: {
    name: string;
    grade_level: GradeLevel | null;
    color: string;
  }) {
    const now = Date.now();
    const count = await db.subjects.count();
    await db.subjects.add({
      id: crypto.randomUUID(),
      name: data.name,
      grade_level: data.grade_level,
      color: data.color,
      order: count,
      created_at: now,
      updated_at: now,
    });
  }

  async function deleteSubject(id: string) {
    // 과목에 딸린 노드·필기 페이지·획을 함께 삭제
    const nodes = await db.nodes.where('subject_id').equals(id).toArray();
    const nodeIds = nodes.map((n) => n.id);
    const inkPages = nodeIds.length
      ? await db.ink_pages.where('node_id').anyOf(nodeIds).toArray()
      : [];
    const inkPageIds = inkPages.map((p) => p.id);

    await db.transaction('rw', db.subjects, db.nodes, db.ink_pages, db.strokes, async () => {
      if (inkPageIds.length) await db.strokes.where('ink_page_id').anyOf(inkPageIds).delete();
      if (nodeIds.length)   await db.ink_pages.where('node_id').anyOf(nodeIds).delete();
      if (nodeIds.length)   await db.nodes.where('subject_id').equals(id).delete();
      await db.subjects.delete(id);
    });
  }

  return { subjects, addSubject, deleteSubject };
}

export type { Subject };
