// 마스코트 미리보기, 2종 미니게임 카드, 스킨 도감 진입을 제공하는 로비 컴포넌트

import React, { useEffect, useRef } from 'react';
import { drawSkinMascot, getSkinById } from '../games/skins.js';

export function Lobby({
  equippedSkinId,
  activeLang,
  highScores,
  unlockedCount,
  totalSkins,
  onSelectGame,
  onOpenShop,
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
          <div className="equipped-pill">
            <span aria-hidden="true">{equippedSkin.badge}</span>
            <span>{equippedSkin.name[activeLang] || equippedSkin.name.en}</span>
          </div>
        </div>
      </section>

      <div className="lobby-games">
        <article className="game-card game-card-dodge">
          <div className="game-card-top">
            <div className="game-card-heading">
              <span className="game-emoji" aria-hidden="true">
                🌠
              </span>
              <h2 className="game-card-title">{text.dodgeTitle}</h2>
            </div>
            <span className="best-badge">
              {text.bestScore} {highScores.dodge}
            </span>
          </div>
          <p className="game-card-desc">{text.dodgeDesc}</p>
          <p className="game-card-control">{text.dodgeControl}</p>
          <button
            type="button"
            className="primary-btn play-btn"
            onClick={() => onSelectGame('dodge')}
          >
            {text.playNow}
          </button>
        </article>

        <article className="game-card game-card-stack">
          <div className="game-card-top">
            <div className="game-card-heading">
              <span className="game-emoji" aria-hidden="true">
                🏰
              </span>
              <h2 className="game-card-title">{text.stackTitle}</h2>
            </div>
            <span className="best-badge">
              {text.bestScore} {highScores.stack}
            </span>
          </div>
          <p className="game-card-desc">{text.stackDesc}</p>
          <p className="game-card-control">{text.stackControl}</p>
          <button
            type="button"
            className="primary-btn play-btn"
            onClick={() => onSelectGame('stack')}
          >
            {text.playNow}
          </button>
        </article>
      </div>

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
    </main>
  );
}
