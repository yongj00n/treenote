import { useState, useEffect, useRef } from 'react';
import { db, type Stroke } from '../db/database';

export function useInkPage(nodeId: string) {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  // ref로 pageId를 즉시 접근 가능하게 유지 (비동기 타이밍 경쟁 방지)
  const pageIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    pageIdRef.current = null;

    async function init() {
      let page = await db.ink_pages
        .where('node_id').equals(nodeId)
        .filter((p) => p.page_index === 0)
        .first();
      if (!page) {
        const id = crypto.randomUUID();
        await db.ink_pages.add({ id, node_id: nodeId, page_index: 0, width: 800, height: 400 });
        page = { id, node_id: nodeId, page_index: 0, width: 800, height: 400 };
      }
      if (cancelled) return;
      pageIdRef.current = page.id;
      const s = await db.strokes.where('ink_page_id').equals(page.id).toArray();
      if (!cancelled) setStrokes(s);
    }
    init();
    return () => { cancelled = true; };
  }, [nodeId]);

  // pageId가 아직 없으면 즉석 생성 후 반환
  async function ensurePageId(): Promise<string> {
    if (pageIdRef.current) return pageIdRef.current;
    const existing = await db.ink_pages
      .where('node_id').equals(nodeId)
      .filter((p) => p.page_index === 0)
      .first();
    if (existing) {
      pageIdRef.current = existing.id;
      return existing.id;
    }
    const id = crypto.randomUUID();
    await db.ink_pages.add({ id, node_id: nodeId, page_index: 0, width: 800, height: 400 });
    pageIdRef.current = id;
    return id;
  }

  async function addStroke(points: [number, number][], color: string, size: number) {
    const pageId = await ensurePageId();
    const s: Stroke = {
      id: crypto.randomUUID(),
      ink_page_id: pageId,
      points,
      pressure: [],
      color,
      base_width: size,
      created_at: Date.now(),
    };
    await db.strokes.add(s);
    setStrokes((prev) => [...prev, s]);
  }

  async function deleteStrokes(ids: string[]) {
    if (!ids.length) return;
    await db.strokes.bulkDelete(ids);
    setStrokes((prev) => prev.filter((s) => !ids.includes(s.id)));
  }

  async function clearAll() {
    const pageId = pageIdRef.current;
    if (!pageId) return;
    await db.strokes.where('ink_page_id').equals(pageId).delete();
    setStrokes([]);
  }

  return { strokes, addStroke, deleteStrokes, clearAll };
}
