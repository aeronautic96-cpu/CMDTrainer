// 실제 크기 계산.
// MFK 치수는 공개 자료가 없어 추정: Boeing CDU 키 간격 ≈ 19 mm (0.75"),
// 나머지는 FCOM 10.10.55 그림 비율 (패널 폭 = 키 간격 × 6.13, 키 = 간격 × 0.78 × 0.70).

export const DEFAULT_PITCH_MM = 19;
export const PANEL_W_RATIO = 6.13; // 패널 폭 / 키 간격
export const PANEL_H_KEYS = 13.4; // 키 영역 높이 / 키 간격 (장식 제외)
export const PANEL_H_FULL = 19.6; // 패널 전체 높이 / 키 간격

/** 기기별 CSS px per mm. iPad는 화면 크기(pt)로 모델을 추정한다. */
export function detectPxPerMm(): { pxPerMm: number; device: string } {
  const w = Math.min(screen.width, screen.height);
  const h = Math.max(screen.width, screen.height);
  const per = (ppiCss: number) => ppiCss / 25.4;
  // iPad mini 6/7: 8.3", 326 ppi, @2x → 163 pt/in
  if (w === 744 && h === 1133) return { pxPerMm: per(163), device: 'iPad mini (6/7세대)' };
  // iPad / Air / Pro 11", 13": 264 ppi @2x → 132 pt/in
  if ([810, 820, 834, 1024, 1032].includes(w)) return { pxPerMm: per(132), device: 'iPad (10.9–13")' };
  // 그 외 (Mac 등): Retina 노트북 근사값. 화면 보정 권장.
  return { pxPerMm: per(127), device: '기타 화면 (보정 권장)' };
}

export const CARD_MM = 85.6; // 신용카드 긴 변
