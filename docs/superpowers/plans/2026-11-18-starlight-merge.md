# Starlight Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add BomBom Arcade's 3rd mini-game **「별빛 톡톡 합체」 (`merge`)** with deterministic 2D circle-merge physics, full integration into stars/skins/leaderboard/brag-card/cloud-backup, and backward-compatible Firestore rules.

**Architecture:** Build a pure, sub-stepped 2D physics & merge state machine in `src/games/starlightMerge.js` mirroring `dodgeRunner.js` and `towerStack.js` (`createInitialMergeState`, `stepMergeState`, `dropMergeOrb`, `mountStarlightMerge`). Update shared adapters (`storage.js`, `profileBackup.js`, `leaderboard.js`, `shareCard.js`, `sound.js`) and UI components (`GameShell.jsx`, `Lobby.jsx`, `Leaderboard.jsx`, `RestoreDialog.jsx`, `App.jsx`) uniformly using explicit `'dodge' | 'stack' | 'merge'` mappings.

**Tech Stack:** React 18 · HTML5 Canvas · Web Audio API · Cloud Firestore Enterprise (`bombom-db`) · Vitest · Playwright

**Spec:** `docs/superpowers/specs/2026-11-18-starlight-merge-design.md`

## Global Constraints
- Follow repo conventions: full-word identifiers (including loop indices), single-line noun-phrase WHY comments, no silent `catch {}`, `ko`/`en` key parity in `translations.js`.
- `firestore.rules` MUST be updated via `firestore-rules-author` subagent and remain backward-compatible with `v1.1.0` backups lacking `highScores.merge`.
- Zero new permissions in `public/manifest.json` (`storage` only).

---

### Task 1: Backward-Compatible Firestore Rules (`firestore.rules`)
- [ ] Delegate to `firestore-rules-author` to add `'merge'` to `isValidGameType` and make `highScores.merge` optional (valid int `0..1000000` if present) in `isValidHighScoresMap`.

### Task 2: Starlight Merge Engine (`src/games/starlightMerge.js`, `tests/starlightMerge.test.js`)
- [ ] Write failing unit tests for:
  - Tier definitions (`8` tiers, ascending radii) and `createInitialMergeState()`.
  - `dropMergeOrb` cooldown enforcement, horizontal clamping, and `nextTier` advance.
  - `stepMergeState` gravity, wall/floor bounce, and same-tier merge into `tier + 1` with score, `starsEarned`, combo multiplier, and `'merge'` event.
  - Double Tier-7 (`Gold Unicorn`) clear bonus (`+100` score, `+20` starsEarned, `'fever'` event).
  - Danger line sustained overflow (`> 1.8s` settled above `DANGER_LINE_Y`) triggering `gameOver` and `'gameover'` event.
  - `mountStarlightMerge` keyboard/pointer lifecycle and clean `destroy()` listener removal.
- [ ] Implement `src/games/starlightMerge.js` and verify all tests pass.

### Task 3: Shared Utilities (`storage.js`, `profileBackup.js`, `leaderboard.js`, `shareCard.js`, `sound.js`) & Tests
- [ ] Extend `highScores` with `merge: 0` in `storage.js` + `profileBackup.js` + `hasProgressToOverwrite`.
- [ ] Extend `VALID_GAME_TYPES` in `leaderboard.js` and `getGameTitle(gameType, text)` helper in `shareCard.js`.
- [ ] Add `'drop'` and `'merge'` presets in `sound.js`.
- [ ] Update & run `storageAndSkins.test.js`, `profileBackup.test.js`, `leaderboard.test.js`, `shareCard.test.js`.

### Task 4: Translations, UI Components & Popup Layout
- [ ] Add `mergeTitle`, `mergeDesc`, `mergeControl`, `mergeHint`, `nextOrbLabel` in `translations.js` + `tests/translations.test.js`.
- [ ] Support `'merge'` in `GameShell.jsx` (preview background, `mountStarlightMerge`, next-tier/combo HUD, game-over persistence).
- [ ] Add 3rd game card in `Lobby.jsx`, 3rd tab in `Leaderboard.jsx`, 3rd best-score icon in `RestoreDialog.jsx`, and `merge` routing/sync in `App.jsx`.
- [ ] Refine `.lobby-games` / `.game-card` spacing in `src/styles/app.css` so 3 cards fit cleanly in both `400×580` popup and mobile full-tab.
- [ ] Bump `public/sw.js` to `bombom-arcade-web-v5`.

### Task 5: End-to-End Verification, Rules Deploy & GitHub Release
- [ ] Run full `npm test` and `npm run package` (rebuild `bombom-arcade-v1.1.0.zip` — wait: verify version with `manifest.json`, keep `1.1.0` or check!).
- [ ] Deploy `firestore.rules` via `firebase deploy --only firestore:rules`.
- [ ] Run Playwright E2E test verifying 3-card Lobby, playing & dropping orbs in Starlight Merge, Leaderboard 3rd tab, and zero console/page errors.
- [ ] Commit & push to `origin main` and verify GitHub Actions deployment succeeds.
