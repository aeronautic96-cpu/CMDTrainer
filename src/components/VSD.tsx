// 787 Vertical Situation Display — FCOM 10.10.36~39 (route mode).
// ND 아래쪽에 그린다. 가로축 = 경로를 따라 간 거리 (ND 범위와 같음), 세로축 = 고도.
import type { Rules } from '../engine/rules';
import { mulberry32, type Scenario } from '../engine/scenario';
import { COL } from './nd-common';

interface Props {
  sc: Scenario;
  rules: Rules;
  top: number; // VSD 영역 위쪽 y
  width: number;
  height: number; // VSD 영역 아래쪽 y
}

const SCALE_W = 92; // 왼쪽 고도 눈금 칸
const STEPS = [1000, 2000, 4000, 8000, 10000, 15000];

export default function VSD({ sc, rules, top, width, height }: Props) {
  const x0 = 132; // 비행기 위치
  const xR = width - 14; // ND 범위 끝
  const yTop = top + 34; // 눈금 최상단
  const yBot = height - 30; // 0 ft
  const range = sc.ndRangeNm;

  const step = STEPS.find((s) => s * 3 >= sc.altitudeFt + 1500) ?? 15000;
  const altMax = step * 3;
  const X = (nm: number) => x0 + (nm / range) * (xR - x0);
  const Y = (ft: number) => yBot - (ft / altMax) * (yBot - yTop);

  // 경로 누적 거리
  const cum: number[] = [];
  sc.legsNm.reduce((s, l, i) => ((cum[i] = s + l), s + l), 0);

  // VNAV 경로 (idle 강하 경로를 목표 지점에서 거꾸로 만든 것) — rule of thumb 프로파일
  const e = sc.thumb;
  const base = e.altNm + e.decelNm;
  const k = base > 0 ? e.requiredNm / base : 1; // 바람 보정 배율
  const decelW = e.decelNm * k;
  const nmPer1000 = rules.nmPer1000ft * k;
  const pathAlt = (distFromAc: number) => {
    const rem = sc.trackMilesNm - distFromAc;
    if (rem <= decelW) return sc.target.altFt;
    return sc.target.altFt + ((rem - decelW) / nmPer1000) * 1000;
  };
  const pathPts: string[] = [];
  for (let d = 0; d <= Math.min(range, sc.trackMilesNm); d += range / 120) {
    pathPts.push(`${X(d)} ${Y(Math.min(pathAlt(d), altMax * 1.2))}`);
  }
  pathPts.push(`${X(Math.min(range, sc.trackMilesNm))} ${Y(pathAlt(Math.min(range, sc.trackMilesNm)))}`);

  // Vertical flight path vector: 길이는 VSD 범위의 절반
  const vecNm = range / 2;
  const vecAlt = sc.altitudeFt + (sc.verticalSpeedFpm / (sc.gsKt / 60)) * vecNm;
  const acY = Y(sc.altitudeFt);

  // 지형 (시드 기반)
  const rnd = mulberry32(sc.seed + 77);
  const terr: string[] = [`M${x0 - 40} ${yBot}`];
  let h = 300 + rnd() * 600;
  for (let i = 0; i <= 60; i++) {
    h = Math.max(0, Math.min(2500, h + (rnd() - 0.5) * 500));
    terr.push(`L${x0 - 40 + (i / 60) * (xR - x0 + 54)} ${Math.min(yBot, Y(h))}`);
  }
  terr.push(`L${xR + 14} ${yBot + 30} L${x0 - 40} ${yBot + 30} Z`);

  const selY = Y(sc.target.altFt);
  const labels = [0, step, step * 2, step * 3];
  const big = (ft: number) => (ft === 0 ? '' : String(Math.floor(ft / 1000)));
  const small = (ft: number) => String(ft % 1000).padStart(3, '0');

  return (
    <g>
      <defs>
        <clipPath id="vsd-plot">
          <rect x={SCALE_W} y={top + 4} width={width - SCALE_W} height={height - top - 26} />
        </clipPath>
      </defs>
      <line x1={0} x2={width} y1={top} y2={top} stroke={COL.white} strokeWidth={2} />

      {/* 고도 눈금 */}
      <rect x={0} y={top + 2} width={SCALE_W} height={height - top - 2} fill="#3c4048" />
      {labels.map((ft) => (
        <g key={ft}>
          <line x1={SCALE_W - 12} x2={SCALE_W} y1={Y(ft)} y2={Y(ft)} stroke={COL.white} strokeWidth={2} />
          <text x={SCALE_W - 14} y={Y(ft)} className="nd m" textAnchor="end" dominantBaseline="central">
            {big(ft)}
            <tspan className="nd xs">{small(ft)}</tspan>
          </text>
        </g>
      ))}
      {/* MCP 선택 고도 */}
      <text x={8} y={top + 16} className="nd m" fill={COL.magenta} dominantBaseline="central">
        {big(sc.target.altFt)}
        <tspan className="nd xs">{small(sc.target.altFt)}</tspan>
      </text>

      <g clipPath="url(#vsd-plot)">
        {/* 지형 */}
        <path d={terr.join(' ')} fill="#00c000" />

        {/* waypoint 기준선 */}
        {sc.waypoints.map((w, i) => {
          if (cum[i] > range) return null;
          const x = X(cum[i]);
          const isTarget = i === sc.waypoints.length - 1;
          const col = i === 0 ? COL.magenta : COL.white;
          return (
            <g key={w.name + i}>
              <line x1={x} x2={x} y1={top + 44} y2={yBot} stroke={COL.white} strokeWidth={1.6} strokeDasharray="7 6" />
              <text x={x} y={top + 16} className="nd s" fill={col} textAnchor="middle" dominantBaseline="central">
                {w.name}
              </text>
              {isTarget && (
                <>
                  <text x={x} y={top + 36} className="nd xs" textAnchor="middle" dominantBaseline="central">
                    {sc.target.altFt}
                  </text>
                  {/* AT 제한: 위/아래 삼각형 */}
                  <path d={`M${x - 8} ${selY - 14} h16 l-8 12 z M${x - 8} ${selY + 14} h16 l-8 -12 z`} fill="none" stroke={COL.white} strokeWidth={1.8} />
                </>
              )}
            </g>
          );
        })}

        {/* 선택 고도 선 */}
        <line x1={SCALE_W} x2={width} y1={selY} y2={selY} stroke={COL.magenta} strokeWidth={2} strokeDasharray="12 8" />

        {/* VNAV 경로 */}
        <path d={'M' + pathPts.join(' L')} fill="none" stroke={COL.magenta} strokeWidth={2.6} />

        {/* Vertical flight path vector */}
        <line x1={x0} y1={acY} x2={X(vecNm)} y2={Y(vecAlt)} stroke={COL.white} strokeWidth={2.4} />

        {/* 비행기 심볼: 아래 변 = 고도, 꼭짓점 = 위치 */}
        <path d={`M${x0} ${acY} h-34 v-20 z`} fill="none" stroke={COL.white} strokeWidth={2.4} />
      </g>
      {/* 선택 고도 버그 */}
      <path d={`M${SCALE_W} ${selY} l8 -9 v18 z`} fill={COL.magenta} />

      {/* 거리 눈금 */}
      {[0, range / 2, range].map((d) => (
        <g key={d}>
          <line x1={X(d)} x2={X(d)} y1={yBot + 4} y2={yBot + 12} stroke={COL.white} strokeWidth={2} />
          <text x={Math.min(X(d), width - 22)} y={height - 9} className="nd s" textAnchor="middle">
            {d}
          </text>
        </g>
      ))}
    </g>
  );
}
