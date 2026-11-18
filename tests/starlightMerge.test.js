import { describe, expect, it, vi } from 'vitest';
import {
  DANGER_LINE_Y,
  FLOOR_Y,
  MERGE_HEIGHT,
  MERGE_TIERS,
  MERGE_WIDTH,
  WALL_LEFT,
  WALL_RIGHT,
  createInitialMergeState,
  dropMergeOrb,
  mountStarlightMerge,
  stepMergeState
} from '../src/games/starlightMerge.js';

function createFixedRandom(fixedValue = 0.2) {
  return () => fixedValue;
}

describe('starlightMerge core physics and merge mechanics', () => {
  it('defines 8 ascending evolution tiers and valid initial state', () => {
    expect(MERGE_WIDTH).toBe(368);
    expect(MERGE_HEIGHT).toBe(430);
    expect(MERGE_TIERS).toHaveLength(8);

    for (let index = 1; index < MERGE_TIERS.length; index += 1) {
      expect(MERGE_TIERS[index].radius).toBeGreaterThan(MERGE_TIERS[index - 1].radius);
      expect(MERGE_TIERS[index].score).toBeGreaterThan(MERGE_TIERS[index - 1].score);
    }

    const initialState = createInitialMergeState(createFixedRandom(0));
    expect(initialState.orbs).toHaveLength(0);
    expect(initialState.score).toBe(0);
    expect(initialState.starsEarned).toBe(0);
    expect(initialState.currentTier).toBeGreaterThanOrEqual(0);
    expect(initialState.currentTier).toBeLessThan(4);
    expect(initialState.nextTier).toBeGreaterThanOrEqual(0);
    expect(initialState.nextTier).toBeLessThan(4);
    expect(initialState.gameOver).toBe(false);
  });

  it('drops orb within clamped jar bounds and enforces drop cooldown', () => {
    let state = createInitialMergeState(createFixedRandom(0));
    state = {
      ...state,
      aimX: 0,
      currentTier: 1,
      nextTier: 2
    };

    const droppedState = dropMergeOrb(state, createFixedRandom(0.5));
    expect(droppedState.orbs).toHaveLength(1);
    expect(droppedState.orbs[0].tier).toBe(1);
    expect(droppedState.orbs[0].x).toBeGreaterThanOrEqual(WALL_LEFT + MERGE_TIERS[1].radius);
    expect(droppedState.orbs[0].x).toBeLessThanOrEqual(WALL_RIGHT - MERGE_TIERS[1].radius);
    expect(droppedState.currentTier).toBe(2);
    expect(droppedState.dropCooldown).toBeGreaterThan(0);
    expect(droppedState.events).toContain('drop');

    // 쿨다운 중 중복 드롭 방지 검증
    const blockedDrop = dropMergeOrb(droppedState, createFixedRandom(0.5));
    expect(blockedDrop.orbs).toHaveLength(1);
  });

  it('merges two touching same-tier orbs into tier + 1 with score, stars, and combo', () => {
    let state = createInitialMergeState(createFixedRandom(0));
    const tierRadius = MERGE_TIERS[1].radius;
    state = {
      ...state,
      orbs: [
        {
          id: 1,
          tier: 1,
          x: 170,
          y: FLOOR_Y - tierRadius,
          velocityX: 15,
          velocityY: 0,
          radius: tierRadius,
          ageSeconds: 1.5,
          hasCollided: true
        },
        {
          id: 2,
          tier: 1,
          x: 170 + tierRadius * 1.6,
          y: FLOOR_Y - tierRadius,
          velocityX: -15,
          velocityY: 0,
          radius: tierRadius,
          ageSeconds: 1.5,
          hasCollided: true
        }
      ]
    };

    const nextState = stepMergeState(state, {}, 0.03, createFixedRandom(0.2));
    expect(nextState.orbs).toHaveLength(1);
    expect(nextState.orbs[0].tier).toBe(2);
    expect(nextState.score).toBe(MERGE_TIERS[2].score);
    expect(nextState.starsEarned).toBe(MERGE_TIERS[2].stars);
    expect(nextState.combo).toBe(1);
    expect(nextState.events).toContain('merge');
  });

  it('clears double Gold Unicorn (tier 7) merge with +100 score and +20 mini stars', () => {
    let state = createInitialMergeState(createFixedRandom(0));
    const maxTier = MERGE_TIERS.length - 1;
    const maxRadius = MERGE_TIERS[maxTier].radius;
    state = {
      ...state,
      orbs: [
        {
          id: 10,
          tier: maxTier,
          x: 150,
          y: FLOOR_Y - maxRadius,
          velocityX: 0,
          velocityY: 0,
          radius: maxRadius,
          ageSeconds: 2.0,
          hasCollided: true
        },
        {
          id: 11,
          tier: maxTier,
          x: 150 + maxRadius * 1.5,
          y: FLOOR_Y - maxRadius,
          velocityX: 0,
          velocityY: 0,
          radius: maxRadius,
          ageSeconds: 2.0,
          hasCollided: true
        }
      ]
    };

    const nextState = stepMergeState(state, {}, 0.02, createFixedRandom(0.2));
    expect(nextState.orbs).toHaveLength(0);
    expect(nextState.score).toBe(100);
    expect(nextState.starsEarned).toBe(20);
    expect(nextState.events).toContain('fever');
  });

  it('triggers gameOver after settled orb stays above DANGER_LINE_Y for over 1.8 seconds', () => {
    let state = createInitialMergeState(createFixedRandom(0));
    const radiusSeven = MERGE_TIERS[7].radius;
    const radiusSix = MERGE_TIERS[6].radius;
    const radiusFive = MERGE_TIERS[5].radius;
    const radiusFour = MERGE_TIERS[4].radius;

    // 바닥(FLOOR_Y=412)부터 4개 구슬이 차곡차곡 쌓여 최상단 구슬이 DANGER_LINE_Y(98) 위로 넘친 상태 구성
    state = {
      ...state,
      orbs: [
        { id: 97, tier: 7, x: MERGE_WIDTH / 2, y: FLOOR_Y - radiusSeven, velocityX: 0, velocityY: 0, radius: radiusSeven, ageSeconds: 3.0, hasCollided: true },
        { id: 98, tier: 6, x: MERGE_WIDTH / 2, y: FLOOR_Y - radiusSeven * 2 - radiusSix, velocityX: 0, velocityY: 0, radius: radiusSix, ageSeconds: 3.0, hasCollided: true },
        { id: 99, tier: 5, x: MERGE_WIDTH / 2, y: FLOOR_Y - radiusSeven * 2 - radiusSix * 2 - radiusFive, velocityX: 0, velocityY: 0, radius: radiusFive, ageSeconds: 3.0, hasCollided: true },
        { id: 100, tier: 4, x: MERGE_WIDTH / 2, y: FLOOR_Y - radiusSeven * 2 - radiusSix * 2 - radiusFive * 2 - radiusFour, velocityX: 0, velocityY: 0, radius: radiusFour, ageSeconds: 2.0, hasCollided: true }
      ]
    };

    for (let stepIndex = 0; stepIndex < 40 && !state.gameOver; stepIndex += 1) {
      state = stepMergeState(state, {}, 0.05, createFixedRandom(0.2));
    }

    expect(state.gameOver).toBe(true);
    expect(state.events).toContain('gameover');
  });

  it('mounts and cleans up listeners cleanly in mountStarlightMerge destroy()', () => {
    const mockContext = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      rect: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
    };
    const mockCanvas = {
      width: MERGE_WIDTH,
      height: MERGE_HEIGHT,
      getContext: vi.fn(() => mockContext),
      getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: MERGE_WIDTH, height: MERGE_HEIGHT })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      setPointerCapture: vi.fn()
    };
    const mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn().mockReturnValue(91),
      cancelAnimationFrame: vi.fn()
    };
    vi.stubGlobal('window', mockWindow);

    const onHudUpdate = vi.fn();
    const mounted = mountStarlightMerge(mockCanvas, {
      skinId: 'bombom',
      onHudUpdate,
      onGameOver: vi.fn(),
      onSound: vi.fn(),
      isPaused: () => false
    });

    expect(onHudUpdate).toHaveBeenCalledTimes(1);
    expect(mockCanvas.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(mockCanvas.addEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));

    mounted.destroy();

    expect(mockWindow.cancelAnimationFrame).toHaveBeenCalledWith(91);
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('pointerup', expect.any(Function));

    vi.unstubAllGlobals();
  });
});
