// 채점: rule of thumb 값이 기준. 정밀 계산 값에 가까워도 정답으로 인정한다.
import type { EnergyState } from './energy';
import type { Scenario } from './scenario';

export interface Answers {
  trackMiles: string;
  required: string;
  state: EnergyState | '';
  action: string; // HIGH: SB 해제 고도 / LOW: 강하 지연 거리(NM)
}

export interface QuestionResult {
  ok: boolean;
  note?: string;
}

export interface Grade {
  trackMiles: QuestionResult;
  required: QuestionResult;
  state: QuestionResult;
  action: QuestionResult;
  score: number;
  max: number;
}

export const TRANSITION_ALT_FT = 14000; // 한국 전이고도

export function fmtAlt(ft: number): string {
  return ft >= TRANSITION_ALT_FT
    ? `FL${String(Math.round(ft / 100)).padStart(3, '0')}`
    : `${Math.round(ft).toLocaleString()} ft`;
}

/** "FL150", "150", "15000", "15,000" 모두 ft로 변환. */
export function parseAlt(s: string): number | null {
  const t = s.trim().toUpperCase().replace(/,/g, '').replace(/FT$/, '').trim();
  if (!t) return null;
  if (t.startsWith('FL')) {
    const n = Number(t.slice(2));
    return Number.isFinite(n) ? n * 100 : null;
  }
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n < 1000 ? n * 100 : n;
}

const num = (s: string) => {
  const n = Number(s.trim());
  return s.trim() && Number.isFinite(n) ? n : null;
};

export const distTol = (v: number) => Math.max(3, Math.abs(v) * 0.07);
export const ALT_TOL_FT = 1500;
export const DELAY_TOL_NM = 3;

export function grade(sc: Scenario, a: Answers): Grade {
  const t = sc.thumb;
  const p = sc.precise;
  const tm = num(a.trackMiles);
  const rq = num(a.required);
  const near = (x: number | null, ref: number, tol: number) => x !== null && Math.abs(x - ref) <= tol;

  const trackMiles: QuestionResult = { ok: near(tm, sc.trackMilesNm, Math.max(3, sc.trackMilesNm * 0.08)) };
  const required: QuestionResult = {
    ok: near(rq, t.requiredNm, distTol(t.requiredNm)) || near(rq, p.requiredNm, distTol(p.requiredNm)),
  };
  // 경계에서 두 계산이 다르면 둘 다 인정
  const stateOk = a.state === t.state || a.state === p.state;
  const state: QuestionResult = { ok: stateOk };

  let action: QuestionResult;
  const ref = a.state === t.state ? t : p;
  if (!stateOk) {
    action = { ok: false, note: '에너지 상태 판단이 틀려 조치도 맞지 않습니다.' };
  } else if (a.state === 'ON') {
    action = { ok: true, note: '프로파일 유지: 추가 조치 불필요.' };
  } else if (a.state === 'HIGH') {
    const alt = parseAlt(a.action);
    const refs = [t, p].filter((e) => e.state === 'HIGH').map((e) => e.manage.retractAltFt!);
    if (alt === null) action = { ok: false, note: 'SB 해제 고도를 입력하지 않았습니다.' };
    else action = { ok: refs.some((r) => Math.abs(alt - r) <= ALT_TOL_FT) };
  } else {
    const d = num(a.action);
    action = { ok: near(d, ref.manage.delayNm ?? 0, DELAY_TOL_NM) };
  }

  const list = [trackMiles, required, state, action];
  return { trackMiles, required, state, action, score: list.filter((q) => q.ok).length, max: 4 };
}
