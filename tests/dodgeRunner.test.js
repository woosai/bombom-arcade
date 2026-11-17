import { describe, expect, it, vi } from 'vitest';
import {
  DODGE_HEIGHT,
  DODGE_WIDTH,
  checkCircleCollision,
  createInitialDodgeState,
  mountDodgeRunner,
  stepDodgeState
} from '../src/games/dodgeRunner.js';

// 결정적 난수 생성용 고정 시퀀스 헬퍼
function createFixedRandom(fixedValue = 0.5) {
  return () => fixedValue;
}

describe('dodgeRunner core mechanics', () => {
  it('checks circle collision accurately at boundaries', () => {
    expect(checkCircleCollision(100, 100, 10, 115, 100, 5)).toBe(true);
    expect(checkCircleCollision(100, 100, 10, 115.01, 100, 5)).toBe(false);
    expect(checkCircleCollision(0, 0, 13, 10, 10, 14)).toBe(true);
    expect(checkCircleCollision(0, 0, 13, 30, 30, 14)).toBe(false);
  });

  it('clamps player movement within [playerVisualRadius + 4, DODGE_WIDTH - playerVisualRadius - 4]', () => {
    let currentState = createInitialDodgeState();
    currentState.hazardSpawnTimer = 99;
    currentState.pickupSpawnTimer = 99;
    const minimumBound = currentState.playerVisualRadius + 4;
    const maximumBound = DODGE_WIDTH - currentState.playerVisualRadius - 4;

    expect(DODGE_WIDTH).toBe(368);
    expect(DODGE_HEIGHT).toBe(430);

    for (let stepIndex = 0; stepIndex < 40; stepIndex += 1) {
      currentState = stepDodgeState(currentState, { moveLeft: true }, 0.05, createFixedRandom());
    }
    expect(currentState.playerX).toBe(minimumBound);

    for (let stepIndex = 0; stepIndex < 60; stepIndex += 1) {
      currentState = stepDodgeState(currentState, { moveRight: true }, 0.05, createFixedRandom());
    }
    expect(currentState.playerX).toBe(maximumBound);

    const pointerLeftState = stepDodgeState(currentState, { pointerX: -200 }, 0.05, createFixedRandom());
    expect(pointerLeftState.playerX).toBe(minimumBound);

    const pointerRightState = stepDodgeState(currentState, { pointerX: 999 }, 0.05, createFixedRandom());
    expect(pointerRightState.playerX).toBe(maximumBound);
  });

  it('clamps rawDeltaSeconds to [0, 0.05] and accumulates +5 survival score per second', () => {
    let currentState = createInitialDodgeState();
    const initialX = currentState.playerX;

    // 과도한 델타 시간 입력 시 0.05초 상한 클램핑 검증
    currentState = stepDodgeState(currentState, { moveRight: true }, 1.5, createFixedRandom());
    expect(currentState.elapsedSeconds).toBeCloseTo(0.05, 6);
    expect(currentState.playerX).toBeCloseTo(initialX + 320 * 0.05, 6);

    // 1초 누적 시 생존 점수 +5점 반영 검증 (0.05초 * 19회 추가 = 총 1.00초)
    for (let stepIndex = 0; stepIndex < 19; stepIndex += 1) {
      currentState = stepDodgeState(currentState, {}, 0.05, createFixedRandom());
    }
    expect(currentState.elapsedSeconds).toBeCloseTo(1.0, 6);
    expect(currentState.score).toBe(5);
  });

  it('increments starsEarned, combo up to 5, score +10*combo, and resets combo after 1.8s', () => {
    let currentState = createInitialDodgeState();
    currentState.pickupSpawnTimer = 99;
    currentState.hazardSpawnTimer = 99;

    // 연속 6회 별 획득 시 콤보 최대 5 제한 및 점수 누적 검증
    let expectedScore = 0;
    for (let collectIndex = 1; collectIndex <= 6; collectIndex += 1) {
      const expectedCombo = Math.min(5, collectIndex);
      expectedScore += 10 * expectedCombo;

      currentState = {
        ...currentState,
        pickups: [
          {
            x: currentState.playerX,
            y: currentState.playerY,
            radius: 12,
            velocityY: 0,
            type: 'star'
          }
        ]
      };
      currentState = stepDodgeState(currentState, {}, 0.01, createFixedRandom());
      expect(currentState.starsEarned).toBe(collectIndex);
      expect(currentState.combo).toBe(expectedCombo);
      expect(currentState.events).toContain('star');
    }
    expect(currentState.score).toBe(expectedScore);

    // 1.8초 경과 동안 별 미획득 시 콤보 0 초기화 검증
    for (let stepIndex = 0; stepIndex < 36; stepIndex += 1) {
      currentState = stepDodgeState(currentState, {}, 0.05, createFixedRandom());
    }
    expect(currentState.combo).toBe(0);
  });

  it('absorbs one hazard hit with shield, grants 1.0s invincibility, and emits shieldBreak', () => {
    let currentState = createInitialDodgeState();
    currentState.shieldCount = 1;
    currentState.pickupSpawnTimer = 99;
    currentState.hazardSpawnTimer = 99;
    currentState.hazards = [
      {
        x: currentState.playerX,
        y: currentState.playerY,
        radius: 14,
        velocityX: 0,
        velocityY: 0,
        rotation: 0,
        rotationSpeed: 0,
        isFastMeteor: false
      }
    ];

    const afterHitState = stepDodgeState(currentState, {}, 0.02, createFixedRandom());
    expect(afterHitState.gameOver).toBe(false);
    expect(afterHitState.shieldCount).toBe(0);
    expect(afterHitState.invincibleTimer).toBeCloseTo(1.0, 5);
    expect(afterHitState.events).toContain('shieldBreak');
  });

  it('sets gameOver and emits gameover when hit without shield, fever, or invincibility', () => {
    let currentState = createInitialDodgeState();
    currentState.pickupSpawnTimer = 99;
    currentState.hazardSpawnTimer = 99;
    currentState.hazards = [
      {
        x: currentState.playerX,
        y: currentState.playerY,
        radius: 14,
        velocityX: 0,
        velocityY: 0,
        rotation: 0,
        rotationSpeed: 0,
        isFastMeteor: false
      }
    ];

    const afterHitState = stepDodgeState(currentState, {}, 0.02, createFixedRandom());
    expect(afterHitState.gameOver).toBe(true);
    expect(afterHitState.events).toContain('gameover');
  });

  it('pulls stars within 130px toward player when magnetTimer > 0', () => {
    let currentState = createInitialDodgeState();
    currentState.magnetTimer = 4.0;
    currentState.pickupSpawnTimer = 99;
    currentState.hazardSpawnTimer = 99;

    const nearStarStartX = currentState.playerX + 100;
    const farStarStartX = currentState.playerX + 160;
    currentState.pickups = [
      { x: nearStarStartX, y: currentState.playerY, radius: 12, velocityY: 0, type: 'star' },
      { x: farStarStartX, y: currentState.playerY, radius: 12, velocityY: 0, type: 'star' }
    ];

    const nextState = stepDodgeState(currentState, {}, 0.05, createFixedRandom());
    expect(nextState.pickups[0].x).toBeLessThan(nearStarStartX);
    expect(nextState.pickups[1].x).toBe(farStarStartX);
  });

  it('grants invulnerability, destroys hazards for +15 score, and speeds pickup spawn to 0.24s in fever', () => {
    let currentState = createInitialDodgeState();
    currentState.feverTimer = 3.0;
    currentState.pickupSpawnTimer = 0.01;
    currentState.hazardSpawnTimer = 99;
    currentState.hazards = [
      {
        x: currentState.playerX,
        y: currentState.playerY,
        radius: 14,
        velocityX: 0,
        velocityY: 0,
        rotation: 0,
        rotationSpeed: 0,
        isFastMeteor: false
      }
    ];

    const nextState = stepDodgeState(currentState, {}, 0.02, createFixedRandom());
    expect(nextState.gameOver).toBe(false);
    expect(nextState.hazards).toHaveLength(0);
    expect(nextState.score).toBe(15);
    expect(nextState.pickupSpawnTimer).toBeCloseTo(0.24, 5);
  });

  it('spawns warning after 12s elapsed, waits 0.6s, then emits fast meteor with velocityY = 450', () => {
    let currentState = createInitialDodgeState();
    currentState.elapsedSeconds = 12.0;
    currentState.warningSpawnTimer = 0.01;
    currentState.pickupSpawnTimer = 99;
    currentState.hazardSpawnTimer = 99;

    // 12초 경과 시 경고 라인 생성 검증
    currentState = stepDodgeState(currentState, {}, 0.02, createFixedRandom(0.5));
    expect(currentState.warnings).toHaveLength(1);
    expect(currentState.warnings[0].timer).toBeCloseTo(0.6, 5);

    // 0.6초 대기 중에는 아직 고속 운석 미발사 검증
    for (let stepIndex = 0; stepIndex < 11; stepIndex += 1) {
      currentState = stepDodgeState(currentState, {}, 0.05, createFixedRandom(0.5));
    }
    expect(currentState.warnings).toHaveLength(1);
    expect(currentState.hazards).toHaveLength(0);

    // 0.6초 경과 완료 시 고속 운석(velocityY = 450) 발사 검증
    currentState = stepDodgeState(currentState, {}, 0.05, createFixedRandom(0.5));
    expect(currentState.warnings).toHaveLength(0);
    expect(currentState.hazards).toHaveLength(1);
    expect(currentState.hazards[0].velocityY).toBe(450);
    expect(currentState.hazards[0].isFastMeteor).toBe(true);
  });

  it('cleans up animation frame and listeners in mountDodgeRunner destroy()', () => {
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
    const canvasListeners = {};
    const mockCanvas = {
      width: DODGE_WIDTH,
      height: DODGE_HEIGHT,
      getContext: vi.fn(() => mockContext),
      getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: DODGE_WIDTH, height: DODGE_HEIGHT })),
      addEventListener: vi.fn((eventName, handler) => {
        canvasListeners[eventName] = handler;
      }),
      removeEventListener: vi.fn()
    };

    const mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn().mockReturnValue(42),
      cancelAnimationFrame: vi.fn()
    };
    vi.stubGlobal('window', mockWindow);

    const onHudUpdate = vi.fn();
    const runner = mountDodgeRunner(mockCanvas, {
      skinId: 'bombom',
      feverText: 'FEVER!',
      onHudUpdate,
      onGameOver: vi.fn(),
      onSound: vi.fn(),
      isPaused: () => false
    });

    expect(onHudUpdate).toHaveBeenCalledTimes(1);
    expect(mockWindow.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
    expect(mockCanvas.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(mockCanvas.addEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(mockCanvas.addEventListener).toHaveBeenCalledWith('pointerleave', expect.any(Function));

    runner.destroy();

    expect(mockWindow.cancelAnimationFrame).toHaveBeenCalledWith(42);
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
    expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('pointerleave', expect.any(Function));

    vi.unstubAllGlobals();
  });

  it('respects isPaused and drives HUD updates via animation frames in mountDodgeRunner', () => {
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
      width: DODGE_WIDTH,
      height: DODGE_HEIGHT,
      getContext: vi.fn(() => mockContext),
      getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: DODGE_WIDTH, height: DODGE_HEIGHT })),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    let scheduledCallback = null;
    const mockWindow = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn((callback) => {
        scheduledCallback = callback;
        return 7;
      }),
      cancelAnimationFrame: vi.fn()
    };
    vi.stubGlobal('window', mockWindow);

    let paused = true;
    const onHudUpdate = vi.fn();
    const runner = mountDodgeRunner(mockCanvas, {
      skinId: 'rocket-cat',
      feverText: '피버 타임!',
      onHudUpdate,
      onGameOver: vi.fn(),
      onSound: vi.fn(),
      isPaused: () => paused
    });

    // 일시정지 중에는 초기 HUD 1회 외 추가 진행 미발생 검증
    scheduledCallback(100);
    expect(onHudUpdate).toHaveBeenCalledTimes(1);

    // 일시정지 해제 후 프레임 진행 시 HUD 갱신 검증
    paused = false;
    scheduledCallback(150);
    expect(onHudUpdate).toHaveBeenCalledTimes(2);
    expect(onHudUpdate).toHaveBeenLastCalledWith({
      score: 0,
      starsEarned: 0,
      combo: 0,
      shieldActive: false,
      magnetActive: false,
      feverActive: false
    });

    runner.destroy();
    vi.unstubAllGlobals();
  });
});
