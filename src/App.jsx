// 전역 영속 상태, 화면 라우팅, 온라인 랭킹 및 모바일 PWA 설치 상태 관리 루트 컴포넌트

import React, { useEffect, useRef, useState } from 'react';
import { GameShell } from './components/GameShell.jsx';
import { Header } from './components/Header.jsx';
import { InstallGuideDialog } from './components/InstallGuideDialog.jsx';
import { Leaderboard } from './components/Leaderboard.jsx';
import { Lobby } from './components/Lobby.jsx';
import { NicknameDialog } from './components/NicknameDialog.jsx';
import { SkinShop } from './components/SkinShop.jsx';
import { SKINS, equipSkin, unlockSkin } from './games/skins.js';
import { resolveLanguage, translations } from './i18n/translations.js';
import { submitLeaderboardScore } from './utils/leaderboard.js';
import { usePwaInstall } from './utils/pwaInstall.js';
import { createDefaultState, loadState, saveState } from './utils/storage.js';

export function App() {
  const isExtensionContext =
    typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.id);
  // 확장 팝업이 아닌 일반 웹·모바일 접속 시 자동 반응형 모드 적용 목적
  const isFullTab =
    !isExtensionContext ||
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('mode') === 'full');

  const [appState, setAppState] = useState(() => createDefaultState());
  const appStateRef = useRef(appState);
  appStateRef.current = appState;

  const [currentScreen, setCurrentScreen] = useState('lobby');
  const [nicknameDialogOpen, setNicknameDialogOpen] = useState(false);
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

  // 업데이터 부수효과 방지를 위해 상태 계산 후 외부에서 저장 수행 목적
  function commitStateUpdate(updater) {
    const nextState = updater(appStateRef.current);
    appStateRef.current = nextState;
    setAppState(nextState);
    saveState(nextState);
    return nextState;
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
    const earnedStars = Number.isFinite(result?.starsEarned)
      ? Math.max(0, Math.floor(result.starsEarned))
      : 0;
    const finalScore = Number.isFinite(result?.score)
      ? Math.max(0, Math.floor(result.score))
      : 0;

    const nextState = commitStateUpdate((previousState) => ({
      ...previousState,
      stars: previousState.stars + earnedStars,
      highScores: {
        ...previousState.highScores,
        [gameType]: Math.max(previousState.highScores[gameType] || 0, finalScore)
      }
    }));

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
  }

  function handleSaveNickname(newNickname) {
    setNicknameDialogOpen(false);
    const nextState = commitStateUpdate((previousState) => ({
      ...previousState,
      nickname: newNickname
    }));

    const gameTypes = ['dodge', 'stack'];
    for (let index = 0; index < gameTypes.length; index += 1) {
      const gameType = gameTypes[index];
      const bestScore = nextState.highScores[gameType] || 0;
      if (bestScore > 0 || gameType === 'dodge') {
        submitLeaderboardScore({
          gameType,
          nickname: newNickname,
          score: bestScore,
          skinId: nextState.equippedSkin
        }).catch((syncError) => {
          console.warn('Leaderboard nickname sync skipped:', syncError);
        });
      }
    }
  }

  function handleUnlockSkin(skinId) {
    commitStateUpdate((previousState) => unlockSkin(previousState, skinId));
  }

  function handleEquipSkin(skinId) {
    const nextState = commitStateUpdate((previousState) => equipSkin(previousState, skinId));
    if (nextState.nickname) {
      for (const gameType of ['dodge', 'stack']) {
        const bestScore = nextState.highScores[gameType] || 0;
        if (bestScore > 0) {
          submitLeaderboardScore({
            gameType,
            nickname: nextState.nickname,
            score: bestScore,
            skinId: nextState.equippedSkin
          }).catch(() => {});
        }
      }
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
        onSave={handleSaveNickname}
        onClose={() => setNicknameDialogOpen(false)}
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
