// iOS Safari 및 Android 수동 홈 화면 추가 2단계 안내 네이티브 <dialog> 모달

import React, { useEffect, useId, useRef } from 'react';

export function InstallGuideDialog({ open, mode, onClose, text }) {
  const dialogRef = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) {
      return;
    }
    if (open && !dialogElement.open) {
      dialogElement.showModal();
    } else if (!open && dialogElement.open) {
      dialogElement.close();
    }
  }, [open]);

  function handleDialogClose() {
    if (dialogRef.current) {
      dialogRef.current.returnValue = '';
    }
    onClose();
  }

  const isIosGuide = mode === 'ios-guide';
  const stepOneText = isIosGuide ? text.installIosStep1 : text.installAndroidStep1;
  const stepTwoText = isIosGuide ? text.installIosStep2 : text.installAndroidStep2;

  return (
    <dialog
      ref={dialogRef}
      className="arcade-dialog install-dialog"
      aria-labelledby={titleId}
      onClose={handleDialogClose}
    >
      <h2 id={titleId} className="result-title">
        <span aria-hidden="true">📱</span> {text.installGuideTitle}
      </h2>

      <ol className="install-steps">
        <li className="install-step-item">
          <span className="install-step-num" aria-hidden="true">
            1
          </span>
          <span className="install-step-text">{stepOneText}</span>
        </li>
        <li className="install-step-item">
          <span className="install-step-num" aria-hidden="true">
            2
          </span>
          <span className="install-step-text">{stepTwoText}</span>
        </li>
      </ol>

      <button
        type="button"
        className="primary-btn result-primary-btn"
        autoFocus
        onClick={onClose}
      >
        {text.installGuideClose}
      </button>
    </dialog>
  );
}
