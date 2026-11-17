// 스킨 메타데이터 정의 및 캔버스 마스코트 렌더링 모듈

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

// 스킨 식별자 기준 스킨 정보 조회 및 기본 봄봄 스킨 폴백 목적
export function getSkinById(skinId) {
  return SKINS.find((skinItem) => skinItem.id === skinId) || SKINS[0];
}

// 보유 별 개수 및 중복 해금 여부 기반 해금 가능성 판정 목적
export function canUnlockSkin(state, skinId) {
  const targetSkin = SKINS.find((skinItem) => skinItem.id === skinId);
  if (!targetSkin) {
    return false;
  }
  if (state.unlockedSkins.includes(skinId)) {
    return false;
  }
  return state.stars >= targetSkin.cost;
}

// 별 소모 및 스킨 도감 해금 후 자동 장착 처리 목적
export function unlockSkin(state, skinId) {
  if (!canUnlockSkin(state, skinId)) {
    return state;
  }
  const targetSkin = getSkinById(skinId);
  return {
    ...state,
    stars: state.stars - targetSkin.cost,
    unlockedSkins: [...state.unlockedSkins, skinId],
    equippedSkin: skinId
  };
}

// 해금 완료된 스킨 대상 장착 전환 처리 목적
export function equipSkin(state, skinId) {
  if (!state.unlockedSkins.includes(skinId)) {
    return state;
  }
  return {
    ...state,
    equippedSkin: skinId
  };
}

// 스킨별 고유 장식 및 표정을 포함한 마스코트 캔버스 렌더링 목적
export function drawSkinMascot(context, skinId, centerX, centerY, radius, timeSeconds = 0) {
  const currentSkin = getSkinById(skinId);
  const bobbingOffset = Math.sin(timeSeconds * 6) * 1.8;
  const currentCenterY = centerY + bobbingOffset;

  context.save();
  context.translate(centerX, currentCenterY);

  // 무지개 구름 후면 오로라 아크 렌더링 목적
  if (skinId === 'rainbow-cloud') {
    const rainbowColors = ['#FF7AA2', '#FFD166', '#80ED99', '#72EFDD', '#B388EB'];
    context.lineWidth = radius * 0.12;
    for (let colorIndex = 0; colorIndex < rainbowColors.length; colorIndex += 1) {
      const arcRadius = radius * (1.1 + colorIndex * 0.12);
      context.strokeStyle = rainbowColors[colorIndex];
      context.beginPath();
      context.arc(0, radius * 0.1, arcRadius, Math.PI * 1.05, Math.PI * 1.95);
      context.stroke();
    }
  }

  // 로켓 냥이 고양이 귀 렌더링 목적
  if (skinId === 'rocket-cat') {
    context.fillStyle = currentSkin.primary;
    context.beginPath();
    context.moveTo(-radius * 0.75, -radius * 0.25);
    context.lineTo(-radius * 0.9, -radius * 1.05);
    context.lineTo(-radius * 0.2, -radius * 0.72);
    context.closePath();
    context.fill();

    context.beginPath();
    context.moveTo(radius * 0.75, -radius * 0.25);
    context.lineTo(radius * 0.9, -radius * 1.05);
    context.lineTo(radius * 0.2, -radius * 0.72);
    context.closePath();
    context.fill();

    // 안쪽 분홍 귀 포인트
    context.fillStyle = '#FFACC5';
    context.beginPath();
    context.moveTo(-radius * 0.65, -radius * 0.35);
    context.lineTo(-radius * 0.8, -radius * 0.9);
    context.lineTo(-radius * 0.3, -radius * 0.65);
    context.closePath();
    context.fill();

    context.beginPath();
    context.moveTo(radius * 0.65, -radius * 0.35);
    context.lineTo(radius * 0.8, -radius * 0.9);
    context.lineTo(radius * 0.3, -radius * 0.65);
    context.closePath();
    context.fill();
  } else if (skinId === 'ribbon-bunny') {
    // 리본 토끼 긴 귀 렌더링 목적
    context.fillStyle = '#FFFFFF';
    context.beginPath();
    context.ellipse(-radius * 0.36, -radius * 0.95, radius * 0.22, radius * 0.55, -0.15, 0, Math.PI * 2);
    context.ellipse(radius * 0.36, -radius * 0.95, radius * 0.22, radius * 0.55, 0.15, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#FFB3C6';
    context.beginPath();
    context.ellipse(-radius * 0.36, -radius * 0.95, radius * 0.12, radius * 0.4, -0.15, 0, Math.PI * 2);
    context.ellipse(radius * 0.36, -radius * 0.95, radius * 0.12, radius * 0.4, 0.15, 0, Math.PI * 2);
    context.fill();

    // 머리 위 미니 리본 장식
    context.fillStyle = '#FF99C8';
    context.beginPath();
    context.arc(0, -radius * 0.8, radius * 0.12, 0, Math.PI * 2);
    context.fill();
  } else if (skinId === 'gold-unicorn') {
    // 골드 유니콘 나선형 황금 뿔 렌더링 목적
    context.fillStyle = '#FFF3B0';
    context.beginPath();
    context.moveTo(-radius * 0.22, -radius * 0.75);
    context.lineTo(0, -radius * 1.35);
    context.lineTo(radius * 0.22, -radius * 0.75);
    context.closePath();
    context.fill();

    context.strokeStyle = '#FFD166';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(-radius * 0.15, -radius * 0.95);
    context.lineTo(radius * 0.15, -radius * 1.05);
    context.moveTo(-radius * 0.1, -radius * 1.15);
    context.lineTo(radius * 0.1, -radius * 1.25);
    context.stroke();
  } else if (skinId === 'strawberry-slime') {
    // 딸기 슬라임 상단 꼭지 잎사귀 렌더링 목적
    context.fillStyle = '#80ED99';
    context.beginPath();
    context.ellipse(0, -radius * 0.95, radius * 0.12, radius * 0.26, 0, 0, Math.PI * 2);
    context.ellipse(-radius * 0.22, -radius * 0.88, radius * 0.1, radius * 0.2, -0.6, 0, Math.PI * 2);
    context.ellipse(radius * 0.22, -radius * 0.88, radius * 0.1, radius * 0.2, 0.6, 0, Math.PI * 2);
    context.fill();
  } else if (skinId === 'bombom') {
    // 봄봄 시그니처 상단 반짝 별 왕관 렌더링 목적
    context.fillStyle = '#FFE066';
    context.beginPath();
    context.arc(0, -radius * 1.05, radius * 0.16, 0, Math.PI * 2);
    context.arc(-radius * 0.25, -radius * 0.95, radius * 0.1, 0, Math.PI * 2);
    context.arc(radius * 0.25, -radius * 0.95, radius * 0.1, 0, Math.PI * 2);
    context.fill();
  }

  // 둥근 원형 본체 그라데이션 렌더링 목적
  const radialGradient = context.createRadialGradient(
    -radius * 0.25,
    -radius * 0.25,
    radius * 0.2,
    0,
    0,
    radius
  );
  radialGradient.addColorStop(0, currentSkin.secondary);
  radialGradient.addColorStop(1, currentSkin.primary);
  context.fillStyle = radialGradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();

  context.lineWidth = 2;
  context.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  context.stroke();

  // 딸기 슬라임 및 봄봄 본체 윤택 광택 하이라이트 렌더링 목적
  if (skinId === 'strawberry-slime' || skinId === 'bombom') {
    context.fillStyle = 'rgba(255, 255, 255, 0.6)';
    context.beginPath();
    context.ellipse(-radius * 0.35, -radius * 0.45, radius * 0.24, radius * 0.12, -0.4, 0, Math.PI * 2);
    context.fill();
  }

  // 초롱초롱한 눈동자 렌더링 목적
  context.fillStyle = '#2B2D42';
  context.beginPath();
  context.arc(-radius * 0.32, -radius * 0.08, radius * 0.12, 0, Math.PI * 2);
  context.arc(radius * 0.32, -radius * 0.08, radius * 0.12, 0, Math.PI * 2);
  context.fill();

  // 눈동자 속 하얀 반사광 렌더링 목적
  context.fillStyle = '#FFFFFF';
  context.beginPath();
  context.arc(-radius * 0.36, -radius * 0.12, radius * 0.045, 0, Math.PI * 2);
  context.arc(radius * 0.28, -radius * 0.12, radius * 0.045, 0, Math.PI * 2);
  context.fill();

  // 발그레한 복숭아빛 볼터치 렌더링 목적
  context.fillStyle = 'rgba(255, 92, 138, 0.45)';
  context.beginPath();
  context.arc(-radius * 0.48, radius * 0.16, radius * 0.14, 0, Math.PI * 2);
  context.arc(radius * 0.48, radius * 0.16, radius * 0.14, 0, Math.PI * 2);
  context.fill();

  // 기분 좋은 미소 입모양 렌더링 목적
  context.strokeStyle = '#2B2D42';
  context.lineWidth = 1.8;
  context.lineCap = 'round';
  context.beginPath();
  context.arc(0, radius * 0.1, radius * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
  context.stroke();

  context.restore();
}
