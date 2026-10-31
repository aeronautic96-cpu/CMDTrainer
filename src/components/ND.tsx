// 787 ND Expanded MAP 모드 — FCOM 10.10.31 / 10.40.4 배치를 따름 (track-up).
import type { Rules } from '../engine/rules';
import type { Scenario } from '../engine/scenario';
import { COL, CompassArc, RouteLayer, WindArrow, eta, pad3, rad } from './nd-common';
import VSD from './VSD';

interface Props {
  sc: Scenario;
  rules: Rules;
  showGreenArc: boolean;
  showVsd: boolean;
}

const W = 600;
const H = 724;
const AX = W / 2; // 비행기 위치 (삼각형 꼭짓점)
const VSD_TOP = 520; // VSD를 켜면 지도는 이 위로 줄어든다 (FCOM 10.10.36)

export default function ND({ sc, rules, showGreenArc, showVsd }: Props) {
  const AY = showVsd ? 462 : 640;
  const R = showVsd ? 372 : 540; // 최대 범위 = 나침반 호
  const mapBottom = showVsd ? VSD_TOP : H;
  const s = R / sc.ndRangeNm;

  // Green arc: 현재 V/S와 GS로 MCP 고도에 도달하는 지점
  const altLoss = sc.altitudeFt - sc.target.altFt;
  const greenNm = (altLoss / Math.abs(sc.verticalSpeedFpm)) * (sc.gsKt / 60);
  const greenR = greenNm * s;
  const arcAt = (r: number, a0: number, a1: number) =>
    `M${AX + r * Math.sin(rad(a0))} ${AY - r * Math.cos(rad(a0))} A ${r} ${r} 0 0 1 ${AX + r * Math.sin(rad(a1))} ${AY - r * Math.cos(rad(a1))}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="instrument" role="img" aria-label="Navigation Display">
      <defs>
        <clipPath id="nd-map">
          <rect x={0} y={72} width={W} height={mapBottom - 72} />
        </clipPath>
      </defs>
      <rect width={W} height={H} fill="#000" />

      {/* 좌상단: GS / TAS / RANGE, 바람 */}
      <text x={10} y={22} className="nd m" dominantBaseline="central">
        <tspan className="nd xs">GS</tspan>
        <tspan dx={3}>{Math.round(sc.gsKt)}</tspan>
        <tspan dx={10} className="nd xs">TAS</tspan>
        <tspan dx={3}>{Math.round(sc.tasKt)}</tspan>
      </text>
      <rect x={170} y={6} width={50} height={44} fill="#000" stroke={COL.white} strokeWidth={2} />
      <text x={195} y={18} className="nd xxs" textAnchor="middle" dominantBaseline="central">
        RANGE
      </text>
      <text x={195} y={37} className="nd m" textAnchor="middle" dominantBaseline="central">
        {sc.ndRangeNm}
      </text>
      <text x={10} y={48} className="nd m" dominantBaseline="central">
        {pad3(sc.windDirDeg)}°/ {sc.windSpdKt}
      </text>
      <WindArrow x={24} y={86} sc={sc} len={32} />

      {/* 상단 가운데: TRK */}
      <text x={AX - 46} y={50} className="nd s" fill={COL.green} textAnchor="end" dominantBaseline="central">
        TRK
      </text>
      <rect x={AX - 40} y={32} width={80} height={36} fill="#000" stroke={COL.white} strokeWidth={2} />
      <text x={AX} y={51} className="nd xl" textAnchor="middle" dominantBaseline="central">
        {pad3(sc.trackDeg)}
      </text>
      <text x={AX + 46} y={50} className="nd s" fill={COL.green} dominantBaseline="central">
        MAG
      </text>

      {/* 우상단: active waypoint */}
      <text x={W - 10} y={20} className="nd m" fill={COL.magenta} textAnchor="end" dominantBaseline="central">
        {sc.waypoints[0].name}
      </text>
      <text x={W - 10} y={44} className="nd m" textAnchor="end" dominantBaseline="central">
        {eta(sc)}
      </text>
      <text x={W - 10} y={68} className="nd m" textAnchor="end" dominantBaseline="central">
        {sc.legsNm[0].toFixed(1)}
        <tspan className="nd xs" dx={2}>
          NM
        </tspan>
      </text>

      <g clipPath="url(#nd-map)">
        <CompassArc cx={AX} cy={AY} r={R} trackDeg={sc.trackDeg} headingDeg={sc.headingDeg} span={showVsd ? 54 : 40} fontClass="nd l" inward />

        {/* 트랙선 + 중간 거리 눈금 */}
        <line x1={AX} y1={AY - 40} x2={AX} y2={AY - R} stroke={COL.white} strokeWidth={2} />
        <line x1={AX - 12} x2={AX + 12} y1={AY - R / 2} y2={AY - R / 2} stroke={COL.white} strokeWidth={2.2} />
        <text x={AX - 18} y={AY - R / 2} className="nd l" textAnchor="end" dominantBaseline="central">
          {sc.ndRangeNm / 2}
        </text>

        {showGreenArc && greenR > 20 && greenR < R && (
          <path d={arcAt(greenR, -14, 14)} fill="none" stroke={COL.green} strokeWidth={3} />
        )}

        <RouteLayer sc={sc} cx={AX} cy={AY} pxPerNm={s} fontClass="nd m" smallClass="nd s" maxX={W} />
      </g>

      {/* 비행기 심볼 */}
      <path d={`M${AX} ${AY} l-15 36 h30 z`} fill="none" stroke={COL.white} strokeWidth={2.6} />

      {showVsd ? (
        <>
          <text x={12} y={VSD_TOP - 18} className="nd s" fill={COL.cyan}>
            TERR
          </text>
          <VSD sc={sc} rules={rules} top={VSD_TOP} width={W} height={H} />
        </>
      ) : (
        <>
      <text x={AX - 70} y={H - 32} className="nd xs" fill={COL.green} textAnchor="middle">
        RNP
      </text>
      <text x={AX - 70} y={H - 12} className="nd s" fill={COL.green} textAnchor="middle">
        1.00
      </text>
      <text x={AX - 10} y={H - 32} className="nd xs" fill={COL.green} textAnchor="middle">
        ANP
      </text>
      <text x={AX - 10} y={H - 12} className="nd s" fill={COL.green} textAnchor="middle">
        0.04
      </text>
      <text x={AX + 90} y={H - 12} className="nd s" fill={COL.green} textAnchor="middle">
        GPS
      </text>
        </>
      )}
    </svg>
  );
}
