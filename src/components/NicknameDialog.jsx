// 가벼운 별명(아이디) 입력·유효성 검증 네이티브 <dialog> 모달 컴포넌트

import React, { useEffect, useId, useRef, useState } from 'react';
import { validateNickname } from '../utils/leaderboard.js';

function resolveErrorMessage(reason, text) {
  switch (reason) {
    case 'unsafe':
      return text.nicknameErrUnsafe;
    case 'privacy':
      return text.nicknameErrPrivacy;
    case 'profanity':
      return text.nicknameErrProfanity;
    default:
      return text.nicknameErrLength;
  }
}

export function NicknameDialog({ open, currentNickname, onSave, onClose, text }) {
  const dialogRef = useRef(null);
  const inputId = useId();
  const titleId = useId();
  const [draftNickname, setDraftNickname] = useState(currentNickname || '');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) {
      return;
    }
    if (open && !dialogElement.open) {
      setDraftNickname(currentNickname || '');
      setErrorMessage('');
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

  function handleSubmit(event) {
    event.preventDefault();
    const result = validateNickname(draftNickname);
    if (!result.valid) {
      setErrorMessage(resolveErrorMessage(result.reason, text));
      return;
    }
    setErrorMessage('');
    onSave(result.nickname);
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
        {errorMessage && (
          <p className="nickname-error" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="result-actions">
          <button type="submit" className="primary-btn result-primary-btn">
            {text.nicknameSaveBtn}
          </button>
          <button
            type="button"
            className="secondary-btn result-secondary-btn"
            onClick={onClose}
          >
            {text.cancelBtn}
          </button>
        </div>
      </form>
    </dialog>
  );
}
