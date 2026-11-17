# 봄봄 아케이드 클라우드 백업 및 복구 설계 명세서

**작성일:** 2026-11-17  
**대상 프로젝트:** `bombom-arcade/` (Firebase Project: `bombom-arcade-woosai`, Firestore Database: `bombom-db`)

---

## 1. 배경 및 목적

- iOS Safari와 홈 화면 바로가기(Standalone PWA)는 WebKit 정책상 `localStorage` 및 IndexedDB(Firebase Anonymous Auth 세션 포함)가 완전히 격리되며, 홈 화면 바로가기를 삭제하면 해당 PWA의 로컬 데이터가 모두 삭제된다.
- 기존 구조는 `leaderboards/{gameType}/scores/{userId}`에 별명·최고점수·장착 스킨만 저장하므로, 보유 황금별(`stars`), 별조각(`starFragments`), 해금 스킨(`unlockedSkins`), 미등록 최고점수를 복구할 수 없었다.
- 개인정보(이메일·전화번호·실명)를 수집하지 않고도 초등학생이 쉽게 기억할 수 있는 **별명(2~10자) + 숫자 4자리 PIN** 조합으로 클라우드 자동 백업 및 즉시 복구를 제공한다.

---

## 2. 아키텍처 및 데이터 모델

### 2.1 해시 키 파생 (클라이언트 Web Crypto SHA-256)
- `normalizeNicknameKey(nickname)` = `nickname.trim().toLowerCase()`
- **별명 선점 키 (`claimKey`):** `SHA-256("bombom-claim-v1:" + normalizeNicknameKey(nickname))` (`[0-9a-f]{64}`)
  - Firestore 문서 ID 제약(`/`, `..`, 길이)과 원본 별명 노출을 동시에 피하기 위해 64자리 hex 해시를 사용한다.
- **프로필 백업 키 (`profileKey`):** `SHA-256("bombom-profile-v1:" + normalizeNicknameKey(nickname) + ":" + pin)` (`[0-9a-f]{64}`)
  - 원본 4자리 PIN은 **로컬 저장소(`localStorage`/`chrome.storage.local`)에도, Firestore에도 평문으로 저장하지 않는다.**
  - 로컬 상태에는 `backupKey` (`profileKey` 문자열 또는 `''`)만 보관한다.

### 2.2 Firestore 컬렉션 (`bombom-db`)

1. **`nicknameClaims/{claimKey}`**
   - 목적: 동일 별명 선점/중복 방지
   - 필드: `{ ownerUid: string, updatedAt: timestamp }`
   - 보안 규칙:
     - `allow list: if false;` (전체 별명 열거 차단)
     - `allow get: if isAuthenticated() && isValidSha256Hex(claimKey);`
     - `allow create: if isOwner(request.resource.data.ownerUid) && isValidNicknameClaim(request.resource.data);`
     - `allow update, delete: if false;` (최초 선점 불변성 유지; 복구 기기에서 PIN 변경 시에는 동일 별명이므로 claim 재작성을 생략하고 `profiles`만 새로 생성)

2. **`profiles/{profileKey}`**
   - 목적: 플레이어 진행 상태 자동 백업 및 복구
   - 필드 (허용 필드 엄격 제한):
     - `nickname`: string (`2..10`자)
     - `stars`: int (`0..1000000`)
     - `starFragments`: int (`0..9`)
     - `highScores`: map `{ dodge: int (0..1000000), stack: int (0..1000000) }`
     - `unlockedSkins`: list (`1..6`개, 허용 스킨 ID enum, 중복 불가 검증은 클라이언트 정규화 + 규칙 리스트 길이/타입/필수 `'bombom'` 포함 검증)
     - `equippedSkin`: string (허용 스킨 ID enum)
     - `updatedAt`: timestamp (`== request.time`)
   - 보안 규칙:
     - `allow list: if false;` (타인 백업 목록 스캔 원천 차단)
     - `allow get: if isAuthenticated() && isValidSha256Hex(profileKey);`
     - `allow create, update: if isAuthenticated() && isValidSha256Hex(profileKey) && isValidProfileBackup(request.resource.data);`
     - `allow delete: if false;`

3. **`leaderboards/{gameType}/scores/{userId}`** (기존 유지 + 조회 중복 제거)
   - 공개 순위표 문서 ID는 `request.auth.uid`를 유지하여 `profileKey`가 외부에 노출되지 않도록 격리한다.
   - `fetchLeaderboard(gameType)` 조회 시 상위 30건을 읽어 `nickname.trim().toLowerCase()` 기준으로 최고 점수 1건만 남기고(동점 시 `userId === currentUserId` 우선) 상위 15건을 반환한다.

---

## 3. 사용자 플로우 및 UI 설계

### 3.1 별명 & 복구용 PIN 설정 (`NicknameDialog.jsx`)
- 입력 필드:
  1. 별명 (2~10자, 기존 검증 규칙 동일)
  2. 복구용 4자리 숫자 PIN (`^\d{4}$`, 숫자 패드 `inputMode="numeric"`, `maxLength={4}`)
- 동작:
  - 기존 PIN 없는 v1.1.0 사용자도 별명을 그대로 두고 4자리 PIN을 입력해 백업을 활성화할 수 있다.
  - 이미 선점된 별명이면서 내 현재 활성 별명과 다를 경우, `"이미 사용 중인 별명이에요. 내 기록이라면 [기록 복구]를 눌러주세요."` 안내와 함께 복구 화면으로 바로 이동할 수 있는 버튼을 제공한다.
  - 저장 성공 시 `nicknameClaims` 등록(신규 별명인 경우) → `profiles/{profileKey}` 백업 생성 → 로컬 상태에 `nickname` + `backupKey` 저장 → 순위표 동기화.

### 3.2 기록 복구 (`RestoreDialog.jsx` + 로비/별명창 진입)
- 진입 경로:
  - 로비 `hero-chips` 영역의 `[기록 복구]` 버튼
  - `NicknameDialog` 하단의 `[이미 계정이 있나요? 기록 복구하기]` 버튼
- 동작:
  1. `별명` + `4자리 숫자 PIN` 입력 후 조회 (`previewProfileBackup`).
  2. 클라이언트 무차별 대입 억제: 연속 5회 불일치 시 30초 쿨다운 타이머 적용.
  3. 백업 조회 성공 시:
     - 현재 기기에 임시 진행분(`nickname`, `stars > 0`, `starFragments > 0`, `unlockedSkins.length > 1`, `highScores > 0`)이 있으면 요약 카드(백업 별명·황금별·스킨 수·최고점수)와 함께 **"현재 기기 기록을 덮어쓰고 복원할까요?"** 2단계 확인.
     - 현재 기기가 초기 상태(진행분 0)이면 확인 없이 즉시 복원.
  4. 복원 완료 시:
     - 로컬 `appState`를 클라우드 백업 상태(`normalizeState` + `backupKey: profileKey`)로 교체 및 저장.
     - 새 기기 익명 UID로 `leaderboards`에 복원된 최고 점수/스킨 동기화.

### 3.3 자동 클라우드 백업 (`App.jsx`)
- `appState.backupKey`가 존재할 때 다음 시점에 백그라운드로 `syncProfileBackup(backupKey, nextState)` 실행:
  - 게임 종료 후 별/최고점수 저장 시 (`handleGameOverPersist`)
  - 스킨 해금 시 (`handleUnlockSkin`)
  - 스킨 장착 시 (`handleEquipSkin`)
- 네트워크 실패 시 로컬 저장은 영향받지 않으며 경고 로그(`console.warn`)만 남기고 다음 변경 시 최신 전체 상태로 재동기화된다.

---

## 4. 개인정보처리방침 및 배포 체크리스트

1. `PRIVACY_POLICY.md` (영문/한국어): 선택적 클라우드 백업 시 저장 항목(별명, 게임 진행도, 단방향 해시 키) 및 평문 PIN/개인정보 미수집 명시.
2. `firestore.rules`: `firestore-rules-author` 서브에이전트로 작성·감사 후 `firebase deploy --only firestore:rules`로 `bombom-db`에 실제 반영.
3. 단위 테스트 (`tests/backup.test.js`, `tests/storageAndSkins.test.js`, `tests/leaderboard.test.js`, `tests/translations.test.js`) + Playwright E2E + `npm run package` + GitHub Pages 배포 검증.
