// 787 PFD — FCOM 10.10.1 / 10.30.15 (HL8387–HL8389, PFD Descent Display) 배치를 따름.
// 화면 전체 하늘/땅 배경 위에 반투명 속도·고도 테이프, 오른쪽 VSI, 아래 mini-map.
import type { Scenario } from '../engine/scenario';
import { COL, CompassArc, RouteLayer, WindArrow, eta, pad3 } from './nd-common';

interface Props {
  sc: Scenario;
  vmoKt: number; // 현재 고도의 최대 속도 (VMO/MMO 중 낮은 값)
  baro: string;
}

const W = 724;
const UH = 520; // PFD 윗부분 높이
const H = 810;
const ACX = 370; // 자세계 중심
const ACY = 252;
const PX_PER_DEG = 5;

const SX0 = 128; // 속도 테이프
const SX1 = 204;
const TAPE_T = 68;
const SPD_B = 452;
const PX_PER_KT = 3.3;

const LX0 = 532; // 고도 테이프
const LX1 = 612;
const ALT_B = 444;
const PX_PER_FT = 0.46;

const VX = 618; // VSI

export default function PFD({ sc, vmoKt, baro }: Props) {
  const ias = sc.iasKt;
  const alt = sc.altitudeFt;
  const vs = sc.verticalSpeedFpm;
  const pitch = -1.5;
  const horizonY = ACY + pitch * PX_PER_DEG;

  const sy = (s: number) => ACY - (s - ias) * PX_PER_KT;
  const ay = (a: number) => ACY - (a - alt) * PX_PER_FT;

  const spdTicks: number[] = [];
  for (let s = Math.floor((ias - 70) / 10) * 10; s <= ias + 70; s += 10) if (s > 30) spdTicks.push(s);
  const altTicks: number[] = [];
  for (let a = Math.floor((alt - 600) / 100) * 100; a <= alt + 600; a += 100) altTicks.push(a);

  // 선택 속도: Mach 구간이면 .840
  const selText = sc.machPhase ? '.' + Math.round(sc.mach * 1000) : String(Math.round(ias));
  const selAlt = sc.target.altFt;
  const selAltY = Math.min(ALT_B, Math.max(TAPE_T, ay(selAlt)));

  // VSI 비선형 눈금 (FCOM: 1, 2, 6)
  const vsiOff = (v: number) => {
    const a = Math.min(Math.abs(v), 6000);
    const o = a <= 1000 ? (a / 1000) * 50 : a <= 2000 ? 50 + ((a - 1000) / 1000) * 64 : 114 + ((a - 2000) / 4000) * 26;
    return -Math.sign(v) * o;
  };

  // 롤링 숫자
  const iasR = Math.round(ias);
  const spdHi = Math.floor(iasR / 10);
  const spdLo = iasR % 10;
  const altR = Math.round(alt / 20) * 20;
  const altK = Math.floor(altR / 1000);
  const altH = Math.floor((altR % 1000) / 100);
  const alt20 = altR % 100;
  const two = (n: number) => String(((n % 100) + 100) % 100).padStart(2, '0');

  // 고도 추세 (6초 예측)
  const trendY = ACY - (vs / 10) * PX_PER_FT;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="instrument" role="img" aria-label="Primary Flight Display">
      <defs>
        <clipPath id="pfd-upper">
          <rect width={W} height={UH} />
        </clipPath>
        <clipPath id="pfd-ladder">
          <rect x={214} y={118} width={312} height={278} />
        </clipPath>
        <clipPath id="pfd-spd">
          <rect x={SX0} y={TAPE_T} width={SX1 - SX0 + 30} height={SPD_B - TAPE_T} />
        </clipPath>
        <clipPath id="pfd-alt">
          <rect x={LX0 - 20} y={TAPE_T} width={LX1 - LX0 + 20} height={ALT_B - TAPE_T} />
        </clipPath>
        <clipPath id="pfd-spdroll">
          <rect x={174} y={ACY - 26} width={22} height={52} />
        </clipPath>
        <clipPath id="pfd-altroll">
          <rect x={586} y={ACY - 28} width={36} height={56} />
        </clipPath>
        <clipPath id="pfd-vsi">
          <path d={`M${VX} ${ACY - 150} h28 l26 40 v220 l-26 40 h-28 z`} />
        </clipPath>
        <pattern id="barber" width={8} height={16} patternUnits="userSpaceOnUse">
          <rect width={8} height={8} fill="#ff0000" />
          <rect y={8} width={8} height={8} fill="#000" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill="#000" />

      {/* 하늘 / 땅 (화면 전체 폭) */}
      <g clipPath="url(#pfd-upper)">
        <rect x={-100} y={-600} width={W + 200} height={horizonY + 600} fill="#1a7fe0" />
        <rect x={-100} y={horizonY} width={W + 200} height={800} fill="#6e4410" />
        <line x1={0} x2={W} y1={horizonY} y2={horizonY} stroke={COL.white} strokeWidth={2.4} />
      </g>

      {/* 피치 사다리 */}
      <g clipPath="url(#pfd-ladder)">
        {[-30, -25, -20, -15, -10, -5, -2.5, 2.5, 5, 10, 15, 20, 25, 30].map((p) => {
          const y = horizonY - p * PX_PER_DEG;
          const half = p % 10 === 0 ? 60 : p % 5 === 0 ? 30 : 14;
          return (
            <g key={p}>
              <line x1={ACX - half} x2={ACX + half} y1={y} y2={y} stroke={COL.white} strokeWidth={2.2} />
              {p % 10 === 0 && (
                <>
                  <text x={ACX - half - 8} y={y} className="pfd s" textAnchor="end" dominantBaseline="central">
                    {Math.abs(p)}
                  </text>
                  <text x={ACX + half + 8} y={y} className="pfd s" dominantBaseline="central">
                    {Math.abs(p)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </g>

      {/* 롤 눈금 + sky pointer */}
      <g stroke={COL.white} strokeWidth={2.6}>
        {[-60, -45, -30, -20, -10, 10, 20, 30, 45, 60].map((b) => {
          const r0 = 142;
          const len = Math.abs(b) === 30 || Math.abs(b) === 60 ? 20 : 11;
          const a = (b * Math.PI) / 180;
          return (
            <line
              key={b}
              x1={ACX + r0 * Math.sin(a)}
              y1={ACY - r0 * Math.cos(a)}
              x2={ACX + (r0 + len) * Math.sin(a)}
              y2={ACY - (r0 + len) * Math.cos(a)}
            />
          );
        })}
      </g>
      <path d={`M${ACX} ${ACY - 142} l-10 -16 h20 z`} fill="none" stroke={COL.white} strokeWidth={2.4} />
      <path d={`M${ACX} ${ACY - 138} l-10 16 h20 z`} fill="none" stroke={COL.white} strokeWidth={2.4} />
      <rect x={ACX - 12} y={ACY - 118} width={24} height={6} fill="none" stroke={COL.white} strokeWidth={2.2} />

      {/* FMA */}
      <rect x={212} y={0} width={316} height={40} fill="#000" />
      {['HOLD', 'LNAV', 'VNAV SPD'].map((t, i) => (
        <text key={i} x={212 + 316 * ((i + 0.5) / 3)} y={22} className="pfd s" fill={COL.green} textAnchor="middle" dominantBaseline="central">
          {t}
        </text>
      ))}
      <line x1={212 + 316 / 3} x2={212 + 316 / 3} y1={4} y2={38} stroke={COL.white} strokeWidth={2} />
      <line x1={212 + (316 * 2) / 3} x2={212 + (316 * 2) / 3} y1={4} y2={38} stroke={COL.white} strokeWidth={2} />
      <text x={ACX} y={78} className="pfd xl" fill={COL.green} textAnchor="middle" dominantBaseline="central">
        A/P
      </text>
      <text x={248} y={106} className="pfd m" textAnchor="middle" dominantBaseline="central">
        FMC
      </text>

      {/* Flight director (마젠타) */}
      <line x1={ACX - 96} x2={ACX + 96} y1={ACY + 4} y2={ACY + 4} stroke={COL.magenta} strokeWidth={4} />
      <line x1={ACX} x2={ACX} y1={ACY - 100} y2={ACY + 100} stroke={COL.magenta} strokeWidth={4} />

      {/* 비행기 심볼 */}
      <g fill="#000" stroke={COL.white} strokeWidth={2.4}>
        <path d={`M${ACX - 118} ${ACY - 5} h76 v26 h-12 v-16 h-64 z`} />
        <path d={`M${ACX + 118} ${ACY - 5} h-76 v26 h12 v-16 h64 z`} />
        <rect x={ACX - 7} y={ACY - 7} width={14} height={14} />
      </g>

      {/* 하단 lateral NPS 표시 */}
      <rect x={270} y={472} width={200} height={28} fill="#3a3a3a" />
      <rect x={290} y={482} width={34} height={8} fill={COL.white} />
      <rect x={416} y={482} width={34} height={8} fill={COL.white} />
      <path d={`M${ACX} 474 l-9 20 h18 z`} fill={COL.magenta} />

      {/* ── 속도 테이프 ── */}
      <rect x={SX0} y={TAPE_T} width={SX1 - SX0} height={SPD_B - TAPE_T} fill="#000" fillOpacity={0.38} />
      <g clipPath="url(#pfd-spd)">
        {spdTicks.map((s) => (
          <g key={s}>
            <line x1={SX1 - 14} x2={SX1} y1={sy(s)} y2={sy(s)} stroke={COL.white} strokeWidth={2.2} />
            {s % 20 === 0 && (
              <text x={SX1 - 22} y={sy(s)} className="pfd l" textAnchor="end" dominantBaseline="central">
                {s}
              </text>
            )}
          </g>
        ))}
        {/* 최대 속도 barber pole */}
        <rect x={SX1 - 7} y={TAPE_T - 20} width={8} height={Math.max(0, sy(vmoKt) - TAPE_T + 20)} fill="url(#barber)" />
        {/* 선택 속도 버그 */}
        <path
          d={`M${SX1} ${sy(ias)} l10 -14 h16 v28 h-16 z`}
          fill="none"
          stroke={COL.magenta}
          strokeWidth={2.6}
        />
      </g>
      {/* 선택 속도 */}
      <rect x={SX0 + 4} y={22} width={SX1 - SX0 - 4} height={36} fill="#000" />
      <text x={SX1 - 6} y={41} className="pfd xl" fill={COL.magenta} textAnchor="end" dominantBaseline="central">
        {selText}
      </text>
      {/* 현재 속도 (롤링) */}
      <path
        d={`M${SX0 + 2} ${ACY - 24} h${SX1 - SX0 - 6} v12 l10 12 l-10 12 v12 h-${SX1 - SX0 - 6} z`}
        fill="#000"
        stroke={COL.white}
        strokeWidth={2.4}
      />
      <text x={174} y={ACY + 1} className="pfd xxl" textAnchor="end" dominantBaseline="central">
        {spdHi}
      </text>
      <g clipPath="url(#pfd-spdroll)">
        {[-1, 0, 1].map((k) => (
          <text key={k} x={186} y={ACY + 1 - k * 26} className="pfd xxl" textAnchor="middle" dominantBaseline="central">
            {(spdLo + k + 10) % 10}
          </text>
        ))}
      </g>
      {/* Mach */}
      <text x={SX0 + 6} y={474} className="pfd l" dominantBaseline="central">
        {sc.mach >= 0.4 ? '.' + String(Math.round(sc.mach * 1000)).padStart(3, '0') : ''}
      </text>

      {/* ── 고도 테이프 ── */}
      <rect x={LX0} y={TAPE_T} width={LX1 - LX0} height={ALT_B - TAPE_T} fill="#000" fillOpacity={0.38} />
      <g clipPath="url(#pfd-alt)">
        {altTicks.map((a) => (
          <g key={a}>
            <line x1={LX0} x2={LX0 + 14} y1={ay(a)} y2={ay(a)} stroke={COL.white} strokeWidth={2.2} />
            {a % 200 === 0 && (
              <text x={LX0 + 18} y={ay(a)} className="pfd l" dominantBaseline="central">
                {Math.floor(a / 1000)}
                <tspan className="pfd s">{String(a % 1000).padStart(3, '0')}</tspan>
              </text>
            )}
          </g>
        ))}
        {/* 선택 고도 버그 */}
        <path d={`M${LX0 - 16} ${selAltY - 16} h26 v32 h-26 v-10 l8 -6 l-8 -6 z`} fill="none" stroke={COL.magenta} strokeWidth={2.6} />
        {/* 고도 추세 (6초) */}
        <line x1={LX0 + 6} x2={LX0 + 6} y1={ACY + 30} y2={trendY} stroke={COL.green} strokeWidth={2.6} />
        <path d={`M${LX0 + 6} ${trendY + 8} l-7 -12 h14 z`} fill={COL.green} />
      </g>
      {/* 선택 고도 */}
      <rect x={LX0} y={22} width={LX1 - LX0 + 4} height={36} fill="#000" />
      <text x={LX1} y={41} className="pfd xl" fill={COL.magenta} textAnchor="end" dominantBaseline="central">
        {Math.floor(selAlt / 1000)}
        <tspan className="pfd m">{String(selAlt % 1000).padStart(3, '0')}</tspan>
      </text>
      {/* 현재 고도 (롤링) */}
      <path
        d={`M${LX0 - 10} ${ACY} l12 -14 v-12 h${LX1 - LX0 + 10} v52 h-${LX1 - LX0 + 10} v-12 z`}
        fill="#000"
        stroke={COL.white}
        strokeWidth={2.4}
      />
      <text x={572} y={ACY + 1} className="pfd xxl" textAnchor="end" dominantBaseline="central">
        {altK}
      </text>
      <text x={586} y={ACY + 2} className="pfd l" textAnchor="end" dominantBaseline="central">
        {altH}
      </text>
      <g clipPath="url(#pfd-altroll)">
        {[-1, 0, 1].map((k) => (
          <text key={k} x={604} y={ACY + 2 - k * 20} className="pfd s" textAnchor="middle" dominantBaseline="central">
            {two(alt20 + k * 20)}
          </text>
        ))}
      </g>
      <line x1={586} x2={622} y1={ACY - 12} y2={ACY - 12} stroke={COL.white} strokeWidth={1} opacity={0.5} />
      <line x1={586} x2={622} y1={ACY + 12} y2={ACY + 12} stroke={COL.white} strokeWidth={1} opacity={0.5} />
      {/* Baro */}
      <text x={LX0 + 40} y={474} className="pfd l" fill={COL.green} textAnchor="middle" dominantBaseline="central">
        {baro}
      </text>

      {/* ── VSI ── */}
      <path d={`M${VX} ${ACY - 150} h28 l26 40 v220 l-26 40 h-28 z`} fill="#000" fillOpacity={0.38} />
      {[6000, 2000, 1000, -1000, -2000, -6000].map((v) => (
        <g key={v}>
          <line x1={VX + 14} x2={VX + 24} y1={ACY + vsiOff(v)} y2={ACY + vsiOff(v)} stroke={COL.white} strokeWidth={2.2} />
          <text x={VX + 10} y={ACY + vsiOff(v)} className="pfd s" textAnchor="end" dominantBaseline="central">
            {Math.abs(v) / 1000}
          </text>
        </g>
      ))}
      {[500, -500, 1500, -1500].map((v) => (
        <line key={v} x1={VX + 18} x2={VX + 24} y1={ACY + vsiOff(v)} y2={ACY + vsiOff(v)} stroke={COL.white} strokeWidth={2} />
      ))}
      <line x1={VX + 18} x2={VX + 30} y1={ACY} y2={ACY} stroke={COL.white} strokeWidth={3} />
      <line x1={W + 10} y1={ACY} x2={VX + 24} y2={ACY + vsiOff(vs)} stroke={COL.white} strokeWidth={3.2} clipPath="url(#pfd-vsi)" />
      <text x={VX + 2} y={ACY + 176} className="pfd l" dominantBaseline="central">
        {Math.round(Math.abs(vs) / 50) * 50}
      </text>

      {/* ── Mini-map ── */}
      <MiniMap sc={sc} />
    </svg>
  );
}

function MiniMap({ sc }: { sc: Scenario }) {
  const top = UH;
  const cx = ACX;
  const cy = 742; // 비행기 위치
  const r = 186;
  const rangeNm = 20;
  const s = r / rangeNm;
  return (
    <g>
      <defs>
        <clipPath id="mm-clip">
          <rect x={0} y={top} width={W} height={H - top} />
        </clipPath>
      </defs>
      <g clipPath="url(#mm-clip)">
        <CompassArc
          cx={cx}
          cy={cy}
          r={r}
          trackDeg={sc.trackDeg}
          headingDeg={sc.headingDeg}
          span={70}
          fontClass="pfd s"
          inward
          drawArc={false}
          tickScale={0.8}
        />
        <line x1={cx} y1={cy - 14} x2={cx} y2={cy - r} stroke={COL.white} strokeWidth={2} />
        <line x1={cx - 10} x2={cx + 10} y1={cy - r / 2} y2={cy - r / 2} stroke={COL.white} strokeWidth={2} />
        <text x={cx - 16} y={cy - r / 2} className="pfd s" textAnchor="end" dominantBaseline="central">
          {rangeNm / 2}
        </text>
        <RouteLayer sc={sc} cx={cx} cy={cy} pxPerNm={s} fontClass="pfd s" smallClass="pfd xs" starR={8} showConstraint={false} maxX={W} />
      </g>
      <path d={`M${cx} ${cy} l-13 30 h26 z`} fill="none" stroke={COL.white} strokeWidth={2.4} />

      <text x={12} y={top + 24} className="pfd m" dominantBaseline="central">
        <tspan className="pfd xs">GS</tspan>
        <tspan dx={4}>{Math.round(sc.gsKt)}</tspan>
        <tspan dx={12} className="pfd xs">TAS</tspan>
        <tspan dx={4}>{Math.round(sc.tasKt)}</tspan>
      </text>
      <text x={12} y={top + 50} className="pfd m" dominantBaseline="central">
        {pad3(sc.windDirDeg)}°/ {sc.windSpdKt}
      </text>
      <WindArrow x={26} y={top + 86} sc={sc} len={30} />
      <text x={16} y={top + 150} className="pfd s" fill={COL.cyan} dominantBaseline="central">
        TERR
      </text>

      <text x={W - 12} y={top + 24} className="pfd m" fill={COL.magenta} textAnchor="end" dominantBaseline="central">
        {sc.waypoints[0].name}
      </text>
      <text x={W - 12} y={top + 50} className="pfd m" textAnchor="end" dominantBaseline="central">
        {eta(sc)}
      </text>
      <text x={W - 12} y={top + 76} className="pfd m" textAnchor="end" dominantBaseline="central">
        {sc.legsNm[0].toFixed(1)}
        <tspan className="pfd xs">NM</tspan>
      </text>

      <text x={200} y={H - 14} className="pfd s" fill={COL.magenta} dominantBaseline="central">
        <tspan className="pfd xs">SEL HDG</tspan> {pad3(sc.headingDeg)}
      </text>
      <text x={420} y={H - 14} className="pfd s" fill={COL.green} dominantBaseline="central">
        MAG
      </text>
      <text x={W - 40} y={H - 14} className="pfd s" fill={COL.green} textAnchor="end" dominantBaseline="central">
        GPS
      </text>
    </g>
  );
}
