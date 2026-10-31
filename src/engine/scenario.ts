import { casToMach, casToTas } from './atmosphere';
import { computePrecise, computeThumb, type EnergyResult } from './energy';
import { crossover, rodFor, scheduleCas, type Rules } from './rules';

export type ScenarioType = 'TEN_K' | 'APPROACH';

export interface Waypoint {
  name: string;
  x: number; // NM, 오른쪽 +
  y: number; // NM, 현재 트랙 방향 +
}

export interface Scenario {
  seed: number;
  type: ScenarioType;
  altitudeFt: number;
  iasKt: number;
  mach: number;
  tasKt: number;
  gsKt: number;
  trackDeg: number;
  headingDeg: number;
  windDirDeg: number;
  windSpdKt: number;
  windComponentKt: number;
  verticalSpeedFpm: number;
  target: { name: string; altFt: number; speedKt: number };
  waypoints: Waypoint[]; // 마지막 = 목표 지점
  legsNm: number[];
  trackMilesNm: number;
  ndRangeNm: number;
  utcMin: number; // 현재 UTC (분)
  machPhase: boolean; // crossover 위 (Mach 유지)
  thumb: EnergyResult; // 훈련 기본 (rule of thumb)
  precise: EnergyResult; // 비교용 정밀 계산
}

/** 시드 기반 난수 (같은 시드 = 같은 문제). */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ND_RANGES = [10, 20, 40, 80, 160];
const CONS = 'BDGKLMNPRSTVZ';
const VOWS = 'AEIOU';
const toRad = (d: number) => (d * Math.PI) / 180;
const norm360 = (d: number) => ((d % 360) + 360) % 360;

function waypointName(rnd: () => number): string {
  const c = () => CONS[Math.floor(rnd() * CONS.length)];
  const v = () => VOWS[Math.floor(rnd() * VOWS.length)];
  return c() + v() + c() + v() + c();
}

function buildRoute(rnd: () => number, totalNm: number) {
  const legCount = totalNm < 30 ? 2 : 2 + Math.floor(rnd() * 3); // 2~4개 구간
  const weights = Array.from({ length: legCount }, () => 0.8 + rnd()); // 너무 짧은 구간 방지
  const sum = weights.reduce((a, b) => a + b, 0);
  const legsNm = weights.map((w) => Math.round(((w / sum) * totalNm) * 10) / 10);
  legsNm[legsNm.length - 1] = Math.round((totalNm - legsNm.slice(0, -1).reduce((a, b) => a + b, 0)) * 10) / 10;

  const pts: Waypoint[] = [];
  let x = 0;
  let y = 0;
  let hdg = 0; // 첫 구간은 현재 트랙 방향 (active waypoint를 향함)
  legsNm.forEach((len, i) => {
    if (i > 0) {
      const turn = (20 + rnd() * 70) * (rnd() < 0.5 ? -1 : 1);
      hdg = Math.max(-150, Math.min(150, hdg + turn));
    }
    x += len * Math.sin(toRad(hdg));
    y += len * Math.cos(toRad(hdg));
    pts.push({ name: waypointName(rnd), x, y });
  });
  return { pts, legsNm };
}

function fitRange(pts: Waypoint[]): number | null {
  for (const r of ND_RANGES) {
    const ok = pts.every((p) => p.y <= r * 0.92 && p.y >= -r * 0.08 && Math.abs(p.x) <= r * 0.42 && Math.hypot(p.x, p.y) <= r * 0.95);
    if (ok) return r;
  }
  return null;
}

export function generateScenario(seed: number, rules: Rules): Scenario {
  const rnd = mulberry32(seed);
  
  const type: ScenarioType = rnd() < 0.55 ? 'TEN_K' : 'APPROACH';
  const altitudeFt =
    type === 'TEN_K'
      ? 15000 + Math.floor(rnd() * 25) * 1000 // 15,000~39,000
      : 6000 + Math.floor(rnd() * 13) * 1000; // 6,000~18,000
  let target: Scenario['target'] =
    type === 'TEN_K'
      ? { name: '', altFt: rules.speedLimitAltFt, speedKt: rules.speedLimitKt }
      : { name: '', altFt: 3000, speedKt: rules.flapsUpSpeedKt };

  // 강하 속도 계획: crossover 위 M.84, 아래 280 kt, 10,000 ft 이하 250 kt
  const xo = crossover(rules);
  const machPhase = altitudeFt >= xo;
  const iasKt = Math.round(scheduleCas(altitudeFt, rules));

  const trackDeg = Math.floor(rnd() * 36) * 10 + Math.floor(rnd() * 10);
  const windDirDeg = Math.floor(rnd() * 36) * 10;
  const windSpdKt = 5 + Math.floor(rnd() * 12) * 5; // 5~60 kt
  const windComponentKt = Math.round(-windSpdKt * Math.cos(toRad(windDirDeg - trackDeg)));
  const crossKt = windSpdKt * Math.sin(toRad(windDirDeg - trackDeg));

  const tasKt = casToTas(iasKt, altitudeFt);
  const mach = casToMach(iasKt, altitudeFt);
  const gsKt = tasKt + windComponentKt;
  const driftDeg = (Math.asin(Math.max(-1, Math.min(1, crossKt / tasKt))) * 180) / Math.PI;
  const headingDeg = norm360(trackDeg + driftDeg);

  // 먼저 필요 거리를 구하고, 원하는 에너지 상태가 되도록 남은 거리를 정한다.
  const base = { altitudeFt, iasKt, targetAltFt: target.altFt, targetSpeedKt: target.speedKt, windComponentKt };
  const required = computeThumb({ ...base, trackMilesNm: 0 }, rules).requiredNm;
  const roll = rnd();
  const tol = rules.onProfileToleranceNm;
  const delta =
    roll < 0.45
      ? -(tol + 2 + rnd() * 20) // 에너지 많음
      : roll < 0.7
        ? (rnd() * 2 - 1) * (tol * 0.6) // 적정
        : tol + 2 + rnd() * 15; // 에너지 부족

  let trackMilesNm = Math.max(12, Math.round((required + delta) * 10) / 10);

  let route = buildRoute(rnd, trackMilesNm);
  let ndRangeNm = fitRange(route.pts);
  for (let i = 0; i < 40 && ndRangeNm === null; i++) {
    route = buildRoute(rnd, trackMilesNm);
    ndRangeNm = fitRange(route.pts);
  }
  if (ndRangeNm === null) {
    // 거의 직선 경로로 대체
    route = { pts: [{ name: waypointName(rnd), x: 0, y: trackMilesNm }], legsNm: [trackMilesNm] };
    ndRangeNm = ND_RANGES.find((r) => trackMilesNm <= r * 0.95) ?? 160;
  }
  trackMilesNm = Math.round(route.legsNm.reduce((a, b) => a + b, 0) * 10) / 10;
  target = { ...target, name: route.pts[route.pts.length - 1].name };

  const thumb = computeThumb({ ...base, trackMilesNm }, rules);
  const precise = computePrecise({ ...base, trackMilesNm }, rules);

  return {
    seed,
    type,
    altitudeFt,
    iasKt,
    mach,
    tasKt,
    gsKt,
    trackDeg,
    headingDeg,
    windDirDeg,
    windSpdKt,
    windComponentKt,
    verticalSpeedFpm: -Math.round(rodFor(iasKt, rules, machPhase).clean / 50) * 50,
    target,
    waypoints: route.pts,
    legsNm: route.legsNm,
    trackMilesNm,
    ndRangeNm,
    utcMin: Math.floor(rnd() * 24 * 60),
    machPhase,
    thumb,
    precise,
  };
}
