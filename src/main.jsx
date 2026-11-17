// React 루트 마운트 및 전역 스타일시트 진입점

import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import './styles/app.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

// 크롬 확장 환경이 아닌 일반 웹 접속 시에만 PWA 서비스 워커 등록 목적
const isExtensionRuntime =
  typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.id);
if (!isExtensionRuntime && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
