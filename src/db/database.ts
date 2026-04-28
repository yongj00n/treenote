import Dexie, { type EntityTable } from 'dexie';

// 과목 (최상위 계층)
export interface Subject {
  id: number;
  grade_level: number | null;
  name: string;
  color: string;
  order: number;
  created_at: Date;
  updated_at: Date;
}

// 트리 노드 (파트 / 챕터 / 소챕터)
// body_json: TipTap 에디터 문서 객체를 그대로 저장
export interface Node {
  id: number;
  parent_id: number | null;
  subject_id: number;
  order: number;
  title: string;
  body_json: Record<string, unknown> | null;
  is_collapsed: boolean;
  created_at: Date;
  updated_at: Date;
}

// 필기 캔버스 페이지 (노드당 여러 페이지 가능)
export interface InkPage {
  id: number;
  node_id: number;
  page_index: number;
  width: number;
  height: number;
}

// 필기 획 하나 (points는 좌표 배열, pressure는 필압 배열)
export interface Stroke {
  id: number;
  ink_page_id: number;
  points: Array<{ x: number; y: number }>;
  pressure: number[];
  color: string;
  base_width: number;
  created_at: Date;
}

const db = new Dexie('TreeNoteDB') as Dexie & {
  subjects: EntityTable<Subject, 'id'>;
  nodes: EntityTable<Node, 'id'>;
  ink_pages: EntityTable<InkPage, 'id'>;
  strokes: EntityTable<Stroke, 'id'>;
};

// 인덱스 컬럼만 선언 — 나머지 필드는 위 인터페이스가 타입을 보장
db.version(1).stores({
  subjects: '++id, order',
  nodes:    '++id, parent_id, subject_id, order',
  ink_pages: '++id, node_id, page_index',
  strokes:  '++id, ink_page_id',
});

export { db };
