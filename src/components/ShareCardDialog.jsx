// 순위표 자랑 카드 미리보기 및 공유·이미지 저장 네이티브 <dialog> 모달

import React, { useEffect, useId, useRef, useState } from 'react';
import {
  PLAY_URL,
  SHARE_CARD_HEIGHT,
  SHARE_CARD_WIDTH,
  buildShareInviteText,
  copyShareInviteText,
  exportCanvasToPngBlob,
  renderShareCardToCanvas,
  shareOrDownloadCard
} from '../utils/shareCard.js';

export function ShareCardDialog({ open, summary, activeLang, onClose, text }) {
  const dialogRef = useRef(null);
  const canvasRef = useRef(null);
  const titleId = useId();
  const [preparedBlob, setPreparedBlob] = useState(null);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  useEffect(() => {
    const dialogElement = dialogRef.current;
    if (!dialogElement) {
      return;
    }

    if (open && summary) {
      setFeedbackMessage('');
      if (!dialogElement.open) {
        dialogElement.showModal();
      }
      if (canvasRef.current) {
        renderShareCardToCanvas(canvasRef.current, summary, text, activeLang);
        exportCanvasToPngBlob(canvasRef.current)
          .then((blob) => setPreparedBlob(blob))
          .catch(() => setPreparedBlob(null));
      }
    } else if (!open && dialogElement.open) {
      dialogElement.close();
      setPreparedBlob(null);
    }
  }, [open, summary, text, activeLang]);

  function handleDialogClose() {
    if (dialogRef.current) {
      dialogRef.current.returnValue = '';
    }
    onClose();
  }

  async function handleShareAction(downloadOnly) {
    if (!summary) return;
    const activeBlob =
      preparedBlob ||
      (canvasRef.current ? await exportCanvasToPngBlob(canvasRef.current) : null);
    if (!activeBlob) return;

    const shareText = buildShareInviteText({ summary, text, activeLang });

    const result = await shareOrDownloadCard({
      blob: activeBlob,
      fileName: `bombom-${summary.gameType}-rank.png`,
      title: text.brandName,
      shareText,
      shareUrl: PLAY_URL,
      downloadOnly
    });

    if (result.method === 'clipboard') {
      setFeedbackMessage(text.shareCardCopied);
    } else if (result.method === 'download') {
      setFeedbackMessage(text.shareCardSaved);
    } else if (result.method === 'share') {
      setFeedbackMessage(text.shareCardShared);
    }
  }

  async function handleCopyInviteLink() {
    if (!summary) return;
    const shareText = buildShareInviteText({ summary, text, activeLang });
    const copied = await copyShareInviteText({ shareText });
    setFeedbackMessage(copied ? text.shareLinkCopied : text.shareLinkCopyFailed);
  }

  return (
    <dialog
      ref={dialogRef}
      className="arcade-dialog share-dialog"
      aria-labelledby={titleId}
      onClose={handleDialogClose}
    >
      <div className="share-dialog-head">
        <h2 id={titleId} className="result-title">
          <span aria-hidden="true">📢</span> {text.shareCardTitle}
        </h2>
        <button
          type="button"
          className="header-btn share-close-btn"
          aria-label={text.cancelBtn}
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      <div className="share-preview-frame">
        <canvas
          ref={canvasRef}
          width={SHARE_CARD_WIDTH}
          height={SHARE_CARD_HEIGHT}
          className="share-preview-canvas"
        />
      </div>

      <div className="share-link-box">
        <a
          href={PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="share-link-url"
        >
          {PLAY_URL}
        </a>
        <button
          type="button"
          className="header-btn share-link-copy-btn"
          onClick={handleCopyInviteLink}
        >
          <span aria-hidden="true">🔗</span> {text.copyInviteLinkBtn}
        </button>
      </div>

      {feedbackMessage && (
        <p className="share-feedback" role="status">
          {feedbackMessage}
        </p>
      )}

      <div className="result-actions">
        <button
          type="button"
          className="primary-btn result-primary-btn"
          autoFocus
          onClick={() => handleShareAction(false)}
        >
          {text.shareNowBtn}
        </button>
        <button
          type="button"
          className="secondary-btn result-secondary-btn"
          onClick={() => handleShareAction(true)}
        >
          {text.saveImageBtn}
        </button>
      </div>
    </dialog>
  );
}
