import { describe, expect, it, vi } from 'vitest';
import {
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  buildShareCardSummary,
  renderShareCardToCanvas,
  shareOrDownloadCard
} from '../src/utils/shareCard.js';
import { translations } from '../src/i18n/translations.js';

describe('shareCard summary and canvas renderer', () => {
  it('computes player rank, best score, and slices top 5 entries', () => {
    const entries = [
      { userId: 'u1', nickname: '다람이', score: 500, skinId: 'rocket-cat' },
      { userId: 'u2', nickname: '봄봄', score: 420, skinId: 'bombom' },
      { userId: 'u3', nickname: '토끼', score: 310, skinId: 'ribbon-bunny' },
      { userId: 'u4', nickname: '구름', score: 200, skinId: 'rainbow-cloud' },
      { userId: 'u5', nickname: '유니콘', score: 150, skinId: 'gold-unicorn' },
      { userId: 'u6', nickname: '슬라임', score: 90, skinId: 'strawberry-slime' }
    ];

    const summary = buildShareCardSummary({
      gameType: 'dodge',
      nickname: '봄봄',
      equippedSkinId: 'bombom',
      entries,
      currentUserId: 'u2',
      myEntry: entries[1],
      localBest: 390
    });

    expect(summary.myRank).toBe(2);
    expect(summary.myScore).toBe(420);
    expect(summary.myName).toBe('봄봄');
    expect(summary.topEntries).toHaveLength(5);
    expect(summary.topEntries[4].userId).toBe('u5');
  });

  it('renders 720x900 share card on canvas without errors', () => {
    const mockContext = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      rect: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
    };
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockContext)
    };

    const summary = buildShareCardSummary({
      gameType: 'stack',
      nickname: '봄봄공주',
      equippedSkinId: 'gold-unicorn',
      entries: [
        { userId: 'u1', nickname: '봄봄공주', score: 340, skinId: 'gold-unicorn' }
      ],
      currentUserId: 'u1',
      myEntry: null,
      localBest: 340
    });

    renderShareCardToCanvas(mockCanvas, summary, translations.ko, 'ko');
    expect(mockCanvas.width).toBe(SHARE_CARD_WIDTH);
    expect(mockCanvas.height).toBe(SHARE_CARD_HEIGHT);
    expect(mockContext.fillText).toHaveBeenCalled();
  });
});

describe('shareOrDownloadCard delivery channels', () => {
  const sampleBlob = new Blob(['png-bytes'], { type: 'image/png' });

  it('uses Web Share API when file sharing is supported', async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const navigatorStub = {
      canShare: vi.fn(() => true),
      share: shareMock
    };

    const result = await shareOrDownloadCard({
      blob: sampleBlob,
      fileName: 'bombom-ranking.png',
      title: '봄봄 아케이드',
      shareText: '봄봄 아케이드 1등!',
      navigatorObject: navigatorStub
    });

    expect(result).toEqual({ method: 'share' });
    expect(shareMock).toHaveBeenCalledTimes(1);
  });

  it('treats user-aborted share sheet as cancelled without triggering download', async () => {
    const abortError = new Error('Share cancelled');
    abortError.name = 'AbortError';
    const navigatorStub = {
      canShare: vi.fn(() => true),
      share: vi.fn().mockRejectedValue(abortError)
    };

    const result = await shareOrDownloadCard({
      blob: sampleBlob,
      fileName: 'bombom-ranking.png',
      title: '봄봄 아케이드',
      shareText: '봄봄 아케이드 1등!',
      navigatorObject: navigatorStub
    });

    expect(result).toEqual({ method: 'cancelled' });
  });

  it('falls back to download when Web Share and clipboard are unavailable', async () => {
    const anchorStub = { href: '', download: '', click: vi.fn() };
    const documentStub = {
      createElement: vi.fn(() => anchorStub),
      body: { appendChild: vi.fn(), removeChild: vi.fn() }
    };
    const urlStub = {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn()
    };

    const result = await shareOrDownloadCard({
      blob: sampleBlob,
      fileName: 'bombom-ranking.png',
      title: '봄봄 아케이드',
      shareText: 'test',
      navigatorObject: {},
      documentObject: documentStub,
      urlObject: urlStub
    });

    expect(result).toEqual({ method: 'download' });
    expect(anchorStub.download).toBe('bombom-ranking.png');
    expect(anchorStub.click).toHaveBeenCalledTimes(1);
    expect(urlStub.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
