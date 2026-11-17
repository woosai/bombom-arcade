// 별빛 닷지 러너 코어 물리 상태 머신 및 캔버스 렌더링 엔진

import { drawSkinMascot, getSkinById } from './skins.js';

export const DODGE_WIDTH = 368;
export const DODGE_HEIGHT = 430;

const PLAYER_VISUAL_RADIUS = 18;
const PLAYER_HIT_RADIUS = 13;
const PLAYER_SPEED = 320;
const POINTER_CHASE_SPEED = 780;
const COMBO_WINDOW_SECONDS = 1.8;
const MAGNET_PULL_RADIUS = 130;
const MAGNET_PULL_SPEED = 280;
const MAGNET_DURATION_SECONDS = 6.0;
const FEVER_DURATION_SECONDS = 5.0;
const FEVER_PICKUP_INTERVAL = 0.24;
const NORMAL_PICKUP_INTERVAL = 0.68;
const WARNING_START_ELAPSED = 18;
const WARNING_WAIT_SECONDS = 0.9;
const FAST_METEOR_SPEED = 450;
const MAX_DELTA_SECONDS = 0.05;
const MIN_PLAYER_X = PLAYER_VISUAL_RADIUS + 4;
const MAX_PLAYER_X = DODGE_WIDTH - PLAYER_VISUAL_RADIUS - 4;
const PLAYER_BASE_Y = DODGE_HEIGHT - 54;
const TRAIL_MAX_LENGTH = 12;
const TRAIL_MAX_LIFE = 0.24;

// 배경 별무리 좌표의 결정적 재현을 위한 정적 시드 배열
const BACKGROUND_STARS = Array.from({ length: 34 }, (_, starIndex) => ({
  x: ((starIndex * 73 + 19) % (DODGE_WIDTH - 16)) + 8,
  y: ((starIndex * 137 + 31) % (DODGE_HEIGHT - 16)) + 8,
  radius: (starIndex % 3) * 0.6 + 0.9,
  speed: (starIndex % 4) * 12 + 18,
  phase: starIndex * 0.85
}));

// 두 원의 중심 거리 제곱 비교를 통한 경계 포함 충돌 판정 목적
export function checkCircleCollision(
  firstX,
  firstY,
  firstRadius,
  secondX,
  secondY,
  secondRadius
) {
  const deltaX = firstX - secondX;
  const deltaY = firstY - secondY;
  const combinedRadius = firstRadius + secondRadius;
  return deltaX * deltaX + deltaY * deltaY <= combinedRadius * combinedRadius;
}

// 별빛 닷지 러너 한 판의 초기 상태 생성 목적
export function createInitialDodgeState() {
  return {
    playerX: DODGE_WIDTH / 2,
    playerY: PLAYER_BASE_Y,
    playerVisualRadius: PLAYER_VISUAL_RADIUS,
    playerHitRadius: PLAYER_HIT_RADIUS,
    score: 0,
    scoreAccumulator: 0,
    starsEarned: 0,
    combo: 0,
    comboTimer: 0,
    shieldCount: 0,
    invincibleTimer: 0,
    magnetTimer: 0,
    feverTimer: 0,
    elapsedSeconds: 0,
    hazardSpawnTimer: 1.4,
    pickupSpawnTimer: 0.4,
    warningSpawnTimer: 0,
    hazards: [],
    pickups: [],
    warnings: [],
    particles: [],
    trail: [],
    gameOver: false,
    events: []
  };
}

// 구간 제한 클램프 보조 함수
function clampNumber(value, minimumValue, maximumValue) {
  return Math.max(minimumValue, Math.min(maximumValue, value));
}

// 충돌·수집 시 터지는 파티클 무리 생성 목적
function createBurstParticles(originX, originY, colorPalette, particleCount, randomFunction) {
  const createdParticles = [];
  for (let particleIndex = 0; particleIndex < particleCount; particleIndex += 1) {
    const angle = (Math.PI * 2 * particleIndex) / particleCount + randomFunction() * 0.4;
    const speed = 55 + randomFunction() * 115;
    const maxLife = 0.28 + randomFunction() * 0.24;
    createdParticles.push({
      x: originX,
      y: originY,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      life: maxLife,
      maxLife,
      color: colorPalette[particleIndex % colorPalette.length],
      radius: 2.2 + randomFunction() * 2.2
    });
  }
  return createdParticles;
}

// 경과 시간에 따른 일반 운석 생성 목적
function createNormalHazard(elapsedSeconds, randomFunction) {
  const difficultyRatio = Math.min(1, elapsedSeconds / 60);
  const radius = 12 + randomFunction() * 7;
  const horizontalMargin = radius + 6;
  const x = horizontalMargin + randomFunction() * (DODGE_WIDTH - horizontalMargin * 2);
  return {
    x,
    y: -radius - 6,
    radius,
    velocityX: (randomFunction() - 0.5) * (36 + difficultyRatio * 68),
    velocityY: 160 + difficultyRatio * 170 + randomFunction() * 50,
    rotation: randomFunction() * Math.PI * 2,
    rotationSpeed: (randomFunction() - 0.5) * 4.5,
    isFastMeteor: false
  };
}

// 피버 상태 및 보호막 보유 여부에 따른 수집 아이템 종류 결정 목적
function createPickupItem(elapsedSeconds, feverActive, shieldCount, randomFunction) {
  const randomRoll = randomFunction();
  let pickupType = 'star';

  if (!feverActive) {
    if (randomRoll < 0.08 && shieldCount === 0) {
      pickupType = 'shield';
    } else if (randomRoll < 0.15) {
      pickupType = 'magnet';
    } else if (randomRoll < 0.21) {
      pickupType = 'fever';
    }
  }

  return {
    x: 24 + randomFunction() * (DODGE_WIDTH - 48),
    y: -18,
    radius: pickupType === 'star' ? 12 : 14,
    velocityY: 138 + Math.min(85, elapsedSeconds * 2),
    type: pickupType
  };
}

// 입력·물리·충돌·아이템·경고 운석 상태를 단일 프레임 전진시키는 순수 스텝 함수
export function stepDodgeState(
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

  // 프레임 드롭 시 터널링 방지를 위한 델타 시간 상한 고정 목적
  const deltaSeconds = clampNumber(
    Number.isFinite(rawDeltaSeconds) ? rawDeltaSeconds : 0,
    0,
    MAX_DELTA_SECONDS
  );

  let playerX = previousState.playerX;
  const moveLeft = Boolean(input?.moveLeft);
  const moveRight = Boolean(input?.moveRight);

  if (moveLeft && !moveRight) {
    playerX -= PLAYER_SPEED * deltaSeconds;
  } else if (moveRight && !moveLeft) {
    playerX += PLAYER_SPEED * deltaSeconds;
  } else if (
    typeof input?.pointerDeltaX === 'number' &&
    Number.isFinite(input.pointerDeltaX) &&
    input.pointerDeltaX !== 0
  ) {
    // 터치 드래그 시 손가락 재진입 순간이동 방지를 위한 상대 이동량 반영
    playerX += input.pointerDeltaX;
  } else if (typeof input?.pointerX === 'number' && Number.isFinite(input.pointerX)) {
    const maxPointerStep = POINTER_CHASE_SPEED * deltaSeconds;
    const distanceToTarget = input.pointerX - playerX;
    playerX += clampNumber(distanceToTarget, -maxPointerStep, maxPointerStep);
  }
  playerX = clampNumber(playerX, MIN_PLAYER_X, MAX_PLAYER_X);

  const elapsedSeconds = previousState.elapsedSeconds + deltaSeconds;
  let score = previousState.score;
  let scoreAccumulator = previousState.scoreAccumulator + deltaSeconds * 5;
  if (scoreAccumulator >= 1) {
    const wholeSurvivalPoints = Math.floor(scoreAccumulator);
    score += wholeSurvivalPoints;
    scoreAccumulator -= wholeSurvivalPoints;
  }

  let starsEarned = previousState.starsEarned;
  let combo = previousState.combo;
  let comboTimer = previousState.comboTimer;
  if (combo > 0) {
    comboTimer -= deltaSeconds;
    // 부동소수점 오차로 1.8초 경계에서 콤보가 잔존하지 않도록 미세 임계치 적용
    if (comboTimer <= 1e-9) {
      combo = 0;
      comboTimer = 0;
    }
  }

  let shieldCount = previousState.shieldCount;
  let invincibleTimer = Math.max(0, previousState.invincibleTimer - deltaSeconds);
  let magnetTimer = Math.max(0, previousState.magnetTimer - deltaSeconds);
  let feverTimer = Math.max(0, previousState.feverTimer - deltaSeconds);

  const events = [];
  const nextParticles = [];
  for (let particleIndex = 0; particleIndex < previousState.particles.length; particleIndex += 1) {
    const particle = previousState.particles[particleIndex];
    const remainingLife = particle.life - deltaSeconds;
    if (remainingLife > 0) {
      nextParticles.push({
        ...particle,
        x: particle.x + particle.velocityX * deltaSeconds,
        y: particle.y + particle.velocityY * deltaSeconds,
        life: remainingLife
      });
    }
  }

  const nextTrail = [];
  for (let pointIndex = 0; pointIndex < previousState.trail.length; pointIndex += 1) {
    const trailPoint = previousState.trail[pointIndex];
    const remainingLife = trailPoint.life - deltaSeconds;
    if (remainingLife > 0) {
      nextTrail.push({
        ...trailPoint,
        life: remainingLife
      });
    }
  }
  nextTrail.push({
    x: playerX,
    y: previousState.playerY + 6,
    life: TRAIL_MAX_LIFE,
    maxLife: TRAIL_MAX_LIFE
  });
  if (nextTrail.length > TRAIL_MAX_LENGTH) {
    nextTrail.splice(0, nextTrail.length - TRAIL_MAX_LENGTH);
  }

  // 수집 아이템 스폰 및 자석 끌어당김 처리
  let pickupSpawnTimer = previousState.pickupSpawnTimer - deltaSeconds;
  const spawnedPickups = [...previousState.pickups];
  if (pickupSpawnTimer <= 0) {
    spawnedPickups.push(
      createPickupItem(elapsedSeconds, feverTimer > 0, shieldCount, randomFunction)
    );
    pickupSpawnTimer =
      feverTimer > 0
        ? FEVER_PICKUP_INTERVAL
        : NORMAL_PICKUP_INTERVAL * (0.85 + randomFunction() * 0.3);
  }

  const nextPickups = [];
  for (let pickupIndex = 0; pickupIndex < spawnedPickups.length; pickupIndex += 1) {
    const pickup = spawnedPickups[pickupIndex];
    let pickupX = pickup.x;
    let pickupY = pickup.y + pickup.velocityY * deltaSeconds;

    if (magnetTimer > 0 && pickup.type === 'star') {
      const deltaX = playerX - pickupX;
      const deltaY = previousState.playerY - pickupY;
      const distance = Math.hypot(deltaX, deltaY);
      if (distance > 0 && distance <= MAGNET_PULL_RADIUS) {
        const pullStep = Math.min(distance, MAGNET_PULL_SPEED * deltaSeconds);
        pickupX += (deltaX / distance) * pullStep;
        pickupY += (deltaY / distance) * pullStep;
      }
    }

    const collected = checkCircleCollision(
      playerX,
      previousState.playerY,
      previousState.playerVisualRadius,
      pickupX,
      pickupY,
      pickup.radius
    );

    if (collected) {
      if (pickup.type === 'star') {
        starsEarned += 1;
        combo = Math.min(5, combo + 1);
        comboTimer = COMBO_WINDOW_SECONDS;
        score += 10 * combo;
        events.push('star');
        nextParticles.push(
          ...createBurstParticles(
            pickupX,
            pickupY,
            ['#FFE066', '#FFF3B0', '#FF7AA2'],
            7,
            randomFunction
          )
        );
      } else if (pickup.type === 'shield') {
        shieldCount = 1;
        score += 15;
        events.push('powerup');
        nextParticles.push(
          ...createBurstParticles(
            pickupX,
            pickupY,
            ['#72EFDD', '#4CC9F0', '#FFFFFF'],
            8,
            randomFunction
          )
        );
      } else if (pickup.type === 'magnet') {
        magnetTimer = MAGNET_DURATION_SECONDS;
        score += 15;
        events.push('powerup');
        nextParticles.push(
          ...createBurstParticles(
            pickupX,
            pickupY,
            ['#FF5D8F', '#FFACC5', '#FFFFFF'],
            8,
            randomFunction
          )
        );
      } else if (pickup.type === 'fever') {
        feverTimer = FEVER_DURATION_SECONDS;
        pickupSpawnTimer = Math.min(pickupSpawnTimer, FEVER_PICKUP_INTERVAL);
        score += 25;
        events.push('fever');
        nextParticles.push(
          ...createBurstParticles(
            pickupX,
            pickupY,
            ['#FFD166', '#FF7AA2', '#72EFDD'],
            10,
            randomFunction
          )
        );
      }
    } else if (pickupY <= DODGE_HEIGHT + 30) {
      nextPickups.push({
        ...pickup,
        x: pickupX,
        y: pickupY
      });
    }
  }

  // 일반 운석 스폰 및 12초 이후 경고 라인·고속 운석 발사 처리
  const difficultyRatio = Math.min(1, elapsedSeconds / 60);
  let hazardSpawnTimer = previousState.hazardSpawnTimer - deltaSeconds;
  const activeHazards = [...previousState.hazards];
  if (hazardSpawnTimer <= 0) {
    activeHazards.push(createNormalHazard(elapsedSeconds, randomFunction));
    const baseInterval = Math.max(0.32, 1.05 - difficultyRatio * 0.65);
    hazardSpawnTimer = baseInterval * (0.85 + randomFunction() * 0.3);
  }

  const nextWarnings = [];
  for (let warningIndex = 0; warningIndex < previousState.warnings.length; warningIndex += 1) {
    const warning = previousState.warnings[warningIndex];
    const remainingTimer = warning.timer - deltaSeconds;
    if (remainingTimer <= 1e-9) {
      activeHazards.push({
        x: warning.x,
        y: -18,
        radius: 14,
        velocityX: 0,
        velocityY: FAST_METEOR_SPEED,
        rotation: 0,
        rotationSpeed: 6,
        isFastMeteor: true
      });
    } else {
      nextWarnings.push({
        ...warning,
        timer: remainingTimer
      });
    }
  }

  let warningSpawnTimer = previousState.warningSpawnTimer;
  if (elapsedSeconds >= WARNING_START_ELAPSED) {
    warningSpawnTimer -= deltaSeconds;
    if (warningSpawnTimer <= 0) {
      nextWarnings.push({
        x: 24 + randomFunction() * (DODGE_WIDTH - 48),
        timer: WARNING_WAIT_SECONDS
      });
      warningSpawnTimer = Math.max(1.5, 3.4 - (elapsedSeconds - WARNING_START_ELAPSED) * 0.04);
    }
  }

  // 운석 이동 및 피격 판정 처리
  let gameOver = false;
  const nextHazards = [];
  for (let hazardIndex = 0; hazardIndex < activeHazards.length; hazardIndex += 1) {
    const hazard = activeHazards[hazardIndex];
    let hazardX = hazard.x + hazard.velocityX * deltaSeconds;
    let hazardVelocityX = hazard.velocityX;
    const hazardY = hazard.y + hazard.velocityY * deltaSeconds;

    if (hazardX < hazard.radius + 4) {
      hazardX = hazard.radius + 4;
      hazardVelocityX = Math.abs(hazardVelocityX);
    } else if (hazardX > DODGE_WIDTH - hazard.radius - 4) {
      hazardX = DODGE_WIDTH - hazard.radius - 4;
      hazardVelocityX = -Math.abs(hazardVelocityX);
    }

    if (hazardY > DODGE_HEIGHT + 36) {
      continue;
    }

    const hitPlayer =
      !gameOver &&
      checkCircleCollision(
        playerX,
        previousState.playerY,
        previousState.playerHitRadius,
        hazardX,
        hazardY,
        hazard.radius
      );

    if (hitPlayer) {
      if (feverTimer > 0) {
        score += 15;
        nextParticles.push(
          ...createBurstParticles(
            hazardX,
            hazardY,
            ['#FFD166', '#FF7AA2', '#72EFDD'],
            9,
            randomFunction
          )
        );
        continue;
      }

      if (invincibleTimer > 0) {
        nextHazards.push({
          ...hazard,
          x: hazardX,
          y: hazardY,
          velocityX: hazardVelocityX,
          rotation: hazard.rotation + hazard.rotationSpeed * deltaSeconds
        });
        continue;
      }

      if (shieldCount > 0) {
        shieldCount -= 1;
        invincibleTimer = 1.0;
        events.push('shieldBreak');
        nextParticles.push(
          ...createBurstParticles(
            playerX,
            previousState.playerY,
            ['#72EFDD', '#4CC9F0', '#FFFFFF'],
            12,
            randomFunction
          )
        );
        continue;
      }

      gameOver = true;
      events.push('gameover');
      nextParticles.push(
        ...createBurstParticles(
          playerX,
          previousState.playerY,
          ['#FF4D6D', '#FFE066', '#FFFFFF'],
          16,
          randomFunction
        )
      );
      continue;
    }

    nextHazards.push({
      ...hazard,
      x: hazardX,
      y: hazardY,
      velocityX: hazardVelocityX,
      rotation: hazard.rotation + hazard.rotationSpeed * deltaSeconds
    });
  }

  return {
    ...previousState,
    playerX,
    score,
    scoreAccumulator,
    starsEarned,
    combo,
    comboTimer,
    shieldCount,
    invincibleTimer,
    magnetTimer,
    feverTimer,
    elapsedSeconds,
    hazardSpawnTimer,
    pickupSpawnTimer,
    warningSpawnTimer,
    hazards: nextHazards,
    pickups: nextPickups,
    warnings: nextWarnings,
    particles: nextParticles,
    trail: nextTrail,
    gameOver,
    events
  };
}

// 5각 별 도형 렌더링 보조 함수
function drawStarShape(context, centerX, centerY, outerRadius, innerRadius, rotationAngle) {
  context.beginPath();
  for (let pointIndex = 0; pointIndex < 10; pointIndex += 1) {
    const activeRadius = pointIndex % 2 === 0 ? outerRadius : innerRadius;
    const angle = rotationAngle + (pointIndex * Math.PI) / 5 - Math.PI / 2;
    const pointX = centerX + Math.cos(angle) * activeRadius;
    const pointY = centerY + Math.sin(angle) * activeRadius;
    if (pointIndex === 0) {
      context.moveTo(pointX, pointY);
    } else {
      context.lineTo(pointX, pointY);
    }
  }
  context.closePath();
}

// 캔버스 환경 구버전 폴백용 둥근 알약 배지 렌더링 보조 함수
function drawRoundedBadge(context, leftX, topY, width, height, cornerRadius) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(leftX, topY, width, height, cornerRadius);
  } else {
    context.rect(leftX, topY, width, height);
  }
  context.closePath();
}

// 수집 아이템 종류별 그래픽 렌더링 목적
function drawPickup(context, pickup, elapsedSeconds) {
  context.save();
  if (pickup.type === 'star') {
    const pulseScale = 1 + Math.sin(elapsedSeconds * 8 + pickup.x) * 0.08;
    context.fillStyle = '#FFE066';
    context.strokeStyle = '#FFF8CC';
    context.lineWidth = 1.5;
    drawStarShape(
      context,
      pickup.x,
      pickup.y,
      pickup.radius * pulseScale,
      pickup.radius * 0.48 * pulseScale,
      Math.sin(elapsedSeconds * 4) * 0.2
    );
    context.fill();
    context.stroke();
  } else {
    let badgeColor = '#4CC9F0';
    let badgeLabel = 'S';
    if (pickup.type === 'magnet') {
      badgeColor = '#FF5D8F';
      badgeLabel = 'M';
    } else if (pickup.type === 'fever') {
      badgeColor = '#FFD166';
      badgeLabel = 'F';
    }

    context.fillStyle = badgeColor;
    context.beginPath();
    context.arc(pickup.x, pickup.y, pickup.radius, 0, Math.PI * 2);
    context.fill();

    context.lineWidth = 2;
    context.strokeStyle = '#FFFFFF';
    context.stroke();

    context.fillStyle = '#1B1438';
    context.font = 'bold 12px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(badgeLabel, pickup.x, pickup.y + 0.5);
  }
  context.restore();
}

// 일반 운석 및 고속 경고 운석 렌더링 목적
function drawHazard(context, hazard) {
  context.save();
  context.translate(hazard.x, hazard.y);

  if (hazard.isFastMeteor) {
    context.fillStyle = 'rgba(255, 77, 109, 0.35)';
    context.beginPath();
    context.moveTo(-hazard.radius * 0.8, 0);
    context.lineTo(0, -hazard.radius * 2.5);
    context.lineTo(hazard.radius * 0.8, 0);
    context.closePath();
    context.fill();
  }

  context.rotate(hazard.rotation);
  context.fillStyle = hazard.isFastMeteor ? '#FF4D6D' : '#4A3F6B';
  context.strokeStyle = hazard.isFastMeteor ? '#FFD166' : '#FF7AA2';
  context.lineWidth = 2;

  context.beginPath();
  const vertexCount = 7;
  for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
    const angle = (vertexIndex * Math.PI * 2) / vertexCount;
    const jaggedRadius = hazard.radius * (vertexIndex % 2 === 0 ? 1.04 : 0.82);
    const pointX = Math.cos(angle) * jaggedRadius;
    const pointY = Math.sin(angle) * jaggedRadius;
    if (vertexIndex === 0) {
      context.moveTo(pointX, pointY);
    } else {
      context.lineTo(pointX, pointY);
    }
  }
  context.closePath();
  context.fill();
  context.stroke();

  context.restore();
}

// 현재 닷지 러너 상태 전체를 368x430 논리 캔버스에 그리는 함수
function renderDodgeScene(context, state, skinId, feverText) {
  const activeSkin = getSkinById(skinId);

  // 밤하늘 그라데이션 배경 렌더링 목적
  const backgroundGradient = context.createLinearGradient(0, 0, 0, DODGE_HEIGHT);
  backgroundGradient.addColorStop(0, '#160F29');
  backgroundGradient.addColorStop(1, '#261848');
  context.fillStyle = backgroundGradient;
  context.fillRect(0, 0, DODGE_WIDTH, DODGE_HEIGHT);

  // 반짝이며 흐르는 배경 별무리 렌더링 목적
  for (let starIndex = 0; starIndex < BACKGROUND_STARS.length; starIndex += 1) {
    const backgroundStar = BACKGROUND_STARS[starIndex];
    const scrolledY =
      (backgroundStar.y + state.elapsedSeconds * backgroundStar.speed) % DODGE_HEIGHT;
    const alpha = 0.35 + 0.45 * Math.sin(state.elapsedSeconds * 3 + backgroundStar.phase);
    context.fillStyle = `rgba(255, 248, 225, ${Math.max(0.15, alpha).toFixed(2)})`;
    context.beginPath();
    context.arc(backgroundStar.x, scrolledY, backgroundStar.radius, 0, Math.PI * 2);
    context.fill();
  }

  // 고속 운석 예고 빨간 점선 가이드 렌더링 목적
  for (let warningIndex = 0; warningIndex < state.warnings.length; warningIndex += 1) {
    const warning = state.warnings[warningIndex];
    context.save();
    context.strokeStyle = 'rgba(255, 77, 109, 0.85)';
    context.lineWidth = 2;
    context.setLineDash([6, 6]);
    context.beginPath();
    context.moveTo(warning.x, 26);
    context.lineTo(warning.x, DODGE_HEIGHT - 16);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = '#FF4D6D';
    context.beginPath();
    context.arc(warning.x, 20, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#FFFFFF';
    context.font = 'bold 13px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText('!', warning.x, 21);
    context.restore();
  }

  // 장착 스킨 색상의 이동 잔상 꼬리 렌더링 목적
  for (let pointIndex = 0; pointIndex < state.trail.length; pointIndex += 1) {
    const trailPoint = state.trail[pointIndex];
    const lifeRatio = trailPoint.life / trailPoint.maxLife;
    context.save();
    context.globalAlpha = lifeRatio * 0.45;
    context.fillStyle = activeSkin.trail;
    context.beginPath();
    context.arc(trailPoint.x, trailPoint.y, state.playerVisualRadius * 0.55 * lifeRatio, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  for (let pickupIndex = 0; pickupIndex < state.pickups.length; pickupIndex += 1) {
    drawPickup(context, state.pickups[pickupIndex], state.elapsedSeconds);
  }

  for (let hazardIndex = 0; hazardIndex < state.hazards.length; hazardIndex += 1) {
    drawHazard(context, state.hazards[hazardIndex]);
  }

  // 마스코트 본체 및 보호막·자석 오라 렌더링 목적
  context.save();
  if (state.invincibleTimer > 0 && Math.floor(state.invincibleTimer * 16) % 2 === 0) {
    context.globalAlpha = 0.45;
  }
  drawSkinMascot(
    context,
    skinId,
    state.playerX,
    state.playerY,
    state.playerVisualRadius,
    state.elapsedSeconds
  );
  context.restore();

  if (state.shieldCount > 0) {
    context.save();
    context.strokeStyle = 'rgba(114, 239, 221, 0.9)';
    context.fillStyle = 'rgba(114, 239, 221, 0.16)';
    context.lineWidth = 2.5;
    context.beginPath();
    context.arc(state.playerX, state.playerY, state.playerVisualRadius + 7, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }

  if (state.magnetTimer > 0) {
    context.save();
    context.strokeStyle = 'rgba(255, 93, 143, 0.65)';
    context.lineWidth = 1.8;
    context.setLineDash([4, 4]);
    context.beginPath();
    context.arc(state.playerX, state.playerY, state.playerVisualRadius + 12, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
    context.restore();
  }

  for (let particleIndex = 0; particleIndex < state.particles.length; particleIndex += 1) {
    const particle = state.particles[particleIndex];
    context.save();
    context.globalAlpha = clampNumber(particle.life / particle.maxLife, 0, 1);
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  // 피버 타임 활성 시 상단 네온 배너 표시 목적
  if (state.feverTimer > 0) {
    context.save();
    context.strokeStyle = 'rgba(255, 209, 102, 0.85)';
    context.lineWidth = 4;
    context.strokeRect(2, 2, DODGE_WIDTH - 4, DODGE_HEIGHT - 4);

    context.fillStyle = '#FFD166';
    drawRoundedBadge(context, DODGE_WIDTH / 2 - 74, 12, 148, 28, 14);
    context.fill();

    context.fillStyle = '#1B1438';
    context.font = 'bold 14px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(feverText || 'FEVER!', DODGE_WIDTH / 2, 26);
    context.restore();
  }
}

// 캔버스에 별빛 닷지 러너 루프와 입력 리스너를 마운트하고 정리 핸들을 반환
export function mountDodgeRunner(canvas, options = {}) {
  const {
    skinId = 'bombom',
    feverText = 'FEVER!',
    onHudUpdate,
    onGameOver,
    onSound,
    isPaused
  } = options;

  const hostWindow = typeof window !== 'undefined' ? window : globalThis;
  const context = canvas.getContext('2d');
  let state = createInitialDodgeState();
  let destroyed = false;
  let gameOverNotified = false;
  let animationFrameId = 0;
  let lastTimestamp = null;

  const inputState = {
    moveLeft: false,
    moveRight: false,
    pointerX: null,
    pointerDeltaX: 0
  };
  let activeTouchPointerId = null;
  let lastTouchClampedX = null;

  function emitHud() {
    if (typeof onHudUpdate === 'function') {
      onHudUpdate({
        score: state.score,
        starsEarned: state.starsEarned,
        combo: state.combo,
        shieldActive: state.shieldCount > 0,
        magnetActive: state.magnetTimer > 0,
        feverActive: state.feverTimer > 0
      });
    }
  }

  function resolveCanvasX(clientX) {
    const boundingRect = canvas.getBoundingClientRect();
    if (!boundingRect || boundingRect.width <= 0) {
      return state.playerX;
    }
    return ((clientX - boundingRect.left) / boundingRect.width) * DODGE_WIDTH;
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      inputState.moveLeft = true;
      inputState.pointerX = null;
      if (event.key === 'ArrowLeft' && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      inputState.moveRight = true;
      inputState.pointerX = null;
      if (event.key === 'ArrowRight' && typeof event.preventDefault === 'function') {
        event.preventDefault();
      }
    }
  }

  function handleKeyUp(event) {
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      inputState.moveLeft = false;
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      inputState.moveRight = false;
    }
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'touch') {
      activeTouchPointerId = event.pointerId;
      lastTouchClampedX = clampNumber(resolveCanvasX(event.clientX), 0, DODGE_WIDTH);
      inputState.pointerX = null;
      if (typeof canvas.setPointerCapture === 'function') {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch (captureError) {
          console.warn('Touch pointer capture skipped:', captureError);
        }
      }
      return;
    }
    inputState.pointerX = resolveCanvasX(event.clientX);
  }

  function handlePointerMove(event) {
    if (event.pointerType === 'touch') {
      if (activeTouchPointerId !== event.pointerId || lastTouchClampedX === null) {
        return;
      }
      const nextClampedX = clampNumber(resolveCanvasX(event.clientX), 0, DODGE_WIDTH);
      inputState.pointerDeltaX += nextClampedX - lastTouchClampedX;
      lastTouchClampedX = nextClampedX;
      return;
    }
    if (activeTouchPointerId === null) {
      inputState.pointerX = resolveCanvasX(event.clientX);
    }
  }

  function handlePointerUpOrCancel(event) {
    if (event.pointerType === 'touch' && activeTouchPointerId === event.pointerId) {
      activeTouchPointerId = null;
      lastTouchClampedX = null;
      inputState.pointerDeltaX = 0;
    }
  }

  function handlePointerLeave() {
    if (activeTouchPointerId === null) {
      inputState.pointerX = null;
    }
  }

  function frame(timestamp) {
    if (destroyed) {
      return;
    }

    const rawDeltaSeconds = lastTimestamp === null ? 0 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    const paused = typeof isPaused === 'function' ? isPaused() : Boolean(isPaused);
    if (!paused && !state.gameOver) {
      state = stepDodgeState(state, inputState, rawDeltaSeconds, Math.random);
      inputState.pointerDeltaX = 0;

      if (typeof onSound === 'function') {
        for (let eventIndex = 0; eventIndex < state.events.length; eventIndex += 1) {
          onSound(state.events[eventIndex]);
        }
      }

      emitHud();

      if (state.gameOver && !gameOverNotified) {
        gameOverNotified = true;
        if (typeof onGameOver === 'function') {
          onGameOver({
            score: state.score,
            starsEarned: state.starsEarned
          });
        }
      }
    } else {
      inputState.pointerDeltaX = 0;
    }

    if (context) {
      renderDodgeScene(context, state, skinId, feverText);
    }

    if (!destroyed && !state.gameOver) {
      animationFrameId = hostWindow.requestAnimationFrame(frame);
    }
  }

  hostWindow.addEventListener('keydown', handleKeyDown);
  hostWindow.addEventListener('keyup', handleKeyUp);
  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUpOrCancel);
  canvas.addEventListener('pointercancel', handlePointerUpOrCancel);
  canvas.addEventListener('pointerleave', handlePointerLeave);

  emitHud();
  if (context) {
    renderDodgeScene(context, state, skinId, feverText);
  }
  animationFrameId = hostWindow.requestAnimationFrame(frame);

  return {
    destroy() {
      destroyed = true;
      hostWindow.cancelAnimationFrame(animationFrameId);
      hostWindow.removeEventListener('keydown', handleKeyDown);
      hostWindow.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUpOrCancel);
      canvas.removeEventListener('pointercancel', handlePointerUpOrCancel);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    }
  };
}
