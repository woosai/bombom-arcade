// 별빛 톡톡 합체(수박게임 스타일 머지 퍼즐) 2D 물리 엔진 및 캔버스 렌더러 모듈

import { drawSkinMascot, getSkinById } from './skins.js';

export const MERGE_WIDTH = 368;
export const MERGE_HEIGHT = 430;
export const WALL_LEFT = 20;
export const WALL_RIGHT = 348;
export const FLOOR_Y = 412;
export const DANGER_LINE_Y = 98;
export const DROP_PREVIEW_Y = 60;

const DROP_COOLDOWN_SECONDS = 0.42;
const COMBO_WINDOW_SECONDS = 1.6;
const OVERFLOW_GRACE_SECONDS = 1.8;
const GRAVITY = 960;
const WALL_BOUNCE = 0.2;
const FLOOR_BOUNCE = 0.18;
const ORB_BOUNCE = 0.16;
const SUBSTEPS = 5;
const MAX_DELTA_SECONDS = 0.05;
const AIM_MOVE_SPEED = 290;
const SPAWN_POOL_MAX_TIER = 4;
const UNICORN_BONUS_SCORE = 100;
const UNICORN_BONUS_STARS = 20;

export const MERGE_TIERS = [
  { tier: 0, skinId: null, badge: '✨', radius: 14, score: 1, stars: 1, primary: '#FFE066', secondary: '#FFF7AE' },
  { tier: 1, skinId: null, badge: '🫧', radius: 19, score: 3, stars: 1, primary: '#72EFDD', secondary: '#E0FBF7' },
  { tier: 2, skinId: 'strawberry-slime', badge: '🍓', radius: 25, score: 6, stars: 2, primary: '#FF5D8F', secondary: '#FFACC5' },
  { tier: 3, skinId: 'ribbon-bunny', badge: '🐰', radius: 32, score: 10, stars: 3, primary: '#B388EB', secondary: '#FF99C8' },
  { tier: 4, skinId: 'rocket-cat', badge: '🐱', radius: 40, score: 15, stars: 4, primary: '#4CC9F0', secondary: '#F72585' },
  { tier: 5, skinId: 'rainbow-cloud', badge: '🌈', radius: 49, score: 21, stars: 6, primary: '#72EFDD', secondary: '#FFD166' },
  { tier: 6, skinId: 'bombom', badge: '⭐', radius: 59, score: 28, stars: 8, primary: '#FF7AA2', secondary: '#FFE066' },
  { tier: 7, skinId: 'gold-unicorn', badge: '🦄', radius: 70, score: 40, stars: 12, primary: '#FFD166', secondary: '#FF70A6' }
];

function clampNumber(value, minimumValue, maximumValue) {
  return Math.max(minimumValue, Math.min(maximumValue, value));
}

function pickSpawnTier(randomFunction = Math.random) {
  return Math.min(
    SPAWN_POOL_MAX_TIER - 1,
    Math.floor(Math.max(0, Math.min(0.9999, randomFunction())) * SPAWN_POOL_MAX_TIER)
  );
}

function clampOrbXForTier(rawX, tier) {
  const radius = MERGE_TIERS[tier]?.radius || MERGE_TIERS[0].radius;
  return clampNumber(rawX, WALL_LEFT + radius + 1, WALL_RIGHT - radius - 1);
}

function createMergeParticles(originX, originY, colors, particleCount, randomFunction) {
  const particles = [];
  for (let index = 0; index < particleCount; index += 1) {
    const angle = (Math.PI * 2 * index) / particleCount + randomFunction() * 0.35;
    const speed = 60 + randomFunction() * 120;
    const maxLife = 0.34 + randomFunction() * 0.24;
    particles.push({
      x: originX,
      y: originY,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      life: maxLife,
      maxLife,
      color: colors[index % colors.length],
      radius: 2.5 + randomFunction() * 2.5
    });
  }
  return particles;
}

export function createInitialMergeState(randomFunction = Math.random) {
  const currentTier = pickSpawnTier(randomFunction);
  const nextTier = pickSpawnTier(randomFunction);
  return {
    aimX: MERGE_WIDTH / 2,
    currentTier,
    nextTier,
    nextOrbId: 1,
    dropCooldown: 0,
    score: 0,
    starsEarned: 0,
    combo: 0,
    comboTimer: 0,
    dangerTimer: 0,
    elapsedSeconds: 0,
    orbs: [],
    particles: [],
    popups: [],
    gameOver: false,
    events: []
  };
}

// 현재 조준 위치에서 대기 중인 구슬을 떨어뜨리고 다음 구슬을 준비하는 순수 전이 함수
export function dropMergeOrb(previousState, randomFunction = Math.random) {
  if (previousState.gameOver || previousState.dropCooldown > 0) {
    return previousState;
  }

  const tierSpec = MERGE_TIERS[previousState.currentTier] || MERGE_TIERS[0];
  const dropX = clampOrbXForTier(previousState.aimX, tierSpec.tier);
  const droppedOrb = {
    id: previousState.nextOrbId,
    tier: tierSpec.tier,
    x: dropX,
    y: DROP_PREVIEW_Y,
    velocityX: (randomFunction() - 0.5) * 6,
    velocityY: 40,
    radius: tierSpec.radius,
    ageSeconds: 0,
    hasCollided: false
  };

  return {
    ...previousState,
    orbs: [...previousState.orbs, droppedOrb],
    currentTier: previousState.nextTier,
    nextTier: pickSpawnTier(randomFunction),
    nextOrbId: previousState.nextOrbId + 1,
    dropCooldown: DROP_COOLDOWN_SECONDS,
    events: [...(previousState.events || []), 'drop']
  };
}

// 프레임 단위 물리 서브스텝 및 동일 단계 구슬 합체 처리 목적
export function stepMergeState(
  previousState,
  input = {},
  rawDeltaSeconds = 0,
  randomFunction = Math.random
) {
  if (previousState.gameOver) {
    return {
      ...previousState,
      events: []
    };
  }

  const deltaSeconds = clampNumber(
    Number.isFinite(rawDeltaSeconds) ? rawDeltaSeconds : 0,
    0,
    MAX_DELTA_SECONDS
  );

  let workingState = {
    ...previousState,
    events: []
  };

  let aimX = workingState.aimX;
  if (input?.moveLeft && !input?.moveRight) {
    aimX -= AIM_MOVE_SPEED * deltaSeconds;
  } else if (input?.moveRight && !input?.moveLeft) {
    aimX += AIM_MOVE_SPEED * deltaSeconds;
  } else if (typeof input?.pointerDeltaX === 'number' && Number.isFinite(input.pointerDeltaX)) {
    aimX += input.pointerDeltaX;
  } else if (typeof input?.pointerX === 'number' && Number.isFinite(input.pointerX)) {
    aimX = input.pointerX;
  }
  aimX = clampOrbXForTier(aimX, workingState.currentTier);

  let dropCooldown = Math.max(0, workingState.dropCooldown - deltaSeconds);
  let combo = workingState.combo;
  let comboTimer = workingState.comboTimer;
  if (combo > 0) {
    comboTimer -= deltaSeconds;
    if (comboTimer <= 1e-9) {
      combo = 0;
      comboTimer = 0;
    }
  }

  let score = workingState.score;
  let starsEarned = workingState.starsEarned;
  let nextOrbId = workingState.nextOrbId;
  const events = [];
  const nextParticles = [];
  const nextPopups = [];

  for (let index = 0; index < workingState.particles.length; index += 1) {
    const particle = workingState.particles[index];
    const life = particle.life - deltaSeconds;
    if (life > 0) {
      nextParticles.push({
        ...particle,
        x: particle.x + particle.velocityX * deltaSeconds,
        y: particle.y + particle.velocityY * deltaSeconds,
        life
      });
    }
  }

  for (let index = 0; index < workingState.popups.length; index += 1) {
    const popup = workingState.popups[index];
    const life = popup.life - deltaSeconds;
    if (life > 0) {
      nextPopups.push({
        ...popup,
        y: popup.y - 24 * deltaSeconds,
        life
      });
    }
  }

  let orbs = workingState.orbs.map((orb) => ({ ...orb, ageSeconds: orb.ageSeconds + deltaSeconds }));
  const subStepDelta = deltaSeconds / SUBSTEPS;

  for (let stepIndex = 0; stepIndex < SUBSTEPS; stepIndex += 1) {
    for (let orbIndex = 0; orbIndex < orbs.length; orbIndex += 1) {
      const orb = orbs[orbIndex];
      orb.velocityY += GRAVITY * subStepDelta;
      orb.x += orb.velocityX * subStepDelta;
      orb.y += orb.velocityY * subStepDelta;

      if (orb.x < WALL_LEFT + orb.radius) {
        orb.x = WALL_LEFT + orb.radius;
        orb.velocityX = Math.abs(orb.velocityX) * WALL_BOUNCE;
      } else if (orb.x > WALL_RIGHT - orb.radius) {
        orb.x = WALL_RIGHT - orb.radius;
        orb.velocityX = -Math.abs(orb.velocityX) * WALL_BOUNCE;
      }

      if (orb.y > FLOOR_Y - orb.radius) {
        orb.y = FLOOR_Y - orb.radius;
        if (Math.abs(orb.velocityY) < 18) {
          orb.velocityY = 0;
        } else {
          orb.velocityY = -Math.abs(orb.velocityY) * FLOOR_BOUNCE;
        }
        orb.velocityX *= 0.94;
        orb.hasCollided = true;
      }
    }

    const mergedOrbIds = new Set();
    const pendingMerges = [];

    for (let firstIndex = 0; firstIndex < orbs.length; firstIndex += 1) {
      const orbA = orbs[firstIndex];
      if (mergedOrbIds.has(orbA.id)) continue;

      for (let secondIndex = firstIndex + 1; secondIndex < orbs.length; secondIndex += 1) {
        const orbB = orbs[secondIndex];
        if (mergedOrbIds.has(orbB.id)) continue;

        const deltaX = orbB.x - orbA.x;
        const deltaY = orbB.y - orbA.y;
        const minDistance = orbA.radius + orbB.radius;
        const distanceSquared = deltaX * deltaX + deltaY * deltaY;

        if (distanceSquared > minDistance * minDistance) {
          continue;
        }

        orbA.hasCollided = true;
        orbB.hasCollided = true;

        if (orbA.tier === orbB.tier) {
          mergedOrbIds.add(orbA.id);
          mergedOrbIds.add(orbB.id);
          pendingMerges.push({ orbA, orbB });
          break;
        }

        const distance = Math.sqrt(distanceSquared) || 0.001;
        const normalX = deltaX / distance;
        const normalY = deltaY / distance;
        const overlap = minDistance - distance;

        const totalMass = orbA.radius + orbB.radius;
        const shareA = orbB.radius / totalMass;
        const shareB = orbA.radius / totalMass;

        orbA.x -= normalX * overlap * shareA;
        orbA.y -= normalY * overlap * shareA;
        orbB.x += normalX * overlap * shareB;
        orbB.y += normalY * overlap * shareB;

        const relativeVelocityX = orbB.velocityX - orbA.velocityX;
        const relativeVelocityY = orbB.velocityY - orbA.velocityY;
        const velocityAlongNormal = relativeVelocityX * normalX + relativeVelocityY * normalY;

        if (velocityAlongNormal < 0) {
          const impulse = -(1 + ORB_BOUNCE) * velocityAlongNormal;
          orbA.velocityX -= impulse * normalX * shareA;
          orbA.velocityY -= impulse * normalY * shareA;
          orbB.velocityX += impulse * normalX * shareB;
          orbB.velocityY += impulse * normalY * shareB;
        }

        orbA.velocityX *= 0.992;
        orbB.velocityX *= 0.992;
      }
    }

    if (pendingMerges.length > 0) {
      orbs = orbs.filter((orb) => !mergedOrbIds.has(orb.id));
      for (let mergeIndex = 0; mergeIndex < pendingMerges.length; mergeIndex += 1) {
        const { orbA, orbB } = pendingMerges[mergeIndex];
        const midX = (orbA.x + orbB.x) / 2;
        const midY = (orbA.y + orbB.y) / 2;
        const maxTier = MERGE_TIERS.length - 1;

        if (orbA.tier >= maxTier) {
          score += UNICORN_BONUS_SCORE;
          starsEarned += UNICORN_BONUS_STARS;
          events.push('fever');
          nextParticles.push(
            ...createMergeParticles(
              midX,
              midY,
              ['#FFD166', '#FF7AA2', '#72EFDD', '#B388EB'],
              16,
              randomFunction
            )
          );
          nextPopups.push({
            text: `+${UNICORN_BONUS_SCORE}!`,
            x: midX,
            y: midY - 12,
            life: 0.95,
            maxLife: 0.95,
            color: '#FFE066'
          });
          continue;
        }

        const nextTierIndex = orbA.tier + 1;
        const nextSpec = MERGE_TIERS[nextTierIndex];
        combo = Math.min(6, combo + 1);
        comboTimer = COMBO_WINDOW_SECONDS;
        const gainedScore = nextSpec.score * combo;
        score += gainedScore;
        starsEarned += nextSpec.stars;
        events.push('merge');

        const spawnedOrb = {
          id: nextOrbId,
          tier: nextTierIndex,
          x: clampOrbXForTier(midX, nextTierIndex),
          y: Math.min(midY, FLOOR_Y - nextSpec.radius),
          velocityX: 0,
          velocityY: -24,
          radius: nextSpec.radius,
          ageSeconds: 0.4,
          hasCollided: true
        };
        nextOrbId += 1;
        orbs.push(spawnedOrb);

        // 합체 순간 인접 구슬을 살짝 밀어내어 수박게임 특유의 도미노 튕김 제공 목적
        for (let neighborIndex = 0; neighborIndex < orbs.length; neighborIndex += 1) {
          const neighbor = orbs[neighborIndex];
          if (neighbor.id === spawnedOrb.id) continue;
          const pushDeltaX = neighbor.x - spawnedOrb.x;
          const pushDeltaY = neighbor.y - spawnedOrb.y;
          const pushDist = Math.hypot(pushDeltaX, pushDeltaY);
          if (pushDist > 0 && pushDist < nextSpec.radius + neighbor.radius + 40) {
            const strength = 68;
            neighbor.velocityX += (pushDeltaX / pushDist) * strength;
            neighbor.velocityY += (pushDeltaY / pushDist) * strength - 18;
          }
        }

        nextParticles.push(
          ...createMergeParticles(
            spawnedOrb.x,
            spawnedOrb.y,
            [nextSpec.primary, nextSpec.secondary, '#FFFFFF'],
            9,
            randomFunction
          )
        );
        nextPopups.push({
          text: combo > 1 ? `${combo} COMBO +${gainedScore}` : `+${gainedScore}`,
          x: spawnedOrb.x,
          y: spawnedOrb.y - spawnedOrb.radius * 0.6,
          life: 0.72,
          maxLife: 0.72,
          color: combo > 1 ? '#FFE066' : '#FFFFFF'
        });
      }
    }
  }

  let dangerActive = false;
  for (let orbIndex = 0; orbIndex < orbs.length; orbIndex += 1) {
    const orb = orbs[orbIndex];
    const settledCheck = orb.hasCollided || orb.ageSeconds >= 1.4;
    if (settledCheck && orb.y - orb.radius < DANGER_LINE_Y) {
      dangerActive = true;
      break;
    }
  }

  let dangerTimer = dangerActive
    ? workingState.dangerTimer + deltaSeconds
    : Math.max(0, workingState.dangerTimer - deltaSeconds * 2);
  let gameOver = false;
  if (dangerTimer > OVERFLOW_GRACE_SECONDS) {
    gameOver = true;
    events.push('gameover');
  }

  return {
    ...workingState,
    aimX,
    dropCooldown,
    combo,
    comboTimer,
    dangerTimer,
    score,
    starsEarned,
    nextOrbId,
    elapsedSeconds: workingState.elapsedSeconds + deltaSeconds,
    orbs,
    particles: nextParticles,
    popups: nextPopups,
    gameOver,
    events
  };
}

function drawMergeOrb(context, orbSpec, centerX, centerY, radius) {
  if (orbSpec.skinId) {
    drawSkinMascot(context, orbSpec.skinId, centerX, centerY, radius, 0);
    return;
  }

  context.save();
  context.translate(centerX, centerY);

  const gradient = context.createRadialGradient(
    -radius * 0.28,
    -radius * 0.28,
    radius * 0.18,
    0,
    0,
    radius
  );
  gradient.addColorStop(0, orbSpec.secondary);
  gradient.addColorStop(1, orbSpec.primary);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();

  context.lineWidth = 2;
  context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  context.stroke();

  // 귀여운 표정 렌더링
  context.fillStyle = '#2B2D42';
  context.beginPath();
  context.arc(-radius * 0.28, -radius * 0.06, radius * 0.11, 0, Math.PI * 2);
  context.arc(radius * 0.28, -radius * 0.06, radius * 0.11, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = '#2B2D42';
  context.lineWidth = 1.6;
  context.lineCap = 'round';
  context.beginPath();
  context.arc(0, radius * 0.08, radius * 0.18, 0.15 * Math.PI, 0.85 * Math.PI);
  context.stroke();

  context.restore();
}

export function renderMergeScene(context, state, skinId, nextLabel = 'NEXT') {
  const skyGradient = context.createLinearGradient(0, 0, 0, MERGE_HEIGHT);
  skyGradient.addColorStop(0, '#1B133A');
  skyGradient.addColorStop(0.65, '#2A1D54');
  skyGradient.addColorStop(1, '#3B2872');
  context.fillStyle = skyGradient;
  context.fillRect(0, 0, MERGE_WIDTH, MERGE_HEIGHT);

  // 유리병 내부 배경 및 테두리
  context.fillStyle = 'rgba(255, 255, 255, 0.06)';
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(WALL_LEFT, DANGER_LINE_Y - 12, WALL_RIGHT - WALL_LEFT, FLOOR_Y - DANGER_LINE_Y + 12, 16);
  } else {
    context.rect(WALL_LEFT, DANGER_LINE_Y - 12, WALL_RIGHT - WALL_LEFT, FLOOR_Y - DANGER_LINE_Y + 12);
  }
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = 'rgba(255, 209, 227, 0.45)';
  context.stroke();

  // 상단 위험선(데드라인) 경고 점선
  const isWarning = state.dangerTimer > 0.25;
  const warningFlash = isWarning && Math.floor(state.elapsedSeconds * 8) % 2 === 0;
  context.save();
  context.setLineDash([7, 6]);
  context.strokeStyle = warningFlash ? '#FF477E' : 'rgba(255, 143, 163, 0.65)';
  context.lineWidth = isWarning ? 2.5 : 1.5;
  context.beginPath();
  context.moveTo(WALL_LEFT + 6, DANGER_LINE_Y);
  context.lineTo(WALL_RIGHT - 6, DANGER_LINE_Y);
  context.stroke();
  context.restore();

  // 우측 상단 NEXT 미리보기 배지
  const nextSpec = MERGE_TIERS[state.nextTier] || MERGE_TIERS[0];
  context.save();
  context.fillStyle = 'rgba(255, 255, 255, 0.14)';
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(MERGE_WIDTH - 76, 10, 62, 54, 14);
  } else {
    context.rect(MERGE_WIDTH - 76, 10, 62, 54);
  }
  context.fill();
  context.fillStyle = '#FFE066';
  context.font = 'bold 10px sans-serif';
  context.textAlign = 'center';
  context.fillText(nextLabel, MERGE_WIDTH - 45, 22);
  drawMergeOrb(context, nextSpec, MERGE_WIDTH - 45, 44, Math.min(14, nextSpec.radius * 0.62));
  context.restore();

  // 조준 가이드라인 및 대기 중인 구슬 + 장착 마스코트 손잡이
  if (!state.gameOver && state.dropCooldown <= 0.1) {
    const currentSpec = MERGE_TIERS[state.currentTier] || MERGE_TIERS[0];
    context.save();
    context.setLineDash([4, 6]);
    context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(state.aimX, DROP_PREVIEW_Y + currentSpec.radius);
    context.lineTo(state.aimX, FLOOR_Y);
    context.stroke();
    context.restore();

    drawMergeOrb(context, currentSpec, state.aimX, DROP_PREVIEW_Y, currentSpec.radius);
    drawSkinMascot(context, skinId, state.aimX, 24, 13, state.elapsedSeconds);
  }

  // 병 안의 구슬 렌더링
  for (let orbIndex = 0; orbIndex < state.orbs.length; orbIndex += 1) {
    const orb = state.orbs[orbIndex];
    const orbSpec = MERGE_TIERS[orb.tier] || MERGE_TIERS[0];
    drawMergeOrb(context, orbSpec, orb.x, orb.y, orb.radius);
  }

  // 파티클 렌더링
  for (let index = 0; index < state.particles.length; index += 1) {
    const particle = state.particles[index];
    context.save();
    context.globalAlpha = clampNumber(particle.life / particle.maxLife, 0, 1);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  // 콤보·점수 팝업
  for (let index = 0; index < state.popups.length; index += 1) {
    const popup = state.popups[index];
    context.save();
    context.globalAlpha = clampNumber(popup.life / popup.maxLife, 0, 1);
    context.fillStyle = popup.color;
    context.font = 'bold 16px sans-serif';
    context.textAlign = 'center';
    context.fillText(popup.text, popup.x, popup.y);
    context.restore();
  }

  // 하단 8단계 진화 미니 가이드 바
  context.save();
  const guideY = FLOOR_Y + 9;
  for (let tierIndex = 0; tierIndex < MERGE_TIERS.length; tierIndex += 1) {
    const guideX = 42 + tierIndex * 40;
    context.font = '13px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(MERGE_TIERS[tierIndex].badge, guideX, guideY);
    if (tierIndex < MERGE_TIERS.length - 1) {
      context.fillStyle = 'rgba(255,255,255,0.45)';
      context.font = '10px sans-serif';
      context.fillText('›', guideX + 20, guideY);
    }
  }
  context.restore();
}

export function mountStarlightMerge(canvasElement, options = {}) {
  const {
    skinId = 'bombom',
    nextLabel = 'NEXT',
    onHudUpdate,
    onGameOver,
    onSound,
    isPaused = () => false
  } = options;

  const context = canvasElement.getContext('2d');
  const activeSkin = getSkinById(skinId);
  let state = createInitialMergeState();
  let animationFrameId = 0;
  let lastTimestamp = null;
  let notifiedGameOver = false;
  let pointerState = {
    isTouchDragging: false,
    activePointerId: null,
    lastTouchClientX: null,
    pendingDeltaX: 0,
    pointerX: null,
    pendingDrop: false
  };
  const keyState = {
    moveLeft: false,
    moveRight: false
  };

  function toCanvasX(clientX) {
    const rect = canvasElement.getBoundingClientRect();
    if (!rect || rect.width <= 0) return MERGE_WIDTH / 2;
    return ((clientX - rect.left) / rect.width) * MERGE_WIDTH;
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      event.preventDefault();
      keyState.moveLeft = true;
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      event.preventDefault();
      keyState.moveRight = true;
    } else if (event.code === 'Space' || event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      pointerState.pendingDrop = true;
    }
  }

  function handleKeyUp(event) {
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      keyState.moveLeft = false;
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      keyState.moveRight = false;
    }
  }

  function handlePointerDown(event) {
    if (isPaused()) return;
    if (event.pointerType === 'touch') {
      pointerState.isTouchDragging = true;
      pointerState.activePointerId = event.pointerId;
      pointerState.lastTouchClientX = event.clientX;
      if (typeof canvasElement.setPointerCapture === 'function') {
        try {
          canvasElement.setPointerCapture(event.pointerId);
        } catch (captureError) {
          console.warn('Merge pointer capture skipped:', captureError);
        }
      }
      return;
    }
    pointerState.pointerX = toCanvasX(event.clientX);
  }

  function handlePointerMove(event) {
    if (event.pointerType === 'touch') {
      if (!pointerState.isTouchDragging || event.pointerId !== pointerState.activePointerId) {
        return;
      }
      const rect = canvasElement.getBoundingClientRect();
      const insideHorizontalBounds =
        rect && rect.width > 0 && event.clientX >= rect.left && event.clientX <= rect.right;
      if (!insideHorizontalBounds) {
        pointerState.lastTouchClientX = null;
        return;
      }
      if (pointerState.lastTouchClientX !== null) {
        const deltaClientX = event.clientX - pointerState.lastTouchClientX;
        pointerState.pendingDeltaX += (deltaClientX / rect.width) * MERGE_WIDTH;
      } else {
        const clampedEdgeClientX = event.clientX < (rect.left + rect.right) / 2 ? rect.left : rect.right;
        pointerState.pendingDeltaX += ((event.clientX - clampedEdgeClientX) / rect.width) * MERGE_WIDTH;
      }
      pointerState.lastTouchClientX = event.clientX;
      return;
    }
    pointerState.pointerX = toCanvasX(event.clientX);
  }

  function handlePointerUp(event) {
    if (isPaused()) return;
    if (event.pointerType === 'touch') {
      if (event.pointerId === pointerState.activePointerId) {
        pointerState.isTouchDragging = false;
        pointerState.activePointerId = null;
        pointerState.lastTouchClientX = null;
        pointerState.pendingDrop = true;
      }
      return;
    }
    pointerState.pointerX = toCanvasX(event.clientX);
    pointerState.pendingDrop = true;
  }

  function handlePointerCancel(event) {
    if (event.pointerId === pointerState.activePointerId) {
      pointerState.isTouchDragging = false;
      pointerState.activePointerId = null;
      pointerState.lastTouchClientX = null;
      pointerState.pendingDeltaX = 0;
    }
  }

  function notifyHud() {
    if (typeof onHudUpdate === 'function') {
      onHudUpdate({
        score: state.score,
        starsEarned: state.starsEarned,
        combo: state.combo,
        nextTier: state.nextTier
      });
    }
  }

  function frameLoop(timestamp) {
    if (lastTimestamp === null) {
      lastTimestamp = timestamp;
    }
    const rawDelta = Math.max(0, (timestamp - lastTimestamp) / 1000);
    lastTimestamp = timestamp;

    if (!isPaused() && !state.gameOver) {
      const frameDeltaX = pointerState.pendingDeltaX;
      pointerState.pendingDeltaX = 0;

      state = stepMergeState(
        state,
        {
          moveLeft: keyState.moveLeft,
          moveRight: keyState.moveRight,
          pointerDeltaX: frameDeltaX,
          pointerX: frameDeltaX === 0 ? pointerState.pointerX : null
        },
        rawDelta
      );

      if (pointerState.pendingDrop) {
        pointerState.pendingDrop = false;
        state = dropMergeOrb(state);
      }

      if (typeof onSound === 'function') {
        for (let index = 0; index < state.events.length; index += 1) {
          onSound(state.events[index]);
        }
      }

      notifyHud();

      if (state.gameOver && !notifiedGameOver) {
        notifiedGameOver = true;
        if (typeof onGameOver === 'function') {
          onGameOver({
            score: state.score,
            starsEarned: state.starsEarned
          });
        }
      }
    }

    if (context) {
      renderMergeScene(context, state, activeSkin.id, nextLabel);
    }

    animationFrameId = window.requestAnimationFrame(frameLoop);
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  canvasElement.addEventListener('pointerdown', handlePointerDown);
  canvasElement.addEventListener('pointermove', handlePointerMove);
  canvasElement.addEventListener('pointerup', handlePointerUp);
  canvasElement.addEventListener('pointercancel', handlePointerCancel);

  notifyHud();
  if (context) {
    renderMergeScene(context, state, activeSkin.id, nextLabel);
  }
  animationFrameId = window.requestAnimationFrame(frameLoop);

  return {
    destroy() {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvasElement.removeEventListener('pointerdown', handlePointerDown);
      canvasElement.removeEventListener('pointermove', handlePointerMove);
      canvasElement.removeEventListener('pointerup', handlePointerUp);
      canvasElement.removeEventListener('pointercancel', handlePointerCancel);
    }
  };
}
