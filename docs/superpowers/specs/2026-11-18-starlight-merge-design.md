# 봄봄 아케이드 제3의 게임 「별빛 톡톡 합체」 설계 명세서

**작성일:** 2026-11-18  
**대상 프로젝트:** `bombom-arcade/`

---

## 1. 개요

- 기존 2종 미니게임(`dodge`, `stack`)에 더해 수박게임 스타일의 물리 기반 합체 퍼즐 **「별빛 톡톡 합체 (`merge`)」**를 추가한다.
- 보유 황금별(`10:1` 환전), 스킨 6종, 실시간 TOP 15 명예의 전당, 자랑하기 카드, 별명+4자리 PIN 클라우드 백업/복구를 모두 공유한다.

---

## 2. 게임 디자인 (`src/games/starlightMerge.js`)

### 2.1 캔버스 및 병 영역
- 캔버스 크기: `MERGE_WIDTH = 368`, `MERGE_HEIGHT = 430` (기존 게임과 동일)
- 병 내부 경계: `WALL_LEFT = 20`, `WALL_RIGHT = 348`, `FLOOR_Y = 412`
- 상단 위험선: `DANGER_LINE_Y = 98`
- 낙하 대기 Y: `DROP_PREVIEW_Y = 58`

### 2.2 8단계 봄봄 진화 트리 (`MERGE_TIERS`)
| Tier | 이름 (KO / EN) | 반지름 | 합체 점수 | 합체 미니별 (`★`) |
|---:|---|---:|---:|---:|
| 0 | 별사탕 / Star Drop | 14 | 1 | 1 |
| 1 | 민트 구슬 / Mint Orb | 19 | 3 | 1 |
| 2 | 딸기 슬라임 / Berry Slime | 25 | 6 | 2 |
| 3 | 리본 토끼 / Ribbon Bunny | 32 | 10 | 3 |
| 4 | 로켓 냥이 / Rocket Kitty | 40 | 15 | 4 |
| 5 | 무지개 구름 / Rainbow Cloud | 49 | 21 | 6 |
| 6 | 왕별 봄봄 / Star BomBom | 59 | 28 | 8 |
| 7 | 골드 유니콘 / Gold Unicorn | 70 | 40 | 12 |

- **스폰 풀:** 플레이어가 떨어뜨릴 수 있는 구슬은 `Tier 0 ~ Tier 3` 중에서 랜덤 선택되며, 현재 구슬 + `NEXT` 구슬 미리보기를 제공한다.
- **최종 보너스:** `Tier 7` 골드 유니콘 2개가 접촉하면 둘 다 무지개 파티클과 함께 사라지며 **+100점 + 미니별 20★** 대보너스를 지급한다.

### 2.3 2D 원형 물리 엔진 및 합체 루프
- **서브스텝:** 프레임당 `SUBSTEPS = 5`로 분할 적분 (`MAX_DELTA_SECONDS = 0.05`)하여 터널링과 겹침 떨림 방지.
- **물리 상수:** `GRAVITY = 960 px/s²`, 벽/바닥 반발 `0.2`, 구슬 반발 `0.16`, 감쇠로 안착 시 떨림 억제.
- **합체 & 도미노 반동:** 동일 `tier` 두 구슬 접촉 시 중간 지점에서 `tier + 1` 구슬 생성 + 반경 `110px` 이내 주변 구슬에 약한 반동 충격 + `1.6초` 콤보 창(`combo` 1..6 배수 점수 보너스).
- **위험선 판정:** 드롭 후 `1.4초` 이상 지났거나 충돌을 겪어 `hasCollided` 상태인 구슬이 `y - radius < DANGER_LINE_Y`에 머물면 경고 상태 활성화, 연속 `1.8초` 초과 시 `gameOver`.

### 2.4 조작
- **포인터/터치:** `pointerdown` / `pointermove` 시 조준 X 이동, `pointerup` 시 드롭 (`0.42초` 쿨다운).
- **키보드:** `ArrowLeft` / `A`, `ArrowRight` / `D` 로 이동, `Space` / `Enter` 로 드롭.

---

## 3. 시스템 확장 및 하위 호환

- `storage.js`: `highScores: { dodge: 0, stack: 0, merge: 0 }` 확장 및 누락 필드 안전 복원.
- `profileBackup.js`: `merge` 최고점수 백업 직렬화.
- `leaderboard.js` & `shareCard.js`: `'merge'` 게임 타입 지원 (`getGameTitle` 매핑 함수로 분기 통합).
- `firestore.rules` (`firestore-rules-author` 위임):
  - `isValidGameType`: `gameType in ['dodge', 'stack', 'merge']`
  - `isValidHighScoresMap`: 기존 v1.1.0 클라이언트 하위 호환을 위해 `hasAll(['dodge', 'stack']) && hasOnly(['dodge', 'stack', 'merge'])` 및 `merge` 존재 시 정수 범위(`0..1000000`) 검증.
- `sound.js`: `drop` 및 `merge` 효과음 프리셋 추가.
- `Lobby.jsx`, `GameShell.jsx`, `Leaderboard.jsx`, `RestoreDialog.jsx`, `App.jsx`, `translations.js`, `app.css`: 3종 게임 카드·탭·HUD·요약 반영, `public/sw.js` 캐시 `bombom-arcade-web-v5` 갱신.
