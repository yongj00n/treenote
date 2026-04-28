import Dexie, { type EntityTable } from 'dexie';

export type GradeLevel = 'ELEMENTARY' | 'MIDDLE' | 'HIGH' | 'UNIV' | 'OTHER';

export const GRADE_LEVEL_LABELS: Record<GradeLevel, string> = {
  ELEMENTARY: '초등',
  MIDDLE: '중등',
  HIGH: '고등',
  UNIV: '대학',
  OTHER: '기타',
};

// 사이드바 그룹 표시 순서
export const GRADE_LEVEL_ORDER: GradeLevel[] = [
  'ELEMENTARY', 'MIDDLE', 'HIGH', 'UNIV', 'OTHER',
];

export interface Subject {
  id: string;
  grade_level: GradeLevel | null;
  name: string;
  color: string;
  order: number;
  created_at: number;
  updated_at: number;
}

export interface Node {
  id: string;
  parent_id: string | null;
  subject_id: string;
  order: number;
  title: string;
  body_json: object;
  is_collapsed: boolean;
  created_at: number;
  updated_at: number;
}

export interface InkPage {
  id: string;
  node_id: string;
  page_index: number;
  width: number;
  height: number;
}

export interface Stroke {
  id: string;
  ink_page_id: string;
  points: Array<[number, number]>;
  pressure: number[];
  color: string;
  base_width: number;
  created_at: number;
}

const db = new Dexie('TreeNoteDB') as Dexie & {
  subjects: EntityTable<Subject, 'id'>;
  nodes: EntityTable<Node, 'id'>;
  ink_pages: EntityTable<InkPage, 'id'>;
  strokes: EntityTable<Stroke, 'id'>;
};

db.version(1).stores({
  subjects:  'id, order',
  nodes:     'id, parent_id, subject_id, order',
  ink_pages: 'id, node_id, page_index',
  strokes:   'id, ink_page_id',
});

export { db };
