// 상단 내비게이션, 보유 별, 언어·사운드·큰 화면 전환 헤더 컴포넌트

import React from 'react';

export function Header({
  currentScreen,
  onBack,
  stars,
  onToggleLanguage,
  muted,
  onToggleMute,
  isFullTab,
  text
}) {
  // 확장 프로그램 환경 여부에 따른 새 탭 확대 URL 생성 목적
  function handleOpenFullTab() {
    const targetUrl =
      typeof chrome !== 'undefined' && chrome?.runtime?.getURL
        ? chrome.runtime.getURL('index.html?mode=full')
        : '?mode=full';
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <header className="arcade-header">
      <div className="header-left">
        {currentScreen !== 'lobby' && (
          <button
            type="button"
            className="header-btn header-back-btn"
            onClick={onBack}
          >
            <span aria-hidden="true">←</span>
            <span>{text.backToLobby}</span>
          </button>
        )}
        <span className="brand-badge">
          <span aria-hidden="true">⭐</span>
          <span>{text.brandShort}</span>
        </span>
      </div>

      <div className="header-right">
        <div className="star-chip" aria-label={`${text.starsLabel} ${stars}`}>
          <span className="star-chip-icon" aria-hidden="true">
            ★
          </span>
          <span className="star-chip-value">{stars}</span>
        </div>

        <button
          type="button"
          className="header-btn header-lang-btn"
          onClick={onToggleLanguage}
        >
          {text.langToggle}
        </button>

        <button
          type="button"
          className="header-btn header-icon-btn"
          onClick={onToggleMute}
          aria-pressed={muted}
          aria-label={muted ? text.soundOff : text.soundOn}
        >
          <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
        </button>

        {!isFullTab && (
          <button
            type="button"
            className="header-btn header-icon-btn"
            onClick={handleOpenFullTab}
            aria-label={text.openFullTab}
          >
            <span aria-hidden="true">⛶</span>
          </button>
        )}
      </div>
    </header>
  );
}
