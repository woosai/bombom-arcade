// 전역 영속 상태, 화면 라우팅, 온라인 랭킹 및 모바일 PWA 설치 상태 관리 루트 컴포넌트

import React, { useEffect, useRef, useState } from 'react';
import { GameShell } from './components/GameShell.jsx';
import { Header } from './components/Header.jsx';
import { InstallGuideDialog } from './components/InstallGuideDialog.jsx';
import { Leaderboard } from './components/Leaderboard.jsx';
import { Lobby } from './components/Lobby.jsx';
import { NicknameDialog } from './components/NicknameDialog.jsx';
import { RestoreDialog } from './components/RestoreDialog.jsx';
import { SkinShop } from './components/SkinShop.jsx';
import { SKINS, equipSkin, unlockSkin } from './games/skins.js';
import { resolveLanguage, translations } from './i18n/translations.js';
import { submitLeaderboardScore } from './utils/leaderboard.js';
import { registerNicknameWithBackup, syncProfileBackup } from './utils/profileBackup.js';
import { usePwaInstall } from './utils/pwaInstall.js';
import {
  applyMiniStarReward,
  createDefaultState,
  loadState,
  loadStateSync,
  saveState
} from './utils/storage.js';

export function App() {
  const isExtensionContext =
    typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.id);
  // 확장 팝업이 아닌 일반 웹·모바일 접속 시 자동 반응형 모드 적용 목적
  const isFullTab =
    !isExtensionContext ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('mode') === 'full');

  // 일반 웹·모바일에서 새로고침 시 별명/기록 깜빡임을 없애기 위한 동기 초기화 목적
  const [appState, setAppState] = useState(() =>
    isExtensionContext ? createDefaultState() : loadStateSync()
  );
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  const [currentScreen, setCurrentScreen] = useState('lobby');
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [restoreSeedNickname, setRestoreSeedNickname] = useState('');
  const [restoreToastVisible, setRestoreToastVisible] = useState(false);
  const [installGuideOpen, setInstallGuideOpen] = useState(false);

  const { installMode, triggerNativeInstall } = usePwaInstall(isExtensionContext);

  const navigatorLanguage =
    typeof navigator !== 'undefined' ? navigator.language : 'en';
  const activeLang = resolveLanguage(appState.settings.lang, navigatorLanguage);
  const text = translations[activeLang] || translations.en;

  useEffect(() => {
    let cancelled = false;
    loadState().then((loadedState) => {
      if (!cancelled) {
        appStateRef.current = loadedState;
        setAppState(loadedState);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.lang = activeLang;
    document.body.classList.toggle('full-tab', isFullTab);
  }, [activeLang, isFullTab]);

  useEffect(() => {
    if (!restoreToastVisible) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setRestoreToastVisible(false);
    }, 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [restoreToastVisible]);

  // 업데이터 부수효과 방지를 위해 상태 계산 후 외부에서 저장 수행 목적
  function commitStateUpdate(updater) {
    const nextState = updater(appStateRef.current);
    appStateRef.current = nextState;
    setAppState(nextState);
    saveState(nextState);
    return nextState;
  }

  function syncBackupIfActive(targetState) {
    if (!targetState?.backupKey || !targetState?.nickname) {
      return;
    }
    syncProfileBackup(targetState.backupKey, targetState).catch((backupError) => {
      console.warn('Cloud profile backup sync skipped:', backupError);
    });
  }

  function syncLeaderboardsForState(targetState, includeZeroDodge = false) {
    if (!targetState?.nickname) {
      return;
    }
    const gameTypes = ['dodge', 'stack'];
    for (let index = 0; index < gameTypes.length; index += 1) {
      const gameType = gameTypes[index];
      const bestScore = targetState.highScores[gameType] || 0;
      if (bestScore > 0 || (includeZeroDodge && gameType === 'dodge')) {
        submitLeaderboardScore({
          gameType,
          nickname: targetState.nickname,
          score: bestScore,
          skinId: targetState.equippedSkin
        }).catch((syncError) => {
          console.warn('Leaderboard sync skipped:', syncError);
        });
      }
    }
  }

  function handleToggleLanguage() {
    const nextLanguage = activeLang === 'ko' ? 'en' : 'ko';
    commitStateUpdate((previousState) => ({
      ...previousState,
      settings: {
        ...previousState.settings,
        lang: nextLanguage
      }
    }));
  }

  function handleToggleMute() {
    commitStateUpdate((previousState) => ({
      ...previousState,
      settings: {
        ...previousState.settings,
        muted: !previousState.settings.muted
      }
    }));
  }

  function handleGameOverPersist(gameType, result) {
    const earnedMiniStars = Number.isFinite(result?.starsEarned)
      ? Math.max(0, Math.floor(result.starsEarned))
      : 0;
    const finalScore = Number.isFinite(result?.score)
      ? Math.max(0, Math.floor(result.score))
      : 0;

    let rewardSummary = { gainedSkinStars: 0, nextFragments: 0 };
    const nextState = commitStateUpdate((previousState) => {
      rewardSummary = applyMiniStarReward(
        previousState.stars,
        previousState.starFragments,
        earnedMiniStars
      );
      return {
        ...previousState,
        stars: rewardSummary.nextStars,
        starFragments: rewardSummary.nextFragments,
        highScores: {
          ...previousState.highScores,
          [gameType]: Math.max(previousState.highScores[gameType] || 0, finalScore)
        }
      };
    });

    if (nextState.nickname) {
      submitLeaderboardScore({
        gameType,
        nickname: nextState.nickname,
        score: nextState.highScores[gameType],
        skinId: nextState.equippedSkin
      }).catch((syncError) => {
        console.warn('Leaderboard sync skipped:', syncError);
      });
    }
    syncBackupIfActive(nextState);

    return rewardSummary;
  }

  async function handleSaveNickname({ nickname, pin }) {
    const registrationResult = await registerNicknameWithBackup({
      currentState: appStateRef.current,
      nickname,
      pin
    });
    if (!registrationResult.ok) {
      return registrationResult;
    }

    setNicknameDialogOpen(false);
    const nextState = commitStateUpdate((previousState) => ({
      ...previousState,
      nickname: registrationResult.nickname,
      backupKey: registrationResult.backupKey
    }));

    syncLeaderboardsForState(nextState, true);
    return { ok: true };
  }

  function handleRestoreBackup(restoredState) {
    setRestoreDialogOpen(false);
    const nextState = commitStateUpdate((previousState) => ({
      ...restoredState,
      settings: previousState.settings
    }));
    syncLeaderboardsForState(nextState, true);
    setRestoreToastVisible(true);
  }

  function handleOpenRestoreDialog(seedNickname = '') {
    setNicknameDialogOpen(false);
    setRestoreSeedNickname(seedNickname);
    setRestoreDialogOpen(true);
  }

  function handleUnlockSkin(skinId) {
    const previousStars = appStateRef.current.stars;
    const nextState = commitStateUpdate((previousState) => unlockSkin(previousState, skinId));
    if (nextState.stars !== previousStars) {
      syncBackupIfActive(nextState);
    }
  }

  function handleEquipSkin(skinId) {
    const previousEquipped = appStateRef.current.equippedSkin;
    const nextState = commitStateUpdate((previousState) => equipSkin(previousState, skinId));
    if (nextState.equippedSkin !== previousEquipped) {
      syncLeaderboardsForState(nextState, false);
      syncBackupIfActive(nextState);
    }
  }

  async function handleInstallClick() {
    if (installMode === 'native') {
      const accepted = await triggerNativeInstall();
      if (!accepted) {
        return;
      }
      return;
    }
    setInstallGuideOpen(true);
  }

  return (
    <div className="arcade-app">
      <Header
        currentScreen={currentScreen}
        onBack={() => setCurrentScreen('lobby')}
        stars={appState.stars}
        onToggleLanguage={handleToggleLanguage}
        muted={appState.settings.muted}
        onToggleMute={handleToggleMute}
        isFullTab={isFullTab}
        text={text}
      />

      {restoreToastVisible && (
        <p className="restore-toast" role="status">
          {text.restoreSuccessToast}
        </p>
      )}

      {currentScreen === 'lobby' && (
        <Lobby
          equippedSkinId={appState.equippedSkin}
          activeLang={activeLang}
          nickname={appState.nickname}
          highScores={appState.highScores}
          unlockedCount={appState.unlockedSkins.length}
          totalSkins={SKINS.length}
          onSelectGame={(gameType) => setCurrentScreen(gameType)}
          onOpenShop={() => setCurrentScreen('shop')}
          onOpenLeaderboard={() => setCurrentScreen('leaderboard')}
          onOpenNicknameDialog={() => setNicknameDialogOpen(true)}
          onOpenRestoreDialog={() => handleOpenRestoreDialog(appState.nickname)}
          installMode={installMode}
          onInstallClick={handleInstallClick}
          text={text}
        />
      )}

      {(currentScreen === 'dodge' || currentScreen === 'stack') && (
        <GameShell
          key={currentScreen}
          gameType={currentScreen}
          equippedSkinId={appState.equippedSkin}
          highScore={appState.highScores[currentScreen] || 0}
          nickname={appState.nickname}
          muted={appState.settings.muted}
          text={text}
          onGameOverPersist={handleGameOverPersist}
          onBackToLobby={() => setCurrentScreen('lobby')}
          onOpenNicknameDialog={() => setNicknameDialogOpen(true)}
        />
      )}

      {currentScreen === 'shop' && (
        <SkinShop
          stars={appState.stars}
          unlockedSkins={appState.unlockedSkins}
          equippedSkinId={appState.equippedSkin}
          activeLang={activeLang}
          onUnlockSkin={handleUnlockSkin}
          onEquipSkin={handleEquipSkin}
          text={text}
        />
      )}

      {currentScreen === 'leaderboard' && (
        <Leaderboard
          nickname={appState.nickname}
          equippedSkinId={appState.equippedSkin}
          activeLang={activeLang}
          highScores={appState.highScores}
          onOpenNicknameDialog={() => setNicknameDialogOpen(true)}
          text={text}
        />
      )}

      <NicknameDialog
        open={nicknameDialogOpen}
        currentNickname={appState.nickname}
        hasBackup={Boolean(appState.backupKey)}
        onSave={handleSaveNickname}
        onSwitchToRestore={(seedNickname) => handleOpenRestoreDialog(seedNickname)}
        onClose={() => setNicknameDialogOpen(false)}
        text={text}
      />

      <RestoreDialog
        open={restoreDialogOpen}
        initialNickname={restoreSeedNickname}
        currentState={appState}
        onRestore={handleRestoreBackup}
        onClose={() => setRestoreDialogOpen(false)}
        text={text}
      />

      <InstallGuideDialog
        open={installGuideOpen}
        mode={installMode}
        onClose={() => setInstallGuideOpen(false)}
        text={text}
      />
    </div>
  );
}

export default App;
