// 하늘 타워 쌓기 코어 판정 로직 및 캔버스 물리 렌더링 엔진

import { drawSkinMascot, getSkinById } from './skins.js';

export const STACK_WIDTH = 368;
export const STACK_HEIGHT = 430;
export const INITIAL_BLOCK_WIDTH = 160;

const BLOCK_HEIGHT = 22;
const BASE_BLOCK_Y = 370;
const PERFECT_TOLERANCE = 4;
const MINIMUM_OVERLAP_WIDTH = 2;
const BONUS_COMBO_STEP = 5;
const BONUS_WIDTH_RESTORE = 16;
const SLICE_GRAVITY = 680;
const MAX_DELTA_SECONDS = 0.05;
const BASE_SPEED = 150;
const SPEED_STEP_PER_FLOOR = 4;
const MAX_SPEED = 340;
const MASCOT_RADIUS = 14;
const MOVING_BLOCK_HOVER_OFFSET = 34;

// 우주 스테이지 반짝임 재현을 위한 정적 배경 별 시드 배열
const SPACE_STARS = Array.from({ length: 30 }, (_, starIndex) => ({
  x: ((starIndex * 89 + 23) % (STACK_WIDTH - 16)) + 8,
  y: ((starIndex * 131 + 17) % (STACK_HEIGHT - 40)) + 12,
  radius: (starIndex % 3) * 0.55 + 0.9,
  phase: starIndex * 0.75
}));

// 구름 형태 배경 장식 배치를 위한 정적 시드 배열
const SKY_CLOUDS = [
  { x: 64, y: 84, scale: 1.0 },
  { x: 266, y: 126, scale: 0.85 },
  { x: 156, y: 196, scale: 0.72 }
];

// 구간 제한 클램프 보조 함수
function clampNumber(value, minimumValue, maximumValue) {
  return Math.max(minimumValue, Math.min(maximumValue, value));
}

// 현재 층수 구간에 따른 하늘·배경 테마 팔레트 반환 목적
export function getStageColors(floorCount) {
  if (floorCount < 10) {
    return {
      stage: 'meadow',
      skyTop: '#7EC8FF',
      skyBottom: '#DFF6E8',
      groundColor: '#7BE495',
      cloudAlpha: 0.78,
      starAlpha: 0
    };
  }
  if (floorCount < 20) {
    return {
      stage: 'sky',
      skyTop: '#4EA8DE',
      skyBottom: '#CBE9FF',
      groundColor: '#9BF6FF',
      cloudAlpha: 0.65,
      starAlpha: 0.15
    };
  }
  if (floorCount < 30) {
    return {
      stage: 'sunset',
      skyTop: '#6D597A',
      skyBottom: '#FFB5A7',
      groundColor: '#FF8FA3',
      cloudAlpha: 0.4,
      starAlpha: 0.45
    };
  }
  return {
    stage: 'space',
    skyTop: '#160F29',
    skyBottom: '#2B1B54',
    groundColor: '#4A3F6B',
    cloudAlpha: 0,
    starAlpha: 0.9
  };
}

// 직전 블록 대비 현재 블록의 정렬 오차·겹침 기반 배치 판정 목적
export function evaluatePlacement(previousBlock, currentBlock, perfectCombo = 0) {
  const alignmentDelta = currentBlock.x - previousBlock.x;
  const overlapLeft = Math.max(previousBlock.x, currentBlock.x);
  const overlapRight = Math.min(
    previousBlock.x + previousBlock.width,
    currentBlock.x + currentBlock.width
  );
  const overlapWidth = overlapRight - overlapLeft;

  // 허용 오차(4px) 이내 정밀 배치 시 스냅 고정 및 5연속 보너스 판정 목적
  if (Math.abs(alignmentDelta) <= PERFECT_TOLERANCE) {
    const nextPerfectCombo = perfectCombo + 1;
    const bonusTriggered = nextPerfectCombo > 0 && nextPerfectCombo % BONUS_COMBO_STEP === 0;
    const expandedWidth = bonusTriggered
      ? Math.min(INITIAL_BLOCK_WIDTH, previousBlock.width + BONUS_WIDTH_RESTORE)
      : previousBlock.width;
    const widthGain = expandedWidth - previousBlock.width;
    const centeredX = clampNumber(
      previousBlock.x - widthGain / 2,
      0,
      STACK_WIDTH - expandedWidth
    );

    return {
      status: 'perfect',
      placedBlock: {
        ...currentBlock,
        x: centeredX,
        width: expandedWidth
      },
      trimmedSlice: null,
      perfectCombo: nextPerfectCombo,
      bonusTriggered,
      starsEarned: 5
    };
  }

  // 유효 겹침 폭(2px 초과) 미달 시 블록 낙하 게임 오버 판정 목적
  if (overlapWidth <= MINIMUM_OVERLAP_WIDTH) {
    return {
      status: 'missed',
      placedBlock: null,
      trimmedSlice: {
        x: currentBlock.x,
        y: currentBlock.y,
        width: currentBlock.width,
        height: currentBlock.height,
        colorIndex: currentBlock.colorIndex,
        velocityX: alignmentDelta >= 0 ? 45 : -45,
        velocityY: 0,
        rotation: 0,
        rotationSpeed: alignmentDelta >= 0 ? 1.8 : -1.8
      },
      perfectCombo: 0,
      bonusTriggered: false,
      starsEarned: 0
    };
  }

  // 일반 배치 시 초과 돌출 구간을 잘라 낙하 조각으로 분리하는 목적
  const overhangsLeft = currentBlock.x < previousBlock.x;
  const sliceX = overhangsLeft ? currentBlock.x : overlapRight;
  const sliceWidth = overhangsLeft
    ? overlapLeft - currentBlock.x
    : currentBlock.x + currentBlock.width - overlapRight;

  return {
    status: 'placed',
    placedBlock: {
      ...currentBlock,
      x: overlapLeft,
      width: overlapWidth
    },
    trimmedSlice:
      sliceWidth > 0
        ? {
            x: sliceX,
            y: currentBlock.y,
            width: sliceWidth,
            height: currentBlock.height,
            colorIndex: currentBlock.colorIndex,
            velocityX: overhangsLeft ? -55 : 55,
            velocityY: 0,
            rotation: 0,
            rotationSpeed: overhangsLeft ? -2.2 : 2.2
          }
        : null,
    perfectCombo: 0,
    bonusTriggered: false,
    starsEarned: 2
  };
}

// 층수별 이동 블록 속도 및 시작 방향 계산 보조 함수
function createNextMovingBlock(nextFloor, blockWidth, blockY) {
  const speed = Math.min(MAX_SPEED, BASE_SPEED + nextFloor * SPEED_STEP_PER_FLOOR);
  const startsFromLeft = nextFloor % 2 === 0;
  return {
    x: startsFromLeft ? 0 : STACK_WIDTH - blockWidth,
    y: blockY,
    width: blockWidth,
    height: BLOCK_HEIGHT,
    velocityX: startsFromLeft ? speed : -speed,
    colorIndex: nextFloor
  };
}

// 하늘 타워 쌓기 한 판의 초기 상태 생성 목적
export function createInitialStackState() {
  const baseBlock = {
    x: (STACK_WIDTH - INITIAL_BLOCK_WIDTH) / 2,
    y: BASE_BLOCK_Y,
    width: INITIAL_BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    colorIndex: 0
  };

  return {
    floor: 0,
    score: 0,
    starsEarned: 0,
    perfectCombo: 0,
    cameraY: 0,
    targetCameraY: 0,
    elapsedSeconds: 0,
    blocks: [baseBlock],
    movingBlock: createNextMovingBlock(0, INITIAL_BLOCK_WIDTH, BASE_BLOCK_Y - BLOCK_HEIGHT),
    fallingSlices: [],
    floatingPopups: [],
    particles: [],
    gameOver: false,
    events: []
  };
}

// 정밀 배치 시 축하 반짝임 파티클 생성 목적
function createPerfectParticles(originX, originY, bonusTriggered) {
  const particleCount = bonusTriggered ? 14 : 8;
  const colors = ['#FFE066', '#FF7AA2', '#72EFDD', '#FFFFFF'];
  const createdParticles = [];
  for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
    const angle = (Math.PI * 2 * particleIndex) / particleCount;
    const speed = 55 + (particleIndex % 3) * 32;
    createdParticles.push({
      x: originX,
      y: originY,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed - 30,
      life: 0.45,
      maxLife: 0.45,
      radius: bonusTriggered ? 3.2 : 2.4,
      color: colors[particleIndex % colors.length]
    });
  }
  return createdParticles;
}

// 현재 왕복 중인 블록을 탑 위에 내려놓고 다음 층 상태로 전이하는 목적
export function placeCurrentBlock(
  previousState,
  perfectText = 'PERFECT!',
  bonusText = 'BONUS!'
) {
  if (previousState.gameOver || !previousState.movingBlock) {
    return previousState;
  }

  const topBlock = previousState.blocks[previousState.blocks.length - 1];
  const evaluation = evaluatePlacement(
    topBlock,
    previousState.movingBlock,
    previousState.perfectCombo
  );

  const nextFallingSlices = evaluation.trimmedSlice
    ? [...previousState.fallingSlices, evaluation.trimmedSlice]
    : previousState.fallingSlices;

  if (evaluation.status === 'missed') {
    return {
      ...previousState,
      perfectCombo: 0,
      movingBlock: null,
      fallingSlices: nextFallingSlices,
      gameOver: true,
      events: ['gameover']
    };
  }

  const nextFloor = previousState.floor + 1;
  const placedBlock = {
    ...evaluation.placedBlock,
    y: topBlock.y - BLOCK_HEIGHT
  };
  const nextBlocks = [...previousState.blocks, placedBlock];
  const scoreGain =
    evaluation.status === 'perfect' ? 20 + evaluation.perfectCombo * 5 : 10;
  const nextTargetCameraY = nextFloor >= 6 ? (nextFloor - 5) * BLOCK_HEIGHT : 0;
  const nextMovingBlock = createNextMovingBlock(
    nextFloor,
    placedBlock.width,
    placedBlock.y - BLOCK_HEIGHT
  );

  const nextPopups = [...previousState.floatingPopups];
  const nextParticles = [...previousState.particles];
  const nextEvents = [];

  if (evaluation.status === 'perfect') {
    nextEvents.push('perfect');
    nextPopups.push({
      text: perfectText || 'PERFECT!',
      x: placedBlock.x + placedBlock.width / 2,
      y: placedBlock.y - 24,
      life: 0.85,
      maxLife: 0.85,
      color: '#FFE066'
    });
    nextParticles.push(
      ...createPerfectParticles(
        placedBlock.x + placedBlock.width / 2,
        placedBlock.y,
        evaluation.bonusTriggered
      )
    );
    if (evaluation.bonusTriggered) {
      nextEvents.push('powerup');
      nextPopups.push({
        text: bonusText || 'BONUS!',
        x: STACK_WIDTH / 2,
        y: placedBlock.y - 46,
        life: 1.15,
        maxLife: 1.15,
        color: '#72EFDD'
      });
    }
  } else {
    nextEvents.push('place');
  }

  return {
    ...previousState,
    floor: nextFloor,
    score: previousState.score + scoreGain,
    starsEarned: previousState.starsEarned + evaluation.starsEarned,
    perfectCombo: evaluation.perfectCombo,
    targetCameraY: nextTargetCameraY,
    blocks: nextBlocks,
    movingBlock: nextMovingBlock,
    fallingSlices: nextFallingSlices,
    floatingPopups: nextPopups,
    particles: nextParticles,
    events: nextEvents
  };
}

// 한 프레임 동안 이동 블록·카메라·낙하 조각·팝업 물리 갱신 목적
export function stepStackFrame(previousState, rawDeltaSeconds) {
  const safeDelta = Number.isFinite(rawDeltaSeconds) ? rawDeltaSeconds : 0;
  const deltaSeconds = clampNumber(safeDelta, 0, MAX_DELTA_SECONDS);

  let nextMovingBlock = previousState.movingBlock;
  if (!previousState.gameOver && previousState.movingBlock) {
    const movingBlock = previousState.movingBlock;
    const maximumX = STACK_WIDTH - movingBlock.width;
    let nextX = movingBlock.x + movingBlock.velocityX * deltaSeconds;
    let nextVelocityX = movingBlock.velocityX;

    if (nextX <= 0) {
      nextX = 0;
      nextVelocityX = Math.abs(movingBlock.velocityX);
    } else if (nextX >= maximumX) {
      nextX = maximumX;
      nextVelocityX = -Math.abs(movingBlock.velocityX);
    }

    nextMovingBlock = {
      ...movingBlock,
      x: nextX,
      velocityX: nextVelocityX
    };
  }

  // 카메라 목표 오프셋을 향한 부드러운 보간 이동 목적
  const interpolationFactor = Math.min(1, deltaSeconds * 8);
  const nextCameraY =
    previousState.cameraY +
    (previousState.targetCameraY - previousState.cameraY) * interpolationFactor;

  // 잘린 초과 블록 조각에 중력(680 px/s^2) 적용 및 화면 이탈 정리 목적
  const nextFallingSlices = [];
  for (let sliceIndex = 0; sliceIndex < previousState.fallingSlices.length; sliceIndex += 1) {
    const slice = previousState.fallingSlices[sliceIndex];
    const nextVelocityY = slice.velocityY + SLICE_GRAVITY * deltaSeconds;
    const nextX = slice.x + slice.velocityX * deltaSeconds;
    const nextY = slice.y + nextVelocityY * deltaSeconds;
    const nextRotation = slice.rotation + slice.rotationSpeed * deltaSeconds;
    if (nextY + nextCameraY < STACK_HEIGHT + 80) {
      nextFallingSlices.push({
        ...slice,
        x: nextX,
        y: nextY,
        velocityY: nextVelocityY,
        rotation: nextRotation
      });
    }
  }

  const nextPopups = [];
  for (let popupIndex = 0; popupIndex < previousState.floatingPopups.length; popupIndex += 1) {
    const popup = previousState.floatingPopups[popupIndex];
    const nextLife = popup.life - deltaSeconds;
    if (nextLife > 0) {
      nextPopups.push({
        ...popup,
        y: popup.y - 26 * deltaSeconds,
        life: nextLife
      });
    }
  }

  const nextParticles = [];
  for (
    let particleIndex = 0;
    particleIndex < previousState.particles.length;
    particleIndex += 1
  ) {
    const particle = previousState.particles[particleIndex];
    const nextLife = particle.life - deltaSeconds;
    if (nextLife > 0) {
      nextParticles.push({
        ...particle,
        x: particle.x + particle.velocityX * deltaSeconds,
        y: particle.y + particle.velocityY * deltaSeconds,
        life: nextLife
      });
    }
  }

  return {
    ...previousState,
    elapsedSeconds: previousState.elapsedSeconds + deltaSeconds,
    cameraY: nextCameraY,
    movingBlock: nextMovingBlock,
    fallingSlices: nextFallingSlices,
    floatingPopups: nextPopups,
    particles: nextParticles,
    events: []
  };
}

// roundRect 미지원 캔버스 환경 호환용 둥근 모서리 블록 경로 생성 목적
function traceRoundedBlockPath(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(x, y, width, height, safeRadius);
    return;
  }
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

// 상단 광택 하이라이트를 포함한 블록 렌더링 목적
function drawStyledBlock(context, x, y, width, height, fillColor) {
  context.save();
  traceRoundedBlockPath(context, x, y, width, height, 6);
  context.fillStyle = fillColor;
  context.fill();

  context.lineWidth = 1.5;
  context.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  context.stroke();

  // 블록 상단 입체감을 주는 얇은 흰색 광택 바 렌더링 목적
  if (width > 12) {
    traceRoundedBlockPath(context, x + 3, y + 2, width - 6, 4, 2);
    context.fillStyle = 'rgba(255, 255, 255, 0.35)';
    context.fill();
  }
  context.restore();
}

// 구름 실루엣 렌더링 보조 함수
function drawCloud(context, centerX, centerY, scale, alpha) {
  if (alpha <= 0) {
    return;
  }
  context.save();
  context.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  context.beginPath();
  context.arc(centerX, centerY, 16 * scale, 0, Math.PI * 2);
  context.arc(centerX - 14 * scale, centerY + 4 * scale, 12 * scale, 0, Math.PI * 2);
  context.arc(centerX + 15 * scale, centerY + 4 * scale, 12 * scale, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

// 현재 타워 쌓기 상태 전체를 368x430 논리 캔버스에 그리는 함수
function renderStackScene(context, state, skinId) {
  const activeSkin = getSkinById(skinId);
  const stageColors = getStageColors(state.floor);

  const backgroundGradient = context.createLinearGradient(0, 0, 0, STACK_HEIGHT);
  backgroundGradient.addColorStop(0, stageColors.skyTop);
  backgroundGradient.addColorStop(1, stageColors.skyBottom);
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, STACK_WIDTH, STACK_HEIGHT);

  // 고층 스테이지 전환 시 배경 별 반짝임 렌더링 목적
  if (stageColors.starAlpha > 0) {
    for (let starIndex = 0; starIndex < SPACE_STARS.length; starIndex += 1) {
      const star = SPACE_STARS[starIndex];
      const twinkle = 0.55 + 0.45 * Math.sin(state.elapsedSeconds * 3 + star.phase);
      const alpha = stageColors.starAlpha * twinkle;
      context.fillStyle = `rgba(255, 250, 220, ${alpha.toFixed(2)})`;
      context.beginPath();
      context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      context.fill();
    }
  }

  for (let cloudIndex = 0; cloudIndex < SKY_CLOUDS.length; cloudIndex += 1) {
    const cloud = SKY_CLOUDS[cloudIndex];
    const cloudY = (cloud.y + state.cameraY * 0.25) % (STACK_HEIGHT + 40);
    drawCloud(context, cloud.x, cloudY, cloud.scale, stageColors.cloudAlpha);
  }

  // 초반 초원 바닥 언덕 렌더링 목적
  const groundTopY = BASE_BLOCK_Y + BLOCK_HEIGHT + state.cameraY;
  if (groundTopY < STACK_HEIGHT + 20) {
    context.fillStyle = stageColors.groundColor;
    context.fillRect(0, groundTopY, STACK_WIDTH, STACK_HEIGHT - groundTopY + 20);
  }

  // 누적된 타워 블록 렌더링 목적
  const palette = activeSkin.blockPalette;
  for (let blockIndex = 0; blockIndex < state.blocks.length; blockIndex += 1) {
    const block = state.blocks[blockIndex];
    const screenY = block.y + state.cameraY;
    if (screenY > STACK_HEIGHT + 30 || screenY + block.height < -30) {
      continue;
    }
    const blockColor = palette[block.colorIndex % palette.length];
    drawStyledBlock(context, block.x, screenY, block.width, block.height, blockColor);
  }

  // 잘려 떨어진 블록 조각 회전 낙하 렌더링 목적
  for (let sliceIndex = 0; sliceIndex < state.fallingSlices.length; sliceIndex += 1) {
    const slice = state.fallingSlices[sliceIndex];
    const screenY = slice.y + state.cameraY;
    const sliceColor = palette[slice.colorIndex % palette.length];
    context.save();
    context.translate(slice.x + slice.width / 2, screenY + slice.height / 2);
    context.rotate(slice.rotation);
    drawStyledBlock(
      context,
      -slice.width / 2,
      -slice.height / 2,
      slice.width,
      slice.height,
      sliceColor
    );
    context.restore();
  }

  // 최상단 블록 위에 마스코트 착석 렌더링 목적
  const topBlock = state.blocks[state.blocks.length - 1];
  drawSkinMascot(
    context,
    skinId,
    topBlock.x + topBlock.width / 2,
    topBlock.y + state.cameraY - MASCOT_RADIUS,
    MASCOT_RADIUS,
    state.elapsedSeconds
  );

  // 마스코트 시야를 가리지 않도록 상단 대기 위치에 왕복 블록 렌더링 목적
  if (!state.gameOver && state.movingBlock) {
    const movingBlock = state.movingBlock;
    const movingScreenY = movingBlock.y + state.cameraY - MOVING_BLOCK_HOVER_OFFSET;
    const movingColor = palette[movingBlock.colorIndex % palette.length];

    context.save();
    context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    context.lineWidth = 1.5;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.moveTo(movingBlock.x + movingBlock.width / 2, movingScreenY + movingBlock.height);
    context.lineTo(movingBlock.x + movingBlock.width / 2, topBlock.y + state.cameraY);
    context.stroke();
    context.setLineDash([]);
    context.restore();

    drawStyledBlock(
      context,
      movingBlock.x,
      movingScreenY,
      movingBlock.width,
      movingBlock.height,
      movingColor
    );
  }

  for (
    let particleIndex = 0;
    particleIndex < state.particles.length;
    particleIndex += 1
  ) {
    const particle = state.particles[particleIndex];
    context.save();
    context.globalAlpha = clampNumber(particle.life / particle.maxLife, 0, 1);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y + state.cameraY, particle.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  for (let popupIndex = 0; popupIndex < state.floatingPopups.length; popupIndex += 1) {
    const popup = state.floatingPopups[popupIndex];
    context.save();
    context.globalAlpha = clampNumber(popup.life / popup.maxLife, 0, 1);
    context.font = 'bold 16px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.lineWidth = 3;
    context.strokeStyle = 'rgba(27, 20, 56, 0.75)';
    if (typeof context.strokeText === 'function') {
      context.strokeText(popup.text, popup.x, popup.y + state.cameraY);
    }
    context.fillStyle = popup.color;
    context.fillText(popup.text, popup.x, popup.y + state.cameraY);
    context.restore();
  }
}

// 캔버스에 하늘 타워 쌓기 루프와 입력 리스너를 마운트하고 정리 핸들을 반환
export function mountTowerStack(canvas, options = {}) {
  const {
    skinId = 'bombom',
    perfectText = 'PERFECT!',
    bonusText = 'BONUS!',
    onHudUpdate,
    onGameOver,
    onSound,
    isPaused
  } = options;

  const hostWindow = typeof window !== 'undefined' ? window : globalThis;
  const context = canvas.getContext('2d');
  let state = createInitialStackState();
  let destroyed = false;
  let gameOverNotified = false;
  let animationFrameId = 0;
  let lastTimestamp = null;

  function checkPaused() {
    return typeof isPaused === 'function' ? isPaused() : Boolean(isPaused);
  }

  function emitHud() {
    if (typeof onHudUpdate === 'function') {
      onHudUpdate({
        score: state.score,
        floor: state.floor,
        starsEarned: state.starsEarned,
        combo: state.perfectCombo
      });
    }
  }

  function handleDropAction() {
    if (destroyed || state.gameOver || checkPaused()) {
      return;
    }

    state = placeCurrentBlock(state, perfectText, bonusText);

    if (typeof onSound === 'function') {
      for (let eventIndex = 0; eventIndex < state.events.length; eventIndex += 1) {
        onSound(state.events[eventIndex]);
      }
    }

    emitHud();

    if (context) {
      renderStackScene(context, state, skinId);
    }

    if (state.gameOver && !gameOverNotified) {
      gameOverNotified = true;
      if (typeof onGameOver === 'function') {
        onGameOver({
          score: state.score,
          starsEarned: state.starsEarned,
          floor: state.floor
        });
      }
    }
  }

  function handleKeyDown(event) {
    if (destroyed || state.gameOver || checkPaused()) {
      return;
    }
    if (event.code === 'Space' || event.key === ' ' || event.key === 'Enter') {
      if (event.repeat) {
        return;
      }
      if (typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
      handleDropAction();
    }
  }

  function handlePointerDown() {
    handleDropAction();
  }

  function frame(timestamp) {
    if (destroyed) {
      return;
    }

    const rawDeltaSeconds = lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    if (!checkPaused() && !state.gameOver) {
      state = stepStackFrame(state, rawDeltaSeconds);
    }

    if (context) {
      renderStackScene(context, state, skinId);
    }

    if (!destroyed && !state.gameOver) {
      animationFrameId = hostWindow.requestAnimationFrame(frame);
    }
  }

  hostWindow.addEventListener('keydown', handleKeyDown);
  canvas.addEventListener('pointerdown', handlePointerDown);

  emitHud();
  if (context) {
    renderStackScene(context, state, skinId);
  }
  animationFrameId = hostWindow.requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      hostWindow.cancelAnimationFrame(animationFrameId);
      hostWindow.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('pointerdown', handlePointerDown);
    }
  };
}
