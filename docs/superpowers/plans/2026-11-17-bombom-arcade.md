# 봄봄 아케이드 (BomBom Arcade) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 초등학생 4학년 이상(따님 맞춤)이 크롬 팝업 및 새 탭에서 가볍게 즐길 수 있는 2종 미니게임(`별빛 닷지 러너`, `하늘 타워 쌓기`)과 공유 별/스킨 시스템을 갖춘 Manifest V3 크롬 확장 프로그램을 구현하고 웹스토어 배포 패키지를 완성한다.

**Architecture:** UI(로비, 헤더, 게임 쉘/모달, 스킨 상점)는 React 18 + Vite로 구성하고, 60fps 게임 루프 2종(`dodgeRunner.js`, `towerStack.js`)은 순수 JavaScript 상태 전이 함수 + HTML5 Canvas 렌더러로 분리해 단위 테스트 가능성과 팝업 실행 성능을 모두 확보한다. 저장소는 `chrome.storage.local`(웹 개발 환경에서는 `localStorage` 폴백)을 사용하며 `manifest.json` 권한은 `storage`만 선언한다.

**Tech Stack:** Chrome Extension Manifest V3, React 18, Vite 5, HTML5 Canvas, Web Audio API, Vitest, Python 3 (아이콘 PNG 생성)

**Spec:** `bombom-arcade/docs/superpowers/specs/2026-11-17-bombom-arcade-design.md`

## Global Constraints

- 브랜드 문구: 한국어 UI는 `봄봄` / `봄봄 아케이드`, 영어 UI는 `BomBom` / `BomBom Arcade`, 기본 스킨 이름은 `봄봄` / `BomBom`.
- `manifest_version: 3`, `permissions: ["storage"]`만 사용(`host_permissions`, `background`, `content_scripts`, `tabs` 미사용).
- 모든 스크립트는 번들된 로컬 파일만 사용(인라인 `<script>`·인라인 핸들러·원격 코드·외부 API 호출 금지).
- 팝업 기본 크기 `400×580`, Canvas 논리 해상도 `368×430`, 새 탭 확대 모드(`?mode=full`) 지원.
- 네이티브 `<dialog>` + `showModal()` 사용(`role="dialog"`/`aria-modal` 중복 금지), `dialog:modal` 및 `dialog::backdrop`에 `overscroll-behavior: contain` 적용, `:focus-visible` 포커스 링 유지, `@media (prefers-reduced-motion: no-preference)` 준수.
- 식별자 축약 금지(전체 단어 사용), 핵심 WHY 주석 한 줄 개조식 유지, 사용자 승인 없이 자동 `git commit`/`git push` 금지.

---

### Task 1: 프로젝트 스캐폴딩 · MV3 매니페스트 · PNG 아이콘 생성

**Files:**
- Create: `bombom-arcade/package.json`
- Create: `bombom-arcade/vite.config.js`
- Create: `bombom-arcade/index.html`
- Create: `bombom-arcade/public/manifest.json`
- Create: `bombom-arcade/public/_locales/ko/messages.json`
- Create: `bombom-arcade/public/_locales/en/messages.json`
- Create: `bombom-arcade/scripts/generate-icons.py`
- Generated: `bombom-arcade/public/icons/icon-16.png`, `icon-48.png`, `icon-128.png`

**Interfaces:**
- Produces: 실행 가능한 Vite + Vitest 프로젝트 설정, MV3 매니페스트, 실존하는 `16/48/128` PNG 아이콘 파일.

- [ ] **Step 1: `package.json`, `vite.config.js`, `index.html` 작성**

```json
// bombom-arcade/package.json
{
  "name": "bombom-arcade",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "package": "bash scripts/package-zip.sh"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.11",
    "vitest": "^2.1.8"
  }
}
```

```js
// bombom-arcade/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  test: {
    environment: 'node'
  }
});
```

```html
<!-- bombom-arcade/index.html -->
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>봄봄 아케이드 | BomBom Arcade</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: MV3 `public/manifest.json` 및 `_locales` 작성**

```json
// bombom-arcade/public/manifest.json
{
  "manifest_version": 3,
  "name": "__MSG_extName__",
  "version": "1.0.0",
  "description": "__MSG_extDescription__",
  "default_locale": "en",
  "permissions": [
    "storage"
  ],
  "action": {
    "default_popup": "index.html",
    "default_title": "__MSG_extName__",
    "default_icon": {
      "16": "icons/icon-16.png",
      "48": "icons/icon-48.png",
      "128": "icons/icon-128.png"
    }
  },
  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  }
}
```

```json
// bombom-arcade/public/_locales/ko/messages.json
{
  "extName": {
    "message": "봄봄 아케이드 - 미니 게임 팩"
  },
  "extDescription": {
    "message": "팝업에서 바로 즐기는 귀여운 닷지 러너 & 타워 쌓기 미니 게임! 별을 모아 봄봄 스킨을 열어보세요."
  }
}
```

```json
// bombom-arcade/public/_locales/en/messages.json
{
  "extName": {
    "message": "BomBom Arcade - Mini Games"
  },
  "extDescription": {
    "message": "Play cute Dodge Runner and Sky Stacker mini-games right in your browser popup and unlock BomBom skins!"
  }
}
```

- [ ] **Step 3: 외부 의존성 없는 Python PNG 아이콘 생성기 작성 및 실행**

`scripts/generate-icons.py`를 Python 표준 라이브러리(`zlib`, `struct`, `math`, `os`)만으로 작성해 안티앨리어싱된 둥근 파스텔 코랄/퍼플 배경 위 황금 별(`BomBom`) 아이콘 3종(`16x16`, `48x48`, `128x128`)을 `public/icons/`에 생성한다.

```python
# bombom-arcade/scripts/generate-icons.py
import math
import os
import struct
import zlib

def write_png(filepath, width, height, pixels):
    def chunk(chunk_type, data):
        length = struct.pack('!I', len(data))
        crc = struct.pack('!I', zlib.crc32(chunk_type + data) & 0xFFFFFFFF)
        return length + chunk_type + data + crc

    raw_rows = bytearray()
    for row_index in range(height):
        raw_rows.append(0)
        start = row_index * width * 4
        raw_rows.extend(pixels[start:start + width * 4])

    compressed = zlib.compress(bytes(raw_rows), 9)
    ihdr = struct.pack('!IIBBBBB', width, height, 8, 6, 0, 0, 0)
    with open(filepath, 'wb') as file_handle:
        file_handle.write(b'\x89PNG\r\n\x1a\n')
        file_handle.write(chunk(b'IHDR', ihdr))
        file_handle.write(chunk(b'IDAT', compressed))
        file_handle.write(chunk(b'IEND', b''))

def point_in_star(px, py, cx, cy, outer_r, inner_r):
    angle = math.atan2(py - cy, px - cx) + math.pi / 2
    sector = (2 * math.pi) / 10
    normalized = ((angle % (2 * math.pi)) + 2 * math.pi) % (2 * math.pi)
    index = int(normalized / sector)
    local = normalized - index * sector
    r1 = outer_r if index % 2 == 0 else inner_r
    r2 = inner_r if index % 2 == 0 else outer_r
    t = local / sector
    x1, y1 = r1 * math.cos(0), r1 * math.sin(0)
    x2, y2 = r2 * math.cos(sector), r2 * math.sin(sector)
    dist = math.hypot(px - cx, py - cy)
    ray_x = dist * math.cos(local)
    ray_y = dist * math.sin(local)
    cross = (x2 - x1) * (ray_y - y1) - (y2 - y1) * (ray_x - x1)
    return cross >= 0

def render_icon(size):
    pixels = bytearray(size * size * 4)
    radius = size * 0.24
    margin = max(0.5, size * 0.04)
    cx = size / 2.0
    cy = size / 2.0
    for y in range(size):
        for x in range(size):
            px = x + 0.5
            py = y + 0.5
            dx = max(0.0, abs(px - cx) - (size / 2.0 - margin - radius))
            dy = max(0.0, abs(py - cy) - (size / 2.0 - margin - radius))
            dist_corner = math.hypot(dx, dy) - radius
            alpha = max(0.0, min(1.0, 0.5 - dist_corner))
            ratio = (px + py) / (2.0 * size)
            bg_r = int(255 * (1 - ratio) + 155 * ratio)
            bg_g = int(122 * (1 - ratio) + 109 * ratio)
            bg_b = int(162 * (1 - ratio) + 255 * ratio)

            in_star = point_in_star(px, py, cx, cy + size * 0.02, size * 0.34, size * 0.16)
            if in_star and alpha > 0.1:
                r, g, b = 255, 224, 102
            else:
                r, g, b = bg_r, bg_g, bg_b

            offset = (y * size + x) * 4
            pixels[offset] = r
            pixels[offset + 1] = g
            pixels[offset + 2] = b
            pixels[offset + 3] = int(alpha * 255)
    return pixels

def main():
    output_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'icons')
    os.makedirs(output_dir, exist_ok=True)
    for size in (16, 48, 128):
        pixels = render_icon(size)
        out_path = os.path.join(output_dir, f'icon-{size}.png')
        write_png(out_path, size, size, pixels)
        print(f'Generated {out_path}')

if __name__ == '__main__':
    main()
```

- [ ] **Step 4: 아이콘 생성 및 npm 의존성 설치 검증**

Run: `cd /Users/jeonwoosung/Desktop/bombba/bombom-arcade && python3 scripts/generate-icons.py && npm install && ls -la public/icons`
Expected: `icon-16.png`, `icon-48.png`, `icon-128.png` 생성 및 `node_modules` 설치 성공.

---

### Task 2: i18n 번역 사전 · 스킨 도감 · 저장소 어댑터 (TDD)

**Files:**
- Create: `bombom-arcade/src/i18n/translations.js`
- Create: `bombom-arcade/src/games/skins.js`
- Create: `bombom-arcade/src/utils/storage.js`
- Test: `bombom-arcade/tests/translations.test.js`
- Test: `bombom-arcade/tests/storageAndSkins.test.js`

**Interfaces:**
- Produces:
  - `translations` (`ko`, `en`), `resolveLanguage(langSetting, navigatorLanguage)`
  - `SKINS` (6종 배열), `getSkinById(skinId)`, `canUnlockSkin(state, skinId)`, `unlockSkin(state, skinId)`, `equipSkin(state, skinId)`, `drawSkinMascot(ctx, skinId, x, y, radius, timeSeconds)`
  - `STORAGE_KEY`, `createDefaultState()`, `normalizeState(raw)`, `loadState()`, `saveState(nextState)`

- [ ] **Step 1: 번역 및 스킨/저장소 실패 테스트 작성**

```js
// bombom-arcade/tests/translations.test.js
import { describe, expect, it } from 'vitest';
import { resolveLanguage, translations } from '../src/i18n/translations.js';

describe('translations', () => {
  it('has identical keys for ko and en', () => {
    const koKeys = Object.keys(translations.ko).sort();
    const enKeys = Object.keys(translations.en).sort();
    expect(koKeys).toEqual(enKeys);
  });

  it('includes 봄봄 in ko and BomBom in en', () => {
    expect(translations.ko.brandName).toContain('봄봄');
    expect(translations.en.brandName).toContain('BomBom');
  });

  it('resolves language from auto setting', () => {
    expect(resolveLanguage('auto', 'ko-KR')).toBe('ko');
    expect(resolveLanguage('auto', 'en-US')).toBe('en');
    expect(resolveLanguage('ko', 'en-US')).toBe('ko');
    expect(resolveLanguage('en', 'ko-KR')).toBe('en');
  });
});
```

```js
// bombom-arcade/tests/storageAndSkins.test.js
import { describe, expect, it } from 'vitest';
import {
  SKINS,
  canUnlockSkin,
  equipSkin,
  getSkinById,
  unlockSkin
} from '../src/games/skins.js';
import { createDefaultState, normalizeState } from '../src/utils/storage.js';

describe('storage normalization', () => {
  it('recovers missing or invalid fields safely', () => {
    const normalized = normalizeState({
      stars: -10,
      highScores: { dodge: 120, stack: 'bad' },
      unlockedSkins: ['unknown', 'strawberry-slime'],
      equippedSkin: 'gold-unicorn',
      settings: { lang: 'jp', muted: 'yes' }
    });

    expect(normalized.stars).toBe(0);
    expect(normalized.highScores).toEqual({ dodge: 120, stack: 0 });
    expect(normalized.unlockedSkins).toEqual(['bombom', 'strawberry-slime']);
    expect(normalized.equippedSkin).toBe('bombom');
    expect(normalized.settings).toEqual({ lang: 'auto', muted: false });
  });
});

describe('skin shop logic', () => {
  it('defines 6 skins with bombom as free default', () => {
    expect(SKINS).toHaveLength(6);
    expect(getSkinById('bombom').cost).toBe(0);
    expect(getSkinById('bombom').name.ko).toBe('봄봄');
    expect(getSkinById('bombom').name.en).toBe('BomBom');
  });

  it('blocks unlock when stars are insufficient', () => {
    const state = { ...createDefaultState(), stars: 20 };
    expect(canUnlockSkin(state, 'strawberry-slime')).toBe(false);
    expect(unlockSkin(state, 'strawberry-slime')).toBe(state);
  });

  it('unlocks and equips skin when stars are sufficient', () => {
    const state = { ...createDefaultState(), stars: 30 };
    const nextState = unlockSkin(state, 'strawberry-slime');
    expect(nextState.stars).toBe(5);
    expect(nextState.unlockedSkins).toContain('strawberry-slime');
    expect(nextState.equippedSkin).toBe('strawberry-slime');

    const equippedBack = equipSkin(nextState, 'bombom');
    expect(equippedBack.equippedSkin).toBe('bombom');
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `cd /Users/jeonwoosung/Desktop/bombba/bombom-arcade && npm test`
Expected: FAIL (`Cannot find module '../src/i18n/translations.js'` 등).

- [ ] **Step 3: `translations.js`, `skins.js`, `storage.js` 구현**

`src/i18n/translations.js`에 한국어(`봄봄 아케이드`)와 영어(`BomBom Arcade`) 모든 UI 문구, 응원 문구, 스킨 상점 문구를 빠짐없이 작성한다.

```js
// bombom-arcade/src/i18n/translations.js
export const translations = {
  ko: {
    brandShort: '봄봄',
    brandName: '봄봄 아케이드',
    tagline: '오늘도 반짝반짝 한 판 놀아볼까?',
    starsLabel: '별',
    soundOn: '소리 켜짐',
    soundOff: '소리 꺼짐',
    openFullTab: '큰 화면으로 열기',
    backToLobby: '로비로',
    skinShopTitle: '봄봄 스킨 도감',
    skinShopSub: '두 게임에서 모은 별로 귀여운 친구들을 데려와요!',
    equipped: '장착 중',
    equip: '장착하기',
    unlockWithStars: '열기',
    needMoreStars: '별이 부족해요',
    unlockedCount: '수집',
    dodgeTitle: '별빛 닷지 러너',
    dodgeDesc: '운석을 요리조리 피하고 반짝이는 별과 아이템을 모아요!',
    dodgeControl: '조작: ← → / A D 또는 마우스 이동',
    stackTitle: '하늘 타워 쌓기',
    stackDesc: '타이밍에 맞춰 블록을 착착! 5연속 PERFECT 보너스!',
    stackControl: '조작: 스페이스바 / 클릭 하나면 끝!',
    playNow: '게임 시작',
    bestScore: '최고 기록',
    scoreLabel: '점수',
    comboLabel: '콤보',
    floorLabel: '층',
    pause: '일시정지',
    resume: '계속하기',
    pausedTitle: '잠깐 쉬는 중!',
    gameOverTitle: '멋진 한 판이었어!',
    newRecordBadge: '최고 기록 경신!',
    earnedStarsLabel: '이번 판 획득 별',
    encouragementGreat: '봄봄이 박수 치는 중! 정말 대단해!',
    encouragementGood: '아깝다! 한 번 더 하면 기록 깰 수 있어!',
    playAgain: '다시 하기',
    startTapHint: '클릭하거나 방향키/스페이스를 누르면 시작!',
    dodgeHint: '빨간 경고선을 조심하고 자석·보호막·피버를 잡아봐!',
    stackHint: '중앙에 딱 맞추면 PERFECT! 5연속이면 블록이 넓어져요!',
    feverBanner: '봄봄 피버 타임!',
    bonusBanner: '봄봄 보너스! 블록 회복!',
    perfectText: 'PERFECT!',
    shieldActive: '보호막 ON',
    magnetActive: '자석 ON',
    feverActive: '피버 ON',
    langToggle: 'EN'
  },
  en: {
    brandShort: 'BomBom',
    brandName: 'BomBom Arcade',
    tagline: 'Ready for a quick, sparkly mini-game break?',
    starsLabel: 'Stars',
    soundOn: 'Sound On',
    soundOff: 'Sound Off',
    openFullTab: 'Open in Full Tab',
    backToLobby: 'Lobby',
    skinShopTitle: 'BomBom Skin Collection',
    skinShopSub: 'Collect stars from both games to unlock cute friends!',
    equipped: 'Equipped',
    equip: 'Equip',
    unlockWithStars: 'Unlock',
    needMoreStars: 'Need more stars',
    unlockedCount: 'Collected',
    dodgeTitle: 'Star Dodge Runner',
    dodgeDesc: 'Dodge meteors and catch stars, shields, magnets, and fever!',
    dodgeControl: 'Controls: ← → / A D or Mouse Move',
    stackTitle: 'Sky Tower Stacker',
    stackDesc: 'Drop blocks on beat! 5x PERFECT restores block width!',
    stackControl: 'Controls: Spacebar / Enter or Click',
    playNow: 'Play',
    bestScore: 'Best',
    scoreLabel: 'Score',
    comboLabel: 'Combo',
    floorLabel: 'Floor',
    pause: 'Pause',
    resume: 'Resume',
    pausedTitle: 'Take a Breather!',
    gameOverTitle: 'Awesome Run!',
    newRecordBadge: 'New High Score!',
    earnedStarsLabel: 'Stars Earned',
    encouragementGreat: 'BomBom is cheering for you! Amazing job!',
    encouragementGood: 'So close! One more try to beat your best!',
    playAgain: 'Play Again',
    startTapHint: 'Click or press Arrow / Space to start!',
    dodgeHint: 'Watch out for red warning lines and grab power-ups!',
    stackHint: 'Line it up for PERFECT! 5 in a row widens your block!',
    feverBanner: 'BomBom FEVER!',
    bonusBanner: 'BomBom BONUS! Block Expanded!',
    perfectText: 'PERFECT!',
    shieldActive: 'Shield ON',
    magnetActive: 'Magnet ON',
    feverActive: 'Fever ON',
    langToggle: 'KO'
  }
};

export function resolveLanguage(langSetting, navigatorLanguage = 'en') {
  if (langSetting === 'ko' || langSetting === 'en') {
    return langSetting;
  }
  return String(navigatorLanguage).toLowerCase().startsWith('ko') ? 'ko' : 'en';
}
```

`src/games/skins.js`를 작성한다 (6종 스킨 메타데이터 + 해금/장착 순수 함수 + Canvas 마스코트 렌더러).

```js
// bombom-arcade/src/games/skins.js
export const SKINS = [
  {
    id: 'bombom',
    cost: 0,
    name: { ko: '봄봄', en: 'BomBom' },
    badge: '⭐',
    primary: '#FF7AA2',
    secondary: '#FFE066',
    trail: '#FFD1E0',
    blockPalette: ['#FF7AA2', '#FFB3C6', '#FFE066', '#9BF6FF']
  },
  {
    id: 'strawberry-slime',
    cost: 25,
    name: { ko: '딸기 슬라임', en: 'Berry Slime' },
    badge: '🍓',
    primary: '#FF5D8F',
    secondary: '#FFACC5',
    trail: '#FFC8DD',
    blockPalette: ['#FF5D8F', '#FF85A1', '#FBB1BD', '#FFCCD5']
  },
  {
    id: 'rocket-cat',
    cost: 50,
    name: { ko: '로켓 냥이', en: 'Rocket Kitty' },
    badge: '🐱',
    primary: '#4CC9F0',
    secondary: '#F72585',
    trail: '#ADE8F4',
    blockPalette: ['#4CC9F0', '#72EFDD', '#4895EF', '#B5179E']
  },
  {
    id: 'ribbon-bunny',
    cost: 80,
    name: { ko: '리본 토끼', en: 'Ribbon Bunny' },
    badge: '🐰',
    primary: '#B388EB',
    secondary: '#FF99C8',
    trail: '#E0C3FC',
    blockPalette: ['#B388EB', '#D0A5F5', '#FF99C8', '#FCF6BD']
  },
  {
    id: 'rainbow-cloud',
    cost: 120,
    name: { ko: '무지개 구름', en: 'Rainbow Cloud' },
    badge: '🌈',
    primary: '#72EFDD',
    secondary: '#FFD166',
    trail: '#CDB4DB',
    blockPalette: ['#FF7AA2', '#FFD166', '#80ED99', '#72EFDD', '#B388EB']
  },
  {
    id: 'gold-unicorn',
    cost: 180,
    name: { ko: '골드 유니콘', en: 'Gold Unicorn' },
    badge: '🦄',
    primary: '#FFD166',
    secondary: '#FF70A6',
    trail: '#FFF3B0',
    blockPalette: ['#FFD166', '#FFE66D', '#FF70A6', '#A0C4FF']
  }
];

export function getSkinById(skinId) {
  return SKINS.find((skin) => skin.id === skinId) || SKINS[0];
}

export function canUnlockSkin(state, skinId) {
  const skin = SKINS.find((item) => item.id === skinId);
  if (!skin) return false;
  if (state.unlockedSkins.includes(skinId)) return false;
  return state.stars >= skin.cost;
}

export function unlockSkin(state, skinId) {
  if (!canUnlockSkin(state, skinId)) {
    return state;
  }
  const skin = getSkinById(skinId);
  return {
    ...state,
    stars: state.stars - skin.cost,
    unlockedSkins: [...state.unlockedSkins, skinId],
    equippedSkin: skinId
  };
}

export function equipSkin(state, skinId) {
  if (!state.unlockedSkins.includes(skinId)) {
    return state;
  }
  return {
    ...state,
    equippedSkin: skinId
  };
}

export function drawSkinMascot(ctx, skinId, centerX, centerY, radius, timeSeconds = 0) {
  const skin = getSkinById(skinId);
  const bobOffset = Math.sin(timeSeconds * 6) * 1.8;
  const y = centerY + bobOffset;

  ctx.save();
  ctx.translate(centerX, y);

  // Cute ears / horns per skin before main body
  if (skinId === 'rocket-cat') {
    ctx.fillStyle = skin.primary;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.75, -radius * 0.25);
    ctx.lineTo(-radius * 0.9, -radius * 1.05);
    ctx.lineTo(-radius * 0.2, -radius * 0.72);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(radius * 0.75, -radius * 0.25);
    ctx.lineTo(radius * 0.9, -radius * 1.05);
    ctx.lineTo(radius * 0.2, -radius * 0.72);
    ctx.closePath();
    ctx.fill();
  } else if (skinId === 'ribbon-bunny') {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(-radius * 0.36, -radius * 0.95, radius * 0.22, radius * 0.55, -0.15, 0, Math.PI * 2);
    ctx.ellipse(radius * 0.36, -radius * 0.95, radius * 0.22, radius * 0.55, 0.15, 0, Math.PI * 2);
    ctx.fill();
  } else if (skinId === 'gold-unicorn') {
    ctx.fillStyle = '#FFF3B0';
    ctx.beginPath();
    ctx.moveTo(-radius * 0.22, -radius * 0.75);
    ctx.lineTo(0, -radius * 1.35);
    ctx.lineTo(radius * 0.22, -radius * 0.75);
    ctx.closePath();
    ctx.fill();
  }

  // Main rounded body
  const gradient = ctx.createRadialGradient(-radius * 0.25, -radius * 0.25, radius * 0.2, 0, 0, radius);
  gradient.addColorStop(0, skin.secondary);
  gradient.addColorStop(1, skin.primary);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.stroke();

  // Eyes and rosy cheeks
  ctx.fillStyle = '#2B2D42';
  ctx.beginPath();
  ctx.arc(-radius * 0.32, -radius * 0.08, radius * 0.12, 0, Math.PI * 2);
  ctx.arc(radius * 0.32, -radius * 0.08, radius * 0.12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-radius * 0.36, -radius * 0.12, radius * 0.045, 0, Math.PI * 2);
  ctx.arc(radius * 0.28, -radius * 0.12, radius * 0.045, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255, 92, 138, 0.45)';
  ctx.beginPath();
  ctx.arc(-radius * 0.48, radius * 0.16, radius * 0.14, 0, Math.PI * 2);
  ctx.arc(radius * 0.48, radius * 0.16, radius * 0.14, 0, Math.PI * 2);
  ctx.fill();

  // Happy smile
  ctx.strokeStyle = '#2B2D42';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, radius * 0.1, radius * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.restore();
}
```

`src/utils/storage.js`를 작성한다.

```js
// bombom-arcade/src/utils/storage.js
import { SKINS } from '../games/skins.js';

export const STORAGE_KEY = 'bombom_arcade_v1';

const VALID_SKIN_IDS = new Set(SKINS.map((skin) => skin.id));

export function createDefaultState() {
  return {
    stars: 0,
    highScores: {
      dodge: 0,
      stack: 0
    },
    unlockedSkins: ['bombom'],
    equippedSkin: 'bombom',
    settings: {
      lang: 'auto',
      muted: false
    }
  };
}

export function normalizeState(raw) {
  const defaults = createDefaultState();
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }

  const stars = Number.isFinite(raw.stars) && raw.stars >= 0 ? Math.floor(raw.stars) : 0;
  const dodgeScore = Number.isFinite(raw.highScores?.dodge) && raw.highScores.dodge >= 0
    ? Math.floor(raw.highScores.dodge)
    : 0;
  const stackScore = Number.isFinite(raw.highScores?.stack) && raw.highScores.stack >= 0
    ? Math.floor(raw.highScores.stack)
    : 0;

  const rawUnlocked = Array.isArray(raw.unlockedSkins) ? raw.unlockedSkins : [];
  const unlockedSet = new Set(['bombom']);
  for (const skinId of rawUnlocked) {
    if (VALID_SKIN_IDS.has(skinId)) {
      unlockedSet.add(skinId);
    }
  }
  const unlockedSkins = Array.from(unlockedSet);

  const equippedSkin = unlockedSet.has(raw.equippedSkin) ? raw.equippedSkin : 'bombom';
  const rawLang = raw.settings?.lang;
  const lang = rawLang === 'ko' || rawLang === 'en' || rawLang === 'auto' ? rawLang : 'auto';
  const muted = typeof raw.settings?.muted === 'boolean' ? raw.settings.muted : false;

  return {
    stars,
    highScores: {
      dodge: dodgeScore,
      stack: stackScore
    },
    unlockedSkins,
    equippedSkin,
    settings: {
      lang,
      muted
    }
  };
}

export async function loadState() {
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return normalizeState(result[STORAGE_KEY]);
    }
    if (typeof localStorage !== 'undefined') {
      const rawText = localStorage.getItem(STORAGE_KEY);
      return rawText ? normalizeState(JSON.parse(rawText)) : createDefaultState();
    }
  } catch (error) {
    console.error('Failed to load BomBom Arcade state:', error);
  }
  return createDefaultState();
}

export async function saveState(nextState) {
  const normalized = normalizeState(nextState);
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
      return normalized;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    }
  } catch (error) {
    console.error('Failed to save BomBom Arcade state:', error);
  }
  return normalized;
}
```

- [ ] **Step 4: 테스트 실행 및 통과 확인**

Run: `cd /Users/jeonwoosung/Desktop/bombba/bombom-arcade && npm test`
Expected: `translations.test.js`, `storageAndSkins.test.js` 전체 PASS.

---

### Task 3: 게임 ① 별빛 닷지 러너 (`dodgeRunner.js`) 코어 로직 & Canvas 엔진 (TDD)

**Files:**
- Create: `bombom-arcade/src/games/dodgeRunner.js`
- Test: `bombom-arcade/tests/dodgeRunner.test.js`

**Interfaces:**
- Produces:
  - `DODGE_WIDTH = 368`, `DODGE_HEIGHT = 430`
  - `createInitialDodgeState()`
  - `checkCircleCollision(ax, ay, ar, bx, by, br)`
  - `stepDodgeState(state, input, dt, randomFn)`
  - `mountDodgeRunner(canvas, options)` (`{ skinId, onHudUpdate, onGameOver, onSound, isPaused }`, 반환: `{ destroy() }`)

- [ ] **Step 1: `dodgeRunner.test.js` 실패 테스트 작성**

```js
// bombom-arcade/tests/dodgeRunner.test.js
import { describe, expect, it } from 'vitest';
import {
  DODGE_WIDTH,
  checkCircleCollision,
  createInitialDodgeState,
  stepDodgeState
} from '../src/games/dodgeRunner.js';

describe('dodgeRunner physics and rules', () => {
  it('moves player within canvas bounds', () => {
    const state = createInitialDodgeState();
    const movedLeft = stepDodgeState(state, { moveDirection: -1, pointerX: null }, 1.0, () => 0.99);
    expect(movedLeft.playerX).toBeGreaterThanOrEqual(state.playerVisualRadius);

    const movedRight = stepDodgeState(state, { moveDirection: 1, pointerX: null }, 2.0, () => 0.99);
    expect(movedRight.playerX).toBeLessThanOrEqual(DODGE_WIDTH - state.playerVisualRadius);
  });

  it('collects star, adds score with combo, and resets combo after timeout', () => {
    const state = createInitialDodgeState();
    state.pickups.push({
      id: 1,
      kind: 'star',
      x: state.playerX,
      y: state.playerY,
      radius: 11,
      vy: 0
    });

    const afterFirst = stepDodgeState(state, { moveDirection: 0, pointerX: null }, 0.016, () => 0.99);
    expect(afterFirst.starsEarned).toBe(1);
    expect(afterFirst.combo).toBe(1);

    afterFirst.pickups.push({
      id: 2,
      kind: 'star',
      x: afterFirst.playerX,
      y: afterFirst.playerY,
      radius: 11,
      vy: 0
    });
    const afterSecond = stepDodgeState(afterFirst, { moveDirection: 0, pointerX: null }, 0.016, () => 0.99);
    expect(afterSecond.starsEarned).toBe(2);
    expect(afterSecond.combo).toBe(2);

    const afterExpiry = stepDodgeState(afterSecond, { moveDirection: 0, pointerX: null }, 2.0, () => 0.99);
    expect(afterExpiry.combo).toBe(0);
  });

  it('consumes shield instead of ending game on meteor collision', () => {
    const state = createInitialDodgeState();
    state.shieldCount = 1;
    state.hazards.push({
      id: 1,
      x: state.playerX,
      y: state.playerY,
      radius: 16,
      vy: 0
    });

    const next = stepDodgeState(state, { moveDirection: 0, pointerX: null }, 0.016, () => 0.99);
    expect(next.gameOver).toBe(false);
    expect(next.shieldCount).toBe(0);
    expect(next.invincibleTimer).toBeGreaterThan(0);
  });

  it('ends game when hit by meteor without shield or fever', () => {
    const state = createInitialDodgeState();
    state.hazards.push({
      id: 1,
      x: state.playerX,
      y: state.playerY,
      radius: 16,
      vy: 0
    });

    const next = stepDodgeState(state, { moveDirection: 0, pointerX: null }, 0.016, () => 0.99);
    expect(next.gameOver).toBe(true);
  });

  it('pulls stars toward player when magnet is active', () => {
    const state = createInitialDodgeState();
    state.magnetTimer = 4.0;
    state.pickups.push({
      id: 1,
      kind: 'star',
      x: state.playerX + 80,
      y: state.playerY,
      radius: 11,
      vy: 100
    });

    const next = stepDodgeState(state, { moveDirection: 0, pointerX: null }, 0.05, () => 0.99);
    expect(next.pickups[0].x).toBeLessThan(state.playerX + 80);
  });

  it('detects circle collision accurately', () => {
    expect(checkCircleCollision(0, 0, 10, 15, 0, 6)).toBe(true);
    expect(checkCircleCollision(0, 0, 10, 25, 0, 6)).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `cd /Users/jeonwoosung/Desktop/bombba/bombom-arcade && npm test`
Expected: FAIL (`Cannot find module '../src/games/dodgeRunner.js'`).

- [ ] **Step 3: `src/games/dodgeRunner.js` 구현**

순수 상태 업데이트(`stepDodgeState`)와 Canvas 렌더/이벤트 루프(`mountDodgeRunner`)를 하나의 응집된 모듈로 작성한다. (경고선 시스템, 보호막/자석/피버, 파티클, 스킨 트레일 포함)

```js
// bombom-arcade/src/games/dodgeRunner.js
import { drawSkinMascot, getSkinById } from './skins.js';

export const DODGE_WIDTH = 368;
export const DODGE_HEIGHT = 430;
const PLAYER_SPEED = 320;
const COMBO_WINDOW_SECONDS = 1.8;

export function checkCircleCollision(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const limit = ar + br;
  return dx * dx + dy * dy <= limit * limit;
}

export function createInitialDodgeState() {
  return {
    elapsed: 0,
    scoreAccumulator: 0,
    score: 0,
    starsEarned: 0,
    combo: 0,
    comboTimer: 0,
    playerX: DODGE_WIDTH / 2,
    playerY: DODGE_HEIGHT - 54,
    playerVisualRadius: 18,
    playerHitRadius: 13,
    shieldCount: 0,
    invincibleTimer: 0,
    magnetTimer: 0,
    feverTimer: 0,
    hazardSpawnTimer: 0.7,
    pickupSpawnTimer: 0.6,
    warningSpawnTimer: 6.5,
    nextEntityId: 1,
    hazards: [],
    warnings: [],
    pickups: [],
    particles: [],
    trail: [],
    events: [],
    gameOver: false
  };
}

function spawnParticles(particles, x, y, color, count, randomFn) {
  for (let index = 0; index < count; index += 1) {
    const angle = randomFn() * Math.PI * 2;
    const speed = 40 + randomFn() * 110;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.45,
      maxLife: 0.45,
      color,
      size: 2.5 + randomFn() * 3
    });
  }
}

export function stepDodgeState(prevState, input, rawDt, randomFn = Math.random) {
  if (prevState.gameOver) {
    return prevState;
  }

  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const state = {
    ...prevState,
    hazards: prevState.hazards.map((item) => ({ ...item })),
    warnings: prevState.warnings.map((item) => ({ ...item })),
    pickups: prevState.pickups.map((item) => ({ ...item })),
    particles: prevState.particles.map((item) => ({ ...item })),
    trail: [...prevState.trail],
    events: []
  };

  state.elapsed += dt;
  const level = 1 + Math.floor(state.elapsed / 10);

  if (input.pointerX !== null && Number.isFinite(input.pointerX)) {
    const delta = input.pointerX - state.playerX;
    const maxStep = PLAYER_SPEED * 1.45 * dt;
    state.playerX += Math.sign(delta) * Math.min(Math.abs(delta), maxStep);
  } else if (input.moveDirection !== 0) {
    state.playerX += input.moveDirection * PLAYER_SPEED * dt;
  }

  const minX = state.playerVisualRadius + 4;
  const maxX = DODGE_WIDTH - state.playerVisualRadius - 4;
  state.playerX = Math.max(minX, Math.min(maxX, state.playerX));

  state.trail.push({ x: state.playerX, y: state.playerY });
  if (state.trail.length > 8) {
    state.trail.shift();
  }

  if (state.invincibleTimer > 0) state.invincibleTimer = Math.max(0, state.invincibleTimer - dt);
  if (state.magnetTimer > 0) state.magnetTimer = Math.max(0, state.magnetTimer - dt);
  if (state.feverTimer > 0) state.feverTimer = Math.max(0, state.feverTimer - dt);
  if (state.comboTimer > 0) {
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer === 0) {
      state.combo = 0;
    }
  }

  state.scoreAccumulator += dt * 5;
  if (state.scoreAccumulator >= 1) {
    const wholePoints = Math.floor(state.scoreAccumulator);
    state.scoreAccumulator -= wholePoints;
    state.score += wholePoints;
  }

  // Spawn hazards
  state.hazardSpawnTimer -= dt;
  if (state.hazardSpawnTimer <= 0) {
    const radius = 14 + randomFn() * 10;
    const speed = Math.min(380, 145 + level * 18 + randomFn() * 45);
    state.hazards.push({
      id: state.nextEntityId++,
      x: radius + randomFn() * (DODGE_WIDTH - radius * 2),
      y: -radius - 10,
      radius,
      vy: speed,
      fast: false
    });
    state.hazardSpawnTimer = Math.max(0.28, 0.72 - level * 0.045);
  }

  // Spawn warning fast meteor after 12s
  if (state.elapsed >= 12) {
    state.warningSpawnTimer -= dt;
    if (state.warningSpawnTimer <= 0) {
      state.warnings.push({
        id: state.nextEntityId++,
        x: 26 + randomFn() * (DODGE_WIDTH - 52),
        timer: 0.6
      });
      state.warningSpawnTimer = Math.max(3.2, 6.2 - level * 0.35);
    }
  }

  // Update warnings -> fast meteors
  const remainingWarnings = [];
  for (const warning of state.warnings) {
    warning.timer -= dt;
    if (warning.timer <= 0) {
      state.hazards.push({
        id: state.nextEntityId++,
        x: warning.x,
        y: -18,
        radius: 16,
        vy: 450,
        fast: true
      });
    } else {
      remainingWarnings.push(warning);
    }
  }
  state.warnings = remainingWarnings;

  // Spawn stars & power-ups
  state.pickupSpawnTimer -= dt;
  if (state.pickupSpawnTimer <= 0) {
    const roll = randomFn();
    let kind = 'star';
    if (roll < 0.06) kind = 'shield';
    else if (roll < 0.12) kind = 'magnet';
    else if (roll < 0.16) kind = 'fever';

    state.pickups.push({
      id: state.nextEntityId++,
      kind,
      x: 22 + randomFn() * (DODGE_WIDTH - 44),
      y: -16,
      radius: kind === 'star' ? 11 : 13,
      vy: 130 + randomFn() * 45
    });
    const baseInterval = state.feverTimer > 0 ? 0.24 : 0.6;
    state.pickupSpawnTimer = baseInterval;
  }

  // Update pickups & magnet attraction
  const remainingPickups = [];
  for (const pickup of state.pickups) {
    pickup.y += pickup.vy * dt;

    if (state.magnetTimer > 0 && pickup.kind === 'star') {
      const dx = state.playerX - pickup.x;
      const dy = state.playerY - pickup.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0 && dist <= 130) {
        const pull = 280 * dt;
        pickup.x += (dx / dist) * pull;
        pickup.y += (dy / dist) * pull;
      }
    }

    if (checkCircleCollision(state.playerX, state.playerY, state.playerVisualRadius, pickup.x, pickup.y, pickup.radius)) {
      if (pickup.kind === 'star') {
        state.combo = Math.min(5, state.combo + 1);
        state.comboTimer = COMBO_WINDOW_SECONDS;
        state.starsEarned += 1;
        state.score += 10 * state.combo;
        state.events.push('star');
        spawnParticles(state.particles, pickup.x, pickup.y, '#FFE066', 7, randomFn);
      } else if (pickup.kind === 'shield') {
        state.shieldCount = 1;
        state.events.push('powerup');
        spawnParticles(state.particles, pickup.x, pickup.y, '#72EFDD', 10, randomFn);
      } else if (pickup.kind === 'magnet') {
        state.magnetTimer = 5.0;
        state.events.push('powerup');
        spawnParticles(state.particles, pickup.x, pickup.y, '#FF7AA2', 10, randomFn);
      } else if (pickup.kind === 'fever') {
        state.feverTimer = 4.0;
        state.events.push('fever');
        spawnParticles(state.particles, pickup.x, pickup.y, '#FFD166', 14, randomFn);
      }
      continue;
    }

    if (pickup.y <= DODGE_HEIGHT + 24) {
      remainingPickups.push(pickup);
    }
  }
  state.pickups = remainingPickups;

  // Update hazards & check collisions
  const remainingHazards = [];
  for (const hazard of state.hazards) {
    hazard.y += hazard.vy * dt;

    if (checkCircleCollision(state.playerX, state.playerY, state.playerHitRadius, hazard.x, hazard.y, hazard.radius)) {
      if (state.feverTimer > 0) {
        state.score += 15;
        spawnParticles(state.particles, hazard.x, hazard.y, '#FFE066', 10, randomFn);
        continue;
      }
      if (state.invincibleTimer > 0) {
        remainingHazards.push(hazard);
        continue;
      }
      if (state.shieldCount > 0) {
        state.shieldCount = 0;
        state.invincibleTimer = 1.0;
        state.events.push('shieldBreak');
        spawnParticles(state.particles, hazard.x, hazard.y, '#72EFDD', 12, randomFn);
        continue;
      }
      state.gameOver = true;
      state.events.push('gameover');
      spawnParticles(state.particles, state.playerX, state.playerY, '#FF5D8F', 18, randomFn);
    }

    if (hazard.y <= DODGE_HEIGHT + 30) {
      remainingHazards.push(hazard);
    }
  }
  state.hazards = remainingHazards;

  // Update particles
  state.particles = state.particles
    .map((particle) => ({
      ...particle,
      x: particle.x + particle.vx * dt,
      y: particle.y + particle.vy * dt,
      life: particle.life - dt
    }))
    .filter((particle) => particle.life > 0);

  return state;
}

function drawStarShape(ctx, cx, cy, outerR, innerR, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let step = 0; step < 10; step += 1) {
    const angle = -Math.PI / 2 + (step * Math.PI) / 5;
    const r = step % 2 === 0 ? outerR : innerR;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (step === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawDodgeCanvas(ctx, state, skinId, feverText) {
  const skin = getSkinById(skinId);
  const bg = ctx.createLinearGradient(0, 0, 0, DODGE_HEIGHT);
  bg.addColorStop(0, '#1B1438');
  bg.addColorStop(1, '#301E5A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, DODGE_WIDTH, DODGE_HEIGHT);

  // Subtle decorative stars
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  for (let idx = 0; idx < 18; idx += 1) {
    const sx = ((idx * 73) % (DODGE_WIDTH - 20)) + 10;
    const sy = ((idx * 119 + state.elapsed * 24) % DODGE_HEIGHT);
    ctx.fillRect(sx, sy, 2, 2);
  }

  // Warning laser lanes
  for (const warning of state.warnings) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 93, 143, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(warning.x, 0);
    ctx.lineTo(warning.x, DODGE_HEIGHT);
    ctx.stroke();
    ctx.restore();
  }

  // Trail
  state.trail.forEach((point, index) => {
    const alpha = ((index + 1) / state.trail.length) * 0.35;
    ctx.fillStyle = skin.trail;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4 + index * 1.1, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Pickups
  for (const pickup of state.pickups) {
    if (pickup.kind === 'star') {
      drawStarShape(ctx, pickup.x, pickup.y, pickup.radius, pickup.radius * 0.48, '#FFE066');
    } else {
      const badgeColor = pickup.kind === 'shield' ? '#72EFDD' : pickup.kind === 'magnet' ? '#FF7AA2' : '#FFD166';
      const symbol = pickup.kind === 'shield' ? '🛡' : pickup.kind === 'magnet' ? '🧲' : '⚡';
      ctx.fillStyle = badgeColor;
      ctx.beginPath();
      ctx.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbol, pickup.x, pickup.y + 1);
    }
  }

  // Hazards (meteors)
  for (const hazard of state.hazards) {
    ctx.save();
    ctx.fillStyle = hazard.fast ? '#FF5D8F' : '#8D99AE';
    ctx.beginPath();
    ctx.arc(hazard.x, hazard.y, hazard.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = hazard.fast ? '#FFCCD5' : '#5C677D';
    ctx.beginPath();
    ctx.arc(hazard.x - hazard.radius * 0.25, hazard.y - hazard.radius * 0.2, hazard.radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Player mascot
  const blinkAlpha = state.invincibleTimer > 0 ? 0.5 + 0.5 * Math.sin(state.elapsed * 16) : 1;
  ctx.save();
  ctx.globalAlpha = blinkAlpha;
  drawSkinMascot(ctx, skinId, state.playerX, state.playerY, state.playerVisualRadius, state.elapsed);
  if (state.shieldCount > 0) {
    ctx.strokeStyle = '#72EFDD';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(state.playerX, state.playerY, state.playerVisualRadius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (state.feverTimer > 0) {
    ctx.strokeStyle = '#FFE066';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(state.playerX, state.playerY, state.playerVisualRadius + 8, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Particles
  for (const particle of state.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  if (state.feverTimer > 0 && feverText) {
    ctx.save();
    ctx.fillStyle = '#FFE066';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(feverText, DODGE_WIDTH / 2, 28);
    ctx.restore();
  }
}

export function mountDodgeRunner(canvas, { skinId, feverText, onHudUpdate, onGameOver, onSound, isPaused }) {
  const ctx = canvas.getContext('2d');
  let state = createInitialDodgeState();
  let animationFrameId = 0;
  let lastTimestamp = performance.now();
  const keysHeld = new Set();
  let pointerX = null;
  let finished = false;

  const getPointerX = (event) => {
    const rect = canvas.getBoundingClientRect();
    return ((event.clientX - rect.left) / rect.width) * DODGE_WIDTH;
  };

  const handleKeyDown = (event) => {
    if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(event.key)) {
      pointerX = null;
      keysHeld.add(event.key.toLowerCase());
    }
  };

  const handleKeyUp = (event) => {
    keysHeld.delete(event.key.toLowerCase());
  };

  const handlePointerMove = (event) => {
    pointerX = getPointerX(event);
  };

  const handlePointerDown = (event) => {
    pointerX = getPointerX(event);
  };

  const handlePointerLeave = () => {
    pointerX = null;
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointerleave', handlePointerLeave);

  const loop = (now) => {
    const dt = (now - lastTimestamp) / 1000;
    lastTimestamp = now;

    if (!isPaused() && !finished) {
      const left = keysHeld.has('arrowleft') || keysHeld.has('a');
      const right = keysHeld.has('arrowright') || keysHeld.has('d');
      const moveDirection = (right ? 1 : 0) - (left ? 1 : 0);

      state = stepDodgeState(state, { moveDirection, pointerX }, dt);
      for (const soundEvent of state.events) {
        onSound?.(soundEvent);
      }

      onHudUpdate?.({
        score: state.score,
        starsEarned: state.starsEarned,
        combo: state.combo,
        shield: state.shieldCount > 0,
        magnet: state.magnetTimer > 0,
        fever: state.feverTimer > 0
      });

      if (state.gameOver) {
        finished = true;
        onGameOver?.({ score: state.score, starsEarned: state.starsEarned });
      }
    }

    drawDodgeCanvas(ctx, state, skinId, feverText);
    animationFrameId = requestAnimationFrame(loop);
  };

  drawDodgeCanvas(ctx, state, skinId, feverText);
  animationFrameId = requestAnimationFrame(loop);

  return {
    destroy() {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    }
  };
}
```

- [ ] **Step 4: 테스트 실행 및 통과 확인**

Run: `cd /Users/jeonwoosung/Desktop/bombba/bombom-arcade && npm test`
Expected: `dodgeRunner.test.js` 포함 전체 PASS.

---

### Task 4: 게임 ② 하늘 타워 쌓기 (`towerStack.js`) 코어 로직 & Canvas 엔진 (TDD)

**Files:**
- Create: `bombom-arcade/src/games/towerStack.js`
- Test: `bombom-arcade/tests/towerStack.test.js`

**Interfaces:**
- Produces:
  - `STACK_WIDTH = 368`, `STACK_HEIGHT = 430`, `INITIAL_BLOCK_WIDTH = 160`
  - `createInitialStackState()`
  - `evaluatePlacement(prevBlock, currBlock, perfectCombo)`
  - `placeCurrentBlock(state)`
  - `getStageColors(floorCount)`
  - `mountTowerStack(canvas, options)` (`{ skinId, perfectText, bonusText, onHudUpdate, onGameOver, onSound, isPaused }`, 반환: `{ destroy() }`)

- [ ] **Step 1: `towerStack.test.js` 실패 테스트 작성**

```js
// bombom-arcade/tests/towerStack.test.js
import { describe, expect, it } from 'vitest';
import {
  INITIAL_BLOCK_WIDTH,
  createInitialStackState,
  evaluatePlacement,
  getStageColors,
  placeCurrentBlock
} from '../src/games/towerStack.js';

describe('towerStack placement rules', () => {
  it('snaps block and keeps width on PERFECT placement (|delta| <= 4)', () => {
    const result = evaluatePlacement({ x: 100, width: 160 }, { x: 103, width: 160 }, 0);
    expect(result.status).toBe('perfect');
    expect(result.placedBlock).toEqual({ x: 100, width: 160 });
    expect(result.nextPerfectCombo).toBe(1);
    expect(result.starsEarned).toBe(2);
    expect(result.trimmedSlice).toBeNull();
  });

  it('restores block width (+16 capped at 160) on 5th consecutive PERFECT', () => {
    const result = evaluatePlacement({ x: 120, width: 110 }, { x: 121, width: 110 }, 4);
    expect(result.status).toBe('perfect');
    expect(result.bonusTriggered).toBe(true);
    expect(result.placedBlock.width).toBe(126);

    const capped = evaluatePlacement({ x: 104, width: 155 }, { x: 104, width: 155 }, 4);
    expect(capped.placedBlock.width).toBe(INITIAL_BLOCK_WIDTH);
  });

  it('trims overhanging slice on normal hit', () => {
    const result = evaluatePlacement({ x: 100, width: 100 }, { x: 130, width: 100 }, 2);
    expect(result.status).toBe('placed');
    expect(result.placedBlock).toEqual({ x: 130, width: 70 });
    expect(result.trimmedSlice).toEqual({ x: 200, width: 30 });
    expect(result.nextPerfectCombo).toBe(0);
    expect(result.starsEarned).toBe(1);
  });

  it('triggers game over when overlap <= 2', () => {
    const result = evaluatePlacement({ x: 100, width: 80 }, { x: 179, width: 80 }, 1);
    expect(result.status).toBe('missed');
  });

  it('advances tower floor and spawns next moving block on placement', () => {
    const state = createInitialStackState();
    state.movingBlock.x = state.blocks[0].x;
    const next = placeCurrentBlock(state);
    expect(next.floor).toBe(1);
    expect(next.blocks).toHaveLength(2);
    expect(next.starsEarned).toBe(2);
    expect(next.gameOver).toBe(false);
  });

  it('transitions sky color stages by floor count', () => {
    expect(getStageColors(2).id).toBe('meadow');
    expect(getStageColors(12).id).toBe('sky');
    expect(getStageColors(22).id).toBe('sunset');
    expect(getStageColors(32).id).toBe('space');
  });
});
```

- [ ] **Step 2: 테스트 실행해 실패 확인**

Run: `cd /Users/jeonwoosung/Desktop/bombba/bombom-arcade && npm test`
Expected: FAIL (`Cannot find module '../src/games/towerStack.js'`).

- [ ] **Step 3: `src/games/towerStack.js` 구현**

```js
// bombom-arcade/src/games/towerStack.js
import { drawSkinMascot, getSkinById } from './skins.js';

export const STACK_WIDTH = 368;
export const STACK_HEIGHT = 430;
export const INITIAL_BLOCK_WIDTH = 160;
const BLOCK_HEIGHT = 22;
const BASE_Y = STACK_HEIGHT - 50;
const PERFECT_TOLERANCE = 4;

export function getStageColors(floorCount) {
  if (floorCount < 10) {
    return { id: 'meadow', top: '#89D2FF', bottom: '#D8F3DC' };
  }
  if (floorCount < 20) {
    return { id: 'sky', top: '#4EA8DE', bottom: '#CAF0F8' };
  }
  if (floorCount < 30) {
    return { id: 'sunset', top: '#5E548E', bottom: '#FFAFCC' };
  }
  return { id: 'space', top: '#14112B', bottom: '#3A1C71' };
}

export function evaluatePlacement(prevBlock, currBlock, perfectCombo) {
  const delta = currBlock.x - prevBlock.x;
  if (Math.abs(delta) <= PERFECT_TOLERANCE) {
    const nextCombo = perfectCombo + 1;
    const bonusTriggered = nextCombo > 0 && nextCombo % 5 === 0;
    const restoredWidth = bonusTriggered
      ? Math.min(INITIAL_BLOCK_WIDTH, prevBlock.width + 16)
      : prevBlock.width;
    const centeredX = Math.max(8, Math.min(STACK_WIDTH - restoredWidth - 8, prevBlock.x - (restoredWidth - prevBlock.width) / 2));

    return {
      status: 'perfect',
      placedBlock: { x: centeredX, width: restoredWidth },
      trimmedSlice: null,
      nextPerfectCombo: nextCombo,
      bonusTriggered,
      starsEarned: 2,
      scoreEarned: 20 + nextCombo * 5
    };
  }

  const overlapStart = Math.max(prevBlock.x, currBlock.x);
  const overlapEnd = Math.min(prevBlock.x + prevBlock.width, currBlock.x + currBlock.width);
  const overlapWidth = overlapEnd - overlapStart;

  if (overlapWidth <= 2) {
    return {
      status: 'missed',
      placedBlock: null,
      trimmedSlice: { x: currBlock.x, width: currBlock.width },
      nextPerfectCombo: 0,
      bonusTriggered: false,
      starsEarned: 0,
      scoreEarned: 0
    };
  }

  const trimmedSlice = delta > 0
    ? { x: overlapEnd, width: currBlock.x + currBlock.width - overlapEnd }
    : { x: currBlock.x, width: overlapStart - currBlock.x };

  return {
    status: 'placed',
    placedBlock: { x: overlapStart, width: overlapWidth },
    trimmedSlice,
    nextPerfectCombo: 0,
    bonusTriggered: false,
    starsEarned: 1,
    scoreEarned: 10
  };
}

export function createInitialStackState() {
  const startX = (STACK_WIDTH - INITIAL_BLOCK_WIDTH) / 2;
  const baseBlock = {
    x: startX,
    y: BASE_Y,
    width: INITIAL_BLOCK_WIDTH,
    colorIndex: 0
  };
  return {
    floor: 0,
    score: 0,
    starsEarned: 0,
    perfectCombo: 0,
    cameraY: 0,
    targetCameraY: 0,
    blocks: [baseBlock],
    movingBlock: {
      x: 10,
      y: BASE_Y - BLOCK_HEIGHT,
      width: INITIAL_BLOCK_WIDTH,
      vx: 150,
      colorIndex: 1
    },
    fallingPieces: [],
    bannerText: '',
    bannerTimer: 0,
    elapsed: 0,
    events: [],
    gameOver: false
  };
}

export function placeCurrentBlock(prevState, perfectText = 'PERFECT!', bonusText = 'BomBom BONUS!') {
  if (prevState.gameOver) return prevState;
  const topBlock = prevState.blocks[prevState.blocks.length - 1];
  const evaluation = evaluatePlacement(topBlock, prevState.movingBlock, prevState.perfectCombo);

  const nextState = {
    ...prevState,
    blocks: [...prevState.blocks],
    fallingPieces: [...prevState.fallingPieces],
    events: []
  };

  if (evaluation.status === 'missed') {
    nextState.fallingPieces.push({
      x: prevState.movingBlock.x,
      y: prevState.movingBlock.y,
      width: prevState.movingBlock.width,
      vy: 40,
      colorIndex: prevState.movingBlock.colorIndex
    });
    nextState.gameOver = true;
    nextState.events.push('gameover');
    return nextState;
  }

  const placedY = prevState.movingBlock.y;
  nextState.blocks.push({
    x: evaluation.placedBlock.x,
    y: placedY,
    width: evaluation.placedBlock.width,
    colorIndex: prevState.movingBlock.colorIndex
  });

  if (evaluation.trimmedSlice && evaluation.trimmedSlice.width > 0) {
    nextState.fallingPieces.push({
      x: evaluation.trimmedSlice.x,
      y: placedY,
      width: evaluation.trimmedSlice.width,
      vy: 30,
      colorIndex: prevState.movingBlock.colorIndex
    });
  }

  nextState.floor += 1;
  nextState.score += evaluation.scoreEarned;
  nextState.starsEarned += evaluation.starsEarned;
  nextState.perfectCombo = evaluation.nextPerfectCombo;

  if (evaluation.bonusTriggered) {
    nextState.bannerText = bonusText;
    nextState.bannerTimer = 1.4;
    nextState.events.push('fever');
  } else if (evaluation.status === 'perfect') {
    nextState.bannerText = `${perfectText} x${nextState.perfectCombo}`;
    nextState.bannerTimer = 0.9;
    nextState.events.push('perfect');
  } else {
    nextState.events.push('place');
  }

  if (nextState.floor >= 6) {
    nextState.targetCameraY = (nextState.floor - 5) * BLOCK_HEIGHT;
  }

  const nextSpeed = Math.min(340, 150 + nextState.floor * 4);
  const spawnFromLeft = nextState.floor % 2 === 0;
  nextState.movingBlock = {
    x: spawnFromLeft ? 8 : STACK_WIDTH - evaluation.placedBlock.width - 8,
    y: placedY - BLOCK_HEIGHT,
    width: evaluation.placedBlock.width,
    vx: spawnFromLeft ? nextSpeed : -nextSpeed,
    colorIndex: nextState.floor + 1
  };

  return nextState;
}

export function stepStackFrame(prevState, rawDt) {
  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  const state = {
    ...prevState,
    movingBlock: { ...prevState.movingBlock },
    fallingPieces: prevState.fallingPieces.map((piece) => ({ ...piece })),
    events: []
  };

  state.elapsed += dt;
  state.cameraY += (state.targetCameraY - state.cameraY) * Math.min(1, dt * 7);

  if (state.bannerTimer > 0) {
    state.bannerTimer = Math.max(0, state.bannerTimer - dt);
  }

  if (!state.gameOver) {
    state.movingBlock.x += state.movingBlock.vx * dt;
    const minX = 6;
    const maxX = STACK_WIDTH - state.movingBlock.width - 6;
    if (state.movingBlock.x <= minX) {
      state.movingBlock.x = minX;
      state.movingBlock.vx = Math.abs(state.movingBlock.vx);
    } else if (state.movingBlock.x >= maxX) {
      state.movingBlock.x = maxX;
      state.movingBlock.vx = -Math.abs(state.movingBlock.vx);
    }
  }

  state.fallingPieces = state.fallingPieces
    .map((piece) => ({
      ...piece,
      vy: piece.vy + 680 * dt,
      y: piece.y + piece.vy * dt
    }))
    .filter((piece) => piece.y - state.cameraY < STACK_HEIGHT + 80);

  return state;
}

function drawStackCanvas(ctx, state, skinId) {
  const skin = getSkinById(skinId);
  const stage = getStageColors(state.floor);
  const bg = ctx.createLinearGradient(0, 0, 0, STACK_HEIGHT);
  bg.addColorStop(0, stage.top);
  bg.addColorStop(1, stage.bottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STACK_WIDTH, STACK_HEIGHT);

  ctx.save();
  ctx.translate(0, state.cameraY);

  const drawBlock = (block) => {
    const color = skin.blockPalette[block.colorIndex % skin.blockPalette.length];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(block.x, block.y, block.width, BLOCK_HEIGHT - 1, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.fillRect(block.x + 3, block.y + 2, Math.max(0, block.width - 6), 4);
  };

  for (const block of state.blocks) {
    drawBlock(block);
  }

  if (!state.gameOver) {
    drawBlock(state.movingBlock);
  }

  for (const piece of state.fallingPieces) {
    drawBlock(piece);
  }

  // Cute mascot perched on the top placed block
  const topBlock = state.blocks[state.blocks.length - 1];
  drawSkinMascot(
    ctx,
    skinId,
    topBlock.x + topBlock.width / 2,
    topBlock.y - 14,
    12,
    state.elapsed
  );

  ctx.restore();

  if (state.bannerTimer > 0 && state.bannerText) {
    ctx.save();
    ctx.fillStyle = '#2B2D42';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.bannerText, STACK_WIDTH / 2, 34);
    ctx.restore();
  }
}

export function mountTowerStack(canvas, { skinId, perfectText, bonusText, onHudUpdate, onGameOver, onSound, isPaused }) {
  const ctx = canvas.getContext('2d');
  let state = createInitialStackState();
  let animationFrameId = 0;
  let lastTimestamp = performance.now();
  let finished = false;

  const triggerDrop = () => {
    if (isPaused() || finished) return;
    state = placeCurrentBlock(state, perfectText, bonusText);
    for (const soundEvent of state.events) {
      onSound?.(soundEvent);
    }
    onHudUpdate?.({
      score: state.score,
      starsEarned: state.starsEarned,
      combo: state.perfectCombo,
      floor: state.floor
    });
    if (state.gameOver) {
      finished = true;
      onGameOver?.({ score: state.score, starsEarned: state.starsEarned });
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      if (!event.repeat) {
        triggerDrop();
      }
    }
  };

  const handlePointerDown = (event) => {
    event.preventDefault();
    triggerDrop();
  };

  window.addEventListener('keydown', handleKeyDown);
  canvas.addEventListener('pointerdown', handlePointerDown);

  const loop = (now) => {
    const dt = (now - lastTimestamp) / 1000;
    lastTimestamp = now;
    if (!isPaused()) {
      state = stepStackFrame(state, dt);
    }
    drawStackCanvas(ctx, state, skinId);
    animationFrameId = requestAnimationFrame(loop);
  };

  drawStackCanvas(ctx, state, skinId);
  animationFrameId = requestAnimationFrame(loop);

  return {
    destroy() {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('pointerdown', handlePointerDown);
    }
  };
}
```

- [ ] **Step 4: 테스트 실행 및 통과 확인**

Run: `cd /Users/jeonwoosung/Desktop/bombba/bombom-arcade && npm test`
Expected: 4개 테스트 파일 전체 PASS.

---

### Task 5: 8비트 Web Audio 사운드 & React UI 컴포넌트 (Header, Lobby, GameShell, SkinShop, App, CSS)

**Files:**
- Create: `bombom-arcade/src/utils/sound.js`
- Create: `bombom-arcade/src/components/Header.jsx`
- Create: `bombom-arcade/src/components/Lobby.jsx`
- Create: `bombom-arcade/src/components/GameShell.jsx`
- Create: `bombom-arcade/src/components/SkinShop.jsx`
- Create: `bombom-arcade/src/App.jsx`
- Create: `bombom-arcade/src/main.jsx`
- Create: `bombom-arcade/src/styles/app.css`

**Interfaces:**
- Consumes: `translations`, `resolveLanguage`, `SKINS`, `getSkinById`, `unlockSkin`, `equipSkin`, `loadState`, `saveState`, `mountDodgeRunner`, `mountTowerStack`
- Produces: 완전한 반응형 팝업/새탭 React 애플리케이션 UI 및 접근성 `<dialog>` 모달

- [ ] **Step 1: `src/utils/sound.js` 작성 (Web Audio API)**

```js
// bombom-arcade/src/utils/sound.js
let sharedAudioContext = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioCtx();
  }
  if (sharedAudioContext.state === 'suspended') {
    sharedAudioContext.resume().catch(() => {});
  }
  return sharedAudioContext;
}

function playTone(frequency, duration, type = 'sine', gainValue = 0.08, delay = 0) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const startTime = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);

  gain.gain.setValueAtTime(gainValue, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration);
}

export function playSoundEffect(eventName, muted) {
  if (muted) return;
  switch (eventName) {
    case 'star':
    case 'place':
      playTone(660, 0.08, 'triangle', 0.09, 0);
      playTone(880, 0.09, 'triangle', 0.07, 0.05);
      break;
    case 'perfect':
      playTone(587, 0.08, 'triangle', 0.09, 0);
      playTone(784, 0.08, 'triangle', 0.09, 0.06);
      playTone(1046, 0.14, 'triangle', 0.09, 0.12);
      break;
    case 'powerup':
    case 'fever':
      playTone(523, 0.08, 'square', 0.05, 0);
      playTone(659, 0.08, 'square', 0.05, 0.06);
      playTone(784, 0.08, 'square', 0.05, 0.12);
      playTone(1046, 0.16, 'square', 0.06, 0.18);
      break;
    case 'shieldBreak':
      playTone(440, 0.12, 'sawtooth', 0.06, 0);
      playTone(300, 0.14, 'sawtooth', 0.05, 0.07);
      break;
    case 'gameover':
      playTone(392, 0.12, 'triangle', 0.08, 0);
      playTone(330, 0.14, 'triangle', 0.08, 0.11);
      playTone(262, 0.24, 'triangle', 0.08, 0.23);
      break;
    default:
      break;
  }
}
```

- [ ] **Step 2: `Header.jsx`, `Lobby.jsx`, `SkinShop.jsx`, `GameShell.jsx`, `App.jsx`, `main.jsx` 작성**

- `Header.jsx`: `<header>` 랜드마크, `screen !== 'lobby'` 시 뒤로가기 `<button>`, 브랜드 배지(`봄봄` / `BomBom`), 별 잔액, 언어 전환, 음소거 토글, 새 탭 확대 버튼(`!isFullTab`).
- `Lobby.jsx`: `<main>` 랜드마크, `<h1>` 타이틀(`봄봄 아케이드` / `BomBom Arcade`), 장착 스킨 미리보기, 게임 2종 카드(`playNow`), 스킨 도감 버튼.
- `GameShell.jsx`: `<main>` 내 `368×430` `<canvas>`, HUD(점수, 획득 별, 콤보, 일시정지 버튼), 시작 대기 오버레이, 네이티브 `<dialog>` (`showModal()` + `<form method="dialog">` 또는 버튼 닫기, `overscroll-behavior: contain` 적용)로 게임 오버 결과 및 다시하기/로비 이동 제공.
- `SkinShop.jsx`: `<main>` 내 6종 스킨 카드 그리드, Canvas 미니 프리뷰 또는 이모지 + 컬러 칩, 해금/장착 처리.
- `App.jsx`: 초기 상태 로드(`loadState`), `<html lang>` 동기화, 게임 결과 및 스킨 해금 즉시 저장(`saveState`), `window.location.search`의 `mode=full` 감지.

*(코드 작성 시 모든 컴포넌트는 전체 단어 식별자 사용, inline handler/script 없음, `aria-label` 및 `:focus-visible` 준수.)*

- [ ] **Step 3: `src/styles/app.css` 작성**

`400×580` 팝업 레이아웃, `body.full-tab` 중앙 정렬 확장 레이아웃, 파스텔 네온 테마 변수, `dialog:modal` & `dialog::backdrop` `overscroll-behavior: contain`, `:focus-visible` 아웃라인, `@media (prefers-reduced-motion: no-preference)` 장식 바운스 애니메이션을 정의한다.

- [ ] **Step 4: 개발 빌드 및 단위 테스트 검증**

Run: `cd /Users/jeonwoosung/Desktop/bombba/bombom-arcade && npm test && npm run build`
Expected: 테스트 PASS, `dist/` 정상 생성(경고/오류 없음).

---

### Task 6: 크롬 웹스토어 배포 문서 · 패키징 스크립트 · E2E 실측 검증

**Files:**
- Create: `bombom-arcade/CHROMEWEBSTORE.md`
- Create: `bombom-arcade/PRIVACY_POLICY.md`
- Create: `bombom-arcade/scripts/package-zip.sh`

- [ ] **Step 1: `CHROMEWEBSTORE.md` 및 `PRIVACY_POLICY.md` 작성**

`chrome-extensions` 스킬의 `chromewebstore-template.md`와 `privacy-policy.md` 형식에 따라 작성한다.
- 구현 세부 기술명(React, Vite, Canvas, chrome.storage 등)은 스토어 사용자 설명에서 제외하고 사용자 혜택 중심으로 서술한다.
- `storage` 권한 사유를 구체적으로 기재한다("Saves the user's high scores, collected stars, unlocked character skins, and language/sound preferences locally on the device").
- 데이터 수집 없음(`No`) 및 오프디바이스 전송 없음을 `PRIVACY_POLICY.md`와 일치시킨다.

- [ ] **Step 2: `scripts/package-zip.sh` 작성 및 실행**

```bash
#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

npm run build

VERSION=$(node -p "require('./public/manifest.json').version")
OUTPUT="bombom-arcade-v${VERSION}.zip"
rm -f "$OUTPUT"

cd dist
zip -r "../$OUTPUT" . \
  -x "*.map" \
  -x ".DS_Store" \
  -x "Thumbs.db"

cd "$PROJECT_DIR"
echo "Packaged: $OUTPUT ($(du -h "$OUTPUT" | cut -f1))"
```

- [ ] **Step 3: 전체 테스트 · 빌드 · ZIP 내용물 · Playwright E2E 검증**

1. `npm test` (전체 단위 테스트 PASS 확인)
2. `bash scripts/package-zip.sh` 및 `unzip -l bombom-arcade-v*.zip`로 불필요 파일(`CHROMEWEBSTORE.md`, `node_modules`, `src` 등) 미포함 및 `manifest.json`, `_locales/`, `icons/*.png`, `index.html`, `assets/*` 포함 확인.
3. Playwright 스크립트(`/tmp/verify_bombom.mjs`)로 `vite preview` 서빙된 빌드 결과물을 실제로 열어:
   - 로비 렌더링(`봄봄 아케이드`), 한/영 전환(`BomBom Arcade`), 스킨 상점 진입
   - 별빛 닷지 러너 실행 및 HUD 동작 확인
   - 하늘 타워 쌓기 실행, 스페이스/클릭으로 블록 배치 후 층수/별 증가 확인
   - 콘솔 에러(`pageerror`, `console.error`) 0건 확인.

---

## Plan Self-Review

1. **Spec Coverage:**
   - 브랜드(`봄봄`/`BomBom`) → Task 1(`_locales`), Task 2(`translations.js`, `skins.js`), Task 5(UI), Task 6(`CHROMEWEBSTORE.md`)
   - 게임 2종(`dodgeRunner.js`, `towerStack.js`) → Task 3, Task 4
   - 공유 별 & 6종 스킨 → Task 2, Task 5
   - MV3 단일 `storage` 권한 & PNG 아이콘 → Task 1
   - Web Audio 8비트 사운드 & KO/EN 전환 & 새 탭 확대 → Task 5
   - 테스트 및 웹스토어 배포 패키지 → Task 2~4, Task 6
2. **Placeholder Scan:** 모든 테스트 코드, 매니페스트, 핵심 엔진 코드, 패키징 스크립트에 TBD/TODO 없음. (Task 5 UI JSX 세부 마크업은 Task 1~4 인터페이스와 spec 3절을 그대로 구현.)
3. **Type & Interface Consistency:** `SKINS`, `getSkinById`, `dodgeRunner.js`의 `mountDodgeRunner`, `towerStack.js`의 `mountTowerStack`, `storage.js`의 `loadState`/`saveState` 시그니처 모두 일치함.
