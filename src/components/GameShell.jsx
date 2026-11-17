// 게임 HUD, 캔버스 엔진 마운트, 시작·일시정지·게임오버 모달을 관리하는 게임 셸 컴포넌트

import React, { useEffect, useRef, useState } from 'react';
import {
  DODGE_HEIGHT,
  DODGE_WIDTH,
  mountDodgeRunner
} from '../games/dodgeRunner.js';
import { drawSkinMascot } from '../games/skins.js';
import {
  STACK_HEIGHT,
  STACK_WIDTH,
  mountTowerStack
} from '../games/towerStack.js';
import { playSoundEffect } from '../utils/sound.js';

const INITIAL_HUD_STATE = {
  score: 0,
  starsEarned: 0,
  combo: 0,
  floor: 0,
  shieldActive: false,
  magnetActive: false,
  feverActive: false
};

export function GameShell({
  gameType,
  equippedSkinId,
  highScore,
  nickname,
  muted,
  text,
  onGameOverPersist,
  onBackToLobby,
  onOpenNicknameDialog
}) {
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [runCounter, setRunCounter] = useState(0);
  const [hud, setHud] = useState(INITIAL_HUD_STATE);
  const [gameOverResult, setGameOverResult] = useState(null);

  const canvasRef = useRef(null);
  const dialogRef = useRef(null);
  const pausedRef = useRef(false);
  const mutedRef = useRef(muted);
  const highScoreRef = useRef(highScore);
  const isGameOverRef = useRef(false);
  const textRef = useRef(text);
  const gameOverPersistRef = useRef(onGameOverPersist);
  const hasReportedGameOverRef = useRef(false);
  const closingActionRef = useRef(null);

  pausedRef.current = paused;
  mutedRef.current = muted;
  highScoreRef.current = highScore;
  isGameOverRef.current = gameOverResult !== null;
  textRef.current = text;
  gameOverPersistRef.current = onGameOverPersist;

  const isDodge = gameType === 'dodge';
  const canvasWidth = isDodge ? DODGE_WIDTH : STACK_WIDTH;
  const canvasHeight = isDodge ? DODGE_HEIGHT : STACK_HEIGHT;
  const gameTitle = isDodge ? text.dodgeTitle : text.stackTitle;
  const gameHint = isDodge ? text.dodgeHint : text.stackHint;

  // 시작 전 대기 화면용 캔버스 배경 및 마스코트 미리보기 렌더링 목적
  useEffect(() => {
    if (started) {
      return undefined;
    }
    const canvasElement = canvasRef.current;
    if (!canvasElement) {
      return undefined;
    }
    const context = canvasElement.getContext('2d');
    if (!context) {
      return undefined;
    }

    const gradient = context.createLinearGradient(0, 0, 0, canvasHeight);
    if (isDodge) {
      gradient.addColorStop(0, '#160F29');
      gradient.addColorStop(1, '#261848');
    } else {
      gradient.addColorStop(0, '#7EC8FF');
      gradient.addColorStop(1, '#DFF6E8');
    }
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvasWidth, canvasHeight);
    drawSkinMascot(
      context,
      equippedSkinId,
      canvasWidth / 2,
      canvasHeight * 0.62,
      24,
      0
    );
    return undefined;
  }, [started, isDodge, canvasWidth, canvasHeight, equippedSkinId]);

  // 게임 시작 시 캔버스 엔진 마운트 및 재시작 시 깨끗한 인스턴스 교체 목적
  useEffect(() => {
    if (!started) {
      return undefined;
    }
    const canvasElement = canvasRef.current;
    if (!canvasElement) {
      return undefined;
    }

    hasReportedGameOverRef.current = false;
    const isDodgeRun = gameType === 'dodge';

    function handleSound(eventName) {
      playSoundEffect(eventName, mutedRef.current);
    }

    function handleHudUpdate(nextHud) {
      setHud({
        score: nextHud.score || 0,
        starsEarned: nextHud.starsEarned || 0,
        combo: nextHud.combo || 0,
        floor: nextHud.floor || 0,
        shieldActive: Boolean(nextHud.shieldActive),
        magnetActive: Boolean(nextHud.magnetActive),
        feverActive: Boolean(nextHud.feverActive)
      });
    }

    function handleGameOver(result) {
      if (hasReportedGameOverRef.current) {
        return;
      }
      hasReportedGameOverRef.current = true;
      const previousBest = highScoreRef.current || 0;
      const isNewRecord = (result.score || 0) > previousBest;
      let rewardSummary = {
        gainedSkinStars: Math.floor((result.starsEarned || 0) / 10),
        nextFragments: (result.starsEarned || 0) % 10
      };
      if (typeof gameOverPersistRef.current === 'function') {
        const persisted = gameOverPersistRef.current(gameType, result);
        if (persisted && typeof persisted.gainedSkinStars === 'number') {
          rewardSummary = persisted;
        }
      }
      setGameOverResult({
        score: result.score || 0,
        starsEarned: result.starsEarned || 0,
        gainedSkinStars: rewardSummary.gainedSkinStars,
        nextFragments: rewardSummary.nextFragments,
        floor: typeof result.floor === 'number' ? result.floor : null,
        isNewRecord
      });
    }

    const commonOptions = {
      skinId: equippedSkinId,
      onHudUpdate: handleHudUpdate,
      onGameOver: handleGameOver,
      onSound: handleSound,
      isPaused: () => pausedRef.current || isGameOverRef.current
    };

    const mountedGame = isDodgeRun
      ? mountDodgeRunner(canvasElement, {
          ...commonOptions,
          feverText: textRef.current.feverBanner
        })
      : mountTowerStack(canvasElement, {
          ...commonOptions,
          perfectText: textRef.current.perfectText,
          bonusText: textRef.current.bonusBanner
        });

    return () => {
      mountedGame.destroy();
    };
  }, [gameType, equippedSkinId, started, runCounter]);

  // 시작 오버레이 키보드 단축키(방향키·스페이스·엔터) 진입 지원 목적
  useEffect(() => {
    if (started) {
      return undefined;
    }

    function handleStartKeyDown(event) {
      const targetElement = event.target;
      // 포커스된 버튼·링크·입력 컨트롤의 기본 키보드 활성화 보존 목적
      if (
        targetElement instanceof Element &&
        targetElement.closest('button, a, input, select')
      ) {
        return;
      }

      const isTriggerKey =
        event.key === 'ArrowLeft' ||
        event.key === 'ArrowRight' ||
        event.code === 'Space' ||
        event.key === ' ' ||
        event.key === 'Enter';
      if (!isTriggerKey) {
        return;
      }

      event.preventDefault();
      setStarted(true);
    }

    window.addEventListener('keydown', handleStartKeyDown);
    return () => {
      window.removeEventListener('keydown', handleStartKeyDown);
    };
  }, [started]);

  // 게임 오버 결과 상태에 맞춘 네이티브 <dialog> showModal/close 동기화 목적
  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) {
      return;
    }
    if (gameOverResult && !dialogElement.open) {
      closingActionRef.current = null;
      dialogElement.showModal();
    } else if (!gameOverResult && dialogElement.open) {
      dialogElement.close();
    }
  }, [gameOverResult]);

  function handleStartGame() {
    setStarted(true);
  }

  function handleTogglePause() {
    if (!started || gameOverResult) {
      return;
    }
    setPaused((previousPaused) => !previousPaused);
  }

  function handlePlayAgain() {
    closingActionRef.current = 'again';
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
    hasReportedGameOverRef.current = false;
    setGameOverResult(null);
    setPaused(false);
    setHud(INITIAL_HUD_STATE);
    setStarted(true);
    setRunCounter((previousCounter) => previousCounter + 1);
  }

  function handleBackFromDialog() {
    closingActionRef.current = 'lobby';
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
    onBackToLobby();
  }

  // Esc 키 등으로 네이티브 모달이 닫혔을 때 빈 캔버스 고착 방지 목적
  function handleDialogClose() {
    const dialogElement = dialogRef.current;
    if (dialogElement) {
      dialogElement.returnValue = '';
    }
    const action = closingActionRef.current;
    closingActionRef.current = null;
    if (!action && gameOverResult) {
      onBackToLobby();
    }
  }

  const encouragementMessage =
    gameOverResult &&
    (gameOverResult.isNewRecord || gameOverResult.starsEarned >= 8)
      ? text.encouragementGreat
      : text.encouragementGood;

  return (
    <main className="game-main" data-game-type={gameType}>
      <div className="game-title-row">
        <h1 className="game-title">{gameTitle}</h1>
        {!isDodge && (
          <span className="game-floor-chip">
            {text.floorLabel} {hud.floor}
          </span>
        )}
      </div>

      <div className="hud-bar">
        <div className="hud-metrics">
          <div className="hud-stat">
            <span className="hud-stat-label">{text.scoreLabel}</span>
            <span className="hud-stat-value">{hud.score}</span>
          </div>
          <div className="hud-stat hud-stat-stars">
            <span aria-hidden="true">★</span>
            <span className="hud-stat-value">{hud.starsEarned}</span>
          </div>
          {hud.combo > 0 && (
            <span className="hud-pill hud-combo">
              {hud.combo} {text.comboLabel}
            </span>
          )}
          {hud.shieldActive && (
            <span className="hud-pill hud-shield">{text.shieldActive}</span>
          )}
          {hud.magnetActive && (
            <span className="hud-pill hud-magnet">{text.magnetActive}</span>
          )}
          {hud.feverActive && (
            <span className="hud-pill hud-fever">{text.feverActive}</span>
          )}
        </div>

        <button
          type="button"
          className="hud-pause-btn"
          onClick={handleTogglePause}
          disabled={!started || gameOverResult !== null}
        >
          {paused ? text.resume : text.pause}
        </button>
      </div>

      <div className="canvas-stage">
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="game-canvas"
        />

        {!started && (
          <div className="canvas-overlay start-overlay" onClick={handleStartGame}>
            <div className="overlay-card">
              <h2 className="overlay-title">{gameTitle}</h2>
              <p className="overlay-hint">{gameHint}</p>
              <p className="overlay-tap-hint">{text.startTapHint}</p>
              <button
                type="button"
                className="primary-btn start-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  handleStartGame();
                }}
              >
                {text.playNow}
              </button>
            </div>
          </div>
        )}

        {started && paused && !gameOverResult && (
          <div className="canvas-overlay pause-overlay">
            <div className="overlay-card">
              <h2 className="overlay-title">{text.pausedTitle}</h2>
              <button
                type="button"
                className="primary-btn resume-btn"
                onClick={handleTogglePause}
              >
                {text.resume}
              </button>
            </div>
          </div>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className="result-dialog"
        aria-labelledby="result-dialog-title"
        onClose={handleDialogClose}
      >
        <h2 id="result-dialog-title" className="result-title">
          {text.gameOverTitle}
        </h2>
        {gameOverResult && (
          <>
            {gameOverResult.isNewRecord && (
              <div className="new-record-badge">
                <span aria-hidden="true">🏆</span>
                <span>{text.newRecordBadge}</span>
              </div>
            )}

            <div className="result-stats">
              <div className="result-stat-row">
                <span className="result-stat-label">{text.scoreLabel}</span>
                <strong className="result-stat-value">
                  {gameOverResult.score}
                </strong>
              </div>
              {!isDodge && typeof gameOverResult.floor === 'number' && (
                <div className="result-stat-row">
                  <span className="result-stat-label">{text.floorLabel}</span>
                  <strong className="result-stat-value">
                    {gameOverResult.floor}
                  </strong>
                </div>
              )}
              <div className="result-stat-row">
                <span className="result-stat-label">
                  {text.miniStarsLabel}
                </span>
                <strong className="result-stat-value">
                  {gameOverResult.starsEarned}{' '}
                  <span aria-hidden="true">★</span>
                </strong>
              </div>
              <div className="result-stat-row result-stat-stars">
                <span className="result-stat-label">
                  {text.earnedGoldStarsLabel}
                </span>
                <strong className="result-stat-value">
                  +{gameOverResult.gainedSkinStars}{' '}
                  <span aria-hidden="true">🌟</span>
                  <span className="result-fragments-tag">
                    {' '}({text.fragmentsProgressLabel} {gameOverResult.nextFragments}/10)
                  </span>
                </strong>
              </div>
            </div>

            <p className="result-encouragement">{encouragementMessage}</p>

            <div className="result-ranking-note">
              {nickname ? (
                <p className="ranking-synced-text">
                  <span aria-hidden="true">🏆</span> {nickname} · {text.leaderboardSynced}
                </p>
              ) : (
                <div className="ranking-prompt-box">
                  <p className="ranking-prompt-text">{text.leaderboardRegisterPrompt}</p>
                  <button
                    type="button"
                    className="nickname-pill-btn"
                    onClick={onOpenNicknameDialog}
                  >
                    <span aria-hidden="true">🏷️</span>
                    <span>{text.nicknameSetBtn}</span>
                  </button>
                </div>
              )}
            </div>

            <div className="result-actions">
              <button
                type="button"
                className="primary-btn result-primary-btn"
                autoFocus
                onClick={handlePlayAgain}
              >
                {text.playAgain}
              </button>
              <button
                type="button"
                className="secondary-btn result-secondary-btn"
                onClick={handleBackFromDialog}
              >
                {text.backToLobby}
              </button>
            </div>
          </>
        )}
      </dialog>
    </main>
  );
}
