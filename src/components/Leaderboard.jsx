// Firebase 실시간 TOP 15 랭킹 조회 및 내 별명 순위 비교 화면 컴포넌트

import React, { useCallback, useEffect, useState } from 'react';
import { getSkinById } from '../games/skins.js';
import { fetchLeaderboard } from '../utils/leaderboard.js';
import { buildShareCardSummary } from '../utils/shareCard.js';
import { ShareCardDialog } from './ShareCardDialog.jsx';

function getRankMedal(rankIndex) {
  if (rankIndex === 0) return '🥇';
  if (rankIndex === 1) return '🥈';
  if (rankIndex === 2) return '🥉';
  return String(rankIndex + 1);
}

export function Leaderboard({
  nickname,
  equippedSkinId,
  activeLang,
  highScores,
  onOpenNicknameDialog,
  text
}) {
  const [selectedGame, setSelectedGame] = useState('dodge');
  const [loading, setLoading] = useState(true);
  const [offlineError, setOfflineError] = useState(false);
  const [entries, setEntries] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [myEntry, setMyEntry] = useState(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const loadRankings = useCallback(async (gameType) => {
    setLoading(true);
    setOfflineError(false);
    try {
      const result = await fetchLeaderboard(gameType);
      setEntries(result.entries);
      setCurrentUserId(result.currentUserId);
      setMyEntry(result.myEntry);
    } catch (fetchError) {
      console.error('Failed to load leaderboard:', fetchError);
      setOfflineError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRankings(selectedGame);
  }, [selectedGame, loadRankings]);

  const myInTopList = entries.some((entry) => entry.userId === currentUserId);
  const localBest = highScores[selectedGame] || 0;
  const shareSummary = shareDialogOpen
    ? buildShareCardSummary({
        gameType: selectedGame,
        nickname,
        equippedSkinId,
        entries,
        currentUserId,
        myEntry,
        localBest
      })
    : null;

  return (
    <main className="leaderboard-main">
      <div className="leaderboard-head">
        <div>
          <h1 className="shop-title">{text.leaderboardTitle}</h1>
          <p className="shop-subtitle">{text.leaderboardSub}</p>
        </div>
        <div className="leaderboard-head-actions">
          <button
            type="button"
            className="header-btn leaderboard-share-btn"
            onClick={() => setShareDialogOpen(true)}
            disabled={loading}
          >
            <span aria-hidden="true">📢</span> {text.shareBragBtn}
          </button>
          <button
            type="button"
            className="header-btn leaderboard-refresh-btn"
            onClick={() => loadRankings(selectedGame)}
            disabled={loading}
          >
            {text.leaderboardRefresh}
          </button>
        </div>
      </div>

      {!nickname && (
        <div className="leaderboard-prompt-card">
          <p className="leaderboard-prompt-text">{text.leaderboardRegisterPrompt}</p>
          <button
            type="button"
            className="secondary-btn leaderboard-nick-btn"
            onClick={onOpenNicknameDialog}
          >
            {text.nicknameSetBtn}
          </button>
        </div>
      )}

      <div className="leaderboard-tabs" role="tablist" aria-label={text.leaderboardTitle}>
        {[
          { id: 'dodge', emoji: '🌠', label: text.dodgeTitle },
          { id: 'stack', emoji: '🏰', label: text.stackTitle },
          { id: 'merge', emoji: '🫧', label: text.mergeTitle }
        ].map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            role="tab"
            aria-selected={selectedGame === tabItem.id}
            className={`leaderboard-tab${selectedGame === tabItem.id ? ' is-selected' : ''}`}
            onClick={() => setSelectedGame(tabItem.id)}
          >
            <span aria-hidden="true">{tabItem.emoji}</span> {tabItem.label}
          </button>
        ))}
      </div>

      <div className="leaderboard-panel" role="tabpanel">
        {loading && (
          <p className="leaderboard-status">{text.leaderboardLoading}</p>
        )}

        {!loading && offlineError && (
          <p className="leaderboard-status is-error">{text.leaderboardOffline}</p>
        )}

        {!loading && !offlineError && entries.length === 0 && (
          <p className="leaderboard-status">{text.leaderboardEmpty}</p>
        )}

        {!loading && !offlineError && entries.length > 0 && (
          <ul className="leaderboard-list">
            {entries.map((entry, entryIndex) => {
              const skin = getSkinById(entry.skinId);
              const isCurrentUser = Boolean(currentUserId && entry.userId === currentUserId);
              return (
                <li
                  key={entry.userId || `${entry.nickname}-${entryIndex}`}
                  className={`leaderboard-row${isCurrentUser ? ' is-me' : ''}`}
                >
                  <span className="leaderboard-rank">{getRankMedal(entryIndex)}</span>
                  <span className="leaderboard-skin" aria-hidden="true">
                    {skin.badge}
                  </span>
                  <span className="leaderboard-name">
                    {entry.nickname}
                    {isCurrentUser && (
                      <span className="leaderboard-me-badge">{text.leaderboardMeBadge}</span>
                    )}
                  </span>
                  <strong className="leaderboard-score">{entry.score}</strong>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !offlineError && !myInTopList && (myEntry || nickname) && (
          <div className="leaderboard-my-summary">
            <span>
              {nickname || myEntry?.nickname} ({text.bestScore})
            </span>
            <strong>{Math.max(localBest, myEntry?.score || 0)}</strong>
          </div>
        )}
      </div>

      <ShareCardDialog
        open={shareDialogOpen}
        summary={shareSummary}
        activeLang={activeLang}
        onClose={() => setShareDialogOpen(false)}
        text={text}
      />
    </main>
  );
}
