# 787-9 Flight Deck Trainer

B787-9 조종사 개인 훈련용 웹앱 (오프라인 사용 가능).

- **강하 계획 (Energy Management):** PFD·ND·VSD를 보고 거리 에너지 → 남은 거리 → ± 판단 → manage 순서로 연습. 채점 기준은 rule of thumb (고도 천 ft × 3.5, 감속 10 kt당 1 NM, 바람 10 kt × 만 ft당 1 NM, SB 1,000 ft = 2 NM).
- **MFK 타이핑:** 실제 크기 Multifunction Keypad로 CDU 페이지(LEGS, DES, DESCENT FORECAST 등) 입력 연습.

> 훈련용 참고 자료입니다. 실제 운항에 사용하지 마세요.

## 개발

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 계산 엔진 · 문제 생성기 테스트
npm run build    # dist/ 생성
```

## 배포 (GitHub Pages)

`main` 브랜치에 push하면 GitHub Actions가 테스트 → 빌드 → GitHub Pages 배포를 자동으로 합니다 (`.github/workflows/deploy.yml`).

처음 한 번만: 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정.

## iPad 설치

1. Safari로 `https://<계정>.github.io/<저장소>/` 열기
2. 공유 버튼 → **홈 화면에 추가**
3. 한 번 열면 앱 전체가 저장되어 오프라인에서도 실행됨. 새 버전을 배포하면 다음 실행 때 자동 업데이트.

기록과 설정은 iPad 안에만 저장됩니다.

## 구조

| 경로 | 내용 |
|---|---|
| `src/engine/` | 강하 계산 (rule of thumb · 정밀), 문제 생성, 채점 |
| `src/components/` | PFD, ND, VSD, 풀이 화면 |
| `src/mfk/` | MFK 키패드, CDU 화면, 타이핑 문제 |
| `public/` | 아이콘, 항공기 이미지 |
