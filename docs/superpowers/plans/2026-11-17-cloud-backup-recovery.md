# BomBom Arcade Cloud Backup & Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable players (including iOS Safari / Standalone PWA users) to automatically back up and restore their full BomBom Arcade profile (`nickname`, `stars`, `starFragments`, `highScores`, `unlockedSkins`, `equippedSkin`) across devices or after clearing/deleting the PWA, using only `nickname + 4-digit PIN` with zero personal info collected.

**Architecture:** Client derives two deterministic SHA-256 hex keys via Web Crypto: `claimKey` from normalized nickname (for `nicknameClaims/{claimKey}` uniqueness) and `profileKey` from normalized nickname + 4-digit PIN (for `profiles/{profileKey}` backup/restore). Raw PINs are never persisted locally or remotely; only `backupKey` (`profileKey`) is stored locally alongside normalized state. `leaderboards/{gameType}/scores/{userId}` keeps using `request.auth.uid` to isolate `profileKey` from public listings, while `fetchLeaderboard` deduplicates recovered devices by normalized nickname.

**Tech Stack:** React 18 · Vite 5 · Firebase Auth (Anonymous) · Cloud Firestore Enterprise (`bombom-db`) · Vitest · Playwright

**Spec:** `docs/superpowers/specs/2026-11-17-cloud-backup-recovery-design.md`

## Global Constraints
- Follow existing code conventions: full-word identifiers (even loop indices), single-line noun-phrase WHY comments, no `catch {}` silent failures, bilingual `ko`/`en` key parity in `src/i18n/translations.js`.
- Mandatory specialist delegation: `firestore.rules` MUST be authored/modified via `firestore-rules-author` subagent (never edited directly by the main agent).
- Never store raw 4-digit PIN in `localStorage`, `chrome.storage.local`, or Firestore documents.
- `leaderboards/{gameType}/scores/{userId}` document ID MUST remain `request.auth.uid`.

---

### Task 1: Firestore Security Rules (`firestore.rules`)

**Files:**
- Modify: `firestore.rules` (via `firestore-rules-author` subagent)

- [ ] **Step 1:** Invoke `firestore-rules-author` subagent with exact schema requirements for `bombom-db` (`firestore.rules`):
  - Preserve existing `leaderboards/{gameType}/scores/{userId}` rules untouched.
  - Add `nicknameClaims/{claimKey}`:
    - `claimKey` must match `^[0-9a-f]{64}$`.
    - `allow list: if false;`
    - `allow get: if isAuthenticated() && isValidSha256Hex(claimKey);`
    - `allow create: if isOwner(request.resource.data.ownerUid) && isValidSha256Hex(claimKey) && hasOnlyAllowedFields(request.resource.data, ['ownerUid', 'updatedAt']) && request.resource.data.ownerUid is string && request.resource.data.updatedAt == request.time;`
    - `allow update, delete: if false;`
  - Add `profiles/{profileKey}`:
    - `profileKey` must match `^[0-9a-f]{64}$`.
    - Required & only allowed fields: `['nickname', 'stars', 'starFragments', 'highScores', 'unlockedSkins', 'equippedSkin', 'updatedAt']`
    - `nickname`: `validStringLength(data.nickname, 2, 10)`
    - `stars`: `data.stars is int && data.stars >= 0 && data.stars <= 1000000`
    - `starFragments`: `data.starFragments is int && data.starFragments >= 0 && data.starFragments <= 9`
    - `highScores`: `data.highScores is map && data.highScores.keys().hasAll(['dodge', 'stack']) && data.highScores.keys().hasOnly(['dodge', 'stack']) && data.highScores.dodge is int && data.highScores.dodge >= 0 && data.highScores.dodge <= 1000000 && data.highScores.stack is int && data.highScores.stack >= 0 && data.highScores.stack <= 1000000`
    - `unlockedSkins`: `data.unlockedSkins is list && data.unlockedSkins.size() >= 1 && data.unlockedSkins.size() <= 6 && 'bombom' in data.unlockedSkins`
    - `equippedSkin`: `isValidSkinId(data.equippedSkin) && data.equippedSkin in data.unlockedSkins`
    - `updatedAt`: `data.updatedAt is timestamp && data.updatedAt == request.time`
    - `allow list: if false;`
    - `allow get: if isAuthenticated() && isValidSha256Hex(profileKey);`
    - `allow create, update: if isAuthenticated() && isValidSha256Hex(profileKey) && isValidProfileBackup(request.resource.data);`
    - `allow delete: if false;`
- [ ] **Step 2:** Verify `firestore.rules` syntax/rules via Firebase CLI deploy (`firebase deploy --only firestore:rules` against `bombom-arcade-woosai`) when ready to test/ship.

---

### Task 2: Storage `backupKey` & Overwrite Check (`src/utils/storage.js`, `tests/storageAndSkins.test.js`)

**Files:**
- Modify: `src/utils/storage.js`
- Modify: `tests/storageAndSkins.test.js`

- [ ] **Step 1:** Write failing unit tests in `tests/storageAndSkins.test.js`:
  - `createDefaultState()` includes `backupKey: ''`.
  - `normalizeState()` accepts valid 64-char lowercase hex `backupKey` and resets malformed/uppercase/short `backupKey` to `''`.
  - `hasProgressToOverwrite(state, targetBackupKey)` returns `false` for fresh/empty state or matching `backupKey`, and `true` when local state has stars/fragments/nickname/highScores/unlockedSkins and differs from `targetBackupKey`.
- [ ] **Step 2:** Run `npx vitest run tests/storageAndSkins.test.js` and verify failure.
- [ ] **Step 3:** Update `src/utils/storage.js` to add `backupKey: ''` validation (`SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/`) and export `hasProgressToOverwrite(state, targetBackupKey)`.
- [ ] **Step 4:** Run `npx vitest run tests/storageAndSkins.test.js` and confirm PASS.

---

### Task 3: Cloud Backup & Recovery Module (`src/utils/profileBackup.js`, `tests/profileBackup.test.js`)

**Files:**
- Create: `src/utils/profileBackup.js`
- Create: `tests/profileBackup.test.js`

- [ ] **Step 1:** Write failing unit tests in `tests/profileBackup.test.js` (testing pure helpers + mocked Firestore/Auth adapter or dependency-injected helpers where needed, keeping crypto real):
  - `validatePin`: accepts `'0000'`, `'1234'`; trims whitespace if string?; wait: reject spaces/letters/3-digit/5-digit (`'123'`, `'12345'`, `'abcd'`, `'12 4'`, `1234`). Let's require exact 4 ASCII digits `/^\d{4}$/` on string (`rawPin.trim()` or exact string). Let's decide: trim whitespace? No, rejecting non-4-digit strings or trimming edges is fine — let's trim surrounding spaces then check `/^\d{4}$/`.
  - `normalizeNicknameKey`: `'  BomBom  '` -> `'bombom'`, `'봄봄 '` -> `'봄봄'`.
  - `deriveClaimKey` & `deriveProfileKey`: deterministic 64-char lowercase hex SHA-256 hashes; case-insensitive on nickname (`'BomBom'` == `'bombom'`); distinct namespaces (`claimKey !== profileKey`); different PINs produce different `profileKey`.
  - `serializeProfilePayload(state)`: clamps integers, excludes `backupKey` and `settings`, keeps exact allowed Firestore schema keys (`nickname`, `stars`, `starFragments`, `highScores`, `unlockedSkins`, `equippedSkin`).
  - `deserializeProfileBackup(rawData, profileKey)`: normalizes fields via `normalizeState` and attaches `backupKey: profileKey`.
  - Cooldown helper (`getRestoreCooldownSeconds`, `recordRestoreFailure`, `clearRestoreFailures`): 5 consecutive failures lock restore attempts for 30 seconds.
- [ ] **Step 2:** Run `npx vitest run tests/profileBackup.test.js` and verify failure.
- [ ] **Step 3:** Implement `src/utils/profileBackup.js`:
  - Exports: `validatePin`, `normalizeNicknameKey`, `deriveClaimKey`, `deriveProfileKey`, `serializeProfilePayload`, `deserializeProfileBackup`, `getRestoreCooldownSeconds`, `clearRestoreFailures`, `registerNicknameWithBackup`, `syncProfileBackup`, `lookupProfileBackup`.
  - `registerNicknameWithBackup({ currentState, nickname, pin })`:
    - Validates `validateNickname(nickname)` and `validatePin(pin)`.
    - Ensures anonymous user (`ensureAnonymousUser()`).
    - Computes `claimKey` and `profileKey`.
    - Reads `nicknameClaims/{claimKey}`.
    - Check ownership/claim collision:
      - `isSameActiveNickname = Boolean(currentState.backupKey && normalizeNicknameKey(currentState.nickname) === normalizeNicknameKey(check.nickname))`
      - If `claimSnap.exists()`:
        - `claimOwnerUid = claimSnap.data()?.ownerUid`
        - If `!isSameActiveNickname && claimOwnerUid !== user.uid`: return `{ ok: false, reason: 'taken' }`.
      - Else: create `nicknameClaims/{claimKey}` (`{ ownerUid: user.uid, updatedAt: serverTimestamp() }`).
    - Write `profiles/{profileKey}` (`serializeProfilePayload({ ...currentState, nickname: check.nickname })` + `updatedAt: serverTimestamp()`).
    - Return `{ ok: true, nickname: check.nickname, backupKey: profileKey }`.
  - `syncProfileBackup(backupKey, state)`:
    - Skips cleanly if `!SHA256_HEX_PATTERN.test(backupKey)` or `!state.nickname`.
    - Serializes/queues per-key writes via `pendingBackupWrites` so rapid consecutive updates finish cleanly.
  - `lookupProfileBackup({ nickname, pin })`:
    - Checks cooldown -> returns `{ ok: false, reason: 'cooldown', retryAfterSeconds }` if active.
    - Validates nickname + PIN format.
    - Computes `profileKey`, calls `getDoc(doc(db, 'profiles', profileKey))`.
    - On `!snap.exists()`: increments failure count, returns `{ ok: false, reason: 'notFound', cooldownSeconds }`.
    - On `snap.exists()`: resets failures, returns `{ ok: true, restoredState: deserializeProfileBackup(snap.data(), profileKey) }`.
- [ ] **Step 4:** Run `npx vitest run tests/profileBackup.test.js` and confirm PASS.

---

### Task 4: Leaderboard Deduplication (`src/utils/leaderboard.js`, `tests/leaderboard.test.js`)

**Files:**
- Modify: `src/utils/leaderboard.js`
- Modify: `tests/leaderboard.test.js`

- [ ] **Step 1:** Write failing unit tests in `tests/leaderboard.test.js` for `deduplicateLeaderboardEntries(entries, currentUserId, limit)`:
  - Keeps only 1 row per normalized nickname (highest score wins).
  - On tied score for the same normalized nickname, prefers `entry.userId === currentUserId`.
  - Respects `limit = 15` even after deduplication.
- [ ] **Step 2:** Run `npx vitest run tests/leaderboard.test.js` and verify failure.
- [ ] **Step 3:** Implement `deduplicateLeaderboardEntries` in `src/utils/leaderboard.js`, raise query limit in `fetchLeaderboard` to `30` (`LEADERBOARD_QUERY_LIMIT = 30`), deduplicate to `LEADERBOARD_LIMIT = 15`, and prefer matching `currentUserId` row if present.
- [ ] **Step 4:** Run `npx vitest run tests/leaderboard.test.js` and confirm PASS.

---

### Task 5: Translations & Backup/Restore UI (`translations.js`, `NicknameDialog.jsx`, `RestoreDialog.jsx`, `Lobby.jsx`, `app.css`)

**Files:**
- Modify: `src/i18n/translations.js`
- Modify: `src/components/NicknameDialog.jsx`
- Create: `src/components/RestoreDialog.jsx`
- Modify: `src/components/Lobby.jsx`
- Modify: `src/styles/app.css`

- [ ] **Step 1:** Add bilingual (`ko`, `en`) translation keys in `src/i18n/translations.js` (`pinLabel`, `pinPlaceholder`, `pinHint`, `pinErrFormat`, `nicknameErrTaken`, `nicknameSavingBtn`, `switchToRestoreBtn`, `restoreOpenBtn`, `restoreModalTitle`, `restoreDesc`, `restoreSubmitBtn`, `restoreCheckingBtn`, `restoreErrNotFound`, `restoreErrOffline`, `restoreErrCooldown`, `restoreConfirmTitle`, `restoreConfirmDesc`, `restoreConfirmApplyBtn`, `restoreSuccessToast`).
- [ ] **Step 2:** Run `npx vitest run tests/translations.test.js` to confirm strict `ko`/`en` key parity.
- [ ] **Step 3:** Update `NicknameDialog.jsx` to include the 4-digit numeric PIN field, handle async submission result (`{ ok, reason }`), show loading label while saving, and provide a one-click jump to `RestoreDialog` when `reason === 'taken'` or at the bottom link.
- [ ] **Step 4:** Create `RestoreDialog.jsx` with 2-step flow (Lookup -> Optional Overwrite Confirmation if `hasProgressToOverwrite` -> Confirm & Restore), cooldown countdown message, and offline error message.
- [ ] **Step 5:** Add the `[기록 복구]` (`restoreOpenBtn`) button in `Lobby.jsx` `hero-chips` and style all new PIN/restore/confirm UI elements in `src/styles/app.css`.

---

### Task 6: App Integration, Privacy Policy, SW Cache, E2E & Deployment

**Files:**
- Modify: `src/App.jsx`
- Modify: `public/sw.js`
- Modify: `PRIVACY_POLICY.md`

- [ ] **Step 1:** Wire `handleSaveNickname({ nickname, pin })`, `handleRestoreBackup(restoredState)`, automatic `syncProfileBackup` in `handleGameOverPersist`, `handleUnlockSkin`, `handleEquipSkin` (replacing silent `.catch(() => {})` with `console.warn`), and a brief restore confirmation banner/toast in `src/App.jsx`.
- [ ] **Step 2:** Bump `CACHE_NAME` in `public/sw.js` to `'bombom-arcade-web-v3'` and update `PRIVACY_POLICY.md` (ko + en).
- [ ] **Step 3:** Run full unit test suite (`npm test`) and build/package (`npm run package`).
- [ ] **Step 4:** Deploy `firestore.rules` to `bombom-arcade-woosai` (`firebase deploy --only firestore:rules`).
- [ ] **Step 5:** Run Playwright E2E verification against `vite preview`:
  - Verify `NicknameDialog` PIN validation & `RestoreDialog` flow, verify zero console/page errors, verify live round-trip backup + restore in a brand-new incognito/fresh browser context!
- [ ] **Step 6:** Commit & push to `origin/main` (strictly following commit message rules: no issue numbers, no `Co-Authored-By`), verify GitHub Actions `deploy-pages.yml` passes, and check `HTTP/2 200` on `https://woosai.github.io/bombom-arcade/`.
