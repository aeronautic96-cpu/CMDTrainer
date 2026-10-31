// 787 Multifunction Keypad — FCOM 10.10.55 배열.
// 모든 치수는 키 간격(--p, px) 배수로 정한다 → 실제 크기(mm)로 맞출 수 있음.
import { useRef, type CSSProperties } from 'react';

export type MfkKey = string; // 'A'..'Z', '0'..'9', '.', '/', '+/-', 'SP', 'DEL', 'CLR', 'CLR_ALL', 'ENTER', 'EXEC', ...

interface Props {
  onKey: (k: MfkKey) => void;
  pitchPx: number; // 키 중심 간격 (px)
  decor?: boolean; // LOWER MFD 스위치·커서 노브·나사 표시
  execLit?: boolean;
}

const NUM = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '+/-'];
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXY'.split('');
const BOXED = new Set(['E', 'N', 'S', 'W']);

export default function MfkKeypad({ onKey, pitchPx, decor = true, execLit }: Props) {
  // CLR: 짧게 = 한 글자, 길게(0.6초) = 전체 삭제
  const clrTimer = useRef<number | null>(null);
  const clrHeld = useRef(false);
  const clrDown = () => {
    clrHeld.current = false;
    clrTimer.current = window.setTimeout(() => {
      clrHeld.current = true;
      onKey('CLR_ALL');
    }, 600);
  };
  const clrUp = () => {
    if (clrTimer.current) window.clearTimeout(clrTimer.current);
    clrTimer.current = null;
    if (!clrHeld.current) onKey('CLR');
  };

  const press = (k: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    onKey(k);
  };

  return (
    <div className={`mfk ${decor ? '' : 'bare'}`} style={{ '--p': `${pitchPx}px` } as CSSProperties} aria-label="Multifunction Keypad">
      {decor && (
        <>
          <span className="screw tl" />
          <span className="screw tr" />
          <span className="screw bl" />
          <span className="screw br" />
          <div className="mfk-lower">
            <span className="mfk-cap">LOWER MFD</span>
            <div className="mfk-sw">
              {['SYS', 'CDU', 'INFO', 'CHKL', 'COMM', 'ND'].map((s) => (
                <span key={s} className={`sw ${s === 'CDU' ? 'on' : ''}`}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mfk-grid mfk-num">
        {NUM.map((k) => (
          <button key={k} type="button" className="key round" onPointerDown={press(k)}>
            {k === '+/-' ? '+/−' : k}
          </button>
        ))}
        <button type="button" className="key enter" onPointerDown={press('ENTER')}>
          {'ENTER'.split('').map((c) => (
            <span key={c}>{c}</span>
          ))}
        </button>
      </div>

      <div className="mfk-grid mfk-alpha">
        {ALPHA.map((k) => (
          <button key={k} type="button" className="key" onPointerDown={press(k)}>
            <span className={BOXED.has(k) ? 'boxed' : ''}>{k}</span>
          </button>
        ))}
        <button type="button" className="key" onPointerDown={press('Z')}>
          Z
        </button>
        <button type="button" className="key sm" onPointerDown={press('SP')}>
          SP
        </button>
        <button type="button" className="key sm" onPointerDown={press('DEL')}>
          DEL
        </button>
        <button type="button" className="key" onPointerDown={press('/')}>
          /
        </button>
        <button
          type="button"
          className="key sm"
          onPointerDown={(e) => {
            e.preventDefault();
            clrDown();
          }}
          onPointerUp={clrUp}
          onPointerLeave={() => clrTimer.current && clrUp()}
        >
          CLR
        </button>
      </div>

      <div className="mfk-exec">
        <span className={`exec-light ${execLit ? 'lit' : ''}`} />
        <button type="button" className="key page" onPointerDown={press('PREV')}>
          PREV
          <br />
          PAGE
        </button>
        <button type="button" className="key page" onPointerDown={press('NEXT')}>
          NEXT
          <br />
          PAGE
        </button>
        <button type="button" className="key exec" onPointerDown={press('EXEC')}>
          EXEC
        </button>
      </div>

      {decor && (
        <div className="mfk-knob">
          <span className="knob" />
          <span className="mfk-cap">CURSOR CONTROL</span>
        </div>
      )}
    </div>
  );
}
