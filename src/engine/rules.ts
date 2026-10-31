// 강하 계획 규칙값. 기본값은 787 FCTM (Descent Planning, 4.20~4.22) 787-9 수치와
// 사용자 기본 강하 속도 (M.84 / 280 kt), Flaps Up 220 kt.
// 회사 SOP에 맞게 설정 화면에서 바꿀 수 있다.
import { crossoverAltFt, machToCas } from './atmosphere';

export interface RodRow {
  clean: number; // fpm
  sb: number; // fpm (speedbrake extended)
}

export interface Rules {
  // 강하 속도 계획
  descentMach: number; // M.84
  descentCasKt: number; // 280 kt
  flapsUpSpeedKt: number; // Flaps Up maneuver speed
  speedLimitAltFt: number; // 250 kt 속도 제한 고도
  speedLimitKt: number;
  vmoKt: number;
  mmo: number;

  // Rule of thumb (훈련 기본)
  nmPer1000ft: number; // 고도 1,000 ft당 거리
  thumbDecelNmPer10Kt: number; // 250 kt 위 감속: 10 kt당 NM
  thumbWindNmPer10KtPer10000ft: number; // 바람 10 kt, 고도 10,000 ft당 NM
  thumbSbNmPer1000ft: number; // SB 1,000 ft당 회수 NM

  // FCTM 원본 수치 (정밀 계산)
  decelHighFromKt: number; // 330 kt
  decelHighTo250Nm: number; // 330→250 kt 수평 감속 거리
  decel250ToFlapsUpNm: number; // 250→Flaps Up 수평 감속 거리
  sbDecelReduction: number; // SB 사용 시 감속 거리 감소율
  rodHigh: RodRow; // 0.85M / 330 kt
  rod250: RodRow; // 250 kt
  rodFlapsUp: RodRow; // Flaps Up maneuver speed

  onProfileToleranceNm: number; // ±이 범위면 "적정"
}

export const DEFAULT_RULES: Rules = {
  descentMach: 0.84,
  descentCasKt: 280,
  flapsUpSpeedKt: 220,
  speedLimitAltFt: 10000,
  speedLimitKt: 250,
  vmoKt: 330,
  mmo: 0.89,

  nmPer1000ft: 3.5,
  thumbDecelNmPer10Kt: 1,
  thumbWindNmPer10KtPer10000ft: 1,
  thumbSbNmPer1000ft: 2,

  decelHighFromKt: 330,
  decelHighTo250Nm: 9,
  decel250ToFlapsUpNm: 4,
  sbDecelReduction: 0.6,
  rodHigh: { clean: 2700, sb: 6500 },
  rod250: { clean: 1500, sb: 3400 },
  rodFlapsUp: { clean: 1200, sb: 2400 },

  onProfileToleranceNm: 3,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export const crossover = (r: Rules) => crossoverAltFt(r.descentMach, r.descentCasKt);

/** 강하 속도 계획상 해당 고도의 CAS (Mach 구간 / 280 kt / 10,000 ft 아래 250 kt). */
export function scheduleCas(altFt: number, r: Rules): number {
  if (altFt <= r.speedLimitAltFt) return Math.min(r.descentCasKt, r.speedLimitKt);
  return Math.min(r.descentCasKt, machToCas(r.descentMach, altFt));
}

/** 속도에 맞는 강하율 (FCTM 표 사이는 선형 보간). Mach 구간은 0.85M/330 kt 행을 쓴다. */
export function rodFor(iasKt: number, r: Rules, machPhase = false): RodRow {
  if (machPhase || iasKt >= r.decelHighFromKt) return r.rodHigh;
  if (iasKt >= 250) {
    const t = clamp01((iasKt - 250) / (r.decelHighFromKt - 250));
    return { clean: lerp(r.rod250.clean, r.rodHigh.clean, t), sb: lerp(r.rod250.sb, r.rodHigh.sb, t) };
  }
  const t = clamp01((iasKt - r.flapsUpSpeedKt) / (250 - r.flapsUpSpeedKt));
  return { clean: lerp(r.rodFlapsUp.clean, r.rod250.clean, t), sb: lerp(r.rodFlapsUp.sb, r.rod250.sb, t) };
}
