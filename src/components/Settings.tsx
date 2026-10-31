import { DEFAULT_RULES, type Rules } from '../engine/rules';

type NumKey =
  | 'descentMach'
  | 'descentCasKt'
  | 'flapsUpSpeedKt'
  | 'nmPer1000ft'
  | 'thumbDecelNmPer10Kt'
  | 'thumbWindNmPer10KtPer10000ft'
  | 'thumbSbNmPer1000ft'
  | 'onProfileToleranceNm';

const GROUPS: { title: string; fields: { k: NumKey; label: string; step: number }[] }[] = [
  {
    title: '강하 속도',
    fields: [
      { k: 'descentMach', label: 'Descent Mach', step: 0.01 },
      { k: 'descentCasKt', label: 'Descent CAS (kt)', step: 5 },
      { k: 'flapsUpSpeedKt', label: 'Flaps Up 기동 속도 (kt)', step: 5 },
    ],
  },
  {
    title: 'Rule of thumb',
    fields: [
      { k: 'nmPer1000ft', label: '고도 1,000 ft당 (NM)', step: 0.1 },
      { k: 'thumbDecelNmPer10Kt', label: '감속 10 kt당 (NM)', step: 0.1 },
      { k: 'thumbWindNmPer10KtPer10000ft', label: '바람 10 kt × 10,000 ft당 (NM)', step: 0.1 },
      { k: 'thumbSbNmPer1000ft', label: 'SB 1,000 ft당 회수 (NM)', step: 0.1 },
      { k: 'onProfileToleranceNm', label: '"적정" 범위 ± (NM)', step: 0.5 },
    ],
  },
];

export default function Settings({ rules, onChange }: { rules: Rules; onChange: (r: Rules) => void }) {
  return (
    <details className="card settings">
      <summary>계산 기준 설정 (회사 SOP에 맞게 조정)</summary>
      {GROUPS.map((g) => (
        <div key={g.title}>
          <h4>{g.title}</h4>
          <div className="grid">
            {g.fields.map(({ k, label, step }) => (
              <label key={k}>
                <span>{label}</span>
                <input
                  type="number"
                  step={step}
                  value={rules[k]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v > 0) onChange({ ...rules, [k]: v });
                  }}
                />
                <em>기본 {DEFAULT_RULES[k]}</em>
              </label>
            ))}
          </div>
        </div>
      ))}
      <p className="muted">
        FCTM 고정값: 330→250 kt 감속 9 NM, 250→Flaps Up 4 NM, SB 사용 시 감속 거리 60% 단축. 787-9 강하율 (clean / SB): 330 kt 2,700 /
        6,500, 250 kt 1,500 / 3,400, Flaps Up 1,200 / 2,400 fpm. 설정을 바꾸면 같은 문제 번호로 다시 계산합니다.
      </p>
      <button type="button" className="link" onClick={() => onChange(DEFAULT_RULES)}>
        기본값으로 되돌리기
      </button>
    </details>
  );
}
