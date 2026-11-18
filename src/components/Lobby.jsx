// 마스코트 미리보기, 2종 미니게임 카드, 스킨 도감 진입을 제공하는 로비 컴포넌트

import React, { useEffect, useRef } from 'react';
import { drawSkinMascot, getSkinById } from '../games/skins.js';

export function Lobby({
  equippedSkinId,
  activeLang,
  nickname,
  highScores,
  unlockedCount,
  totalSkins,
  onSelectGame,
  onOpenShop,
  onOpenLeaderboard,
  onOpenNicknameDialog,
  onOpenRestoreDialog,
  installMode,
  onInstallClick,
  text
}) {
  const mascotCanvasRef = useRef(null);
  const equippedSkin = getSkinById(equippedSkinId);

  useEffect(() => {
    const canvasElement = mascotCanvasRef.current;
    if (!canvasElement) {
      return undefined;
    }
    const context = canvasElement.getContext('2d');
    if (!context) {
      return undefined;
    }

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      context.clearRect(0, 0, canvasElement.width, canvasElement.height);
      drawSkinMascot(context, equippedSkinId, 32, 35, 19, 0);
      return undefined;
    }

    let animationFrameId = 0;
    let startTimestamp = null;

    function renderFrame(timestamp) {
      if (startTimestamp === null) {
        startTimestamp = timestamp;
      }
      const elapsedSeconds = (timestamp - startTimestamp) / 1000;
      context.clearRect(0, 0, canvasElement.width, canvasElement.height);
      drawSkinMascot(context, equippedSkinId, 32, 35, 19, elapsedSeconds);
      animationFrameId = window.requestAnimationFrame(renderFrame);
    }

    animationFrameId = window.requestAnimationFrame(renderFrame);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [equippedSkinId]);

  return (
    <main className="lobby-main">
      <section className="lobby-hero" aria-labelledby="lobby-hero-title">
        <div className="lobby-mascot-frame">
          <canvas
            ref={mascotCanvasRef}
            width={64}
            height={64}
            className="lobby-mascot-canvas"
            aria-hidden="true"
          />
        </div>
        <div className="lobby-hero-copy">
          <h1 id="lobby-hero-title" className="lobby-title">
            {text.brandName}
          </h1>
          <p className="lobby-tagline">{text.tagline}</p>
          <div className="hero-chips">
            <div className="equipped-pill">
              <span aria-hidden="true">{equippedSkin.badge}</span>
              <span>{equippedSkin.name[activeLang] || equippedSkin.name.en}</span>
            </div>
            <button
              type="button"
              className="nickname-pill-btn"
              onClick={onOpenNicknameDialog}
            >
              <span aria-hidden="true">🏷️</span>
              <span>{nickname || text.nicknameSetBtn}</span>
            </button>
            <button
              type="button"
              className="nickname-pill-btn restore-pill-btn"
              onClick={onOpenRestoreDialog}
            >
              <span aria-hidden="true">☁️</span>
              <span>{text.restoreOpenBtn}</span>
            </button>
          </div>
        </div>
      </section>

      {installMode !== 'none' && (
        <button
          type="button"
          className="install-banner-btn"
          onClick={onInstallClick}
        >
          <span aria-hidden="true">📱</span>
          <span>{text.installAppBtn}</span>
        </button>
      )}

      <div className="lobby-games">
        {[
          {
            id: 'merge',
            emoji: '🫧',
            title: text.mergeTitle,
            desc: text.mergeDesc,
            control: text.mergeControl,
            cardClass: 'game-card-merge'
          },
          {
            id: 'dodge',
            emoji: '🌠',
            title: text.dodgeTitle,
            desc: text.dodgeDesc,
            control: text.dodgeControl,
            cardClass: 'game-card-dodge'
          },
          {
            id: 'stack',
            emoji: '🏰',
            title: text.stackTitle,
            desc: text.stackDesc,
            control: text.stackControl,
            cardClass: 'game-card-stack'
          }
        ].map((gameItem) => (
          <article key={gameItem.id} className={`game-card ${gameItem.cardClass}`}>
            <div className="game-card-top">
              <div className="game-card-heading">
                <span className="game-emoji" aria-hidden="true">
                  {gameItem.emoji}
                </span>
                <h2 className="game-card-title">{gameItem.title}</h2>
              </div>
              <span className="best-badge">
                {text.bestScore} {highScores[gameItem.id] || 0}
              </span>
            </div>
            <p className="game-card-desc">{gameItem.desc}</p>
            <p className="game-card-control">{gameItem.control}</p>
            <button
              type="button"
              className="primary-btn play-btn"
              onClick={() => onSelectGame(gameItem.id)}
            >
              {text.playNow}
            </button>
          </article>
        ))}
      </div>

      <div className="lobby-footer-actions">
        <button
          type="button"
          className="shop-entry-btn"
          onClick={onOpenShop}
        >
          <span className="shop-entry-label">
            <span aria-hidden="true">🎨</span>
            <span>{text.skinShopTitle}</span>
          </span>
          <span className="shop-count-badge">
            {unlockedCount}/{totalSkins}
          </span>
        </button>

        <button
          type="button"
          className="leaderboard-entry-btn"
          onClick={onOpenLeaderboard}
        >
          <span aria-hidden="true">🏆</span>
          <span>{text.leaderboardBtn}</span>
        </button>
      </div>
    </main>
  );
}
