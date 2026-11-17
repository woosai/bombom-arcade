// 6종 스킨 도감 조회, 별 해금 및 장착 전환 화면 컴포넌트

import React from 'react';
import { SKINS } from '../games/skins.js';

export function SkinShop({
  stars,
  unlockedSkins,
  equippedSkinId,
  activeLang,
  onUnlockSkin,
  onEquipSkin,
  text
}) {
  return (
    <main className="shop-main">
      <div className="shop-intro">
        <h1 className="shop-title">{text.skinShopTitle}</h1>
        <p className="shop-subtitle">{text.skinShopSub}</p>
        <p className="shop-exchange-hint">{text.starExchangeHint}</p>
      </div>

      <div className="skin-grid">
        {SKINS.map((skinItem) => {
          const isEquipped = equippedSkinId === skinItem.id;
          const isUnlocked = unlockedSkins.includes(skinItem.id);
          const canAfford = stars >= skinItem.cost;
          const localizedName = skinItem.name[activeLang] || skinItem.name.en;

          let actionControl;
          if (isEquipped) {
            actionControl = (
              <button
                type="button"
                className="skin-action-btn is-equipped"
                disabled
              >
                {text.equipped}
              </button>
            );
          } else if (isUnlocked) {
            actionControl = (
              <button
                type="button"
                className="skin-action-btn is-unlocked"
                onClick={() => onEquipSkin(skinItem.id)}
              >
                {text.equip}
              </button>
            );
          } else if (canAfford) {
            actionControl = (
              <button
                type="button"
                className="skin-action-btn is-affordable"
                onClick={() => onUnlockSkin(skinItem.id)}
              >
                {skinItem.cost} <span aria-hidden="true">🌟</span>{' '}
                {text.unlockWithStars}
              </button>
            );
          } else {
            actionControl = (
              <button
                type="button"
                className="skin-action-btn is-locked"
                disabled
              >
                {skinItem.cost} <span aria-hidden="true">🌟</span> (
                {text.needMoreStars})
              </button>
            );
          }

          return (
            <article
              key={skinItem.id}
              className={`skin-card${isEquipped ? ' is-active-skin' : ''}`}
            >
              <div className="skin-card-head">
                <span className="skin-badge" aria-hidden="true">
                  {skinItem.badge}
                </span>
                <div
                  className="skin-swatch"
                  style={{
                    background: `linear-gradient(135deg, ${skinItem.primary}, ${skinItem.secondary})`
                  }}
                  aria-hidden="true"
                />
              </div>
              <h2 className="skin-name">{localizedName}</h2>
              {actionControl}
            </article>
          );
        })}
      </div>
    </main>
  );
}
