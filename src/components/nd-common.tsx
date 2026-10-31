// ND / PFD mini-map 공통 그리기 도구 (787 FCOM 10.40 ND Symbology 참고).
import type { Scenario } from '../engine/scenario';

export const COL = {
  white: '#ffffff',
  green: '#00ff00',
  magenta: '#ff40ff',
  cyan: '#00ffff',
  amber: '#ffb000',
  gray: '#8a919c',
};

export const rad = (d: number) => (d * Math.PI) / 180;
export const pad3 = (n: number) => String(Math.round(((n % 360) + 360) % 360) || 360).padStart(3, '0');
export const relDeg = (a: number, b: number) => ((a - b + 540) % 360) - 180;

/** Boeing 4-point waypoint star */
export function starPath(cx: number, cy: number, r = 10) {
  const k = r * 0.26;
  return `M${cx} ${cy - r} Q${cx + k * 0.4} ${cy - k * 0.4} ${cx + r} ${cy} Q${cx + k * 0.4} ${cy + k * 0.4} ${cx} ${cy + r} Q${cx - k * 0.4} ${cy + k * 0.4} ${cx - r} ${cy} Q${cx - k * 0.4} ${cy - k * 0.4} ${cx} ${cy - r} Z`;
}

export function eta(sc: Scenario) {
  const m = sc.utcMin + (sc.legsNm[0] / sc.gsKt) * 60;
  const hh = String(Math.floor(m / 60) % 24).padStart(2, '0');
  const mm = String(Math.floor(m % 60)).padStart(2, '0');
  return `${hh}${mm}.${Math.floor((m % 1) * 10)}z`;
}

interface CompassProps {
  cx: number;
  cy: number;
  r: number;
  trackDeg: number;
  headingDeg: number;
  span: number; // ±deg
  labelEvery?: number;
  fontClass: string;
  inward?: boolean; // 눈금이 안쪽 (ND expanded map)
  drawArc?: boolean;
  tickScale?: number;
}

/** track-up 나침반 호: 눈금, 숫자, 기수 지시(▽), 선택 heading bug */
export function CompassArc({
  cx,
  cy,
  r,
  trackDeg,
  headingDeg,
  span,
  labelEvery = 30,
  fontClass,
  inward = true,
  drawArc = true,
  tickScale = 1,
}: CompassProps) {
  const ticks: { a: number; deg: number }[] = [];
  for (let d = Math.ceil((trackDeg - span) / 5) * 5; d <= trackDeg + span; d += 5) {
    ticks.push({ a: d - trackDeg, deg: ((d % 360) + 360) % 360 });
  }
  const P = (a: number, rr: number) => [cx + rr * Math.sin(rad(a)), cy - rr * Math.cos(rad(a))] as const;
  const dir = inward ? -1 : 1;
  const hdgA = relDeg(headingDeg, trackDeg);
  const [ax0, ay0] = P(-span, r);
  const [ax1, ay1] = P(span, r);

  return (
    <g>
      {drawArc && (
        <path
          d={`M${ax0} ${ay0} A ${r} ${r} 0 ${span > 90 ? 1 : 0} 1 ${ax1} ${ay1}`}
          fill="none"
          stroke={COL.white}
          strokeWidth={2}
        />
      )}
      {ticks.map(({ a, deg }) => {
        const len = (deg % 10 === 0 ? 16 : 8) * tickScale;
        const [x1, y1] = P(a, r);
        const [x2, y2] = P(a, r + dir * len);
        const [lx, ly] = P(a, r + dir * (len + 16 * tickScale));
        return (
          <g key={deg}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={COL.white} strokeWidth={2} />
            {deg % labelEvery === 0 && (
              <text x={lx} y={ly} className={fontClass} textAnchor="middle" dominantBaseline="central" transform={`rotate(${a} ${lx} ${ly})`}>
                {deg / 10}
              </text>
            )}
          </g>
        );
      })}
      {/* 선택 heading bug (마젠타) */}
      <g transform={`rotate(${hdgA} ${cx} ${cy})`}>
        <path
          d={`M${cx - 11 * tickScale} ${cy - r} v${-10 * tickScale} h${22 * tickScale} v${10 * tickScale} l${-5 * tickScale} 0 l${-6 * tickScale} ${8 * tickScale} l${-6 * tickScale} ${-8 * tickScale} z`}
          fill="none"
          stroke={COL.magenta}
          strokeWidth={2}
        />
      </g>
      {/* 현재 heading 지시 (▽) */}
      <g transform={`rotate(${hdgA} ${cx} ${cy})`}>
        <path
          d={`M${cx} ${cy - r - 2} l${-9 * tickScale} ${-15 * tickScale} h${18 * tickScale} z`}
          fill="none"
          stroke={COL.white}
          strokeWidth={2}
        />
      </g>
    </g>
  );
}

/** 경로(마젠타) + waypoint 별 + 이름 */
export function RouteLayer({
  sc,
  cx,
  cy,
  pxPerNm,
  fontClass,
  smallClass,
  starR = 10,
  showConstraint = true,
  maxX,
}: {
  sc: Scenario;
  cx: number;
  cy: number;
  pxPerNm: number;
  fontClass: string;
  smallClass: string;
  starR?: number;
  showConstraint?: boolean;
  maxX: number;
}) {
  const pts = sc.waypoints.map((w) => ({ ...w, px: cx + w.x * pxPerNm, py: cy - w.y * pxPerNm }));
  const d = `M${cx} ${cy} ` + pts.map((p) => `L${p.px} ${p.py}`).join(' ');
  // 이름표가 겹치면 별 위쪽으로 옮긴다
  const placed: { x: number; y: number }[] = [];
  const labelY = pts.map((p) => {
    const below = p.py + starR + 10;
    const above = p.py - starR - 34;
    const hit = (y: number) => placed.some((q) => Math.abs(q.x - p.px) < 110 && Math.abs(q.y - y) < 44);
    const y = !hit(below) ? below : !hit(above) ? above : below;
    placed.push({ x: p.px, y });
    return y;
  });
  return (
    <g>
      <path d={d} fill="none" stroke={COL.magenta} strokeWidth={2.6} strokeLinejoin="round" />
      {pts.map((p, i) => {
        const col = i === 0 ? COL.magenta : COL.white;
        const right = p.px < maxX - 120;
        const tx = p.px + (right ? starR + 6 : -(starR + 6));
        const anchor = right ? 'start' : 'end';
        return (
          <g key={p.name + i}>
            <path d={starPath(p.px, p.py, starR)} fill="none" stroke={col} strokeWidth={2} />
            <text x={tx} y={labelY[i]} className={fontClass} fill={col} textAnchor={anchor}>
              {p.name}
            </text>
            {showConstraint && i === pts.length - 1 && (
              <text x={tx} y={labelY[i] + 22} className={smallClass} textAnchor={anchor}>
                {sc.target.speedKt}/{sc.target.altFt}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

export function WindArrow({ x, y, sc, len = 30 }: { x: number; y: number; sc: Scenario; len?: number }) {
  // 기본 모양은 아래(비행기 쪽) = 정풍. 바람이 불어가는 방향으로 회전.
  const rot = sc.windDirDeg - sc.trackDeg;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <line x1={0} y1={-len / 2} x2={0} y2={len / 2 - 4} stroke={COL.white} strokeWidth={2.4} />
      <path d={`M0 ${len / 2 + 2} l-6 -10 h12 z`} fill={COL.white} />
    </g>
  );
}
