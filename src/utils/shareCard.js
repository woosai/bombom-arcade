// 순위표 자랑하기 카드 Canvas 렌더링 및 모바일 공유·복사·다운로드 유틸리티

import { drawSkinMascot, getSkinById } from '../games/skins.js';

export const SHARE_CARD_WIDTH = 720;
export const SHARE_CARD_HEIGHT = 900;
export const PLAY_URL = 'https://woosai.github.io/bombom-arcade/';
const SHARE_URL_LABEL = 'woosai.github.io/bombom-arcade';

function drawRoundedBox(context, originX, originY, boxWidth, boxHeight, radius) {
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(originX, originY, boxWidth, boxHeight, radius);
  } else {
    const safeRadius = Math.min(radius, boxWidth / 2, boxHeight / 2);
    context.moveTo(originX + safeRadius, originY);
    context.lineTo(originX + boxWidth - safeRadius, originY);
    context.quadraticCurveTo(originX + boxWidth, originY, originX + boxWidth, originY + safeRadius);
    context.lineTo(originX + boxWidth, originY + boxHeight - safeRadius);
    context.quadraticCurveTo(
      originX + boxWidth,
      originY + boxHeight,
      originX + boxWidth - safeRadius,
      originY + boxHeight
    );
    context.lineTo(originX + safeRadius, originY + boxHeight);
    context.quadraticCurveTo(originX, originY + boxHeight, originX, originY + boxHeight - safeRadius);
    context.lineTo(originX, originY + safeRadius);
    context.quadraticCurveTo(originX, originY, originX + safeRadius, originY);
    context.closePath();
  }
}

export function buildShareCardSummary({
  gameType,
  nickname,
  equippedSkinId,
  entries,
  currentUserId,
  myEntry,
  localBest
}) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const foundIndex = currentUserId
    ? safeEntries.findIndex((entry) => entry.userId === currentUserId)
    : -1;
  const myRank = foundIndex >= 0 ? foundIndex + 1 : null;
  const safeLocalBest = Number.isFinite(localBest) && localBest >= 0 ? Math.floor(localBest) : 0;
  const myScore = Math.max(safeLocalBest, myEntry?.score || 0);
  const myName = nickname || myEntry?.nickname || 'BomBom';
  const mySkinId = myEntry?.skinId || equippedSkinId || 'bombom';

  return {
    gameType,
    myName,
    mySkinId,
    myRank,
    myScore,
    currentUserId,
    topEntries: safeEntries.slice(0, 5)
  };
}

// 고해상도(720x900) 파스텔 네온 순위표 자랑 카드 캔버스 렌더링 목적
export function renderShareCardToCanvas(canvasElement, summary, text, activeLang = 'ko') {
  canvasElement.width = SHARE_CARD_WIDTH;
  canvasElement.height = SHARE_CARD_HEIGHT;
  const context = canvasElement.getContext('2d');
  if (!context) {
    return;
  }

  const background = context.createLinearGradient(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);
  background.addColorStop(0, '#FFF1F6');
  background.addColorStop(0.55, '#F2EAFF');
  background.addColorStop(1, '#E2F7FF');
  context.fillStyle = background;
  context.fillRect(0, 0, SHARE_CARD_WIDTH, SHARE_CARD_HEIGHT);

  // 배경 장식 도형 배치
  context.fillStyle = 'rgba(255, 122, 162, 0.14)';
  context.beginPath();
  context.arc(100, 120, 96, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(114, 239, 221, 0.22)';
  context.beginPath();
  context.arc(620, 210, 110, 0, Math.PI * 2);
  context.fill();

  // 외곽 카드 프레임
  drawRoundedBox(context, 36, 36, SHARE_CARD_WIDTH - 72, SHARE_CARD_HEIGHT - 72, 34);
  context.fillStyle = 'rgba(255, 255, 255, 0.94)';
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = '#FFD1E3';
  context.stroke();

  // 상단 브랜드 배지 및 게임 제목
  const gameTitle = summary.gameType === 'dodge' ? text.dodgeTitle : text.stackTitle;
  drawRoundedBox(context, 240, 66, 240, 44, 22);
  context.fillStyle = '#FFE066';
  context.fill();
  context.fillStyle = '#1B1438';
  context.font = 'bold 21px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(`⭐ ${text.brandName}`, SHARE_CARD_WIDTH / 2, 89);

  context.fillStyle = '#1F1836';
  context.font = 'bold 34px sans-serif';
  context.fillText(gameTitle, SHARE_CARD_WIDTH / 2, 148);

  // 내 기록 하이라이트 배너
  drawRoundedBox(context, 68, 186, SHARE_CARD_WIDTH - 136, 176, 26);
  const heroGradient = context.createLinearGradient(68, 186, SHARE_CARD_WIDTH - 68, 362);
  heroGradient.addColorStop(0, '#24184E');
  heroGradient.addColorStop(1, '#3D2478');
  context.fillStyle = heroGradient;
  context.fill();

  drawSkinMascot(context, summary.mySkinId, 152, 274, 48, 0);

  context.textAlign = 'left';
  context.fillStyle = '#FFE066';
  context.font = 'bold 22px sans-serif';
  const rankBadgeText = summary.myRank
    ? `#${summary.myRank} ${text.leaderboardTitle}`
    : text.bestScore;
  context.fillText(rankBadgeText, 226, 232);

  context.fillStyle = '#FFFFFF';
  context.font = 'bold 36px sans-serif';
  context.fillText(summary.myName, 226, 278);

  context.fillStyle = '#72EFDD';
  context.font = 'bold 30px sans-serif';
  context.fillText(`${text.scoreLabel} ${summary.myScore}`, 226, 326);

  // TOP 5 순위표 영역
  context.textAlign = 'left';
  context.fillStyle = '#4E446B';
  context.font = 'bold 22px sans-serif';
  context.fillText('TOP 5', 74, 404);

  const medals = ['🥇', '🥈', '🥉', '4', '5'];
  const listStartY = 430;
  const rowHeight = 68;
  const rowGap = 12;

  if (summary.topEntries.length === 0) {
    drawRoundedBox(context, 68, listStartY, SHARE_CARD_WIDTH - 136, 120, 20);
    context.fillStyle = '#F7F2FF';
    context.fill();
    context.textAlign = 'center';
    context.fillStyle = '#4E446B';
    context.font = 'bold 22px sans-serif';
    context.fillText(text.leaderboardEmpty, SHARE_CARD_WIDTH / 2, listStartY + 60);
  } else {
    for (let entryIndex = 0; entryIndex < summary.topEntries.length; entryIndex += 1) {
      const entry = summary.topEntries[entryIndex];
      const rowY = listStartY + entryIndex * (rowHeight + rowGap);
      const isMe = Boolean(
        (summary.currentUserId && entry.userId === summary.currentUserId) ||
          entry.nickname === summary.myName
      );
      const skin = getSkinById(entry.skinId);

      drawRoundedBox(context, 68, rowY, SHARE_CARD_WIDTH - 136, rowHeight, 18);
      context.fillStyle = isMe ? '#FFF0F6' : '#F9F7FD';
      context.fill();
      context.lineWidth = isMe ? 3 : 1.5;
      context.strokeStyle = isMe ? '#D62865' : '#E6DCF7';
      context.stroke();

      context.textAlign = 'center';
      context.fillStyle = '#1F1836';
      context.font = 'bold 26px sans-serif';
      context.fillText(medals[entryIndex] || String(entryIndex + 1), 108, rowY + rowHeight / 2 + 1);

      context.font = '26px sans-serif';
      context.fillText(skin.badge, 158, rowY + rowHeight / 2 + 2);

      context.textAlign = 'left';
      context.fillStyle = '#1F1836';
      context.font = 'bold 24px sans-serif';
      const displayName = isMe ? `${entry.nickname} (${text.leaderboardMeBadge})` : entry.nickname;
      context.fillText(displayName, 196, rowY + rowHeight / 2 + 1);

      context.textAlign = 'right';
      context.fillStyle = isMe ? '#D62865' : '#1F1836';
      context.font = 'bold 26px sans-serif';
      context.fillText(String(entry.score), SHARE_CARD_WIDTH - 92, rowY + rowHeight / 2 + 1);
    }
  }

  // 하단 플레이 안내 푸터
  context.textAlign = 'center';
  context.fillStyle = '#4E446B';
  context.font = 'bold 20px sans-serif';
  const footerCallout =
    activeLang === 'ko' ? '같이 한 판 도전해 볼래?' : 'Think you can beat this score?';
  context.fillText(footerCallout, SHARE_CARD_WIDTH / 2, SHARE_CARD_HEIGHT - 94);

  context.fillStyle = '#D62865';
  context.font = 'bold 19px sans-serif';
  context.fillText(SHARE_URL_LABEL, SHARE_CARD_WIDTH / 2, SHARE_CARD_HEIGHT - 62);
}

export function exportCanvasToPngBlob(canvasElement) {
  return new Promise((resolve, reject) => {
    if (!canvasElement || typeof canvasElement.toBlob !== 'function') {
      reject(new Error('Canvas blob export is not supported'));
      return;
    }
    canvasElement.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create PNG image blob'));
      }
    }, 'image/png');
  });
}

function triggerBlobDownload(blob, fileName, documentObject, urlObject) {
  const objectUrl = urlObject.createObjectURL(blob);
  const anchor = documentObject.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  documentObject.body.appendChild(anchor);
  anchor.click();
  documentObject.body.removeChild(anchor);
  urlObject.revokeObjectURL(objectUrl);
}

export function buildShareInviteText({ summary, text, activeLang, playUrl = PLAY_URL }) {
  const gameTitle = summary.gameType === 'dodge' ? text.dodgeTitle : text.stackTitle;
  if (activeLang === 'ko') {
    return `${text.brandName} - ${gameTitle} ${summary.myName} (${summary.myScore}점)!\n같이 한 판 도전해 볼래? 👉 ${playUrl}`;
  }
  return `${text.brandName} - ${gameTitle} ${summary.myName} (${summary.myScore})!\nThink you can beat this score? 👉 ${playUrl}`;
}

export async function copyShareInviteText({
  shareText,
  navigatorObject = typeof navigator !== 'undefined' ? navigator : undefined
}) {
  if (
    !shareText ||
    !navigatorObject?.clipboard ||
    typeof navigatorObject.clipboard.writeText !== 'function'
  ) {
    return false;
  }
  try {
    await navigatorObject.clipboard.writeText(shareText);
    return true;
  } catch (copyError) {
    console.warn('Failed to copy share invite text:', copyError);
    return false;
  }
}

// Web Share 파일 공유 -> 클립보드 이미지 복사 -> PNG 파일 다운로드 순 폴백 전달 목적
export async function shareOrDownloadCard({
  blob,
  fileName = 'bombom-ranking.png',
  title,
  shareText,
  shareUrl = PLAY_URL,
  downloadOnly = false,
  navigatorObject = typeof navigator !== 'undefined' ? navigator : undefined,
  documentObject = typeof document !== 'undefined' ? document : undefined,
  urlObject = typeof URL !== 'undefined' ? URL : undefined
}) {
  if (!downloadOnly && navigatorObject && typeof File !== 'undefined') {
    const shareFile = new File([blob], fileName, { type: 'image/png' });
    const canShareWithUrl =
      Boolean(shareUrl) &&
      typeof navigatorObject.canShare === 'function' &&
      navigatorObject.canShare({
        files: [shareFile],
        title,
        text: shareText,
        url: shareUrl
      });
    const canShareFiles =
      typeof navigatorObject.canShare === 'function' &&
      navigatorObject.canShare({ files: [shareFile] });

    if ((canShareWithUrl || canShareFiles) && typeof navigatorObject.share === 'function') {
      try {
        const sharePayload = {
          files: [shareFile],
          title,
          text: shareText
        };
        if (canShareWithUrl) {
          sharePayload.url = shareUrl;
        }
        await navigatorObject.share(sharePayload);
        return { method: 'share' };
      } catch (shareError) {
        if (shareError?.name === 'AbortError') {
          return { method: 'cancelled' };
        }
      }
    }
  }

  if (
    !downloadOnly &&
    typeof ClipboardItem !== 'undefined' &&
    navigatorObject?.clipboard &&
    typeof navigatorObject.clipboard.write === 'function'
  ) {
    try {
      await navigatorObject.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return { method: 'clipboard' };
    } catch {
      // 클립보드 권한 거부 시 파일 다운로드 폴백 수행
    }
  }

  if (documentObject && urlObject && typeof urlObject.createObjectURL === 'function') {
    triggerBlobDownload(blob, fileName, documentObject, urlObject);
    return { method: 'download' };
  }

  return { method: 'unsupported' };
}
