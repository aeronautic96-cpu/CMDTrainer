// MFK 타이핑 연습: CDU 페이지의 빈칸을 MFK로 입력한다.
// 흐름: scratchpad에 입력 → ENTER(또는 해당 LSK) → ACT 페이지는 EXEC까지.
import { useCallback, useEffect, useRef, useState } from 'react';
import { load, save } from '../storage';
import { ALL_CATS, applyPlusMinus, CAT_LABEL, makeDrills, minKeystrokes, type Drill, type DrillCat } from './drills';
import MfkKeypad from './MfkKeypad';
import { CARD_MM, DEFAULT_PITCH_MM, detectPxPerMm, PANEL_H_KEYS, PANEL_W_RATIO } from './physical';

type Phase = 'setup' | 'run' | 'done';

interface ItemLog {
  ms: number;
  keys: number;
  minKeys: number;
  wrong: number;
}

interface Best {
  avgMs: number;
  date: string;
}

const COUNT_OPTIONS = [5, 10, 20];
const needsExec = (d: Drill) => d.title.startsWith('ACT');

export default function MfkTrainer() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [cats, setCats] = useState<DrillCat[]>(() => load<DrillCat[]>('mfk-cats', ALL_CATS));
  const [showAnswer, setShowAnswer] = useState<boolean>(() => load('mfk-show', true));
  const [count, setCount] = useState<number>(() => load('mfk-count', 10));
  const [best, setBest] = useState<Record<string, Best>>(() => load('mfk-best', {}));

  // 키 크기: 실제 크기(1:1) / 화면 맞춤
  const detected = useState(detectPxPerMm)[0];
  const [sizeMode, setSizeModeS] = useState<'real' | 'fit'>(() => load('mfk-size', 'real'));
  const [pitchMm, setPitchMmS] = useState<number>(() => load('mfk-pitch', DEFAULT_PITCH_MM));
  const [pxPerMm, setPxPerMmS] = useState<number>(() => load('mfk-pxmm', detected.pxPerMm));
  const setSizeMode = (v: 'real' | 'fit') => (setSizeModeS(v), save('mfk-size', v));
  const setPitchMm = (v: number) => (setPitchMmS(v), save('mfk-pitch', v));
  const setPxPerMm = (v: number) => (setPxPerMmS(v), save('mfk-pxmm', v));
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const h = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const realPitch = pitchMm * pxPerMm;
  const pitchPx =
    sizeMode === 'real'
      ? Math.min(realPitch, vp.w / PANEL_W_RATIO)
      : vp.w >= 600
        ? Math.min(realPitch, (Math.min(vp.w - 24, 960) - 352) / PANEL_W_RATIO, (vp.h - 24) / PANEL_H_KEYS)
        : Math.min(realPitch, (vp.w - 20) / PANEL_W_RATIO);
  const scalePct = Math.round((pitchPx / realPitch) * 100);

  const [items, setItems] = useState<Drill[]>([]);
  const [idx, setIdx] = useState(0);
  const [scratch, setScratch] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [entered, setEntered] = useState<string | null>(null); // 칸에 들어간 값 (EXEC 대기)
  const [flash, setFlash] = useState<'ok' | null>(null);
  const [logs, setLogs] = useState<ItemLog[]>([]);

  const cur = useRef({ start: 0, keys: 0, wrong: 0 });
  const drill = items[idx];
  const bestKey = `${[...cats].sort().join(',')}|${showAnswer ? 'show' : 'desc'}`;

  const start = () => {
    save('mfk-cats', cats);
    save('mfk-show', showAnswer);
    save('mfk-count', count);
    setItems(makeDrills(cats, count));
    setIdx(0);
    setLogs([]);
    resetItem();
    setPhase('run');
  };

  const resetItem = () => {
    setScratch('');
    setMsg(null);
    setEntered(null);
    setFlash(null);
    cur.current = { start: 0, keys: 0, wrong: 0 };
  };

  const finishItem = useCallback(() => {
    const d = items[idx];
    const log: ItemLog = {
      ms: performance.now() - cur.current.start,
      keys: cur.current.keys,
      minKeys: minKeystrokes(d.answer) + (needsExec(d) ? 1 : 0),
      wrong: cur.current.wrong,
    };
    const all = [...logs, log];
    setLogs(all);
    setFlash('ok');
    window.setTimeout(() => {
      if (idx + 1 >= items.length) {
        const avgMs = all.reduce((s, l) => s + l.ms, 0) / all.length;
        const prev = best[bestKey];
        if (!prev || avgMs < prev.avgMs) {
          const nb = { ...best, [bestKey]: { avgMs, date: new Date().toISOString().slice(0, 10) } };
          setBest(nb);
          save('mfk-best', nb);
        }
        setPhase('done');
      } else {
        setIdx(idx + 1);
        resetItem();
      }
    }, 450);
  }, [items, idx, logs, best, bestKey]);

  const submit = useCallback(() => {
    if (!drill || entered !== null) return;
    const v = scratch.trim();
    if (drill.accepts.includes(v)) {
      setEntered(v);
      setScratch('');
      if (!needsExec(drill)) finishItem();
    } else {
      cur.current.wrong++;
      setMsg('INVALID ENTRY');
    }
  }, [drill, entered, scratch, finishItem]);

  const onKey = useCallback(
    (k: string) => {
      if (phase !== 'run' || !drill || flash) return;
      if (cur.current.keys === 0) cur.current.start = performance.now();
      cur.current.keys++;

      if (msg) {
        // FMC: 메시지는 CLR로 지워야 한다 (입력하던 내용은 남음)
        if (k === 'CLR' || k === 'CLR_ALL') setMsg(null);
        return;
      }
      if (k === 'EXEC') {
        if (entered !== null) finishItem();
        return;
      }
      if (entered !== null) return; // EXEC 대기 중
      if (k === 'ENTER') return submit();
      if (k === 'CLR') return setScratch((s) => s.slice(0, -1));
      if (k === 'CLR_ALL') return setScratch('');
      if (k === 'DEL') return setScratch('DELETE');
      if (k === '+/-') return setScratch((s) => (s === 'DELETE' ? '-' : applyPlusMinus(s)).slice(0, 24));
      if (k === 'PREV' || k === 'NEXT') return;
      const ch = k === 'SP' ? ' ' : k;
      setScratch((s) => (s === 'DELETE' ? ch : (s + ch).slice(0, 24)));
    },
    [phase, drill, flash, msg, entered, submit, finishItem],
  );

  // 실물 키보드 (Mac/외장 키보드)
  useEffect(() => {
    if (phase !== 'run') return;
    const h = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      let k: string | null = null;
      if (/^[a-zA-Z0-9./]$/.test(key)) k = key.toUpperCase();
      else if (key === ' ') k = 'SP';
      else if (key === '-' || key === '+') k = '+/-';
      else if (key === 'Backspace') k = 'CLR';
      else if (key === 'Escape') k = 'CLR_ALL';
      else if (key === 'Enter') k = e.shiftKey ? 'EXEC' : 'ENTER';
      if (k) {
        e.preventDefault();
        onKey(k);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [phase, onKey]);

  if (phase === 'setup') {
    const b = best[bestKey];
    return (
      <section className="card mfk-setup">
        <h2>MFK 타이핑 연습</h2>
        <p className="muted">
          CDU 페이지의 빈칸(□)에 들어갈 값을 MFK로 입력하고 ENTER(또는 칸 옆 LSK)를 누르세요. ACT 페이지는 입력 후 EXEC까지 눌러야
          끝납니다. 틀리면 실제 FMC처럼 INVALID ENTRY가 뜨고, CLR로 지워야 계속할 수 있습니다.
        </p>
        <h4>연습 종류</h4>
        <div className="chips">
          {ALL_CATS.map((c) => (
            <label key={c} className={cats.includes(c) ? 'on' : ''}>
              <input
                type="checkbox"
                checked={cats.includes(c)}
                onChange={(e) => setCats(e.target.checked ? [...cats, c] : cats.filter((x) => x !== c))}
              />
              {CAT_LABEL[c]}
            </label>
          ))}
        </div>
        <h4>문제 표시</h4>
        <div className="seg two">
          <button type="button" className={showAnswer ? 'on' : ''} onClick={() => setShowAnswer(true)}>
            입력값 보여주기
          </button>
          <button type="button" className={!showAnswer ? 'on' : ''} onClick={() => setShowAnswer(false)}>
            설명만 (형식 연습)
          </button>
        </div>
        <h4>문제 수</h4>
        <div className="seg three">
          {COUNT_OPTIONS.map((n) => (
            <button key={n} type="button" className={count === n ? 'on' : ''} onClick={() => setCount(n)}>
              {n}문제
            </button>
          ))}
        </div>
        <h4>키 크기</h4>
        <div className="seg two">
          <button type="button" className={sizeMode === 'real' ? 'on' : ''} onClick={() => setSizeMode('real')}>
            실제 크기 (1:1, 스크롤)
          </button>
          <button type="button" className={sizeMode === 'fit' ? 'on' : ''} onClick={() => setSizeMode('fit')}>
            화면 맞춤 (전체 보기)
          </button>
        </div>
        <div className="size-row">
          <label>
            키 간격
            <input
              type="number"
              step={0.5}
              min={10}
              max={30}
              value={pitchMm}
              onChange={(e) => Number(e.target.value) > 0 && setPitchMm(Number(e.target.value))}
            />
            mm
          </label>
          <span>
            추정값 {DEFAULT_PITCH_MM} mm (Boeing CDU 기준). 실제 MFK에서 A 키 중심 → B 키 중심 거리를 재서 넣으세요.
          </span>
        </div>
        <div className="size-row">
          <label>
            화면 보정
            <input
              type="range"
              min={detected.pxPerMm * 0.8}
              max={detected.pxPerMm * 1.2}
              step={0.01}
              value={pxPerMm}
              onChange={(e) => setPxPerMm(Number(e.target.value))}
            />
          </label>
          <span>
            {detected.device} · 아래 막대에 신용카드 긴 변을 대고 길이가 같도록 조정
          </span>
          <button type="button" className="link" onClick={() => setPxPerMm(detected.pxPerMm)}>
            초기화
          </button>
        </div>
        <div className="card-ruler" style={{ width: Math.min(CARD_MM * pxPerMm, vp.w - 80) }}>
          신용카드 {CARD_MM} mm
        </div>
        <p className="muted">
          지금 화면에서 키 간격 {pitchMm} mm = {Math.round(realPitch)} px. {sizeMode === 'fit' ? `화면 맞춤 시 실제의 약 ${scalePct}%.` : scalePct < 100 ? `화면 폭 때문에 실제의 ${scalePct}%.` : '1:1 실제 크기.'}
        </p>
        <p className="muted">
          {b ? `이 설정 최고 기록: 문제당 평균 ${(b.avgMs / 1000).toFixed(1)}초 (${b.date})` : '이 설정의 기록이 아직 없습니다.'} · Mac
          키보드도 사용 가능 (Backspace = CLR, Esc = 전체 지우기, Shift+Enter = EXEC, − = +/−).
        </p>
        <button type="button" className="primary" disabled={!cats.length} onClick={start}>
          시작
        </button>
      </section>
    );
  }

  if (phase === 'done') {
    const totalMs = logs.reduce((s, l) => s + l.ms, 0);
    const firstTry = logs.filter((l) => l.wrong === 0).length;
    const keys = logs.reduce((s, l) => s + l.keys, 0);
    const minKeys = logs.reduce((s, l) => s + l.minKeys, 0);
    const b = best[bestKey];
    return (
      <section className="card mfk-setup">
        <h2>결과</h2>
        <div className="mfk-stats">
          <div>
            <b>{(totalMs / logs.length / 1000).toFixed(1)}초</b>
            <span>문제당 평균</span>
          </div>
          <div>
            <b>
              {firstTry}/{logs.length}
            </b>
            <span>한 번에 정답</span>
          </div>
          <div>
            <b>{Math.round((minKeys / keys) * 100)}%</b>
            <span>키 효율 (최소 {minKeys} / 실제 {keys})</span>
          </div>
          <div>
            <b>{b ? (b.avgMs / 1000).toFixed(1) + '초' : '–'}</b>
            <span>최고 기록</span>
          </div>
        </div>
        <ol className="mfk-log">
          {items.map((d, i) => (
            <li key={i} className={logs[i]?.wrong ? 'bad' : 'ok'}>
              <span>{CAT_LABEL[d.cat]}</span>
              <code>{d.answer}</code>
              <span>
                {((logs[i]?.ms ?? 0) / 1000).toFixed(1)}초{logs[i]?.wrong ? ` · 오답 ${logs[i].wrong}` : ''}
              </span>
            </li>
          ))}
        </ol>
        <div className="score">
          <button type="button" className="primary" onClick={start}>
            다시 하기
          </button>
          <button type="button" className="link" onClick={() => setPhase('setup')}>
            설정 바꾸기
          </button>
        </div>
      </section>
    );
  }

  const showHint = showAnswer || cur.current.wrong >= 2;
  const title = entered !== null && needsExec(drill) ? drill.title.replace(/^ACT/, 'MOD') : drill.title;

  const execWait = entered !== null && needsExec(drill);
  const keypad = <MfkKeypad onKey={onKey} pitchPx={pitchPx} decor={sizeMode === 'real'} execLit={execWait} />;
  const lsk = (i: number, side: 'L' | 'R') => (
    <button
      type="button"
      className="lsk"
      aria-label={`LSK ${i + 1}${side}`}
      onPointerDown={(e) => {
        e.preventDefault();
        if (drill.target.row === i && drill.target.side === side) onKey('ENTER');
      }}
    />
  );
  const cduView = (
    <div className={`cdu ${flash === 'ok' ? 'ok' : ''}`}>
      <div className="cdu-title">{title}</div>
      {Array.from({ length: 6 }, (_, i) => {
        const row = drill.rows[i] ?? {};
        const cell = (side: 'L' | 'R') => {
          const v = side === 'L' ? row.l : row.r;
          if (drill.target.row === i && drill.target.side === side) {
            return <span className={`fld target ${entered !== null ? 'filled' : ''}`}>{entered ?? v}</span>;
          }
          return <span className="fld">{v}</span>;
        };
        return (
          <div key={i} className="cdu-row">
            {lsk(i, 'L')}
            <div className="cdu-cells">
              <div className="cdu-labels">
                <span>{row.lLabel}</span>
                <span>{row.rLabel}</span>
              </div>
              <div className="cdu-vals">
                {cell('L')}
                {cell('R')}
              </div>
            </div>
            {lsk(i, 'R')}
          </div>
        );
      })}
      <div className={`cdu-scratch ${msg ? 'msg' : ''}`}>
        {msg ?? scratch}
        {!msg && <span className="caret" />}
      </div>
    </div>
  );

  return (
    <section className={`mfk-run ${sizeMode}`}>
      <div className="mfk-left">
        <div className="mfk-top">
          <span>
            {idx + 1} / {items.length}
          </span>
          <span>{CAT_LABEL[drill.cat]}</span>
          <button type="button" className="link" onClick={() => setSizeMode(sizeMode === 'real' ? 'fit' : 'real')}>
            {sizeMode === 'real' ? '화면 맞춤으로' : '실제 크기로'}
          </button>
          <button type="button" className="link" onClick={() => setPhase('setup')}>
            그만하기
          </button>
        </div>
        <div className="task">
          <p>{drill.desc}</p>
          {showHint && (
            <p className="task-answer">
              입력: <code>{drill.answer}</code>
            </p>
          )}
          {execWait && <p className="task-exec">EXEC를 눌러 실행하세요</p>}
        </div>
        {cduView}
      </div>

      {sizeMode === 'real' && (
        <div className="scratch-strip">
          <span className="t">
            <b>{drill.desc}</b>
            {showHint && <> · {drill.answer}</>}
          </span>
          <span className={`sp ${msg ? 'msg' : ''} ${execWait ? 'exec' : ''}`}>
            {msg ?? (execWait ? 'EXEC' : scratch || ' ')}
          </span>
        </div>
      )}
      <div className="mfk-pad">{keypad}</div>
    </section>
  );
}
