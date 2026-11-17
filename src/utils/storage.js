// 로컬 저장소 및 Chrome Storage 동기화 어댑터 모듈

import { SKINS } from '../games/skins.js';

export const STORAGE_KEY = 'bombom_arcade_v1';

const VALID_SKIN_IDENTIFIERS = new Set(SKINS.map((skinItem) => skinItem.id));

// 기본 초기 상태 객체 생성 목적
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

// 비정상 데이터 및 누락 필드 복원 정규화 목적
export function normalizeState(rawState) {
  const defaultState = createDefaultState();
  if (!rawState || typeof rawState !== 'object') {
    return defaultState;
  }

  const validStars = Number.isFinite(rawState.stars) && rawState.stars >= 0
    ? Math.floor(rawState.stars)
    : 0;

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

// Chrome Storage 및 LocalStorage 기반 영속 상태 비동기 로딩 목적
export async function loadState() {
  try {
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      const storageRecord = await chrome.storage.local.get(STORAGE_KEY);
      return normalizeState(storageRecord[STORAGE_KEY]);
    }
    if (typeof localStorage !== 'undefined') {
      const serializedItem = localStorage.getItem(STORAGE_KEY);
      return serializedItem ? normalizeState(JSON.parse(serializedItem)) : createDefaultState();
    }
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
