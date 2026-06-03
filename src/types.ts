/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// パワーアップ（おみせのアイテム）の定義
export interface UpgradeItem {
  id: string;
  name: string; // ひらがな・カタカナ表記
  description: string; // ひらがな表記
  emoji: string;
  cost: number;
  baseCost: number;
  level: number;
  multiplier: number; // 1レベルあたりの増加量
  type: 'click' | 'auto'; // タップ強化 or 自動生産
}

// ほうせきの定義
export interface Gem {
  id: string;
  name: string; // ひらがな・カタカナ
  description: string; // ひらがな
  emoji: string;
  rarity: 'common' | 'rare' | 'legendary'; // レア度
  color: string; // Tailwindカラー（グラデーション用）
  unlocked: boolean;
  count: number;
}

// ゲームのセーブデータの定義
export interface SaveData {
  ores: number;
  totalOresEver: number;
  clickPower: number;
  autoPower: number;
  upgrades: { [id: string]: number }; // id: level
  unlockedGems: { [id: string]: number }; // id: count
  isMuted: boolean;
  equippedGemId?: string | null;
}

