// MFK 타이핑 연습 문제: 실제 CDU 페이지의 한 칸에 값을 넣는 형식.
// 키패드에 있는 글자만 사용 (A–Z, 0–9, . / + − 공백).

export type DrillCat = 'IDENT' | 'CONSTRAINT' | 'DES' | 'WIND' | 'TEMP' | 'PBD';

export const CAT_LABEL: Record<DrillCat, string> = {
  IDENT: '공항 · 경로점',
  CONSTRAINT: '속도/고도 제한',
  DES: '강하 속도 · 순항 고도',
  WIND: '강하 바람 예보',
  TEMP: '기온 (± 키)',
  PBD: 'Place/Bearing/Distance',
};
export const ALL_CATS = Object.keys(CAT_LABEL) as DrillCat[];

export interface CduRow {
  lLabel?: string;
  l?: string;
  rLabel?: string;
  r?: string;
}

export interface Drill {
  cat: DrillCat;
  title: string;
  rows: CduRow[]; // 최대 6줄 (LSK 1~6)
  target: { row: number; side: 'L' | 'R' };
  desc: string; // 설명만 보기 모드에서 보여줄 문장
  answer: string; // 대표 정답
  accepts: string[]; // 정답으로 인정하는 입력
}

type Rnd = () => number;
const CONS = 'BDGKLMNPRSTVZ';
const VOWS = 'AEIOU';
const pick = <T,>(r: Rnd, a: T[]) => a[Math.floor(r() * a.length)];
const int = (r: Rnd, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const wpt = (r: Rnd) => pick(r, [...CONS]) + pick(r, [...VOWS]) + pick(r, [...CONS]) + pick(r, [...VOWS]) + pick(r, [...CONS]);
const pad3 = (n: number) => String(n).padStart(3, '0');
const TA = 14000; // 전이고도

/** 고도 표기: 전이고도 이상은 FL, 아래는 ft. 인정 입력도 함께. */
function altForms(ft: number, suffix = '') {
  if (ft >= TA) {
    const fl = String(Math.round(ft / 100)).padStart(3, '0');
    return { show: `FL${fl}${suffix}`, accepts: [`FL${fl}${suffix}`, `${fl}${suffix}`, `${ft}${suffix}`] };
  }
  return { show: `${ft}${suffix}`, accepts: [`${ft}${suffix}`] };
}
const ko = (ft: number) => (ft >= TA ? `FL${Math.round(ft / 100)}` : `${ft.toLocaleString()} ft`);

const AIRPORTS: [string, string][] = [
  ['인천', 'RKSI'], ['김포', 'RKSS'], ['제주', 'RKPC'], ['김해', 'RKPK'], ['나리타', 'RJAA'], ['하네다', 'RJTT'],
  ['간사이', 'RJBB'], ['방콕 수완나품', 'VTBS'], ['호찌민', 'VVTS'], ['다낭', 'VVDN'], ['로스앤젤레스', 'KLAX'],
  ['샌프란시스코', 'KSFO'], ['뉴어크', 'KEWR'], ['호놀룰루', 'PHNL'], ['워싱턴 덜레스', 'KIAD'], ['프랑크푸르트', 'EDDF'],
  ['싱가포르', 'WSSS'], ['타이베이', 'RCTP'], ['시애틀', 'KSEA'], ['밴쿠버', 'CYVR'],
];

/** LEGS 페이지: 타이핑 연습용으로 경로점 이름만 표시 */
function legsRows(r: Rnd, n = 5) {
  const names = Array.from({ length: n }, () => wpt(r));
  const rows: CduRow[] = names.map((name) => ({ l: name }));
  return { rows, names };
}

const gens: Record<DrillCat, (r: Rnd) => Drill> = {
  IDENT(r) {
    if (r() < 0.5) {
      const [city, icao] = pick(r, AIRPORTS);
      const [, orig] = pick(r, AIRPORTS.filter(([, c]) => c !== icao));
      return {
        cat: 'IDENT',
        title: 'RTE 1',
        rows: [
          { lLabel: 'ORIGIN', l: orig, rLabel: 'DEST', r: '□□□□' },
          { lLabel: 'RUNWAY', l: '-----', rLabel: 'FLT NO', r: '----------' },
          { lLabel: 'REQUEST', l: '<SEND', rLabel: 'CO ROUTE', r: '----------' },
        ],
        target: { row: 0, side: 'R' },
        desc: `목적지 공항: ${city}`,
        answer: icao,
        accepts: [icao],
      };
    }
    const { rows, names } = legsRows(r, 5);
    const to = names[int(r, 2, 4)];
    rows[0] = { ...rows[0], l: '□□□□□', lLabel: 'DIRECT TO' };
    return {
      cat: 'IDENT',
      title: 'ACT RTE 1 LEGS',
      rows,
      target: { row: 0, side: 'L' },
      desc: `${to}로 DIRECT TO`,
      answer: to,
      accepts: [to],
    };
  },

  CONSTRAINT(r) {
    const { rows, names } = legsRows(r, 5);
    const row = int(r, 1, 4);
    const kind = int(r, 0, 5);
    let ft = int(r, 4, 26) * 1000;
    let answer: string;
    let accepts: string[];
    let desc: string;
    if (kind === 0) {
      // 속도/고도 AT
      ft = int(r, 6, 13) * 1000;
      const spd = ft > 10000 ? pick(r, [270, 280, 290]) : pick(r, [210, 220, 230, 240, 250]);
      const a = altForms(ft);
      answer = `${spd}/${a.show}`;
      accepts = a.accepts.map((x) => `${spd}/${x}`);
      desc = `${names[row]}: ${ko(ft)}, ${spd} kt`;
    } else if (kind === 1) {
      const a = altForms(ft);
      answer = a.show;
      accepts = [...a.accepts, ...a.accepts.map((x) => `/${x}`)];
      desc = `${names[row]}: ${ko(ft)} (AT, 속도는 그대로)`;
    } else if (kind === 2) {
      const a = altForms(ft, 'A');
      answer = a.show;
      accepts = [...a.accepts, ...a.accepts.map((x) => `/${x}`)];
      desc = `${names[row]}: ${ko(ft)} 이상 (AT OR ABOVE)`;
    } else if (kind === 3) {
      const a = altForms(ft, 'B');
      answer = a.show;
      accepts = [...a.accepts, ...a.accepts.map((x) => `/${x}`)];
      desc = `${names[row]}: ${ko(ft)} 이하 (AT OR BELOW)`;
    } else if (kind === 4) {
      ft = int(r, 3, 9) * 1000;
      const spd = pick(r, [200, 210, 220, 230]);
      const a = altForms(ft, 'A');
      answer = `${spd}/${a.show}`;
      accepts = a.accepts.map((x) => `${spd}/${x}`);
      desc = `${names[row]}: ${ko(ft)} 이상, ${spd} kt`;
    } else {
      const spd = pick(r, [230, 240, 250, 260]);
      answer = `${spd}/`;
      accepts = [`${spd}/`];
      desc = `${names[row]}: 속도 ${spd} kt만 (고도는 그대로)`;
    }
    rows[row] = { ...rows[row], r: '□□□/□□□□□' };
    return { cat: 'CONSTRAINT', title: 'ACT RTE 1 LEGS', rows, target: { row, side: 'R' }, desc, answer, accepts };
  },

  DES(r) {
    const kind = int(r, 0, 2);
    if (kind === 2) {
      const ft = int(r, 31, 41) * 1000;
      const a = altForms(ft);
      return {
        cat: 'DES',
        title: 'PERF INIT',
        rows: [
          { lLabel: 'GR WT', l: `${int(r, 180, 250)}.${int(r, 0, 9)}`, rLabel: 'CRZ ALT', r: '□□□□□' },
          { lLabel: 'FUEL', l: `${int(r, 30, 90)}.${int(r, 0, 9)}`, rLabel: 'COST INDEX', r: `${int(r, 20, 120)}` },
          { lLabel: 'ZFW', l: `${int(r, 150, 170)}.${int(r, 0, 9)}`, rLabel: 'MIN FUEL TEMP', r: '-37°C' },
          { lLabel: 'RESERVES', l: `${int(r, 4, 8)}.${int(r, 0, 9)}`, rLabel: 'CRZ CG', r: '30.0%' },
        ],
        target: { row: 0, side: 'R' },
        desc: `순항 고도 ${ko(ft)}`,
        answer: a.show,
        accepts: a.accepts,
      };
    }
    const e = wpt(r);
    const rows: CduRow[] = [
      { lLabel: 'E/D AT', l: `${e}`, rLabel: 'END OF DES', r: '10000' },
      { lLabel: 'ECON SPD', l: '.840/280', rLabel: 'TO E/D', r: `${int(r, 40, 120)} NM` },
      { lLabel: 'SPD TRANS', l: '250/10000', rLabel: 'WPT/ALT', r: '---/-----' },
      { lLabel: 'SPD RESTR', l: '---/-----', rLabel: 'FPA V/B V/S', r: '2.6 2.8 2300' },
    ];
    if (kind === 0) {
      const m = pick(r, [0.8, 0.82, 0.84, 0.85]);
      const c = pick(r, [270, 280, 290, 300, 310]);
      const ms = '.' + Math.round(m * 100);
      rows[1] = { ...rows[1], lLabel: 'SEL SPD', l: '□□□/□□□' };
      return {
        cat: 'DES',
        title: 'ACT ECON DES',
        rows,
        target: { row: 1, side: 'L' },
        desc: `강하 속도 M${ms} / ${c} kt`,
        answer: `${ms}/${c}`,
        accepts: [`${ms}/${c}`, `${ms}0/${c}`, `0${ms}/${c}`],
      };
    }
    const spd = pick(r, [220, 230, 240, 250]);
    const ft = int(r, 5, 12) * 1000;
    rows[3] = { ...rows[3], l: '□□□/□□□□□' };
    return {
      cat: 'DES',
      title: 'ACT ECON DES',
      rows,
      target: { row: 3, side: 'L' },
      desc: `속도 제한 ${spd} kt / ${ko(ft)}`,
      answer: `${spd}/${ft}`,
      accepts: [`${spd}/${ft}`],
    };
  },

  WIND(r) {
    const levels = [int(r, 33, 39) * 1000, int(r, 22, 28) * 1000, int(r, 12, 18) * 1000, int(r, 5, 9) * 1000];
    const rows: CduRow[] = [
      { lLabel: 'TRANS LVL', l: 'FL140', rLabel: 'TAI/ON ALT', r: '-----' },
      ...levels.map((ft) => ({ lLabel: 'ALT', l: altForms(ft).show, rLabel: 'WIND DIR/SPD', r: '---°/---' })),
    ];
    const kind = r() < 0.7 ? 'wind' : 'alt';
    const row = int(r, 1, 4);
    if (kind === 'wind') {
      const dir = int(r, 0, 35) * 10 || 360;
      const spd = int(r, 10, 120);
      rows[row] = { ...rows[row], r: '□□□°/□□□' };
      return {
        cat: 'WIND',
        title: 'DESCENT FORECAST',
        rows,
        target: { row, side: 'R' },
        desc: `${rows[row].l} 바람 ${pad3(dir)}° / ${spd} kt`,
        answer: `${pad3(dir)}/${spd}`,
        accepts: [`${pad3(dir)}/${spd}`, `${pad3(dir)}/${pad3(spd)}`, `${dir}/${spd}`],
      };
    }
    const ft = levels[row - 1];
    const a = altForms(ft);
    rows[row] = { ...rows[row], l: '□□□□□' };
    return {
      cat: 'WIND',
      title: 'DESCENT FORECAST',
      rows,
      target: { row, side: 'L' },
      desc: `예보 고도 ${ko(ft)}`,
      answer: a.show,
      accepts: a.accepts,
    };
  },

  TEMP(r) {
    if (r() < 0.5) {
      const t = -int(r, 40, 65);
      return {
        cat: 'TEMP',
        title: 'PERF INIT',
        rows: [
          { lLabel: 'GR WT', l: `${int(r, 180, 250)}.${int(r, 0, 9)}`, rLabel: 'CRZ ALT', r: 'FL390' },
          { lLabel: 'FUEL', l: `${int(r, 30, 90)}.${int(r, 0, 9)}`, rLabel: 'COST INDEX', r: `${int(r, 20, 120)}` },
          { lLabel: 'ZFW', l: `${int(r, 150, 170)}.${int(r, 0, 9)}`, rLabel: 'T/C OAT', r: '□□□°C' },
          { lLabel: 'RESERVES', l: `${int(r, 4, 8)}.${int(r, 0, 9)}`, rLabel: 'CRZ CG', r: '30.0%' },
        ],
        target: { row: 2, side: 'R' },
        desc: `T/C OAT ${t}°C (− 는 +/− 키)`,
        answer: `${t}`,
        accepts: [`${t}`, `${t}C`],
      };
    }
    const t = int(r, -15, 35);
    const s = t > 0 && r() < 0.5 ? `+${t}` : `${t}`;
    return {
      cat: 'TEMP',
      title: 'TAKEOFF REF',
      rows: [
        { lLabel: 'FLAPS', l: `${pick(r, [5, 15, 20])}`, rLabel: 'QRH', r: 'V1' },
        { lLabel: 'THRUST', l: 'TO 1', rLabel: '', r: 'VR' },
        { lLabel: 'CG', l: '25.0%', rLabel: '', r: 'V2' },
        { lLabel: 'OAT', l: '□□□°C', rLabel: 'TOGW', r: `${int(r, 200, 254)}.${int(r, 0, 9)}` },
      ],
      target: { row: 3, side: 'L' },
      desc: `OAT ${s}°C${s.startsWith('+') ? ' (+ 는 +/− 키 두 번)' : t < 0 ? ' (− 는 +/− 키)' : ''}`,
      answer: s,
      accepts: t > 0 ? [`${t}`, `+${t}`, `${t}C`, `+${t}C`] : [`${t}`, `${t}C`],
    };
  },

  PBD(r) {
    const { rows, names } = legsRows(r, 5);
    const base = names[int(r, 1, 4)];
    const row = int(r, 1, 4);
    rows[row] = { ...rows[row], l: '□□□□□' };
    if (r() < 0.6) {
      const brg = int(r, 1, 360);
      const d = int(r, 3, 40);
      return {
        cat: 'PBD',
        title: 'ACT RTE 1 LEGS',
        rows,
        target: { row, side: 'L' },
        desc: `${base}에서 ${pad3(brg)}°, ${d} NM 지점`,
        answer: `${base}${pad3(brg)}/${d}`,
        accepts: [`${base}${pad3(brg)}/${d}`],
      };
    }
    const d = int(r, 2, 15);
    const before = r() < 0.6;
    return {
      cat: 'PBD',
      title: 'ACT RTE 1 LEGS',
      rows,
      target: { row, side: 'L' },
      desc: `${base} ${d} NM ${before ? '전' : '후'} (along-track)${before ? ' (− 는 +/− 키)' : ''}`,
      answer: `${base}/${before ? '-' : ''}${d}`,
      accepts: before ? [`${base}/-${d}`] : [`${base}/${d}`, `${base}/+${d}`],
    };
  },
};

export function makeDrills(cats: DrillCat[], count: number, rnd: Rnd = Math.random): Drill[] {
  const list = cats.length ? cats : ALL_CATS;
  return Array.from({ length: count }, (_, i) => gens[list[i % list.length]](rnd)).sort(() => rnd() - 0.5);
}

/** 정답을 치는 데 필요한 최소 키 수 (+ 는 +/− 두 번, ENTER 포함). */
export function minKeystrokes(answer: string): number {
  let n = 1; // ENTER
  for (const ch of answer) n += ch === '+' ? 2 : 1;
  return n;
}

/** +/− 키: 마지막 글자가 −면 +, +면 −로 바꾸고, 아니면 − 추가 (FCOM 10.10.56). */
export function applyPlusMinus(s: string): string {
  const last = s.slice(-1);
  if (last === '-') return s.slice(0, -1) + '+';
  if (last === '+') return s.slice(0, -1) + '-';
  return s + '-';
}

export const KEYPAD_CHARS = /^[A-Z0-9./+\- ]*$/;
