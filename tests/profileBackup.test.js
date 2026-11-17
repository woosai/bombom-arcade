import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockDoc = vi.fn((_db, ...segments) => ({ path: segments.join('/') }));
const mockServerTimestamp = vi.fn(() => 'SERVER_TIME');
const mockEnsureAnonymousUser = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args) => mockDoc(...args),
  getDoc: (...args) => mockGetDoc(...args),
  setDoc: (...args) => mockSetDoc(...args),
  serverTimestamp: () => mockServerTimestamp()
}));

vi.mock('../src/utils/firebase.js', () => ({
  ensureAnonymousUser: () => mockEnsureAnonymousUser(),
  getBomBomFirestore: () => ({ id: 'mock-db' })
}));

import {
  clearRestoreFailures,
  deriveClaimKey,
  deriveProfileKey,
  deserializeProfileBackup,
  getRestoreCooldownSeconds,
  lookupProfileBackup,
  normalizeNicknameKey,
  registerNicknameWithBackup,
  serializeProfilePayload,
  syncProfileBackup,
  validatePin
} from '../src/utils/profileBackup.js';

describe('profileBackup pure helpers', () => {
  it('validates 4-digit numeric PIN strictly', () => {
    expect(validatePin('0429')).toEqual({ valid: true, pin: '0429' });
    expect(validatePin(' 1234 ')).toEqual({ valid: true, pin: '1234' });
    expect(validatePin('123')).toEqual({ valid: false, pin: '' });
    expect(validatePin('12345')).toEqual({ valid: false, pin: '' });
    expect(validatePin('12ab')).toEqual({ valid: false, pin: '' });
    expect(validatePin(1234)).toEqual({ valid: false, pin: '' });
  });

  it('derives deterministic SHA-256 claim and profile keys without raw PIN', async () => {
    expect(normalizeNicknameKey('  BomBom  ')).toBe('bombom');

    const claimUpper = await deriveClaimKey('BomBom');
    const claimLower = await deriveClaimKey('  bombom ');
    const profileKeyOne = await deriveProfileKey('BomBom', '1234');
    const profileKeyTwo = await deriveProfileKey('bombom', '1234');
    const profileKeyOtherPin = await deriveProfileKey('bombom', '9999');

    expect(claimUpper).toMatch(/^[0-9a-f]{64}$/);
    expect(claimUpper).toBe(claimLower);
    expect(profileKeyOne).toMatch(/^[0-9a-f]{64}$/);
    expect(profileKeyOne).toBe(profileKeyTwo);
    expect(profileKeyOne).not.toBe(claimUpper);
    expect(profileKeyOne).not.toBe(profileKeyOtherPin);
  });

  it('serializes and deserializes profile backups safely within Firestore limits', () => {
    const profileKey = 'f'.repeat(64);
    const payload = serializeProfilePayload({
      nickname: '봄봄스타',
      stars: 2000000,
      starFragments: 18,
      backupKey: profileKey,
      highScores: { dodge: 540, stack: 25 },
      unlockedSkins: ['bombom', 'rocket-cat', 'unknown'],
      equippedSkin: 'rocket-cat',
      settings: { lang: 'ko', muted: true }
    });

    expect(payload).toEqual({
      nickname: '봄봄스타',
      stars: 1000000,
      starFragments: 8,
      highScores: { dodge: 540, stack: 25 },
      unlockedSkins: ['bombom', 'rocket-cat'],
      equippedSkin: 'rocket-cat'
    });

    const restored = deserializeProfileBackup(payload, profileKey);
    expect(restored.backupKey).toBe(profileKey);
    expect(restored.nickname).toBe('봄봄스타');
    expect(restored.unlockedSkins).toEqual(['bombom', 'rocket-cat']);
    expect(restored.equippedSkin).toBe('rocket-cat');
  });
});

describe('profileBackup Firestore operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRestoreFailures();
    mockEnsureAnonymousUser.mockResolvedValue({ uid: 'uid-current' });
  });

  it('rejects duplicate nickname claim belonging to another uid', async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ownerUid: 'uid-other' })
    });

    const result = await registerNicknameWithBackup({
      currentState: { nickname: '', backupKey: '' },
      nickname: '봄봄공주',
      pin: '1234'
    });

    expect(result).toEqual({ ok: false, reason: 'taken' });
    expect(mockSetDoc).not.toHaveBeenCalled();
  });

  it('allows changing PIN on the same active backed-up nickname without rewriting claim', async () => {
    const existingBackupKey = 'a'.repeat(64);
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ ownerUid: 'uid-original-pwa' })
    });
    mockSetDoc.mockResolvedValue(undefined);

    const result = await registerNicknameWithBackup({
      currentState: {
        nickname: '봄봄공주',
        backupKey: existingBackupKey,
        stars: 14,
        starFragments: 3,
        highScores: { dodge: 300, stack: 20 },
        unlockedSkins: ['bombom'],
        equippedSkin: 'bombom'
      },
      nickname: '봄봄공주',
      pin: '5678'
    });

    const expectedProfileKey = await deriveProfileKey('봄봄공주', '5678');
    expect(result).toEqual({
      ok: true,
      nickname: '봄봄공주',
      backupKey: expectedProfileKey
    });
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][0].path).toBe(`profiles/${expectedProfileKey}`);
  });

  it('enforces cooldown after 5 consecutive failed restore lookups and clears on success', async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const failResult = await lookupProfileBackup({ nickname: '봄봄공주', pin: '0000' });
      expect(failResult).toEqual({ ok: false, reason: 'notFound', cooldownSeconds: 0 });
    }

    const fifthResult = await lookupProfileBackup({ nickname: '봄봄공주', pin: '0000' });
    expect(fifthResult.ok).toBe(false);
    expect(fifthResult.reason).toBe('notFound');
    expect(fifthResult.cooldownSeconds).toBeGreaterThan(0);
    expect(getRestoreCooldownSeconds()).toBeGreaterThan(0);

    const blockedResult = await lookupProfileBackup({ nickname: '봄봄공주', pin: '1234' });
    expect(blockedResult.ok).toBe(false);
    expect(blockedResult.reason).toBe('cooldown');
    expect(blockedResult.retryAfterSeconds).toBeGreaterThan(0);

    clearRestoreFailures();
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({
        nickname: '봄봄공주',
        stars: 25,
        starFragments: 4,
        highScores: { dodge: 600, stack: 40 },
        unlockedSkins: ['bombom', 'strawberry-slime'],
        equippedSkin: 'strawberry-slime'
      })
    });

    const successResult = await lookupProfileBackup({ nickname: '봄봄공주', pin: '1234' });
    expect(successResult.ok).toBe(true);
    expect(successResult.restoredState.stars).toBe(25);
    expect(successResult.restoredState.equippedSkin).toBe('strawberry-slime');
    expect(getRestoreCooldownSeconds()).toBe(0);
  });

  it('skips sync when backupKey is empty and writes payload when valid', async () => {
    await syncProfileBackup('', { nickname: '봄봄' });
    expect(mockSetDoc).not.toHaveBeenCalled();

    const validKey = 'b'.repeat(64);
    mockSetDoc.mockResolvedValueOnce(undefined);
    await syncProfileBackup(validKey, {
      nickname: '봄봄',
      stars: 10,
      starFragments: 2,
      highScores: { dodge: 100, stack: 10 },
      unlockedSkins: ['bombom'],
      equippedSkin: 'bombom'
    });

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc.mock.calls[0][0].path).toBe(`profiles/${validKey}`);
  });
});
