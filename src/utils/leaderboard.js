// 별명 검증 및 Firestore Enterprise 랭킹 조회·동기화 모듈

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { execute, field } from 'firebase/firestore/pipelines';
import { SKINS } from '../games/skins.js';
import { ensureAnonymousUser, getBomBomFirestore } from './firebase.js';

const VALID_GAME_TYPES = new Set(['dodge', 'stack']);
const VALID_SKIN_IDENTIFIERS = new Set(SKINS.map((skinItem) => skinItem.id));
const MAX_LEADERBOARD_SCORE = 1000000;
const LEADERBOARD_LIMIT = 15;
const pendingWrites = new Set();

async function waitForPendingWrites() {
  if (pendingWrites.size === 0) {
    return;
  }
  await Promise.allSettled(Array.from(pendingWrites));
}

// 초등학생 안전 보호를 위한 기본 금칙어 및 개인정보 패턴 차단 목적
const BLOCKED_WORDS = [
  '시발',
  '씨발',
  '병신',
  '개새끼',
  '미친놈',
  '존나',
  'fuck',
  'shit',
  'bitch',
  'asshole'
];

export function validateNickname(rawNickname) {
  if (typeof rawNickname !== 'string') {
    return { valid: false, nickname: '', reason: 'length' };
  }

  const trimmed = rawNickname.trim();
  if (trimmed.length < 2 || trimmed.length > 10) {
    return { valid: false, nickname: '', reason: 'length' };
  }

  if (/[<>]/.test(trimmed)) {
    return { valid: false, nickname: '', reason: 'unsafe' };
  }

  if (/@/.test(trimmed) || /\d{7,}/.test(trimmed.replace(/[-\s]/g, '')) || /01\d[-.\s]?\d{3,4}/.test(trimmed)) {
    return { valid: false, nickname: '', reason: 'privacy' };
  }

  const normalizedLower = trimmed.toLowerCase().replace(/\s+/g, '');
  for (let wordIndex = 0; wordIndex < BLOCKED_WORDS.length; wordIndex += 1) {
    if (normalizedLower.includes(BLOCKED_WORDS[wordIndex])) {
      return { valid: false, nickname: '', reason: 'profanity' };
    }
  }

  return { valid: true, nickname: trimmed, reason: null };
}

export function normalizeLeaderboardEntry(userId, rawData) {
  const safeNickname =
    typeof rawData?.nickname === 'string' && rawData.nickname.trim().length >= 2
      ? rawData.nickname.trim().slice(0, 10)
      : 'BomBom';
  const safeScore =
    Number.isFinite(rawData?.score) && rawData.score >= 0
      ? Math.min(MAX_LEADERBOARD_SCORE, Math.floor(rawData.score))
      : 0;
  const safeSkinId = VALID_SKIN_IDENTIFIERS.has(rawData?.skinId)
    ? rawData.skinId
    : 'bombom';

  return {
    userId: String(userId || ''),
    nickname: safeNickname,
    score: safeScore,
    skinId: safeSkinId
  };
}

// Enterprise Pipelines 기반 상위 15명 및 본인 순위 조회 목적
export async function fetchLeaderboard(gameType) {
  if (!VALID_GAME_TYPES.has(gameType)) {
    return { entries: [], currentUserId: null, myEntry: null, offline: false };
  }

  // 별명 저장·게임 종료 직후 순위표를 열어도 직전 업로드 완료를 보장 목적
  await waitForPendingWrites();

  const db = getBomBomFirestore();
  let currentUserId = null;
  try {
    const user = await ensureAnonymousUser();
    currentUserId = user?.uid || null;
  } catch (authError) {
    console.warn('Anonymous auth skipped during leaderboard fetch:', authError);
  }

  const snapshot = await execute(
    db
      .pipeline()
      .collection(`leaderboards/${gameType}/scores`)
      .sort(field('score').descending())
      .limit(LEADERBOARD_LIMIT)
  );

  const entries = snapshot.results.map((resultItem) =>
    normalizeLeaderboardEntry(resultItem.id || resultItem.ref?.id, resultItem.data())
  );

  let myEntry = entries.find((entry) => entry.userId === currentUserId) || null;
  if (!myEntry && currentUserId) {
    try {
      const myDocSnap = await getDoc(doc(db, 'leaderboards', gameType, 'scores', currentUserId));
      if (myDocSnap.exists()) {
        myEntry = normalizeLeaderboardEntry(currentUserId, myDocSnap.data());
      }
    } catch (docError) {
      console.warn('Could not read own leaderboard document:', docError);
    }
  }

  return {
    entries,
    currentUserId,
    myEntry,
    offline: false
  };
}

// 최고 점수 단조 증가 규칙 준수 하에 랭킹 등록·갱신 목적
export function submitLeaderboardScore({ gameType, nickname, score, skinId }) {
  const syncPromise = performSubmitLeaderboardScore({
    gameType,
    nickname,
    score,
    skinId
  });
  pendingWrites.add(syncPromise);
  syncPromise.finally(() => {
    pendingWrites.delete(syncPromise);
  });
  return syncPromise;
}

async function performSubmitLeaderboardScore({ gameType, nickname, score, skinId }) {
  if (!VALID_GAME_TYPES.has(gameType)) {
    return { ok: false, reason: 'invalidGame' };
  }

  const check = validateNickname(nickname);
  if (!check.valid) {
    return { ok: false, reason: check.reason };
  }

  const safeScore = Number.isFinite(score) && score >= 0
    ? Math.min(MAX_LEADERBOARD_SCORE, Math.floor(score))
    : 0;
  const safeSkinId = VALID_SKIN_IDENTIFIERS.has(skinId) ? skinId : 'bombom';

  const user = await ensureAnonymousUser();
  const db = getBomBomFirestore();
  const entryReference = doc(db, 'leaderboards', gameType, 'scores', user.uid);

  let existingScore = -1;
  let existingNickname = '';
  let existingSkinId = '';
  try {
    const existingSnap = await getDoc(entryReference);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      existingScore = Number.isFinite(existingData?.score) ? Math.floor(existingData.score) : 0;
      existingNickname = existingData?.nickname || '';
      existingSkinId = existingData?.skinId || '';
    }
  } catch (readError) {
    console.warn('Existing score check failed before write:', readError);
  }

  const targetScore = Math.max(existingScore, safeScore);
  if (
    existingScore >= 0 &&
    targetScore === existingScore &&
    existingNickname === check.nickname &&
    existingSkinId === safeSkinId
  ) {
    return { ok: true, skipped: true, score: targetScore, userId: user.uid };
  }

  await setDoc(entryReference, {
    nickname: check.nickname,
    score: targetScore,
    skinId: safeSkinId,
    updatedAt: serverTimestamp()
  });

  return { ok: true, skipped: false, score: targetScore, userId: user.uid };
}
