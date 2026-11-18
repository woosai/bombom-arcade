// 별명+4자리 PIN 기반 클라우드 백업 조회·덮어쓰기 확인 네이티브 <dialog> 모달 컴포넌트

import React, { useEffect, useId, useRef, useState } from 'react';
import { SKINS } from '../games/skins.js';
import { validateNickname } from '../utils/leaderboard.js';
import { lookupProfileBackup, validatePin } from '../utils/profileBackup.js';
import { hasProgressToOverwrite } from '../utils/storage.js';

function resolveRestoreError(result, text) {
  switch (result.reason) {
    case 'unsafe':
      return text.nicknameErrUnsafe;
    case 'privacy':
      return text.nicknameErrPrivacy;
    case 'profanity':
      return text.nicknameErrProfanity;
    case 'length':
      return text.nicknameErrLength;
    case 'pin':
      return text.pinErrFormat;
    case 'cooldown':
      return text.restoreErrCooldown.replace(
        '{seconds}',
        String(result.retryAfterSeconds || 30)
      );
    default:
      return result.cooldownSeconds > 0
        ? text.restoreErrCooldown.replace('{seconds}', String(result.cooldownSeconds))
        : text.restoreErrNotFound;
  }
}

export function RestoreDialog({
  open,
  initialNickname,
  currentState,
  onRestore,
  onClose,
  text
}) {
  const dialogRef = useRef(null);
  const nicknameInputId = useId();
  const pinInputId = useId();
  const titleId = useId();
  const [draftNickname, setDraftNickname] = useState(initialNickname || '');
  const [draftPin, setDraftPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [pendingRestoredState, setPendingRestoredState] = useState(null);

  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) {
      return;
    }
    if (open && !dialogElement.open) {
      setDraftNickname(initialNickname || '');
      setDraftPin('');
      setErrorMessage('');
      setChecking(false);
      setPendingRestoredState(null);
      dialogElement.showModal();
    } else if (!open && dialogElement.open) {
      dialogElement.close();
    }
  }, [open, initialNickname]);

  function handleDialogClose() {
    if (dialogRef.current) {
      dialogRef.current.returnValue = '';
    }
    onClose();
  }

  async function handleLookupSubmit(event) {
    event.preventDefault();
    if (checking) {
      return;
    }

    const nicknameCheck = validateNickname(draftNickname);
    if (!nicknameCheck.valid) {
      setErrorMessage(resolveRestoreError({ reason: nicknameCheck.reason }, text));
      return;
    }

    const pinCheck = validatePin(draftPin);
    if (!pinCheck.valid) {
      setErrorMessage(text.pinErrFormat);
      return;
    }

    setErrorMessage('');
    setChecking(true);
    try {
      const lookupResult = await lookupProfileBackup({
        nickname: nicknameCheck.nickname,
        pin: pinCheck.pin
      });
      if (!lookupResult.ok) {
        setErrorMessage(resolveRestoreError(lookupResult, text));
        return;
      }

      const restoredState = lookupResult.restoredState;
      if (hasProgressToOverwrite(currentState, restoredState.backupKey)) {
        setPendingRestoredState(restoredState);
        return;
      }

      onRestore(restoredState);
    } catch (lookupError) {
      console.error('Failed to look up cloud backup:', lookupError);
      setErrorMessage(text.restoreErrOffline);
    } finally {
      setChecking(false);
    }
  }

  function handleConfirmRestore() {
    if (!pendingRestoredState) {
      return;
    }
    onRestore(pendingRestoredState);
  }

  return (
    <dialog
      ref={dialogRef}
      className="arcade-dialog restore-dialog"
      aria-labelledby={titleId}
      onClose={handleDialogClose}
    >
      {pendingRestoredState ? (
        <>
          <h2 id={titleId} className="result-title">
            <span aria-hidden="true">✨</span> {text.restoreConfirmTitle}
          </h2>
          <p className="dialog-tip">{text.restoreConfirmDesc}</p>

          <div className="restore-preview-card">
            <div className="result-stat-row">
              <span className="result-stat-label">{text.nicknameLabel}</span>
              <strong className="result-stat-value">{pendingRestoredState.nickname}</strong>
            </div>
            <div className="result-stat-row">
              <span className="result-stat-label">{text.starsLabel}</span>
              <strong className="result-stat-value">
                {pendingRestoredState.stars} <span aria-hidden="true">🌟</span>
              </strong>
            </div>
            <div className="result-stat-row">
              <span className="result-stat-label">{text.unlockedCount}</span>
              <strong className="result-stat-value">
                {pendingRestoredState.unlockedSkins.length}/{SKINS.length}
              </strong>
            </div>
            <div className="result-stat-row">
              <span className="result-stat-label">{text.bestScore}</span>
              <strong className="result-stat-value">
                🌠 {pendingRestoredState.highScores.dodge} · 🏰 {pendingRestoredState.highScores.stack} · 🫧 {pendingRestoredState.highScores.merge || 0}
              </strong>
            </div>
          </div>

          <div className="result-actions">
            <button
              type="button"
              className="primary-btn result-primary-btn"
              onClick={handleConfirmRestore}
            >
              {text.restoreConfirmApplyBtn}
            </button>
            <button
              type="button"
              className="secondary-btn result-secondary-btn"
              onClick={() => setPendingRestoredState(null)}
            >
              {text.restoreBackBtn}
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 id={titleId} className="result-title">
            <span aria-hidden="true">☁️</span> {text.restoreModalTitle}
          </h2>
          <p className="dialog-tip">{text.restoreDesc}</p>

          <form className="nickname-form" onSubmit={handleLookupSubmit}>
            <label htmlFor={nicknameInputId} className="visually-hidden">
              {text.nicknameLabel}
            </label>
            <input
              id={nicknameInputId}
              type="text"
              className="nickname-input"
              value={draftNickname}
              onChange={(event) => {
                setDraftNickname(event.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder={text.nicknamePlaceholder}
              maxLength={10}
              autoFocus
            />

            <label htmlFor={pinInputId} className="visually-hidden">
              {text.pinLabel}
            </label>
            <input
              id={pinInputId}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="nickname-input pin-input"
              value={draftPin}
              onChange={(event) => {
                const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 4);
                setDraftPin(digitsOnly);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder={text.pinPlaceholder}
              maxLength={4}
            />

            {errorMessage && (
              <p className="nickname-error" role="alert">
                {errorMessage}
              </p>
            )}

            <div className="result-actions">
              <button
                type="submit"
                className="primary-btn result-primary-btn"
                disabled={checking}
              >
                {checking ? text.restoreCheckingBtn : text.restoreSubmitBtn}
              </button>
              <button
                type="button"
                className="secondary-btn result-secondary-btn"
                onClick={onClose}
                disabled={checking}
              >
                {text.cancelBtn}
              </button>
            </div>
          </form>
        </>
      )}
    </dialog>
  );
}
