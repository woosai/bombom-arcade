// 모바일(Android/iOS) 홈 화면 바로가기 설치 상태 감지 및 프롬프트 제어 훅

import { useEffect, useState } from 'react';

export function isRunningStandalone() {
  if (typeof window === 'undefined') {
    return false;
  }
  const mediaStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = Boolean(window.navigator?.standalone);
  return mediaStandalone || iosStandalone;
}

export function isIosDevice(userAgent = '') {
  const normalized = String(userAgent).toLowerCase();
  const isAppleHandheld = /iphone|ipad|ipod/.test(normalized);
  const isIpadDesktopMode =
    normalized.includes('macintosh') &&
    typeof navigator !== 'undefined' &&
    navigator.maxTouchPoints > 1;
  return isAppleHandheld || isIpadDesktopMode;
}

export function isAndroidDevice(userAgent = '') {
  return /android/i.test(String(userAgent));
}

export function usePwaInstall(isExtensionContext) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [standalone, setStandalone] = useState(() => isRunningStandalone());

  useEffect(() => {
    if (isExtensionContext || typeof window === 'undefined') {
      return undefined;
    }

    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredPrompt(event);
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setStandalone(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isExtensionContext]);

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const ios = isIosDevice(userAgent);
  const android = isAndroidDevice(userAgent);

  // 이미 홈 화면 앱으로 실행 중이거나 크롬 확장 팝업이면 설치 버튼 숨김
  let installMode = 'none';
  if (!isExtensionContext && !standalone) {
    if (deferredPrompt) {
      installMode = 'native';
    } else if (ios) {
      installMode = 'ios-guide';
    } else if (android) {
      installMode = 'android-guide';
    }
  }

  async function triggerNativeInstall() {
    if (!deferredPrompt) {
      return false;
    }
    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    if (choiceResult?.outcome === 'accepted') {
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }

  return {
    installMode,
    triggerNativeInstall
  };
}
