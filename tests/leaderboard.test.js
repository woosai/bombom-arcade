import { describe, expect, it } from 'vitest';
import {
  deduplicateLeaderboardEntries,
  normalizeLeaderboardEntry,
  validateNickname
} from '../src/utils/leaderboard.js';

describe('validateNickname', () => {
  it('trims and accepts valid Korean and English nicknames (2..10 chars)', () => {
    expect(validateNickname('  봄봄공주  ')).toEqual({
      valid: true,
      nickname: '봄봄공주',
      reason: null
    });
    expect(validateNickname('BomBom01')).toEqual({
      valid: true,
      nickname: 'BomBom01',
      reason: null
    });
  });

  it('rejects too short, too long, or HTML tag nicknames', () => {
    expect(validateNickname('봄')).toEqual({
      valid: false,
      nickname: '',
      reason: 'length'
    });
    expect(validateNickname('열글자가넘는아주긴별명이야')).toEqual({
      valid: false,
      nickname: '',
      reason: 'length'
    });
    expect(validateNickname('<script>')).toEqual({
      valid: false,
      nickname: '',
      reason: 'unsafe'
    });
  });

  it('blocks personal info patterns (email/phone) and profanity', () => {
    expect(validateNickname('a@b.com').valid).toBe(false);
    expect(validateNickname('01012345678').valid).toBe(false);
    expect(validateNickname('010-1234').valid).toBe(false);
    expect(validateNickname('바보시발').valid).toBe(false);
    expect(validateNickname('fuckyou').valid).toBe(false);
  });
});

describe('normalizeLeaderboardEntry', () => {
  it('normalizes skinId, score, and nickname safely', () => {
    const entry = normalizeLeaderboardEntry('user-1', {
      nickname: '봄봄',
      score: 345.9,
      skinId: 'invalid-skin'
    });
    expect(entry).toEqual({
      userId: 'user-1',
      nickname: '봄봄',
      score: 345,
      skinId: 'bombom'
    });
  });
});

describe('deduplicateLeaderboardEntries', () => {
  it('keeps highest score per normalized nickname and prefers currentUserId on tie', () => {
    const entries = [
      { userId: 'old-pwa', nickname: 'BomBom', score: 500, skinId: 'bombom' },
      { userId: 'new-safari', nickname: 'bombom', score: 500, skinId: 'rocket-cat' },
      { userId: 'other-user', nickname: '스타', score: 400, skinId: 'bombom' },
      { userId: 'other-older', nickname: '스타 ', score: 300, skinId: 'bombom' }
    ];

    const deduplicated = deduplicateLeaderboardEntries(entries, 'new-safari', 15);
    expect(deduplicated).toEqual([
      { userId: 'new-safari', nickname: 'bombom', score: 500, skinId: 'rocket-cat' },
      { userId: 'other-user', nickname: '스타', score: 400, skinId: 'bombom' }
    ]);
  });

  it('respects leaderboard limit after deduplication', () => {
    const entries = Array.from({ length: 20 }, (_unused, index) => ({
      userId: `user-${index}`,
      nickname: `Player${index}`,
      score: 1000 - index,
      skinId: 'bombom'
    }));

    expect(deduplicateLeaderboardEntries(entries, null, 15)).toHaveLength(15);
  });
});
