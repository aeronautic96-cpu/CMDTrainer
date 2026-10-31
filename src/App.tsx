import { useMemo, useState } from 'react';
import ND from './components/ND';
import PFD from './components/PFD';
import ProfileChart from './components/ProfileChart';
import Explanation from './components/Explanation';
import Settings from './components/Settings';
import type { EnergyState } from './engine/energy';
import { fmtAlt, grade, TRANSITION_ALT_FT, type Answers, type Grade } from './engine/grading';
import { DEFAULT_RULES, type Rules } from './engine/rules';
import { machToCas } from './engine/atmosphere';
import { generateScenario } from './engine/scenario';
import { load, save } from './storage';
import MfkTrainer from './mfk/MfkTrainer';

const newSeed = () => Math.floor(Math.random() * 1e9);
const EMPTY: Answers = { trackMiles: '', required: '', state: '', action: '' };

interface Stats {
  attempts: number;
  score: number;
}

export default function App() {
  const [rules, setRules] = useState<Rules>(() => ({ ...DEFAULT_RULES, ...load<Partial<Rules>>('rules-v2', {}) }));
  const [seed, setSeed] = useState(newSeed);
  const sc = useMemo(() => generateScenario(seed, rules), [seed, rules]);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [result, setResult] = useState<Grade | null>(null);
  const [hints, setHints] = useState({ greenArc: false, legs: false, wind: false, vsd: false });
  const [stats, setStats] = useState<Stats>(() => load<Stats>('stats', { attempts: 0, score: 0 }));

  const next = () => {
    setSeed(newSeed());
    setAnswers(EMPTY);
    setResult(null);
    setHints({ greenArc: false, legs: false, wind: false, vsd: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = () => {
    const g = grade(sc, answers);
    setResult(g);
    const s = { attempts: stats.attempts + 1, score: stats.score + g.score };
    setStats(s);
    save('stats', s);
    // 풀이로 이동 (태블릿에서 스크롤 줄이기)
    setTimeout(() => document.querySelector('.result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const updateRules = (r: Rules) => {
    setRules(r);
    save('rules-v2', r);
    setAnswers(EMPTY);
    setResult(null);
  };

  const set = (k: keyof Answers) => (v: string) => setAnswers((a) => ({ ...a, [k]: v }));
  const hintCount = Object.values(hints).filter(Boolean).length;
  const done = result !== null;
  const [mode, setModeState] = useState<'descent' | 'mfk'>(() => load('mode', 'descent'));
  const setMode = (m: 'descent' | 'mfk') => {
    setModeState(m);
    save('mode', m);
  };

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-text">
          <p className="eyebrow">B787-9 · Flight Deck Trainer</p>
          <h1>{mode === 'descent' ? 'Energy Management Trainer' : 'MFK Typing Trainer'}</h1>
          <nav className="tabs" aria-label="연습 종류">
            <button type="button" className={mode === 'descent' ? 'on' : ''} onClick={() => setMode('descent')}>
              강하 계획
            </button>
            <button type="button" className={mode === 'mfk' ? 'on' : ''} onClick={() => setMode('mfk')}>
              MFK 타이핑
            </button>
          </nav>
          <div className="stats" hidden={mode !== 'descent'}>
            <span>문제 #{seed}</span>
            <span>
              누적 {stats.attempts}문제 · 평균 {stats.attempts ? (stats.score / stats.attempts).toFixed(1) : '–'}/4
            </span>
          </div>
        </div>
        <img className="hero-img" src={`${import.meta.env.BASE_URL}aircraft/climb.webp`} alt="B787-9" />
      </header>

      {mode === 'mfk' ? (
        <main className="mfk-main">
          <MfkTrainer />
        </main>
      ) : (
      <main className="layout">
        <section className="deck" aria-label="계기">
          <div className="deck-row">
            <div className="du">
              <PFD
                sc={sc}
                vmoKt={Math.min(rules.vmoKt, machToCas(rules.mmo, sc.altitudeFt))}
                baro={sc.altitudeFt >= TRANSITION_ALT_FT ? 'STD' : '1013 HPA'}
              />
              <span className="du-label">PFD</span>
            </div>
            <div className="du">
              <ND sc={sc} rules={rules} showGreenArc={hints.greenArc} showVsd={hints.vsd} />
              <span className="du-label">ND · MAP {sc.ndRangeNm} NM</span>
            </div>
          </div>
          <p className="brief">
            현재 <b>{fmtAlt(sc.altitudeFt)}</b>,{' '}
            <b>{sc.machPhase ? `M${sc.mach.toFixed(3).slice(1)} (${sc.iasKt} KIAS)` : `${sc.iasKt} KIAS`}</b>로 VNAV SPD idle 강하
            중입니다 (강하 속도 M{rules.descentMach.toFixed(2).slice(1)}/{rules.descentCasKt} kt). 목표:{' '}
            <b>
              {sc.target.name} {sc.target.altFt.toLocaleString()} ft / {sc.target.speedKt} kt
            </b>
            {sc.type === 'APPROACH' ? ' (Flaps Up 기동 속도, 직진 진입 지점)' : ' (10,000 ft · 250 kt 크로스체크)'}.
          </p>

          <div className="hints">
            <span>힌트{hintCount ? ` (${hintCount}개 사용)` : ''}:</span>
            <label>
              <input type="checkbox" checked={hints.legs} onChange={(e) => setHints({ ...hints, legs: e.target.checked })} /> LEGS 거리
            </label>
            <label>
              <input type="checkbox" checked={hints.wind} onChange={(e) => setHints({ ...hints, wind: e.target.checked })} /> 바람 성분
            </label>
            <label>
              <input type="checkbox" checked={hints.greenArc} onChange={(e) => setHints({ ...hints, greenArc: e.target.checked })} /> Green arc
            </label>
            <label>
              <input type="checkbox" checked={hints.vsd} onChange={(e) => setHints({ ...hints, vsd: e.target.checked })} /> VSD
            </label>
          </div>
          {(hints.legs || hints.wind) && (
            <div className="hint-box">
              {hints.legs && (
                <table>
                  <tbody>
                    {sc.waypoints.map((w, i) => (
                      <tr key={w.name + i}>
                        <td>{w.name}</td>
                        <td>{sc.legsNm[i].toFixed(1)} NM</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {hints.wind && (
                <p>
                  트랙 {String(sc.trackDeg).padStart(3, '0')}° 기준 {sc.windComponentKt >= 0 ? '배풍' : '정풍'}{' '}
                  {Math.abs(sc.windComponentKt)} kt
                </p>
              )}
            </div>
          )}
        </section>

        <section className="card quiz" aria-label="문제">
          <h2>판단하기</h2>
          <Field
            n={1}
            label="거리 에너지 (고도 + 속도 + 바람)"
            hint="천 ft × 3.5 · 10 kt당 1 NM · 바람 10 kt × 만 ft당 1 NM"
            unit="NM"
            value={answers.required}
            onChange={set('required')}
            disabled={done}
            res={result?.required}
          />
          <Field
            n={2}
            label="ND로 확인한 남은 거리"
            unit="NM"
            value={answers.trackMiles}
            onChange={set('trackMiles')}
            disabled={done}
            res={result?.trackMiles}
          />
          <div className={`q ${result ? (result.state.ok ? 'ok' : 'bad') : ''}`}>
            <span className="qn">3</span>
            <div className="qbody">
              <span className="qlabel">± 결정 (±{rules.onProfileToleranceNm} NM)</span>
              <div className="seg">
                {(
                  [
                    ['HIGH', '높음 (High)'],
                    ['ON', '적정'],
                    ['LOW', '낮음 (Low)'],
                  ] as [EnergyState, string][]
                ).map(([v, t]) => (
                  <button
                    key={v}
                    type="button"
                    className={answers.state === v ? 'on' : ''}
                    disabled={done}
                    onClick={() => setAnswers((a) => ({ ...a, state: v, action: '' }))}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {answers.state === 'HIGH' && (
            <Field
              n={4}
              label="Manage: Speedbrake 해제 고도"
              hint="SB 1,000 ft = 2 NM 회수"
              unit="ft / FL"
              placeholder="예: FL150 또는 12000"
              text
              value={answers.action}
              onChange={set('action')}
              disabled={done}
              res={result?.action}
            />
          )}
          {answers.state === 'LOW' && (
            <Field
              n={4}
              label="Manage: 강하를 늦출 거리 (수평 비행)"
              hint="남는 거리만큼 수평 비행"
              unit="NM"
              value={answers.action}
              onChange={set('action')}
              disabled={done}
              res={result?.action}
            />
          )}
          {answers.state === 'ON' && result && (
            <p className={`note ${result.action.ok ? 'ok' : 'bad'}`}>{result.action.note}</p>
          )}

          {!done ? (
            <button className="primary" type="button" onClick={submit} disabled={!answers.state}>
              채점하기
            </button>
          ) : (
            <div className="score">
              <strong>
                {result.score} / {result.max}
              </strong>
              <button className="primary" type="button" onClick={next}>
                다음 문제 →
              </button>
            </div>
          )}
          {!done && (
            <button className="link" type="button" onClick={next}>
              다른 문제로 바꾸기
            </button>
          )}
        </section>

        {done && (
          <section className="card result" aria-label="풀이">
            <h2>풀이</h2>
            <ProfileChart sc={sc} rules={rules} />
            <Explanation sc={sc} rules={rules} grade={result} answers={answers} />
          </section>
        )}

        <Settings rules={rules} onChange={updateRules} />
      </main>
      )}

      <footer>
        훈련용 참고 자료입니다. 실제 운항에 사용하지 마세요. 기준: 787 FCTM Descent Planning (4.20–4.22), 787-9 강하율 표, 계기 배치는
        787 FCOM 10.10 / 10.30 / 10.40. 정밀 계산은 ISA와 일정한 바람을 가정합니다.
      </footer>
    </div>
  );
}

interface FieldProps {
  n: number;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  res?: { ok: boolean | null; note?: string };
  placeholder?: string;
  text?: boolean;
  hint?: string;
}

function Field({ n, label, unit, value, onChange, disabled, res, placeholder, text, hint }: FieldProps) {
  return (
    <div className={`q ${res ? (res.ok ? 'ok' : 'bad') : ''}`}>
      <span className="qn">{n}</span>
      <label className="qbody">
        <span className="qlabel">{label}</span>
        {hint && <span className="qhint">{hint}</span>}
        <span className="inp">
          <input
            inputMode={text ? 'text' : 'decimal'}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          <em>{unit}</em>
        </span>
        {res?.note && <span className="note">{res.note}</span>}
      </label>
    </div>
  );
}
