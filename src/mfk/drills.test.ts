import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine/scenario';
import { ALL_CATS, applyPlusMinus, KEYPAD_CHARS, makeDrills, minKeystrokes } from './drills';

describe('MFK drills', () => {
  it('모든 문제: 키패드 글자만, 정답이 인정 목록에 포함, 대상 칸이 있음', () => {
    const rnd = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      for (const d of makeDrills(ALL_CATS, ALL_CATS.length, rnd)) {
        for (const a of d.accepts) expect(a).toMatch(KEYPAD_CHARS);
        expect(d.accepts).toContain(d.answer);
        expect(d.answer.length).toBeLessThanOrEqual(24);
        expect(d.rows[d.target.row]).toBeDefined();
        expect(d.rows.length).toBeLessThanOrEqual(6);
      }
    }
  });

  it('카테고리 필터와 개수', () => {
    const ds = makeDrills(['WIND'], 10, mulberry32(1));
    expect(ds).toHaveLength(10);
    expect(ds.every((d) => d.cat === 'WIND')).toBe(true);
  });

  it('+/− 키 규칙 (FCOM): 첫 번째 −, 이후 +/− 번갈아', () => {
    expect(applyPlusMinus('12')).toBe('12-');
    expect(applyPlusMinus('')).toBe('-');
    expect(applyPlusMinus('-')).toBe('+');
    expect(applyPlusMinus('+')).toBe('-');
  });

  it('최소 키 수: ENTER 포함, + 는 두 번', () => {
    expect(minKeystrokes('250/10000')).toBe(10);
    expect(minKeystrokes('+12')).toBe(5);
    expect(minKeystrokes('-52')).toBe(4);
  });
});
