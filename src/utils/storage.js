// 로컬 저장소 및 Chrome Storage 동기화 어댑터 모듈

import { SKINS } from '../games/skins.js';

export const STORAGE_KEY = 'bombom_arcade_v1';
export const MINI_STARS_PER_GOLD_STAR = 10;

const VALID_SKIN_IDENTIFIERS = new Set(SKINS.map((skinItem) => skinItem.id));

// 기본 초기 상태 객체 생성 목적
export function createDefaultState() {
  return {
    stars: 0,
    starFragments: 0,
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
  };
}

// 인게임 작은 별(10개) -> 스킨 황금별(1개) 환산 및 자투리 조각 이월 목적
export function applyMiniStarReward(currentStars, currentFragments, earnedMiniStars) {
  const safeStars = Number.isFinite(currentStars) && currentStars >= 0
    ? Math.floor(currentStars)
    : 0;
  const safeFragments = Number.isFinite(currentFragments) && currentFragments >= 0
    ? Math.floor(currentFragments) % MINI_STARS_PER_GOLD_STAR
    : 0;
  const safeEarned = Number.isFinite(earnedMiniStars) && earnedMiniStars >= 0
    ? Math.floor(earnedMiniStars)
    : 0;

  const totalFragments = safeFragments + safeEarned;
  const gainedSkinStars = Math.floor(totalFragments / MINI_STARS_PER_GOLD_STAR);
  return {
    nextStars: safeStars + gainedSkinStars,
    nextFragments: totalFragments % MINI_STARS_PER_GOLD_STAR,
    gainedSkinStars
  };
}

// 비정상 데이터 및 누락 필드 복원 정규화 목적
export function normalizeState(rawState) {
  const defaultState = createDefaultState();
  if (!rawState || typeof rawState !== 'object') {
    return defaultState;
  }

  const validStars = Number.isFinite(rawState.stars) && rawState.stars >= 0
    ? Math.floor(rawState.stars)
    : 0;

  const validStarFragments = Number.isFinite(rawState.starFragments) && rawState.starFragments >= 0
    ? Math.floor(rawState.starFragments) % MINI_STARS_PER_GOLD_STAR
    : 0;

  const validNickname = typeof rawState.nickname === 'string'
    ? rawState.nickname.trim().slice(0, 10)
    : '';

  const validDodgeScore = Number.isFinite(rawState.highScores?.dodge) && rawState.highScores.dodge >= 0
    ? Math.floor(rawState.highScores.dodge)
    : 0;

  const validStackScore = Number.isFinite(rawState.highScores?.stack) && rawState.highScores.stack >= 0
    ? Math.floor(rawState.highScores.stack)
    : 0;

  const rawUnlockedList = Array.isArray(rawState.unlockedSkins)
    ? rawState.unlockedSkins
    : [];
  const unlockedSet = new Set(['bombom']);
  for (const candidateSkinId of rawUnlockedList) {
    if (VALID_SKIN_IDENTIFIERS.has(candidateSkinId)) {
      unlockedSet.add(candidateSkinId);
    }
  }
  const normalizedUnlockedSkins = Array.from(unlockedSet);

  const normalizedEquippedSkin = unlockedSet.has(rawState.equippedSkin)
    ? rawState.equippedSkin
    : 'bombom';

  const rawLanguage = rawState.settings?.lang;
  const normalizedLanguage = rawLanguage === 'ko' || rawLanguage === 'en' || rawLanguage === 'auto'
    ? rawLanguage
    : 'auto';

  const normalizedMuted = typeof rawState.settings?.muted === 'boolean'
    ? rawState.settings.muted
    : false;

  return {
    stars: validStars,
    starFragments: validStarFragments,
    nickname: validNickname,
    highScores: {
      dodge: validDodgeScore,
      stack: validStackScore
    },
    unlockedSkins: normalizedUnlockedSkins,
    equippedSkin: normalizedEquippedSkin,
    settings: {
      lang: normalizedLanguage,
      muted: normalizedMuted
    }
  };
}

// 일반 웹·모바일 환경에서 첫 렌더 깜빡임 방지를 위한 동기 로드 목적
export function loadStateSync() {
  try {
    if (typeof localStorage !== 'undefined') {
      const serializedItem = localStorage.getItem(STORAGE_KEY);
      return serializedItem ? normalizeState(JSON.parse(serializedItem)) : createDefaultState();
    }
  } catch (loadError) {
    console.error('Failed to synchronously load BomBom Arcade state:', loadError);
  }
  return createDefaultState();
}

// Chrome Storage 및 LocalStorage 기반 영속 상태 비동기 로딩 목적
export async function loadState() {
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      const storageRecord = await chrome.storage.local.get(STORAGE_KEY);
      return normalizeState(storageRecord[STORAGE_KEY]);
    }
    return loadStateSync();
  } catch (loadError) {
    console.error('Failed to load BomBom Arcade state:', loadError);
  }
  return createDefaultState();
}

// 정규화 데이터의 Chrome Storage 및 LocalStorage 저장 목적
export async function saveState(nextState) {
  const normalizedState = normalizeState(nextState);
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: normalizedState });
      return normalizedState;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedState));
      return normalizedState;
    }
  } catch (saveError) {
    console.error('Failed to save BomBom Arcade state:', saveError);
  }
  return normalizedState;
}
