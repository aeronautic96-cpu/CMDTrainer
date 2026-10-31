// 풀이: ① 거리 에너지 → ② 남은 거리 → ③ ± 판단 → ④ manage.
// 각 단계는 rule of thumb이 기본이고, 근거와 정밀 계산 비교를 함께 보여준다.
import type { ReactNode } from 'react';
import { casToTas } from '../engine/atmosphere';
import type { EnergyResult } from '../engine/energy';
import type { Answers, Grade } from '../engine/grading';
import { ALT_TOL_FT, DELAY_TOL_NM, fmtAlt } from '../engine/grading';
import { crossover, rodFor, scheduleCas, type Rules } from '../engine/rules';
import type { Scenario } from '../engine/scenario';

const f1 = (n: number) => n.toFixed(1);
const sgn = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1);
const STATE_KO = { HIGH: '에너지 많음 (High)', ON: '적정', LOW: '에너지 부족 (Low)' } as const;

interface Props {
  sc: Scenario;
  rules: Rules;
  grade: Grade;
  answers: Answers;
}

/** 해당 고도에서 1,000 ft당 clean/SB 거리 (FCTM 강하율 표 + ISA TAS). */
function per1000(altFt: number, r: Rules, windKt: number) {
  const cas = scheduleCas(altFt, r);
  const tas = casToTas(cas, altFt);
  const rod = rodFor(cas, r, altFt >= crossover(r));
  const gs = tas + windKt;
  const clean = (gs / 60) * (1000 / rod.clean);
  const sb = (gs / 60) * (1000 / rod.sb);
  return { cas, tas, rod, clean, sb, gain: clean - sb };
}

function Why({ children }: { children: ReactNode }) {
  return (
    <details className="why">
      <summary>근거 보기</summary>
      <div>{children}</div>
    </details>
  );
}

function Compare({ label, thumb, precise, unit = 'NM' }: { label: string; thumb: string; precise: string; unit?: string }) {
  return (
    <p className="compare">
      <span>{label}</span> rule {thumb} {unit} · 정밀 {precise} {unit}
    </p>
  );
}

export default function Explanation({ sc, rules, grade, answers }: Props) {
  const t = sc.thumb;
  const p = sc.precise;
  const wind = sc.windComponentKt;
  const xo = crossover(rules);
  const sampleAlts = [Math.min(sc.altitudeFt, 30000), 20000, 10500, 9000].filter(
    (a, i, arr) => a > sc.target.altFt && arr.indexOf(a) === i,
  );
  const descentMin10k = ((10 * rules.nmPer1000ft) / (p.avgTasKt ?? 350)) * 60;
  const here = per1000(sc.altitudeFt, rules, wind);

  return (
    <ol className="explain">
      {/* ① 거리 에너지 */}
      <li className={grade.required.ok ? 'ok' : 'bad'}>
        <h3>
          <b>1</b> 고도·속도를 거리 에너지로 환산
          <span>
            정답 {f1(t.requiredNm)} NM · 내 답 {answers.required || '–'}
          </span>
        </h3>

        <div className="rule">
          <p>
            <em>고도</em> {(t.altLossFt / 1000).toFixed(1)} (천 ft) × {rules.nmPer1000ft} = <b>{f1(t.altNm)} NM</b>
          </p>
          <p>
            <em>속도</em>{' '}
            {t.decelParts.length === 0
              ? '감속 없음'
              : t.decelParts.map((d, i) => (
                  <span key={i}>
                    {i > 0 && ' + '}
                    {Math.round(d.fromKt)}→{Math.round(d.toKt)} kt {f1(d.nm)}
                  </span>
                ))}{' '}
            = <b>{f1(t.decelNm)} NM</b>
          </p>
          <p>
            <em>바람</em> {wind >= 0 ? '배풍' : '정풍'} {Math.abs(wind)} kt → {Math.abs(wind) / 10} × {(t.altLossFt / 10000).toFixed(2)} (만
            ft) = <b>{sgn(t.windNm)} NM</b>
          </p>
          <p className="total">
            필요 거리 = {f1(t.altNm)} + {f1(t.decelNm)} {t.windNm >= 0 ? '+' : '−'} {f1(Math.abs(t.windNm))} = <b>{f1(t.requiredNm)} NM</b>
          </p>
        </div>

        <Why>
          <h4>고도: 1,000 ft당 3.5 NM</h4>
          <p>
            FCTM 4.21: "바람 없음, ECON 속도에서 1,000 ft당 약 3.5 NM". 이 강하 속도(M{rules.descentMach.toFixed(2).slice(1)}/
            {rules.descentCasKt} kt)로 idle clean 강하를 직접 계산하면 아래와 같습니다 (TAS ÷ 강하율, 무풍).
          </p>
          <table className="mini">
            <thead>
              <tr>
                <th>고도</th>
                <th>속도</th>
                <th>TAS</th>
                <th>강하율</th>
                <th>1,000 ft당</th>
              </tr>
            </thead>
            <tbody>
              {sampleAlts.map((a) => {
                const q = per1000(a, rules, 0);
                return (
                  <tr key={a}>
                    <td>{fmtAlt(a)}</td>
                    <td>{a >= xo ? `M${rules.descentMach.toFixed(2).slice(1)}` : `${Math.round(q.cas)} kt`}</td>
                    <td>{Math.round(q.tas)} kt</td>
                    <td>{Math.round(q.rod.clean).toLocaleString()} fpm</td>
                    <td>{f1(q.clean)} NM</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p>
            실제 값은 대부분 3.5 NM보다 짧습니다. 그래서 3.5를 쓰면 <b>약 10% 여유</b>가 생깁니다 (anti-ice, 감속, 바람 변화 대비).
            강하율은 FCTM 787-9 표(250 kt 1,500 / 330 kt 2,700 fpm) 사이를 보간한 값입니다.
          </p>

          <h4>속도: 10 kt당 1 NM, 250→Flaps Up 4 NM</h4>
          <p>
            FCTM 4.22: 수평 비행에서 330→250 kt 감속에 약 80초·9 NM (80 kt → 10 kt당 1.1 NM), 250 kt→Flaps Up 기동 속도에 추가 40초·4
            NM. 그래서 280→250 kt는 3 NM, 250→{rules.flapsUpSpeedKt} kt는 4 NM으로 잡습니다.
          </p>
          <p>
            10,000 ft 위에서는 속도 제한(250 kt) 때문에 <b>10,000 ft 전에 250 kt까지 감속</b>해야 하므로 목표가 10,000 ft여도 감속 거리가
            붙습니다. Crossover(약 {fmtAlt(xo)}) 위 Mach 구간에서는 내려오면서 IAS가 저절로 {rules.descentCasKt} kt까지 올라가므로{' '}
            <b>Mach 구간에는 별도 감속 거리가 없습니다.</b>
          </p>
          <p>
            FCTM 수치는 <b>수평 감속</b> 기준입니다. 실제 VNAV는 약 500 fpm으로 내려가며 감속하므로 필요한 거리가 조금 짧습니다. 즉 이
            값은 안전 쪽 여유입니다.
          </p>

          <h4>바람: 10 kt마다, 고도 10,000 ft당 1 NM</h4>
          <p>
            idle 강하율은 TAS와 항력으로 정해지고 바람과 무관합니다. 그래서 <b>강하 시간은 바람이 있어도 같고</b>, 바람은 그 시간 동안
            비행기를 밀거나 잡아당깁니다.
          </p>
          <p className="formula">추가 거리 = 바람 × 강하 시간 = 무풍 거리 × (바람 ÷ TAS)</p>
          <p>
            10,000 ft = 35 NM. 이 문제의 평균 TAS {Math.round(p.avgTasKt ?? 350)} kt로 날면 약 {descentMin10k.toFixed(1)}분이 걸립니다.
            바람 10 kt × 약 6분 = <b>1 NM</b>. 비율로는 10 ÷ 350 ≈ <b>3%</b>입니다.
          </p>
          <p>
            주의: ND의 바람은 <b>현재 고도</b>의 바람이고 보통 위로 갈수록 강합니다. 현재 바람과 지상 바람의 평균이나 DESCENT FORECAST
            값을 쓰세요. 바람 성분은 <b>트랙 기준</b>이며 (바람 방향 − 트랙의 cos), STAR에서 방향이 바뀌면 구간별로 달라집니다.
          </p>
        </Why>
        <Compare label="정밀 계산" thumb={f1(t.requiredNm)} precise={f1(p.requiredNm)} />
        <p className="muted">
          정밀: 감속은 FCTM 비례값({f1(p.decelNm)} NM), 바람은 (고도+감속) × {wind}/{Math.round(p.avgTasKt ?? 0)} = {sgn(p.windNm)} NM.
        </p>
      </li>

      {/* ② 남은 거리 */}
      <li className={grade.trackMiles.ok ? 'ok' : 'bad'}>
        <h3>
          <b>2</b> 남은 거리 확인
          <span>
            정답 {f1(sc.trackMilesNm)} NM · 내 답 {answers.trackMiles || '–'}
          </span>
        </h3>
        <div className="rule">
          <p>
            {sc.waypoints.map((w, i) => `${w.name} ${f1(sc.legsNm[i])}`).join(' + ')} = <b>{f1(sc.trackMilesNm)} NM</b>
          </p>
        </div>
        <Why>
          <p>
            첫 구간은 ND 우상단의 active waypoint DTG({f1(sc.legsNm[0])} NM)로 읽습니다. 다음 구간은 ND 거리 눈금으로 어림합니다. 지금 RANGE{' '}
            {sc.ndRangeNm}이므로 트랙선 중간 눈금이 {sc.ndRangeNm / 2} NM, 나침반 호가 {sc.ndRangeNm} NM입니다.
          </p>
          <p>5 NM 단위로 읽어도 판단에는 충분합니다 (채점 허용: ±{Math.max(3, sc.trackMilesNm * 0.08).toFixed(0)} NM).</p>
        </Why>
      </li>

      {/* ③ 판단 */}
      <li className={grade.state.ok ? 'ok' : 'bad'}>
        <h3>
          <b>3</b> ± 결정<span>정답 {STATE_KO[t.state]}</span>
        </h3>
        <div className="rule">
          <p className="total">
            남은 거리 {f1(sc.trackMilesNm)} − 필요 거리 {f1(t.requiredNm)} = <b>{sgn(t.deltaNm)} NM</b> → {STATE_KO[t.state]}
          </p>
        </div>
        <Why>
          <p>
            음수면 거리가 모자라므로 <b>에너지가 많고</b>(High), 양수면 거리가 남으므로 <b>에너지가 부족</b>합니다(Low). ±
            {rules.onProfileToleranceNm} NM 안이면 적정으로 봅니다. rule of thumb과 정밀 계산의 차이가 보통 1~2 NM이라 그보다 넓게 잡은
            값입니다.
          </p>
          <p>
            강하 중 크로스체크: (남은 거리 − 감속 − 바람) ÷ 3.5 = 목표보다 높아야 할 고도(천 ft). 지금이면{' '}
            {fmtAlt(Math.round((((sc.trackMilesNm - t.decelNm - t.windNm) / rules.nmPer1000ft) * 1000 + sc.target.altFt) / 100) * 100)}에
            있어야 하는데 현재 {fmtAlt(sc.altitudeFt)}입니다. FCTM 크로스체크: <b>공항 30 NM 전 10,000 ft AGL, 250 kt</b>.
          </p>
        </Why>
        <Compare label="정밀 계산" thumb={sgn(t.deltaNm)} precise={sgn(p.deltaNm)} />
      </li>

      {/* ④ Manage */}
      <li className={grade.action.ok ? 'ok' : 'bad'}>
        <h3>
          <b>4</b> 어떻게 manage할지
        </h3>
        <div className="rule">
          <ManageText e={t} sc={sc} rules={rules} />
        </div>
        <Why>
          {t.state === 'HIGH' && (
            <>
              <h4>SB 1,000 ft = 2 NM</h4>
              <p>
                FCTM 787-9 강하율 표 기준으로 같은 1,000 ft를 SB로 내려가면 더 짧은 거리에서 내려갑니다. 그 차이가 회수 거리입니다.
                현재 고도에서는 clean {Math.round(here.rod.clean).toLocaleString()} fpm, SB {Math.round(here.rod.sb).toLocaleString()} fpm,
                GS {Math.round(here.tas + wind)} kt이므로 다음과 같습니다.
              </p>
              <p className="formula">
                clean {f1(here.clean)} NM − SB {f1(here.sb)} NM = 1,000 ft당 {f1(here.gain)} NM
              </p>
              <table className="mini">
                <thead>
                  <tr>
                    <th>고도</th>
                    <th>clean / SB 강하율</th>
                    <th>회수 /1,000 ft</th>
                  </tr>
                </thead>
                <tbody>
                  {sampleAlts.map((a) => {
                    const q = per1000(a, rules, 0);
                    return (
                      <tr key={a}>
                        <td>{fmtAlt(a)}</td>
                        <td>
                          {Math.round(q.rod.clean).toLocaleString()} / {Math.round(q.rod.sb).toLocaleString()}
                        </td>
                        <td>{f1(q.gain)} NM</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p>
                고도·속도와 관계없이 대략 1.6~2.0 NM입니다. 이를 <b>2로 반올림</b>하고 SB 고도를 500 ft 단위로 올려 잡아 조금 넉넉히
                씁니다. 감속 구간에서 SB를 쓰면 감속 거리가 <b>{Math.round(rules.sbDecelReduction * 100)}% 줄어듭니다</b> (FCTM 4.22).
              </p>
              <p>
                주의 (FCTM): SB 사용 중 PF는 레버에 손을 둡니다. Flaps 5 초과에서는 쓰지 말고, 1,000 ft AGL 전에 접습니다. VMO 근처에서는
                천천히 접습니다.
              </p>
            </>
          )}
          {t.state === 'LOW' && (
            <p>
              거리가 남으면 그만큼 고도를 늦게 잃으면 됩니다. 수평 비행 1 NM = 1 NM 회수입니다. V/S를 줄이면 더 부드럽게 맞출 수
              있습니다. 강하율을 반으로 줄이면 1,000 ft당 거리가 두 배가 됩니다.
            </p>
          )}
          {t.state === 'ON' && <p>idle 강하와 속도 계획을 그대로 유지합니다. 다음 waypoint에서 다시 크로스체크하세요.</p>}
        </Why>
        {p.state === 'HIGH' && p.manage.retractAltFt !== undefined && t.state === 'HIGH' && (
          <Compare label="SB 해제 고도" thumb={fmtAlt(t.manage.retractAltFt!)} precise={fmtAlt(p.manage.retractAltFt)} unit="" />
        )}
        {grade.action.note && <p className="muted">{grade.action.note}</p>}
        <p className="muted">
          채점 허용: SB 해제 고도 ±{ALT_TOL_FT.toLocaleString()} ft, 지연 거리 ±{DELAY_TOL_NM} NM. rule과 정밀 계산 중 어느 쪽에 가까워도
          정답입니다.
        </p>
      </li>
    </ol>
  );
}

function ManageText({ e, sc, rules }: { e: EnergyResult; sc: Scenario; rules: Rules }) {
  const m = e.manage;
  const deficit = -e.deltaNm;
  if (e.state === 'ON') return <p className="total">프로파일 유지: idle 강하를 계속합니다.</p>;
  if (e.state === 'LOW')
    return (
      <p className="total">
        약 <b>{f1(m.delayNm!)} NM</b> 동안 강하를 늦추거나(수평 유지), V/S를 줄여 경로에 다시 맞춥니다.
      </p>
    );
  if (m.kind === 'SB')
    return (
      <>
        <p>
          부족 {f1(deficit)} NM ÷ {rules.thumbSbNmPer1000ft} NM = {f1((deficit / rules.thumbSbNmPer1000ft) * 1000 / 1000)} (천 ft) → 500
          ft 단위로 올려 <b>{m.sbFt!.toLocaleString()} ft</b> SB
        </p>
        <p className="total">
          {fmtAlt(sc.altitudeFt)} − {m.sbFt!.toLocaleString()} ft = <b>{fmtAlt(m.retractAltFt!)}에서 SB 해제</b> 후 clean idle
        </p>
      </>
    );
  if (m.kind === 'SB_DECEL')
    return (
      <p className="total">
        목표 고도까지 SB를 써도 {f1(m.sbRecoveredNm!)} NM입니다. <b>감속할 때도 SB</b>를 쓰면 {f1(m.decelSavingNm!)} NM이 더해져 부족분{' '}
        {f1(deficit)} NM을 맞출 수 있습니다. 목표 고도({fmtAlt(sc.target.altFt)}) 부근까지 SB를 유지하세요.
      </p>
    );
  return (
    <p className="total">
      <b>SB만으로는 부족합니다</b> (강하 {f1(m.sbRecoveredNm!)} + 감속 {f1(m.decelSavingNm!)} {'<'} {f1(deficit)} NM). ATC에 track
      miles(vector)을 요청하고, 일찍 감속하고, 필요하면 200 kt 이하에서 gear down을 고려하세요.
    </p>
  );
}
