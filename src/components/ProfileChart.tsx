// 수직 프로파일: 필요 강하 경로 vs 현재 위치, 그리고 수정 조치 경로.
import type { Rules } from '../engine/rules';
import type { Scenario } from '../engine/scenario';
import { fmtAlt } from '../engine/grading';

const W = 760;
const H = 300;
const ML = 64;
const MR = 24;
const MT = 22;
const MB = 42;

export default function ProfileChart({ sc, rules }: { sc: Scenario; rules: Rules }) {
  const e = sc.thumb;
  const base = e.altNm + e.decelNm;
  const windFactor = base > 0 ? e.requiredNm / base : 1;
  const decelW = e.decelNm * windFactor;
  const nmPer1000 = rules.nmPer1000ft * windFactor;
  const tAlt = sc.target.altFt;

  const D = Math.ceil((Math.max(sc.trackMilesNm, e.requiredNm) + 8) / 10) * 10;
  const topAlt = Math.ceil((sc.altitudeFt + 3000) / 5000) * 5000;
  const botAlt = Math.max(0, Math.floor((tAlt - 3000) / 5000) * 5000);

  const x = (d: number) => ML + ((D - d) / D) * (W - ML - MR); // d = 목표까지 남은 거리
  const y = (a: number) => MT + ((topAlt - a) / (topAlt - botAlt)) * (H - MT - MB);
  const profileD = (alt: number) => decelW + ((alt - tAlt) / 1000) * nmPer1000;

  const ideal = [
    [0, tAlt],
    [decelW, tAlt],
    [e.requiredNm, sc.altitudeFt],
  ];
  const idealPath = ideal.map(([d, a], i) => `${i ? 'L' : 'M'}${x(d)} ${y(a)}`).join(' ');

  const acX = x(sc.trackMilesNm);
  const acY = y(sc.altitudeFt);

  let fix: { path: string; label: string; color: string } | null = null;
  if (e.state === 'HIGH') {
    const rAlt = e.manage.retractAltFt ?? tAlt;
    const rD = Math.min(profileD(rAlt), sc.trackMilesNm);
    fix = {
      path: `M${acX} ${acY} L${x(rD)} ${y(rAlt)}`,
      label: `SB → ${fmtAlt(rAlt)}`,
      color: 'var(--coral)',
    };
  } else if (e.state === 'LOW') {
    fix = {
      path: `M${acX} ${acY} L${x(e.requiredNm)} ${acY}`,
      label: `강하 지연 ${e.manage.delayNm!.toFixed(0)} NM`,
      color: 'var(--ok)',
    };
  }

  const distTicks = Array.from({ length: D / 10 + 1 }, (_, i) => i * 10);
  const altTicks: number[] = [];
  for (let a = botAlt; a <= topAlt; a += 5000) altTicks.push(a);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="profile" role="img" aria-label="Vertical profile">
      <rect x={ML} y={MT} width={W - ML - MR} height={H - MT - MB} fill="var(--chart-bg)" />
      {altTicks.map((a) => (
        <g key={a}>
          <line x1={ML} x2={W - MR} y1={y(a)} y2={y(a)} stroke="var(--grid)" />
          <text x={ML - 8} y={y(a) + 4} className="axis" textAnchor="end">{a === 0 ? '0' : fmtAlt(a)}</text>
        </g>
      ))}
      {distTicks.map((d) => (
        <g key={d}>
          <line x1={x(d)} x2={x(d)} y1={MT} y2={H - MB} stroke="var(--grid)" />
          <text x={x(d)} y={H - MB + 18} className="axis" textAnchor="middle">{d}</text>
        </g>
      ))}
      <text x={W - MR} y={H - 6} className="axis" textAnchor="end">목표 지점까지 거리 (NM)</text>

      {/* 필요 프로파일 */}
      <path d={idealPath} fill="none" stroke="var(--profile)" strokeWidth={2.5} strokeDasharray="8 5" />
      <line x1={x(e.requiredNm)} x2={x(D)} y1={y(sc.altitudeFt)} y2={y(sc.altitudeFt)} stroke="var(--profile)" strokeOpacity={0.35} strokeWidth={2} />
      <text x={x(e.requiredNm)} y={y(sc.altitudeFt) - 10} className="lbl" textAnchor="middle" fill="var(--profile)">
        필요 {e.requiredNm.toFixed(1)} NM
      </text>
      {decelW > 0.5 && (
        <text x={x(decelW / 2)} y={y(tAlt) - 8} className="lbl" textAnchor="middle" fill="var(--profile)">감속</text>
      )}

      {/* 목표 */}
      <circle cx={x(0)} cy={y(tAlt)} r={5} fill="var(--profile)" />
      <text x={x(0) - 8} y={y(tAlt) + 20} className="lbl" textAnchor="end">
        {sc.target.name} {sc.target.altFt}/{sc.target.speedKt}
      </text>

      {/* 수정 경로 */}
      {fix && (
        <g>
          <path d={fix.path} stroke={fix.color} strokeWidth={3} fill="none" />
          <text x={acX + 12} y={acY + 30} className="lbl" fill={fix.color}>{fix.label}</text>
        </g>
      )}

      {/* 현재 위치 */}
      <line x1={acX} x2={acX} y1={acY} y2={H - MB} stroke="var(--coral)" strokeDasharray="3 3" />
      <image href={`${import.meta.env.BASE_URL}aircraft/side.webp`} x={acX - 48} y={acY - 20} width={96} height={48} className="ac-img" />
      <circle cx={acX} cy={acY} r={4} fill="var(--coral)" />
      <text x={acX} y={H - MB + 32} className="lbl" textAnchor="middle" fill="var(--coral)">
        현재 {sc.trackMilesNm.toFixed(1)} NM
      </text>
    </svg>
  );
}
