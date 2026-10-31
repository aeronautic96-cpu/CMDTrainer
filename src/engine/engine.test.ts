import { describe, expect, it } from 'vitest';
import { casToTas, crossoverAltFt, machToCas } from './atmosphere';
import { computePrecise, computeThumb, decelDistance, thumbDecel } from './energy';
import { grade } from './grading';
import { DEFAULT_RULES as R, scheduleCas } from './rules';
import { generateScenario } from './scenario';

const close = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
const sum = (p: { nm: number }[]) => p.reduce((s, x) => s + x.nm, 0);

describe('atmosphere', () => {
  it('250 KIAS at 10,000 ft ≈ 288 KTAS', () => close(casToTas(250, 10000), 288, 3));
  it('330 KIAS at FL200 ≈ 438 KTAS', () => close(casToTas(330, 20000), 438, 3));
  it('M.84/280 crossover ≈ FL360', () => close(crossoverAltFt(0.84, 280), 36000, 600));
  it('M.84 at FL380 ≈ 266 KCAS', () => close(machToCas(0.84, 38000), 266, 3));
});

describe('speed schedule', () => {
  it('FL380 Mach 구간, FL200 280 kt, 9,000 ft 250 kt', () => {
    expect(scheduleCas(38000, R)).toBeLessThan(280);
    expect(scheduleCas(20000, R)).toBe(280);
    expect(scheduleCas(9000, R)).toBe(250);
  });
});

describe('decel', () => {
  it('FCTM 330→250 = 9 NM', () => close(sum(decelDistance(330, 250, R)), 9, 0.01));
  it('FCTM 280→250 = 3.4 NM', () => close(sum(decelDistance(280, 250, R)), 3.375, 0.01));
  it('FCTM 250→220 = 4 NM', () => close(sum(decelDistance(250, 220, R)), 4, 0.01));
  it('Rule 280→250 = 3 NM, 280→220 = 7 NM', () => {
    close(sum(thumbDecel(280, 250, R)), 3, 0.01);
    close(sum(thumbDecel(280, 220, R)), 7, 0.01);
  });
});

describe('rule of thumb', () => {
  // 예제: FL200 / 280 kt → 3,000 ft / 220 kt, 배풍 20 kt, ND 65 NM
  const ex = { altitudeFt: 20000, iasKt: 280, targetAltFt: 3000, targetSpeedKt: 220, windComponentKt: 20, trackMilesNm: 65 };

  it('고도 59.5 + 감속 7 + 바람 3.4 = 69.9 NM', () => {
    const t = computeThumb(ex, R);
    close(t.altNm, 59.5, 0.01);
    close(t.decelNm, 7, 0.01);
    close(t.windNm, 3.4, 0.01);
    close(t.requiredNm, 69.9, 0.01);
  });

  it('−4.9 NM → High, SB 2,500 ft → 17,500 ft 해제', () => {
    const t = computeThumb(ex, R);
    expect(t.state).toBe('HIGH');
    expect(t.manage.kind).toBe('SB');
    expect(t.manage.sbFt).toBe(2500);
    expect(t.manage.retractAltFt).toBe(17500);
  });

  it('정밀 계산도 비슷한 결론 (약 71 NM, High)', () => {
    const p = computePrecise(ex, R);
    close(p.requiredNm, 71, 1);
    expect(p.state).toBe('HIGH');
    close(p.manage.retractAltFt!, 17000, 1500);
  });

  it('Mach 구간에서 감속은 280 kt부터', () => {
    const t = computeThumb({ ...ex, altitudeFt: 38000, iasKt: 266, targetAltFt: 10000, targetSpeedKt: 250 }, R);
    close(t.decelNm, 3, 0.01);
  });

  it('남는 거리 → Low, 지연 거리', () => {
    const t = computeThumb({ ...ex, trackMilesNm: 85 }, R);
    expect(t.state).toBe('LOW');
    close(t.manage.delayNm!, 15.1, 0.01);
  });

  it('부족분이 너무 크면 SB만으로 불충분', () => {
    const t = computeThumb({ ...ex, altitudeFt: 12000, targetAltFt: 10000, targetSpeedKt: 250, trackMilesNm: 1 }, R);
    expect(t.manage.kind).toBe('SB_INSUFFICIENT');
  });
});

describe('generateScenario', () => {
  it('같은 시드 = 같은 문제', () => expect(generateScenario(42, R)).toEqual(generateScenario(42, R)));

  it('여러 시드에서 경로·속도 계획이 일관됨', () => {
    for (let s = 1; s <= 300; s++) {
      const sc = generateScenario(s, R);
      close(sum(sc.legsNm.map((nm) => ({ nm }))), sc.trackMilesNm, 0.05);
      expect(sc.legsNm.every((l) => l > 0)).toBe(true);
      for (const p of sc.waypoints) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(sc.ndRangeNm);
      expect(sc.target.name).toBe(sc.waypoints[sc.waypoints.length - 1].name);
      if (sc.altitudeFt <= 10000) expect(sc.iasKt).toBe(250);
      else expect(sc.iasKt).toBeLessThanOrEqual(280);
    }
  });

  it('정답을 그대로 넣으면 만점', () => {
    for (let s = 1; s <= 100; s++) {
      const sc = generateScenario(s, R);
      const t = sc.thumb;
      const action =
        t.state === 'HIGH' ? String(t.manage.retractAltFt) : t.state === 'LOW' ? String(t.manage.delayNm) : '';
      const g = grade(sc, { trackMiles: String(sc.trackMilesNm), required: String(t.requiredNm), state: t.state, action });
      expect(g.score).toBe(4);
    }
  });
});
