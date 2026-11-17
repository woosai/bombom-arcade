// 전역 영속 상태, 화면 라우팅, 다국어·확대 모드 동기화를 담당하는 루트 앱 컴포넌트

import React, { useEffect, useState } from 'react';
import { GameShell } from './components/GameShell.jsx';
import { Header } from './components/Header.jsx';
import { Lobby } from './components/Lobby.jsx';
import { SkinShop } from './components/SkinShop.jsx';
import { SKINS, equipSkin, unlockSkin } from './games/skins.js';
import { resolveLanguage, translations } from './i18n/translations.js';
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
  const [currentScreen, setCurrentScreen] = useState('lobby');

  const navigatorLanguage =
    typeof navigator !== 'undefined' ? navigator.language : 'en';
  const activeLang = resolveLanguage(appState.settings.lang, navigatorLanguage);
  const text = translations[activeLang] || translations.en;

  useEffect(() => {
    let cancelled = false;
    loadState().then((loadedState) => {
      if (!cancelled) {
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

  // 상태 변경 즉시 로컬·확장 저장소 동기화 목적
  function commitStateUpdate(updater) {
    setAppState((previousState) => {
      const nextState = updater(previousState);
      saveState(nextState);
      return nextState;
    });
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

    commitStateUpdate((previousState) => ({
      ...previousState,
      stars: previousState.stars + earnedStars,
      highScores: {
        ...previousState.highScores,
        [gameType]: Math.max(previousState.highScores[gameType] || 0, finalScore)
      }
    }));
  }

  function handleUnlockSkin(skinId) {
    commitStateUpdate((previousState) => unlockSkin(previousState, skinId));
  }

  function handleEquipSkin(skinId) {
    commitStateUpdate((previousState) => equipSkin(previousState, skinId));
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
          highScores={appState.highScores}
          unlockedCount={appState.unlockedSkins.length}
          totalSkins={SKINS.length}
          onSelectGame={(gameType) => setCurrentScreen(gameType)}
          onOpenShop={() => setCurrentScreen('shop')}
          text={text}
        />
      )}

      {(currentScreen === 'dodge' || currentScreen === 'stack') && (
        <GameShell
          key={currentScreen}
          gameType={currentScreen}
          equippedSkinId={appState.equippedSkin}
          highScore={appState.highScores[currentScreen] || 0}
          muted={appState.settings.muted}
          text={text}
          onGameOverPersist={handleGameOverPersist}
          onBackToLobby={() => setCurrentScreen('lobby')}
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
    </div>
  );
}
export default App;
