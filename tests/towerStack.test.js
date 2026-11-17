import { describe, expect, it, vi } from 'vitest';
import {
  INITIAL_BLOCK_WIDTH,
  STACK_HEIGHT,
  STACK_WIDTH,
  createInitialStackState,
  evaluatePlacement,
  getStageColors,
  mountTowerStack,
  placeCurrentBlock,
  stepStackFrame
} from '../src/games/towerStack.js';

// 캔버스 목업 생성 보조 함수
function createMockCanvasContext(options = {}) {
  const { includeRoundRect = true } = options;
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
  };
  if (includeRoundRect) {
    context.roundRect = vi.fn();
  }
  return context;
}

describe('towerStack core logic', () => {
  it('exposes expected canvas constants', () => {
    expect(STACK_WIDTH).toBe(368);
    expect(STACK_HEIGHT).toBe(430);
    expect(INITIAL_BLOCK_WIDTH).toBe(160);
  });

  it('returns meadow, sky, sunset, and space stage palettes by floorCount', () => {
    expect(getStageColors(0).stage).toBe('meadow');
    expect(getStageColors(9).stage).toBe('meadow');
    expect(getStageColors(10).stage).toBe('sky');
    expect(getStageColors(19).stage).toBe('sky');
    expect(getStageColors(20).stage).toBe('sunset');
    expect(getStageColors(29).stage).toBe('sunset');
    expect(getStageColors(30).stage).toBe('space');
    expect(getStageColors(65).stage).toBe('space');
  });

  it('evaluates PERFECT placement when |delta| <= 4', () => {
    const previousBlock = { x: 104, y: 370, width: 140, height: 22, colorIndex: 0 };
    const currentBlock = { x: 108, y: 348, width: 140, height: 22, colorIndex: 1 };

    const result = evaluatePlacement(previousBlock, currentBlock, 2);
    expect(result.status).toBe('perfect');
    expect(result.placedBlock.x).toBe(104);
    expect(result.placedBlock.width).toBe(140);
    expect(result.trimmedSlice).toBeNull();
    expect(result.perfectCombo).toBe(3);
    expect(result.bonusTriggered).toBe(false);
    expect(result.starsEarned).toBe(5);

    const negativeDeltaResult = evaluatePlacement(
      previousBlock,
      { ...currentBlock, x: 100 },
      0
    );
    expect(negativeDeltaResult.status).toBe('perfect');
    expect(negativeDeltaResult.placedBlock.x).toBe(104);
    expect(negativeDeltaResult.perfectCombo).toBe(1);
  });

  it('triggers 5th consecutive PERFECT bonus and restores +16px capped at INITIAL_BLOCK_WIDTH', () => {
    const narrowPrevious = { x: 134, y: 282, width: 100, height: 22, colorIndex: 3 };
    const narrowCurrent = { x: 136, y: 260, width: 100, height: 22, colorIndex: 4 };

    const expandedResult = evaluatePlacement(narrowPrevious, narrowCurrent, 4);
    expect(expandedResult.status).toBe('perfect');
    expect(expandedResult.perfectCombo).toBe(5);
    expect(expandedResult.bonusTriggered).toBe(true);
    expect(expandedResult.placedBlock.width).toBe(116);
    expect(expandedResult.starsEarned).toBe(5);

    // 최대 너비 160px 상한 제한 검증
    const widePrevious = { x: 108, y: 260, width: 152, height: 22, colorIndex: 4 };
    const wideCurrent = { x: 107, y: 238, width: 152, height: 22, colorIndex: 5 };
    const cappedResult = evaluatePlacement(widePrevious, wideCurrent, 4);
    expect(cappedResult.bonusTriggered).toBe(true);
    expect(cappedResult.placedBlock.width).toBe(INITIAL_BLOCK_WIDTH);
  });

  it('evaluates normal placement by trimming overhanging slice and resetting perfectCombo', () => {
    const previousBlock = { x: 104, y: 370, width: 160, height: 22, colorIndex: 0 };

    // 우측 돌출 배치 검증
    const rightCurrent = { x: 124, y: 348, width: 160, height: 22, colorIndex: 1 };
    const rightResult = evaluatePlacement(previousBlock, rightCurrent, 3);
    expect(rightResult.status).toBe('placed');
    expect(rightResult.placedBlock.x).toBe(124);
    expect(rightResult.placedBlock.width).toBe(140);
    expect(rightResult.trimmedSlice).not.toBeNull();
    expect(rightResult.trimmedSlice.x).toBe(264);
    expect(rightResult.trimmedSlice.width).toBe(20);
    expect(rightResult.perfectCombo).toBe(0);
    expect(rightResult.bonusTriggered).toBe(false);
    expect(rightResult.starsEarned).toBe(2);

    // 좌측 돌출 배치 검증
    const leftCurrent = { x: 84, y: 348, width: 160, height: 22, colorIndex: 1 };
    const leftResult = evaluatePlacement(previousBlock, leftCurrent, 4);
    expect(leftResult.status).toBe('placed');
    expect(leftResult.placedBlock.x).toBe(104);
    expect(leftResult.placedBlock.width).toBe(140);
    expect(leftResult.trimmedSlice).not.toBeNull();
    expect(leftResult.trimmedSlice.x).toBe(84);
    expect(leftResult.trimmedSlice.width).toBe(20);
    expect(leftResult.perfectCombo).toBe(0);
    expect(leftResult.starsEarned).toBe(2);
  });

  it('evaluates missed placement when overlapWidth <= 2', () => {
    const previousBlock = { x: 104, y: 370, width: 160, height: 22, colorIndex: 0 };

    // 겹침 너비 정확히 2px 이하인 경우 미스 판정 검증
    const edgeMissBlock = { x: 262, y: 348, width: 160, height: 22, colorIndex: 1 };
    const edgeResult = evaluatePlacement(previousBlock, edgeMissBlock, 2);
    expect(edgeResult.status).toBe('missed');
    expect(edgeResult.placedBlock).toBeNull();
    expect(edgeResult.perfectCombo).toBe(0);
    expect(edgeResult.starsEarned).toBe(0);

    // 완전 이탈 미스 판정 검증
    const farMissBlock = { x: 300, y: 348, width: 160, height: 22, colorIndex: 1 };
    const farResult = evaluatePlacement(previousBlock, farMissBlock, 2);
    expect(farResult.status).toBe('missed');
  });

  it('updates floor, movingBlock side/speed, targetCameraY, and gameOver in placeCurrentBlock', () => {
    let state = createInitialStackState();
    expect(state.floor).toBe(0);
    expect(state.blocks).toHaveLength(1);
    expect(state.blocks[0].width).toBe(INITIAL_BLOCK_WIDTH);
    expect(state.movingBlock.velocityX).toBe(150);

    // 1층~6층까지 정확히 정렬 배치 시 속도·방향 교차 및 6층 카메라 목표 Y 검증
    for (let stepIndex = 1; stepIndex <= 6; stepIndex += 1) {
      const topBlock = state.blocks[state.blocks.length - 1];
      state = {
        ...state,
        movingBlock: {
          ...state.movingBlock,
          x: topBlock.x
        }
      };
      state = placeCurrentBlock(state, 'PERFECT!', 'BONUS!');
      expect(state.floor).toBe(stepIndex);
      expect(state.blocks).toHaveLength(stepIndex + 1);

      const expectedSpeed = Math.min(340, 150 + stepIndex * 4);
      if (stepIndex % 2 === 1) {
        expect(state.movingBlock.x).toBe(STACK_WIDTH - state.movingBlock.width);
        expect(state.movingBlock.velocityX).toBe(-expectedSpeed);
      } else {
        expect(state.movingBlock.x).toBe(0);
        expect(state.movingBlock.velocityX).toBe(expectedSpeed);
      }

      if (stepIndex < 6) {
        expect(state.targetCameraY).toBe(0);
      } else {
        expect(state.targetCameraY).toBe((6 - 5) * 22);
      }
    }

    // 최고 층수에서 속도 상한 340 제한 검증
    const highFloorState = {
      ...state,
      floor: 59
    };
    const topAtHigh = highFloorState.blocks[highFloorState.blocks.length - 1];
    const nextHighState = placeCurrentBlock(
      {
        ...highFloorState,
        movingBlock: { ...highFloorState.movingBlock, x: topAtHigh.x }
      },
      'PERFECT!',
      'BONUS!'
    );
    expect(Math.abs(nextHighState.movingBlock.velocityX)).toBe(340);

    // 미스 발생 시 게임 오버 전환 및 종료 사운드 이벤트 기록 검증
    const missedState = placeCurrentBlock(
      {
        ...nextHighState,
        movingBlock: { ...nextHighState.movingBlock, x: 360 }
      },
      'PERFECT!',
      'BONUS!'
    );
    expect(missedState.gameOver).toBe(true);
    expect(missedState.events).toContain('gameover');
  });

  it('steps movingBlock bounce, smooth camera interpolation, and falling slice gravity (680 px/s^2)', () => {
    let state = createInitialStackState();
    state = {
      ...state,
      targetCameraY: 44,
      fallingSlices: [
        {
          x: 264,
          y: 348,
          width: 20,
          height: 22,
          colorIndex: 1,
          velocityX: 50,
          velocityY: 0,
          rotation: 0,
          rotationSpeed: 1
        }
      ],
      movingBlock: {
        ...state.movingBlock,
        x: STACK_WIDTH - state.movingBlock.width - 2,
        velocityX: 200
      }
    };

    // 우측 벽 반사 및 델타 클램프(0.05s) + 중력 가속도 검증
    state = stepStackFrame(state, 1.0);
    expect(state.elapsedSeconds).toBeCloseTo(0.05, 6);
    expect(state.movingBlock.x).toBe(STACK_WIDTH - state.movingBlock.width);
    expect(state.movingBlock.velocityX).toBe(-200);
    expect(state.cameraY).toBeGreaterThan(0);
    expect(state.cameraY).toBeLessThan(44);
    expect(state.fallingSlices[0].velocityY).toBeCloseTo(680 * 0.05, 6);
    expect(state.fallingSlices[0].y).toBeCloseTo(348 + 680 * 0.05 * 0.05, 6);
  });
});

describe('mountTowerStack canvas engine', () => {
  it('mounts listeners, supports Space/Enter/pointerdown, handles missing roundRect fallback, and cleans up on destroy', () => {
    const mockContext = createMockCanvasContext({ includeRoundRect: false });
    const canvasListeners = {};
    const mockCanvas = {
      width: STACK_WIDTH,
      height: STACK_HEIGHT,
      getContext: vi.fn(() => mockContext),
      addEventListener: vi.fn((eventName, handler) => {
        canvasListeners[eventName] = handler;
      }),
      removeEventListener: vi.fn()
    };

    const windowListeners = {};
    const mockWindow = {
      addEventListener: vi.fn((eventName, handler) => {
        windowListeners[eventName] = handler;
      }),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn().mockReturnValue(99),
      cancelAnimationFrame: vi.fn()
    };
    vi.stubGlobal('window', mockWindow);

    const onHudUpdate = vi.fn();
    const onGameOver = vi.fn();
    const onSound = vi.fn();
    let paused = false;

    const controller = mountTowerStack(mockCanvas, {
      skinId: 'bombom',
      perfectText: 'PERFECT!',
      bonusText: 'BONUS!',
      onHudUpdate,
      onGameOver,
      onSound,
      isPaused: () => paused
    });

    expect(onHudUpdate).toHaveBeenCalledTimes(1);
    expect(mockContext.quadraticCurveTo).toHaveBeenCalled();

    // 반복 키 입력(event.repeat === true) 무시 검증
    const repeatPreventDefault = vi.fn();
    windowListeners.keydown({
      code: 'Space',
      key: ' ',
      repeat: true,
      preventDefault: repeatPreventDefault
    });
    expect(repeatPreventDefault).not.toHaveBeenCalled();
    expect(onHudUpdate).toHaveBeenCalledTimes(1);

    // 정상 Space 입력 시 preventDefault 호출 및 1층 일반 배치(폭 56px) 검증
    const spacePreventDefault = vi.fn();
    windowListeners.keydown({
      code: 'Space',
      key: ' ',
      repeat: false,
      preventDefault: spacePreventDefault
    });
    expect(spacePreventDefault).toHaveBeenCalledTimes(1);
    expect(onHudUpdate).toHaveBeenCalledTimes(2);
    expect(onSound).toHaveBeenCalledWith('place');
    expect(onGameOver).not.toHaveBeenCalled();

    // 2층 블록이 우측 끝(312..368)에서 시작할 때 pointerdown 즉시 입력 시 미스 및 게임 오버 검증
    canvasListeners.pointerdown({});
    expect(onHudUpdate).toHaveBeenCalledTimes(3);
    expect(onSound).toHaveBeenCalledWith('gameover');
    expect(onGameOver).toHaveBeenCalledTimes(1);

    // 게임 오버 이후 추가 입력 무시 검증
    canvasListeners.pointerdown({});
    expect(onHudUpdate).toHaveBeenCalledTimes(3);

    controller.destroy();
    expect(mockWindow.cancelAnimationFrame).toHaveBeenCalledWith(99);
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(mockCanvas.removeEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function));

    vi.unstubAllGlobals();
  });

  it('respects isPaused for Enter/pointerdown and updates mascot/HUD on frame', () => {
    const mockContext = createMockCanvasContext({ includeRoundRect: true });
    const canvasListeners = {};
    const mockCanvas = {
      width: STACK_WIDTH,
      height: STACK_HEIGHT,
      getContext: vi.fn(() => mockContext),
      addEventListener: vi.fn((eventName, handler) => {
        canvasListeners[eventName] = handler;
      }),
      removeEventListener: vi.fn()
    };

    const windowListeners = {};
    let scheduledFrame = null;
    const mockWindow = {
      addEventListener: vi.fn((eventName, handler) => {
        windowListeners[eventName] = handler;
      }),
      removeEventListener: vi.fn(),
      requestAnimationFrame: vi.fn((callback) => {
        scheduledFrame = callback;
        return 12;
      }),
      cancelAnimationFrame: vi.fn()
    };
    vi.stubGlobal('window', mockWindow);

    let paused = true;
    const onHudUpdate = vi.fn();
    const onSound = vi.fn();

    const controller = mountTowerStack(mockCanvas, {
      skinId: 'strawberry-slime',
      perfectText: 'PERFECT!',
      bonusText: 'BONUS!',
      onHudUpdate,
      onGameOver: vi.fn(),
      onSound,
      isPaused: () => paused
    });

    // 일시정지 중에는 Enter 및 pointerdown 무시 검증
    const pausedEnterPrevent = vi.fn();
    windowListeners.keydown({
      code: 'Enter',
      key: 'Enter',
      repeat: false,
      preventDefault: pausedEnterPrevent
    });
    canvasListeners.pointerdown({});
    expect(pausedEnterPrevent).not.toHaveBeenCalled();
    expect(onSound).not.toHaveBeenCalled();

    // 일시정지 해제 후 프레임 진행 및 중앙 정렬 타이밍에 Enter 배치 성공 검증
    paused = false;
    scheduledFrame(100);
    // 104 / 150 = 0.6933초 도달을 위해 0.05초 단위로 전진
    let currentTimestamp = 100;
    for (let frameIndex = 0; frameIndex < 14; frameIndex += 1) {
      currentTimestamp += 50;
      scheduledFrame(currentTimestamp);
    }

    const activeEnterPrevent = vi.fn();
    windowListeners.keydown({
      code: 'Enter',
      key: 'Enter',
      repeat: false,
      preventDefault: activeEnterPrevent
    });
    expect(activeEnterPrevent).toHaveBeenCalledTimes(1);
    expect(onSound).toHaveBeenCalledWith('perfect');
    expect(onHudUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        floor: 1,
        starsEarned: 5,
        combo: 1
      })
    );

    controller.destroy();
    vi.unstubAllGlobals();
  });
});
