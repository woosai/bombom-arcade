// 별명 및 복구용 4자리 PIN 설정·검증 네이티브 <dialog> 모달 컴포넌트

import React, { useEffect, useId, useRef, useState } from 'react';
import { validateNickname } from '../utils/leaderboard.js';
import { validatePin } from '../utils/profileBackup.js';

function resolveErrorMessage(reason, text) {
  switch (reason) {
    case 'unsafe':
      return text.nicknameErrUnsafe;
    case 'privacy':
      return text.nicknameErrPrivacy;
    case 'profanity':
      return text.nicknameErrProfanity;
    case 'pin':
      return text.pinErrFormat;
    case 'taken':
      return text.nicknameErrTaken;
    case 'offline':
      return text.nicknameErrSaveFailed;
    default:
      return text.nicknameErrLength;
  }
}

export function NicknameDialog({
  open,
  currentNickname,
  hasBackup,
  onSave,
  onSwitchToRestore,
  onClose,
  text
}) {
  const dialogRef = useRef(null);
  const inputId = useId();
  const pinInputId = useId();
  const titleId = useId();
  const [draftNickname, setDraftNickname] = useState(currentNickname || '');
  const [draftPin, setDraftPin] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) {
      return;
    }
    if (open && !dialogElement.open) {
      setDraftNickname(currentNickname || '');
      setDraftPin('');
      setErrorMessage('');
      setSubmitting(false);
      dialogElement.showModal();
    } else if (!open && dialogElement.open) {
      dialogElement.close();
    }
  }, [open, currentNickname]);

  function handleDialogClose() {
    if (dialogRef.current) {
      dialogRef.current.returnValue = '';
    }
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) {
      return;
    }

    const nicknameResult = validateNickname(draftNickname);
    if (!nicknameResult.valid) {
      setErrorMessage(resolveErrorMessage(nicknameResult.reason, text));
      return;
    }

    const pinResult = validatePin(draftPin);
    if (!pinResult.valid) {
      setErrorMessage(resolveErrorMessage('pin', text));
      return;
    }

    setErrorMessage('');
    setSubmitting(true);
    try {
      const saveResult = await onSave({
        nickname: nicknameResult.nickname,
        pin: pinResult.pin
      });
      if (saveResult && !saveResult.ok) {
        setErrorMessage(resolveErrorMessage(saveResult.reason, text));
      }
    } catch (saveError) {
      console.error('Failed to save nickname with backup:', saveError);
      setErrorMessage(text.nicknameErrSaveFailed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="arcade-dialog nickname-dialog"
      aria-labelledby={titleId}
      onClose={handleDialogClose}
    >
      <h2 id={titleId} className="result-title">
        <span aria-hidden="true">🏷️</span> {text.nicknameModalTitle}
      </h2>
      <p className="dialog-tip">{text.nicknamePrivacyTip}</p>

      <form className="nickname-form" onSubmit={handleSubmit}>
        <label htmlFor={inputId} className="visually-hidden">
          {text.nicknameLabel}
        </label>
        <input
          id={inputId}
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

        <div className="pin-field-group">
          <label htmlFor={pinInputId} className="pin-field-label">
            <span aria-hidden="true">🔑</span> {text.pinLabel}
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
          <p className="pin-hint">
            {hasBackup ? text.pinUpdateHint : text.pinHint}
          </p>
        </div>

        {errorMessage && (
          <p className="nickname-error" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="result-actions">
          <button
            type="submit"
            className="primary-btn result-primary-btn"
            disabled={submitting}
          >
            {submitting ? text.nicknameSavingBtn : text.nicknameSaveBtn}
          </button>
          <button
            type="button"
            className="secondary-btn result-secondary-btn"
            onClick={onClose}
            disabled={submitting}
          >
            {text.cancelBtn}
          </button>
        </div>

        <button
          type="button"
          className="dialog-switch-btn"
          onClick={() => onSwitchToRestore(draftNickname.trim())}
          disabled={submitting}
        >
          {text.switchToRestoreBtn}
        </button>
      </form>
    </dialog>
  );
}
