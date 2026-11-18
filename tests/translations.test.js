import { describe, expect, it } from 'vitest';
import { resolveLanguage, translations } from '../src/i18n/translations.js';

describe('translations', () => {
  it('has identical keys for ko and en', () => {
    const koreanKeys = Object.keys(translations.ko).sort();
    const englishKeys = Object.keys(translations.en).sort();
    expect(koreanKeys).toEqual(englishKeys);
  });

  it('includes 봄봄 in ko and BomBom in en for brand text', () => {
    expect(translations.ko.brandShort).toBe('봄봄');
    expect(translations.en.brandShort).toBe('BomBom');
    expect(translations.ko.brandName).toContain('봄봄');
    expect(translations.en.brandName).toContain('BomBom');
  });

  it('contains all required keys across UI, HUD, and banners', () => {
    const requiredKeys = [
      'brandShort',
      'brandName',
      'tagline',
      'starsLabel',
      'soundOn',
      'soundOff',
      'openFullTab',
      'backToLobby',
      'skinShopTitle',
      'skinShopSub',
      'equipped',
      'equip',
      'unlockWithStars',
      'needMoreStars',
      'unlockedCount',
      'dodgeTitle',
      'dodgeDesc',
      'dodgeControl',
      'stackTitle',
      'stackDesc',
      'stackControl',
      'mergeTitle',
      'mergeDesc',
      'mergeControl',
      'nextOrbLabel',
      'playNow',
      'bestScore',
      'scoreLabel',
      'comboLabel',
      'floorLabel',
      'pause',
      'resume',
      'pausedTitle',
      'gameOverTitle',
      'newRecordBadge',
      'earnedStarsLabel',
      'encouragementGreat',
      'encouragementGood',
      'playAgain',
      'startTapHint',
      'dodgeHint',
      'stackHint',
      'mergeHint',
      'feverBanner',
      'bonusBanner',
      'perfectText',
      'shieldActive',
      'magnetActive',
      'feverActive',
      'langToggle'
    ];

    for (const requiredKey of requiredKeys) {
      expect(translations.ko).toHaveProperty(requiredKey);
      expect(translations.en).toHaveProperty(requiredKey);
      expect(typeof translations.ko[requiredKey]).toBe('string');
      expect(typeof translations.en[requiredKey]).toBe('string');
      expect(translations.ko[requiredKey].length).toBeGreaterThan(0);
      expect(translations.en[requiredKey].length).toBeGreaterThan(0);
    }
  });

  it('resolves language correctly for explicit settings and auto detection', () => {
    expect(resolveLanguage('auto', 'ko-KR')).toBe('ko');
    expect(resolveLanguage('auto', 'ko')).toBe('ko');
    expect(resolveLanguage('auto', 'en-US')).toBe('en');
    expect(resolveLanguage('auto', 'ja-JP')).toBe('en');
    expect(resolveLanguage('auto', '')).toBe('en');
    expect(resolveLanguage('auto', undefined)).toBe('en');
    expect(resolveLanguage('ko', 'en-US')).toBe('ko');
    expect(resolveLanguage('en', 'ko-KR')).toBe('en');
  });
});
