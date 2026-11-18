// 별명+4자리 PIN 해시 키 기반 클라우드 백업·복구 모듈

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ensureAnonymousUser, getBomBomFirestore } from './firebase.js';
import { validateNickname } from './leaderboard.js';
import { normalizeState, SHA256_HEX_PATTERN } from './storage.js';

const CLAIM_KEY_PREFIX = 'bombom-claim-v1:';
const PROFILE_KEY_PREFIX = 'bombom-profile-v1:';
const MAX_BACKUP_NUMERIC_VALUE = 1000000;
const PIN_PATTERN = /^\d{4}$/;
const MAX_RESTORE_FAILURES = 5;
const RESTORE_COOLDOWN_MS = 30000;

let consecutiveRestoreFailures = 0;
let restoreLockedUntilMs = 0;
const syncQueueByKey = new Map();

export function validatePin(rawPin) {
  if (typeof rawPin !== 'string') {
    return { valid: false, pin: '' };
  }
  const trimmed = rawPin.trim();
  if (!PIN_PATTERN.test(trimmed)) {
    return { valid: false, pin: '' };
  }
  return { valid: true, pin: trimmed };
}

export function normalizeNicknameKey(rawNickname) {
  return typeof rawNickname === 'string'
    ? rawNickname.trim().toLowerCase()
    : '';
}

async function digestSha256Hex(rawInput) {
  const bytes = new TextEncoder().encode(rawInput);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byteValue) => byteValue.toString(16).padStart(2, '0'))
    .join('');
}

// Firestore 문서 ID 제약 및 평문 별명 경로 노출 방지용 해시 키 생성 목적
export function deriveClaimKey(nickname) {
  return digestSha256Hex(`${CLAIM_KEY_PREFIX}${normalizeNicknameKey(nickname)}`);
}

// 평문 PIN 비저장 원칙 유지를 위한 단방향 프로필 백업 키 파생 목적
export function deriveProfileKey(nickname, pin) {
  const normalizedPin = typeof pin === 'string' ? pin.trim() : '';
  return digestSha256Hex(
    `${PROFILE_KEY_PREFIX}${normalizeNicknameKey(nickname)}:${normalizedPin}`
  );
}

export function serializeProfilePayload(rawState) {
  const normalized = normalizeState(rawState);
  return {
    nickname: normalized.nickname,
    stars: Math.min(MAX_BACKUP_NUMERIC_VALUE, normalized.stars),
    starFragments: normalized.starFragments,
    highScores: {
      dodge: Math.min(MAX_BACKUP_NUMERIC_VALUE, normalized.highScores.dodge),
      stack: Math.min(MAX_BACKUP_NUMERIC_VALUE, normalized.highScores.stack),
      merge: Math.min(MAX_BACKUP_NUMERIC_VALUE, normalized.highScores.merge)
    },
    unlockedSkins: normalized.unlockedSkins,
    equippedSkin: normalized.equippedSkin
  };
}

export function deserializeProfileBackup(rawData, profileKey) {
  return normalizeState({
    ...rawData,
    backupKey: profileKey
  });
}

export function getRestoreCooldownSeconds(nowMs = Date.now()) {
  if (restoreLockedUntilMs <= nowMs) {
    return 0;
  }
  return Math.ceil((restoreLockedUntilMs - nowMs) / 1000);
}

export function clearRestoreFailures() {
  consecutiveRestoreFailures = 0;
  restoreLockedUntilMs = 0;
}

function recordRestoreFailure(nowMs = Date.now()) {
  consecutiveRestoreFailures += 1;
  if (consecutiveRestoreFailures >= MAX_RESTORE_FAILURES) {
    restoreLockedUntilMs = nowMs + RESTORE_COOLDOWN_MS;
    consecutiveRestoreFailures = 0;
    return Math.ceil(RESTORE_COOLDOWN_MS / 1000);
  }
  return 0;
}

// 별명 중복 선점 확인 후 PIN 해시 키 기반 클라우드 백업 생성 목적
export async function registerNicknameWithBackup({ currentState, nickname, pin }) {
  const nicknameCheck = validateNickname(nickname);
  if (!nicknameCheck.valid) {
    return { ok: false, reason: nicknameCheck.reason };
  }

  const pinCheck = validatePin(pin);
  if (!pinCheck.valid) {
    return { ok: false, reason: 'pin' };
  }

  const user = await ensureAnonymousUser();
  const database = getBomBomFirestore();
  const claimKey = await deriveClaimKey(nicknameCheck.nickname);
  const profileKey = await deriveProfileKey(nicknameCheck.nickname, pinCheck.pin);

  const claimReference = doc(database, 'nicknameClaims', claimKey);
  const claimSnapshot = await getDoc(claimReference);

  const isSameActiveNickname = Boolean(
    currentState?.backupKey &&
    normalizeNicknameKey(currentState.nickname) === normalizeNicknameKey(nicknameCheck.nickname)
  );

  if (claimSnapshot.exists()) {
    const claimOwnerUid = claimSnapshot.data()?.ownerUid;
    if (!isSameActiveNickname && claimOwnerUid !== user.uid) {
      return { ok: false, reason: 'taken' };
    }
  } else {
    await setDoc(claimReference, {
      ownerUid: user.uid,
      updatedAt: serverTimestamp()
    });
  }

  const profileReference = doc(database, 'profiles', profileKey);
  const payload = serializeProfilePayload({
    ...currentState,
    nickname: nicknameCheck.nickname
  });

  await setDoc(profileReference, {
    ...payload,
    updatedAt: serverTimestamp()
  });

  return {
    ok: true,
    nickname: nicknameCheck.nickname,
    backupKey: profileKey
  };
}

// 연속 게임 종료·스킨 변경 시 구버전 상태 역전 덮어쓰기 방지를 위한 키별 직렬 동기화 목적
export function syncProfileBackup(backupKey, state) {
  if (!SHA256_HEX_PATTERN.test(backupKey || '') || !state?.nickname) {
    return Promise.resolve({ ok: false, skipped: true });
  }

  const previousPromise = syncQueueByKey.get(backupKey) || Promise.resolve();
  const payload = serializeProfilePayload(state);

  const nextPromise = previousPromise
    .catch(() => undefined)
    .then(async () => {
      await ensureAnonymousUser();
      const database = getBomBomFirestore();
      const profileReference = doc(database, 'profiles', backupKey);
      await setDoc(profileReference, {
        ...payload,
        updatedAt: serverTimestamp()
      });
      return { ok: true, skipped: false };
    });

  syncQueueByKey.set(backupKey, nextPromise);
  nextPromise.finally(() => {
    if (syncQueueByKey.get(backupKey) === nextPromise) {
      syncQueueByKey.delete(backupKey);
    }
  });

  return nextPromise;
}

export async function lookupProfileBackup({ nickname, pin }) {
  const retryAfterSeconds = getRestoreCooldownSeconds();
  if (retryAfterSeconds > 0) {
    return { ok: false, reason: 'cooldown', retryAfterSeconds };
  }

  const nicknameCheck = validateNickname(nickname);
  if (!nicknameCheck.valid) {
    return { ok: false, reason: nicknameCheck.reason };
  }

  const pinCheck = validatePin(pin);
  if (!pinCheck.valid) {
    return { ok: false, reason: 'pin' };
  }

  await ensureAnonymousUser();
  const database = getBomBomFirestore();
  const profileKey = await deriveProfileKey(nicknameCheck.nickname, pinCheck.pin);
  const profileReference = doc(database, 'profiles', profileKey);
  const profileSnapshot = await getDoc(profileReference);

  if (!profileSnapshot.exists()) {
    const cooldownSeconds = recordRestoreFailure();
    return { ok: false, reason: 'notFound', cooldownSeconds };
  }

  clearRestoreFailures();
  return {
    ok: true,
    restoredState: deserializeProfileBackup(profileSnapshot.data(), profileKey)
  };
}
