import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { getStroke } from 'perfect-freehand';
import { useInkPage } from '../hooks/useInkPage';

type Tool = 'pen' | 'eraser';
const ERASER_R = 16;

function toPath(points: [number, number][], size: number): string {
  if (points.length < 2) return '';
  const outline = getStroke(points, {
    size, thinning: 0, smoothing: 0.5, streamline: 0.5,
    simulatePressure: false, last: true,
  });
  if (!outline.length) return '';
  const d: string[] = [`M ${outline[0][0]} ${outline[0][1]}`];
  for (let i = 1; i < outline.length - 1; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[i + 1];
    d.push(`Q ${x0} ${y0} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`);
  }
  d.push('Z');
  return d.join(' ');
}

export interface InkCanvasHandle { clearAll: () => void; }

interface Props {
  nodeId: string;
  isActive: boolean;
  tool: Tool;
  color: string;
  size: number;
}

export const InkCanvas = forwardRef<InkCanvasHandle, Props>(
  function InkCanvas({ nodeId, isActive, tool, color, size }, ref) {
    const { strokes, addStroke, deleteStrokes, clearAll } = useInkPage(nodeId);
    const [curPts, setCurPts]       = useState<[number, number][]>([]);
    const [erasedIds, setErasedIds] = useState<Set<string>>(new Set());

    const isDrawing  = useRef(false);
    const erasedRef  = useRef<Set<string>>(new Set());
    const strokesRef = useRef(strokes);
    strokesRef.current = strokes;
    const svgRef = useRef<SVGSVGElement>(null);

    useImperativeHandle(ref, () => ({ clearAll }));

    function pt(e: React.PointerEvent<SVGSVGElement>): [number, number] {
      const r = svgRef.current!.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }

    function eraseAt([ex, ey]: [number, number]) {
      const hit = strokesRef.current
        .filter((s) => !erasedRef.current.has(s.id))
        .filter((s) => s.points.some(([px, py]) => {
          const dx = px - ex, dy = py - ey;
          return dx * dx + dy * dy < ERASER_R * ERASER_R;
        }))
        .map((s) => s.id);
      if (!hit.length) return;
      hit.forEach((id) => erasedRef.current.add(id));
      setErasedIds(new Set(erasedRef.current));
    }

    function onDown(e: React.PointerEvent<SVGSVGElement>) {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      isDrawing.current = true;
      const p = pt(e);
      if (tool === 'pen') setCurPts([p]);
      else eraseAt(p);
    }

    function onMove(e: React.PointerEvent<SVGSVGElement>) {
      if (!isDrawing.current) return;
      const p = pt(e);
      if (tool === 'pen') setCurPts((prev) => [...prev, p]);
      else eraseAt(p);
    }

    async function onUp() {
      if (!isDrawing.current) return;
      isDrawing.current = false;
      if (tool === 'pen' && curPts.length >= 2) {
        await addStroke(curPts, color, size);
      } else if (tool === 'eraser' && erasedRef.current.size > 0) {
        await deleteStrokes([...erasedRef.current]);
        erasedRef.current = new Set();
        setErasedIds(new Set());
      }
      setCurPts([]);
    }

    const curPath = toPath(curPts, size);

    return (
      <svg
        ref={svgRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          pointerEvents: isActive ? 'all' : 'none',
          cursor: isActive ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default',
          touchAction: 'none',
          overflow: 'visible',
        }}
        onPointerDown={isActive ? onDown : undefined}
        onPointerMove={isActive ? onMove : undefined}
        onPointerUp={isActive ? onUp : undefined}
        onPointerLeave={isActive ? onUp : undefined}
      >
        {strokes.map((s) =>
          erasedIds.has(s.id) ? null : (
            <path key={s.id} d={toPath(s.points, s.base_width)} fill={s.color} stroke="none"/>
          )
        )}
        {curPath && <path d={curPath} fill={color} stroke="none"/>}
      </svg>
    );
  }
);
