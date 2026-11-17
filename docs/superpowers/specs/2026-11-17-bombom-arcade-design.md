# 봄봄 아케이드 (BomBom Arcade) 설계 명세서

**작성일:** 2026-11-17  
**프로젝트 경로:** `bombom-arcade/`  
**대상:** 초등학생 4학년 이상 (따님 맞춤 가볍고 안전한 크롬 확장 미니 아케이드)  
**기술 스택:** Chrome Extension Manifest V3 · React 18 · Vite · HTML5 Canvas · Web Audio API

---

## 1. 제품 개요 및 핵심 원칙

- **브랜드 표기:** 한국어 UI에서는 **`봄봄`** / **`봄봄 아케이드`**, 영어 UI에서는 **`BomBom`** / **`BomBom Arcade`**로 표기하며, 기본 마스코트 스킨 이름 역시 **`봄봄 (BomBom)`**으로 통일한다.
- **사용자 경험 목표:**
  - 팝업 클릭 즉시 1분 컷으로 부담 없이 즐길 수 있는 가벼운 아케이드 게임 2종 제공.
  - 밝고 경쾌한 파스텔 네온 비주얼, 부드러운 조작감, 실패 시에도 응원해 주는 피드백 문구 제공.
  - 두 게임에서 모은 **별(★)**을 공유해 귀여운 캐릭터 스킨 6종을 수집하는 성취감 부여.
- **안전 및 배포 원칙:**
  - 외부 서버 통신, 광고, 사용자 추적, 개인정보 수집이 전혀 없는 100% 로컬 동작.
  - `manifest.json` 권한은 `storage` 하나만 선언(`host_permissions`, `background`, `content_scripts` 미사용)하여 크롬 웹스토어 심사 리스크 최소화.

---

## 2. 디렉터리 및 파일 구조

```text
bombom-arcade/
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-11-17-bombom-arcade-design.md
├── public/
│   ├── manifest.json
│   ├── _locales/
│   │   ├── ko/messages.json
│   │   └── en/messages.json
│   └── icons/
│       ├── icon-16.png
│       ├── icon-48.png
│       └── icon-128.png
├── scripts/
│   ├── generate-icons.py
│   └── package-zip.sh
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── styles/
│   │   └── app.css
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── Lobby.jsx
│   │   ├── GameShell.jsx
│   │   └── SkinShop.jsx
│   ├── games/
│   │   ├── skins.js
│   │   ├── dodgeRunner.js
│   │   └── towerStack.js
│   ├── i18n/
│   │   └── translations.js
│   └── utils/
│       ├── storage.js
│       └── sound.js
├── tests/
│   ├── dodgeRunner.test.js
│   ├── towerStack.test.js
│   ├── storageAndSkins.test.js
│   └── translations.test.js
├── index.html
├── package.json
├── vite.config.js
├── CHROMEWEBSTORE.md
└── PRIVACY_POLICY.md
```

---

## 3. UI 및 화면 흐름

### 3.1 뷰포트 및 실행 모드
- **팝업 모드 (기본):** `400px × 580px` 고정 컨테이너.
- **새 탭 크게 보기 모드 (`index.html?mode=full`):** 상단 헤더의 확대 아이콘 클릭 시 `window.open(chrome.runtime.getURL('index.html?mode=full'), '_blank')` (또는 일반 브라우저 환경 폴백 `window.open('?mode=full', '_blank')`)로 새 탭에서 실행. `tabs` 권한이 필요 없다.

### 3.2 화면 구성
1. **Header (`Header.jsx`):**
   - 좌측: `봄봄` / `BomBom` 배지 로고 (게임/상점 화면에서는 뒤로가기 버튼 포함).
   - 우측: 보유 별(`★ N`) 카운터, `KO/EN` 언어 전환 버튼, 사운드 음소거 토글, 새 탭 확대 버튼(팝업 모드일 때만 표시).
2. **Lobby (`Lobby.jsx`):**
   - 장착 중인 스킨 캐릭터 프리뷰와 인사말.
   - 게임 선택 카드 2종 (`별빛 닷지 / Star Dodge`, `하늘 타워 쌓기 / Sky Stacker`) — 각 게임의 최고 점수, 조작법 한 줄 요약, 플레이 버튼.
   - 하단 `스킨 도감 & 상점` 버튼 (해금 수 `unlocked/6` 표시).
3. **GameShell (`GameShell.jsx`):**
   - 논리 해상도 `368×430` `<canvas>` 호스트.
   - 상단 인게임 HUD: 현재 점수, 이번 판 획득 별, 콤보 배지, 활성 아이템/일시정지 버튼.
   - 시작 전 간단 안내 오버레이 및 게임 오버 결과 다이얼로그 (`<dialog>` 또는 접근성 준수 모달: 최종 점수, 최고 기록 갱신 배지, 획득 별 `+N★`, 응원 메시지, `다시 하기` / `로비로`).
4. **SkinShop (`SkinShop.jsx`):**
   - 6종 스킨 카드 그리드 (아이콘 미리보기, 이름, 가격 또는 `보유중`/`장착중` 상태).
   - 별이 부족한 경우 부족한 별 개수 안내; 충분하면 클릭 한 번으로 즉시 해금 및 장착.

---

## 4. 게임 메카닉 상세 명세

### 4.1 게임 ①: 별빛 닷지 러너 (`dodgeRunner.js`)
- **조작:** 키보드 `ArrowLeft` / `ArrowRight` / `A` / `D` 또는 캔버스 내 마우스/포인터 이동(드래그 및 호버 지원).
- **물리 및 판정:**
  - 델타타임(`dt`, 최대 `0.05s` 클램프) 기반 60fps 루프.
  - 플레이어 시각 반지름 `18px`, 충돌 판정 히트박스 반지름 `13px` (초등학생이 아쉽게 스치는 억울함을 줄이는 관대한 히트박스).
  - 키보드 이동 속도: `320px/s`. 포인터 조작 시 포인터 X 좌표로 부드럽게 추종.
- **장애물:**
  - 일반 운석: 반지름 `14~24px`, 낙하 속도 `145 + level * 18 px/s` (상한 `380px/s`).
  - 고속 경고 운석 (경과 12초 이후부터 일정 확률): 떨어질 X 위치에 **0.6초간 빨간 점선 경고선**을 먼저 표시한 뒤 고속(`450px/s`) 낙하.
- **별 & 특수 아이템:**
  - 반짝이는 별(`★`): 획득 시 `+1` 별, 기본 `+10 * combo` 점수. `1.8초` 이내 연속 획득 시 콤보 배수 상승(최대 `x5`).
  - 보호막(`shield`): 다음 충돌 1회 무효화 + `1.0초` 무적 점멸.
  - 자석(`magnet`): `5.0초` 동안 반경 `130px` 이내의 별을 플레이어 쪽으로 끌어당김.
  - 피버(`fever`): `4.0초` 동안 무적 + 별 생성률 `2.5배` + `BomBom FEVER!` 배너.
- **점수 및 종료:** 생존 시간(초당 `+5점`) + 별 점수를 합산. 보호막 없이 운석에 닿으면 게임 오버.

### 4.2 게임 ②: 하늘 타워 쌓기 (`towerStack.js`)
- **조작:** `Space`, `Enter`, 또는 캔버스 `pointerdown` (원버튼 조작).
- **초기값 및 물리:**
  - 기준 블록 폭 `160px`, 높이 `22px`, 초기 왕복 속도 `150px/s` (층당 `+4px/s`, 상한 `340px/s`).
- **배치 및 절단 로직 (`evaluatePlacement` 순수 함수):**
  - 이전 블록(`prev`)과 이동 블록(`curr`)의 X축 차이 `delta = curr.x - prev.x`.
  - **PERFECT 판정 (`|delta| <= 4`):** 위치가 `prev.x`에 딱 스냅되고 폭이 줄지 않음. `perfectCombo += 1`, 별 `+2`, 점수 `+(20 + perfectCombo * 5)`. **`5연속 PERFECT` 달성 시** `BomBom BONUS!`와 함께 현재 폭이 `16px` 회복(초기 폭 `160px` 상한).
  - **일반 배치 (`|delta| > 4` 이고 겹치는 폭 `overlapWidth > 2`):** 겹친 영역만 새 블록으로 남고(`newX = max(prev.x, curr.x)`, `newWidth = overlapWidth`), 튀어나온 여분은 중력으로 떨어지는 파편 애니메이션 처리. `perfectCombo = 0`, 별 `+1`, 점수 `+10`.
  - **실패 (`overlapWidth <= 2`):** 현재 블록 전체가 아래로 추락하며 게임 오버.
- **카메라 & 배경 고도 변화:**
  - 6층 이상부터 타워 상단이 화면 중앙 아래에 유지되도록 카메라 Y 오프셋 부드럽게 보간.
  - 층수에 따라 배경 그라데이션이 파스텔 초원(0~9층) → 맑은 하늘(10~19층) → 노을 성층권(20~29층) → 은하 우주(30층+)로 자연스럽게 변화.

---

## 5. 스킨 도감 (6종) 및 보상 밸런스

| ID | 한국어 이름 | 영어 이름 | 해금 비용 | 비주얼 특징 |
|----|-------------|-----------|-----------|-------------|
| `bombom` | 봄봄 | BomBom | 0★ (기본) | 코랄·골드 파스텔 별 마스코트 |
| `strawberry-slime` | 딸기 슬라임 | Berry Slime | 25★ | 말랑한 핑크 딸기 슬라임 |
| `rocket-cat` | 로켓 냥이 | Rocket Kitty | 50★ | 민트 고양이 우주 비행사 |
| `ribbon-bunny` | 리본 토끼 | Ribbon Bunny | 80★ | 라벤더 귀에 리본 달린 토끼 |
| `rainbow-cloud` | 무지개 구름 | Rainbow Cloud | 120★ | 몽실몽실 구름과 파스텔 무지개 꼬리 |
| `gold-unicorn` | 골드 유니콘 | Gold Unicorn | 180★ | 반짝이는 황금 뿔 유니콘 |

- 두 게임 모두 한 판에 평균 `6~15★`를 모을 수 있어 2~3판 만에 첫 스킨(`딸기 슬라임`, `25★`)을 해금할 수 있도록 설계한다.
- 장착된 스킨은 `dodgeRunner`의 플레이어 캐릭터·트레일 색상과 `towerStack`의 블록 팔레트·최상단 마스코트 아이콘에 함께 반영된다.

---

## 6. 데이터 저장, i18n, 사운드 및 에러 처리

### 6.1 저장 스키마 (`bombom_arcade_v1`)
```json
{
  "stars": 0,
  "highScores": {
    "dodge": 0,
    "stack": 0
  },
  "unlockedSkins": ["bombom"],
  "equippedSkin": "bombom",
  "settings": {
    "lang": "auto",
    "muted": false
  }
}
```
- **저장 어댑터 (`utils/storage.js`):**
  - `chrome?.storage?.local`이 존재하면 사용하고, 일반 웹 개발 환경(`npm run dev` / 테스트)에서는 `localStorage`로 투명하게 폴백한다.
  - 읽기 시 스키마 정규화 함수(`normalizeState`)를 거쳐 손상되거나 누락된 필드, 음수 `stars`, 미해금 `equippedSkin`을 안전한 기본값으로 복구한다.
- **팝업 닫힘 방어:** 게임 오버 및 스킨 구매/장착 직후 즉시 저장해 팝업이 갑자기 닫혀도 진행도가 유실되지 않는다.

### 6.2 다국어 (`i18n/translations.js` & `public/_locales/`)
- `lang === 'auto'`일 때 `navigator.language`가 `ko`로 시작하면 한국어, 그 외에는 영어를 기본 표시한다.
- 상단 토글 버튼으로 언제든 `KO` / `EN`을 즉시 전환하고 설정에 저장한다.

### 6.3 사운드 (`utils/sound.js`)
- 외부 오디오 파일 없이 Web Audio API(`AudioContext`)로 8비트 신디사이저 효과음(별 획득, 점프/착지, PERFECT 딩동, 아이템, 게임오버)을 생성한다.
- 브라우저 자동재생 정책으로 `AudioContext.state === 'suspended'`인 경우 첫 키/포인터 입력 시 안전하게 `resume()`하며, `AudioContext` 미지원 환경에서도 예외 없이 무음 처리한다.

---

## 7. 테스트 및 배포 준비 계획

### 7.1 자동화 테스트 (Vitest)
- `towerStack.test.js`: PERFECT 스냅 판정, 5연속 PERFECT 폭 회복 상한(`160px`), 오버행 절단 좌표/폭 계산, 빗나감(`overlap <= 2`) 게임 오버 판정 검증.
- `dodgeRunner.test.js`: 히트박스 충돌 판정, 보호막 방어, 자석 끌어당김 벡터, 피버 배수 및 콤보 타이머 만료 검증.
- `storageAndSkins.test.js`: 손상된 저장 데이터 정규화, 별 부족 시 스킨 해금 거부, 해금 및 장착 상태 전이 검증.
- `translations.test.js`: `ko`와 `en` 번역 딕셔너리 키 100% 일치 여부 및 브랜드 문구(`봄봄`, `BomBom`) 포함 검증.

### 7.2 빌드 및 E2E 검증
- `npm run build` 후 `dist/`에 `manifest.json`, `_locales/`, `icons/*.png`, 번들 JS/CSS가 누락 없이 출력되는지 확인.
- 실제 빌드 결과물을 브라우저(Playwright)로 열어 로비 → 게임 2종 플레이 → 게임오버 저장 → 스킨 상점 → 한/영 전환 동작을 직접 확인.

### 7.3 크롬 웹스토어 배포 패키지
- `CHROMEWEBSTORE.md`: 한/영 스토어 제목/설명, `storage` 단일 권한 사유, 데이터 비수집 고지, 스크린샷 규격(1280×800) 안내.
- `PRIVACY_POLICY.md`: 개인정보를 수집/전송하지 않음을 명시한 정책 문서.
- `scripts/package-zip.sh`: `dist/` 기준으로 불필요 파일(`.DS_Store`, 소스맵 등)을 제외하고 웹스토어 업로드용 `.zip`을 생성하는 스크립트.
