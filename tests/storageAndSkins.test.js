import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SKINS,
  canUnlockSkin,
  drawSkinMascot,
  equipSkin,
  getSkinById,
  unlockSkin
} from '../src/games/skins.js';
import {
  STORAGE_KEY,
  createDefaultState,
  loadState,
  normalizeState,
  saveState
} from '../src/utils/storage.js';

describe('storage normalization and defaults', () => {
  it('returns valid default state', () => {
    const defaultState = createDefaultState();
    expect(defaultState).toEqual({
      stars: 0,
      nickname: '',
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
    });
  });

  it('recovers missing, null, or corrupted data safely', () => {
    expect(normalizeState(null)).toEqual(createDefaultState());
    expect(normalizeState(undefined)).toEqual(createDefaultState());
    expect(normalizeState('invalid string')).toEqual(createDefaultState());

    const normalized = normalizeState({
      stars: -50,
      nickname: '  봄봄  ',
      highScores: { dodge: 120, stack: 'invalid' },
      unlockedSkins: ['unknown_skin', 'strawberry-slime'],
      equippedSkin: 'gold-unicorn',
      settings: { lang: 'japanese', muted: 'yes' }
    });

    expect(normalized.stars).toBe(0);
    expect(normalized.nickname).toBe('봄봄');
    expect(normalized.highScores).toEqual({ dodge: 120, stack: 0 });
    expect(normalized.unlockedSkins).toEqual(['bombom', 'strawberry-slime']);
    expect(normalized.equippedSkin).toBe('bombom');
    expect(normalized.settings).toEqual({ lang: 'auto', muted: false });
  });

  it('preserves valid equipped skin and high scores', () => {
    const rawState = {
      stars: 85,
      highScores: { dodge: 420, stack: 35 },
      unlockedSkins: ['bombom', 'rocket-cat'],
      equippedSkin: 'rocket-cat',
      settings: { lang: 'ko', muted: true }
    };

    const normalized = normalizeState(rawState);
    expect(normalized.stars).toBe(85);
    expect(normalized.highScores).toEqual({ dodge: 420, stack: 35 });
    expect(normalized.unlockedSkins).toEqual(['bombom', 'rocket-cat']);
    expect(normalized.equippedSkin).toBe('rocket-cat');
    expect(normalized.settings).toEqual({ lang: 'ko', muted: true });
  });
});

describe('skin catalog and interactions', () => {
  it('defines exactly 6 skins with bombom free and required metadata', () => {
    expect(SKINS).toHaveLength(6);

    const expectedSkins = [
      { id: 'bombom', cost: 0, badge: '⭐' },
      { id: 'strawberry-slime', cost: 25, badge: '🍓' },
      { id: 'rocket-cat', cost: 50, badge: '🐱' },
      { id: 'ribbon-bunny', cost: 80, badge: '🐰' },
      { id: 'rainbow-cloud', cost: 120, badge: '🌈' },
      { id: 'gold-unicorn', cost: 180, badge: '🦄' }
    ];

    for (const expectedSkin of expectedSkins) {
      const skinItem = getSkinById(expectedSkin.id);
      expect(skinItem).toBeDefined();
      expect(skinItem.cost).toBe(expectedSkin.cost);
      expect(skinItem.badge).toBe(expectedSkin.badge);
      expect(typeof skinItem.name.ko).toBe('string');
      expect(typeof skinItem.name.en).toBe('string');
      expect(typeof skinItem.primary).toBe('string');
      expect(typeof skinItem.secondary).toBe('string');
      expect(typeof skinItem.trail).toBe('string');
      expect(Array.isArray(skinItem.blockPalette)).toBe(true);
      expect(skinItem.blockPalette.length).toBeGreaterThanOrEqual(4);
    }

    const defaultSkin = getSkinById('bombom');
    expect(defaultSkin.name.ko).toBe('봄봄');
    expect(defaultSkin.name.en).toBe('BomBom');
  });

  it('falls back to bombom when skin id is not found', () => {
    const fallbackSkin = getSkinById('non-existent-skin');
    expect(fallbackSkin.id).toBe('bombom');
  });

  it('blocks unlock when stars are insufficient or already unlocked', () => {
    const state = { ...createDefaultState(), stars: 20 };
    expect(canUnlockSkin(state, 'strawberry-slime')).toBe(false);
    expect(unlockSkin(state, 'strawberry-slime')).toBe(state);

    const alreadyUnlockedState = {
      ...createDefaultState(),
      stars: 100,
      unlockedSkins: ['bombom', 'strawberry-slime']
    };
    expect(canUnlockSkin(alreadyUnlockedState, 'strawberry-slime')).toBe(false);
    expect(unlockSkin(alreadyUnlockedState, 'strawberry-slime')).toBe(alreadyUnlockedState);
  });

  it('unlocks and equips skin when stars are sufficient', () => {
    const initialState = { ...createDefaultState(), stars: 30 };
    const unlockedState = unlockSkin(initialState, 'strawberry-slime');

    expect(unlockedState.stars).toBe(5);
    expect(unlockedState.unlockedSkins).toContain('strawberry-slime');
    expect(unlockedState.equippedSkin).toBe('strawberry-slime');

    const equippedBackState = equipSkin(unlockedState, 'bombom');
    expect(equippedBackState.equippedSkin).toBe('bombom');

    const invalidEquipState = equipSkin(equippedBackState, 'gold-unicorn');
    expect(invalidEquipState.equippedSkin).toBe('bombom');
  });

  it('draws mascot safely for all skins with mock canvas context', () => {
    const createMockContext = () => {
      const gradientMock = {
        addColorStop: vi.fn()
      };
      return {
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(),
        ellipse: vi.fn(),
        fill: vi.fn(),
        stroke: vi.fn(),
        createRadialGradient: vi.fn(() => gradientMock),
        createLinearGradient: vi.fn(() => gradientMock),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineCap: 'butt'
      };
    };

    for (const skin of SKINS) {
      const contextMock = createMockContext();
      expect(() => {
        drawSkinMascot(contextMock, skin.id, 100, 100, 24, 0.5);
      }).not.toThrow();

      expect(contextMock.save).toHaveBeenCalled();
      expect(contextMock.restore).toHaveBeenCalled();
      expect(contextMock.translate).toHaveBeenCalledWith(100, expect.any(Number));
      expect(contextMock.fill).toHaveBeenCalled();
      expect(contextMock.stroke).toHaveBeenCalled();
    }
  });
});

describe('storage persistence adapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete globalThis.chrome;
    delete globalThis.localStorage;
  });

  afterEach(() => {
    delete globalThis.chrome;
    delete globalThis.localStorage;
  });

  it('uses chrome.storage.local when available', async () => {
    const storedData = {};
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async (key) => ({ [key]: storedData[key] })),
          set: vi.fn(async (items) => {
            Object.assign(storedData, items);
          })
        }
      }
    };

    const loadedInitial = await loadState();
    expect(loadedInitial.stars).toBe(0);

    const updatedState = {
      ...loadedInitial,
      stars: 45,
      highScores: { dodge: 150, stack: 10 }
    };

    const saved = await saveState(updatedState);
    expect(saved.stars).toBe(45);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      [STORAGE_KEY]: expect.objectContaining({ stars: 45 })
    });

    const loadedAfterSave = await loadState();
    expect(loadedAfterSave.stars).toBe(45);
    expect(loadedAfterSave.highScores.dodge).toBe(150);
  });

  it('falls back to localStorage when chrome is undefined', async () => {
    const store = new Map();
    globalThis.localStorage = {
      getItem: vi.fn((key) => store.get(key) || null),
      setItem: vi.fn((key, value) => {
        store.set(key, String(value));
      }),
      removeItem: vi.fn((key) => {
        store.delete(key);
      }),
      clear: vi.fn(() => {
        store.clear();
      })
    };

    const loadedInitial = await loadState();
    expect(loadedInitial.stars).toBe(0);

    const nextState = {
      ...loadedInitial,
      stars: 99,
      equippedSkin: 'bombom'
    };

    await saveState(nextState);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      STORAGE_KEY,
      expect.stringContaining('"stars":99')
    );

    const reloaded = await loadState();
    expect(reloaded.stars).toBe(99);
  });

  it('handles storage errors gracefully without throwing', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => {
            throw new Error('Simulated chrome storage read failure');
          }),
          set: vi.fn(async () => {
            throw new Error('Simulated chrome storage write failure');
          })
        }
      }
    };

    const fallbackLoaded = await loadState();
    expect(fallbackLoaded).toEqual(createDefaultState());
    expect(consoleErrorSpy).toHaveBeenCalled();

    const saveResult = await saveState({ stars: 10 });
    expect(saveResult.stars).toBe(10);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
