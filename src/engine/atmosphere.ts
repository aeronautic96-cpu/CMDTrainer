// ISA 표준대기 기준 속도 변환 (CAS → Mach / TAS).

const A0_KT = 661.4786; // 해면 음속

export function pressureRatio(altFt: number): number {
  return altFt <= 36089
    ? Math.pow(1 - 6.87559e-6 * altFt, 5.25588)
    : 0.223361 * Math.exp(-4.80637e-5 * (altFt - 36089));
}

export function isaTempK(altFt: number): number {
  return altFt <= 36089 ? 288.15 - 0.0019812 * altFt : 216.65;
}

export function casToMach(casKt: number, altFt: number): number {
  const qcOverP0 = Math.pow(1 + 0.2 * (casKt / A0_KT) ** 2, 3.5) - 1;
  const delta = pressureRatio(altFt);
  return Math.sqrt(5 * (Math.pow(qcOverP0 / delta + 1, 2 / 7) - 1));
}

export function casToTas(casKt: number, altFt: number): number {
  return casToMach(casKt, altFt) * 38.96785 * Math.sqrt(isaTempK(altFt));
}

/** Mach → CAS (이분법). */
export function machToCas(mach: number, altFt: number): number {
  let lo = 50;
  let hi = 500;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (casToMach(mid, altFt) < mach) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 주어진 Mach/CAS가 같아지는 고도 (crossover altitude). */
export function crossoverAltFt(mach: number, casKt: number): number {
  let lo = 0;
  let hi = 45000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (casToMach(casKt, mid) < mach) lo = mid;
    else hi = mid;
  }
  return Math.round((lo + hi) / 2);
}
