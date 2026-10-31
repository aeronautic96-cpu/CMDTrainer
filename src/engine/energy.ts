// 에너지 계산. 순서: ① 고도·속도를 거리로 환산 → ② 남은 거리 → ③ ± 판단 → ④ manage.
// computeThumb = 훈련 기본 (rule of thumb), computePrecise = FCTM 표 + ISA 기반 비교용.
import { casToTas } from './atmosphere';
import { crossover, rodFor, scheduleCas, type Rules } from './rules';

export type EnergyState = 'HIGH' | 'ON' | 'LOW';

export interface EnergyInput {
  altitudeFt: number;
  iasKt: number; // 현재 CAS
  targetAltFt: number;
  targetSpeedKt: number;
  windComponentKt: number; // + 배풍 / − 정풍
  trackMilesNm: number; // 목표 지점까지 남은 경로 거리
}

export interface DecelPart {
  fromKt: number;
  toKt: number;
  nm: number;
}

export interface Manage {
  kind: 'SB' | 'SB_DECEL' | 'SB_INSUFFICIENT' | 'HOLD' | 'DELAY';
  sbFt?: number; // SB로 내려갈 고도
  retractAltFt?: number; // SB 해제 고도
  sbRecoveredNm?: number; // 강하 중 SB 회수 거리
  decelSavingNm?: number; // 감속 중 SB 회수 거리
  delayNm?: number; // 강하를 늦출 거리
  per1000Nm?: number; // SB 1,000 ft당 회수 거리
}

export interface EnergyResult {
  altLossFt: number;
  altNm: number;
  decelFromKt: number;
  decelParts: DecelPart[];
  decelNm: number;
  windNm: number;
  requiredNm: number;
  deltaNm: number; // 남은 거리 − 필요 거리 (음수 = 에너지 많음)
  state: EnergyState;
  manage: Manage;
  avgTasKt?: number; // 정밀 계산에서만
}

const stateOf = (delta: number, tol: number): EnergyState => (delta < -tol ? 'HIGH' : delta > tol ? 'LOW' : 'ON');

/** 감속 시작 속도: 10,000 ft 위에서는 계획 속도(280 kt)까지 올라간 뒤 감속한다 (Mach 구간 포함). */
export function decelFrom(input: EnergyInput, r: Rules): number {
  return input.altitudeFt > r.speedLimitAltFt ? Math.max(input.iasKt, r.descentCasKt) : input.iasKt;
}

/** FCTM 수평 감속 거리: 330→250 kt 9 NM, 250→Flaps Up 4 NM (비례). */
export function decelDistance(fromKt: number, toKt: number, r: Rules): DecelPart[] {
  const parts: DecelPart[] = [];
  if (fromKt <= toKt) return parts;
  if (fromKt > 250) {
    const to = Math.max(toKt, 250);
    parts.push({ fromKt, toKt: to, nm: ((fromKt - to) / (r.decelHighFromKt - 250)) * r.decelHighTo250Nm });
  }
  if (toKt < 250) {
    const from = Math.min(fromKt, 250);
    parts.push({ fromKt: from, toKt, nm: ((from - toKt) / (250 - r.flapsUpSpeedKt)) * r.decel250ToFlapsUpNm });
  }
  return parts;
}

/** Rule of thumb 감속: 250 kt 위는 10 kt당 1 NM, 250→Flaps Up은 FCTM 4 NM. */
export function thumbDecel(fromKt: number, toKt: number, r: Rules): DecelPart[] {
  const parts: DecelPart[] = [];
  if (fromKt <= toKt) return parts;
  if (fromKt > 250) {
    const to = Math.max(toKt, 250);
    parts.push({ fromKt, toKt: to, nm: ((fromKt - to) / 10) * r.thumbDecelNmPer10Kt });
  }
  if (toKt < 250) {
    const from = Math.min(fromKt, 250);
    parts.push({ fromKt: from, toKt, nm: ((from - toKt) / (250 - r.flapsUpSpeedKt)) * r.decel250ToFlapsUpNm });
  }
  return parts;
}

// ── Rule of thumb ─────────────────────────────────────────────

export function computeThumb(input: EnergyInput, r: Rules): EnergyResult {
  const altLossFt = Math.max(0, input.altitudeFt - input.targetAltFt);
  const altNm = (altLossFt / 1000) * r.nmPer1000ft;
  const from = decelFrom(input, r);
  const decelParts = thumbDecel(from, input.targetSpeedKt, r);
  const decelNm = decelParts.reduce((s, p) => s + p.nm, 0);
  const windNm = (input.windComponentKt / 10) * (altLossFt / 10000) * r.thumbWindNmPer10KtPer10000ft;
  const requiredNm = altNm + decelNm + windNm;
  const deltaNm = input.trackMilesNm - requiredNm;
  const state = stateOf(deltaNm, r.onProfileToleranceNm);

  let manage: Manage = { kind: 'HOLD' };
  if (state === 'LOW') manage = { kind: 'DELAY', delayNm: deltaNm };
  if (state === 'HIGH') {
    const deficit = Math.round(-deltaNm * 10) / 10; // 화면에 보이는 값으로 계산
    const per = r.thumbSbNmPer1000ft;
    const sbFt = Math.ceil(((deficit / per) * 1000) / 500) * 500; // 500 ft 단위로 넉넉히
    if (sbFt <= altLossFt) {
      manage = { kind: 'SB', sbFt, retractAltFt: input.altitudeFt - sbFt, per1000Nm: per };
    } else {
      const sbRecoveredNm = (altLossFt / 1000) * per;
      const decelSavingNm = decelNm * r.sbDecelReduction;
      manage = {
        kind: sbRecoveredNm + decelSavingNm >= deficit ? 'SB_DECEL' : 'SB_INSUFFICIENT',
        sbFt: altLossFt,
        retractAltFt: input.targetAltFt,
        sbRecoveredNm,
        decelSavingNm,
        per1000Nm: per,
      };
    }
  }
  return { altLossFt, altNm, decelFromKt: from, decelParts, decelNm, windNm, requiredNm, deltaNm, state, manage };
}

// ── 정밀 계산 (비교용) ─────────────────────────────────────────

/** 100 ft씩 내려가며 SB 회수 거리를 쌓아 해제 고도를 찾는다. */
function preciseSpeedbrake(input: EnergyInput, deficitNm: number, decelNm: number, r: Rules): Manage {
  const step = 100;
  const xo = crossover(r);
  const gainPerStep = (altFt: number) => {
    const machPhase = altFt >= xo;
    const cas = altFt > input.altitudeFt - 1 ? input.iasKt : scheduleCas(altFt, r);
    const gs = casToTas(cas, altFt) + input.windComponentKt;
    const rod = rodFor(cas, r, machPhase);
    return (gs / 60) * (step / rod.clean - step / rod.sb);
  };
  const per1000Nm = gainPerStep(input.altitudeFt) * (1000 / step);

  let alt = input.altitudeFt;
  let recovered = 0;
  while (alt - step >= input.targetAltFt && recovered < deficitNm) {
    recovered += gainPerStep(alt - step / 2);
    alt -= step;
  }
  if (recovered >= deficitNm) {
    const retract = Math.max(Math.round(alt / 500) * 500, input.targetAltFt);
    return { kind: 'SB', sbFt: input.altitudeFt - retract, retractAltFt: retract, sbRecoveredNm: recovered, per1000Nm };
  }
  const decelSavingNm = decelNm * r.sbDecelReduction;
  return {
    kind: recovered + decelSavingNm >= deficitNm ? 'SB_DECEL' : 'SB_INSUFFICIENT',
    sbFt: input.altitudeFt - input.targetAltFt,
    retractAltFt: input.targetAltFt,
    sbRecoveredNm: recovered,
    decelSavingNm,
    per1000Nm,
  };
}

export function computePrecise(input: EnergyInput, r: Rules): EnergyResult {
  const altLossFt = Math.max(0, input.altitudeFt - input.targetAltFt);
  const altNm = (altLossFt / 1000) * r.nmPer1000ft;
  const from = decelFrom(input, r);
  const decelParts = decelDistance(from, input.targetSpeedKt, r);
  const decelNm = decelParts.reduce((s, p) => s + p.nm, 0);

  const avgTasKt = (casToTas(input.iasKt, input.altitudeFt) + casToTas(input.targetSpeedKt, input.targetAltFt)) / 2;
  const windNm = ((altNm + decelNm) * input.windComponentKt) / avgTasKt;
  const requiredNm = altNm + decelNm + windNm;
  const deltaNm = input.trackMilesNm - requiredNm;
  const state = stateOf(deltaNm, r.onProfileToleranceNm);

  let manage: Manage = { kind: 'HOLD' };
  if (state === 'LOW') manage = { kind: 'DELAY', delayNm: deltaNm };
  if (state === 'HIGH') manage = preciseSpeedbrake(input, -deltaNm, decelNm, r);
  return { altLossFt, altNm, decelFromKt: from, decelParts, decelNm, windNm, requiredNm, deltaNm, state, manage, avgTasKt };
}
