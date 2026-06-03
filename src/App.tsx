/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, RotateCcw, HelpCircle, Trophy, ShoppingBag, Sparkles, QrCode, Share2, Check, X } from 'lucide-react';
import { UpgradeItem, Gem, SaveData } from './types';
import { INITIAL_UPGRADES, INITIAL_GEMS } from './utils/initialData';
import { audio } from './utils/audio';

declare const __LOCAL_IP__: string;

interface Skill {
  id: string;
  name: string;
  emoji: string;
  description: string;
  gemId: string;
  duration: number;
  cooldown: number;
  color: string;
  activeColor: string;
  cost: number;
}

const SKILLS: Skill[] = [
  {
    id: 'ruby_burn',
    name: 'ルビー・バーニング',
    emoji: '🔥',
    description: '15びょうかん、タップしたときのこうせきが 5ばい！',
    gemId: 'gem_ruby',
    duration: 15,
    cooldown: 45,
    color: 'from-red-500 to-rose-600',
    activeColor: 'shadow-red-500/50 ring-red-400',
    cost: 100,
  },
  {
    id: 'sapphire_freeze',
    name: 'タイム・フリーズ',
    emoji: '❄️',
    description: '10びょうかん、じどうではっくつするスピードが 10ばい！',
    gemId: 'gem_sapphire',
    duration: 10,
    cooldown: 45,
    color: 'from-blue-500 to-indigo-600',
    activeColor: 'shadow-blue-500/50 ring-blue-400',
    cost: 500,
  },
  {
    id: 'emerald_rain',
    name: 'エメラルド・レイン',
    emoji: '🌲',
    description: '15びょうかん、そらからエメラルドがふりそそぎ、こうせきがじどうでふえる！',
    gemId: 'gem_emerald',
    duration: 15,
    cooldown: 60,
    color: 'from-emerald-500 to-teal-600',
    activeColor: 'shadow-emerald-500/50 ring-emerald-400',
    cost: 1500,
  },
  {
    id: 'topaz_luck',
    name: 'ラッキー・ラッシュ',
    emoji: '✨',
    description: '20びょうかん、まぼろしのほうせきのドロップりつが 5ばい！',
    gemId: 'gem_topaz',
    duration: 20,
    cooldown: 60,
    color: 'from-amber-400 to-yellow-500',
    activeColor: 'shadow-amber-500/50 ring-amber-400',
    cost: 4000,
  },
  {
    id: 'amethyst_magic',
    name: 'ダブル・マジック',
    emoji: '🔮',
    description: '15びょうかん、すべてのこうせきかくとくが ランダムで 2ばい〜4ばい！',
    gemId: 'gem_amethyst',
    duration: 15,
    cooldown: 60,
    color: 'from-purple-500 to-violet-600',
    activeColor: 'shadow-purple-500/50 ring-purple-400',
    cost: 8000,
  },
  {
    id: 'diamond_rainbow',
    name: 'レインボー・オメガ',
    emoji: '👑',
    description: '10びょうかん、タップパワーとじどうパワーが 10ばいになる究極スキル！',
    gemId: 'gem_rainbow_diamond',
    duration: 10,
    cooldown: 90,
    color: 'from-pink-500 via-purple-500 to-cyan-500',
    activeColor: 'shadow-pink-500/50 ring-pink-400 animate-pulse',
    cost: 25000,
  },
];

export default function App() {
  // 一番最初はローカルストレージの読み込みを試みる
  const [ores, setOres] = useState<number>(0);
  const [totalOresEver, setTotalOresEver] = useState<number>(0);
  const [clickPower, setClickPower] = useState<number>(1);
  const [autoPower, setAutoPower] = useState<number>(0);
  const [upgrades, setUpgrades] = useState<UpgradeItem[]>(INITIAL_UPGRADES);
  const [gems, setGems] = useState<Gem[]>(INITIAL_GEMS);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [equippedGemId, setEquippedGemId] = useState<string | null>(null);

  // 画面タブの切り替え ('shop' | 'album')
  const [activeTab, setActiveTab] = useState<'shop' | 'album'>('shop');

  // エフェクト用のパーティクル配列
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    text: string;
    emoji?: string;
  }>>([]);
  const particleIdRef = useRef(0);
  const gemTimeoutRef = useRef<any>(null);

  // たからもの（まぼろしのほうせき）を発見したときのモーダル用
  const [foundGem, setFoundGem] = useState<Gem | null>(null);
  const [gemBonus, setGemBonus] = useState<number>(0);

  // 鉱石ランクアップお祝いトースト用
  const [rankUpMessage, setRankUpMessage] = useState<string | null>(null);

  // あそびかたモーダル表示
  const [showHelp, setShowHelp] = useState<boolean>(false);

  // リセットかくにんモーダル表示
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // セーブしましたマークの表示フラグ
  const [showSaveAlert, setShowSaveAlert] = useState<boolean>(false);

  // 岩のタップ時にぷるんと動くためのトリガー
  const [rockScale, setRockScale] = useState<number>(1);

  // アクティブスキル状態管理
  const [activeSkills, setActiveSkills] = useState<{ [id: string]: boolean }>({});
  const [skillCooldowns, setSkillCooldowns] = useState<{ [id: string]: number }>({});

  // スマホ実機連携・公開共有モーダル表示
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // これまでに採掘した「ほうせき」の総数
  const totalGemsMined = gems.reduce((sum, g) => sum + g.count, 0);

  // 鉱山ランク(Tier)の決定
  let mineTier = 1;
  let mineName = 'ちいさな石のいわ 🪨';
  let nextTierGoal = 10;
  if (totalGemsMined >= 30) {
    mineTier = 3;
    mineName = 'でんせつの金のいわ 🌟✨';
    nextTierGoal = 99999;
  } else if (totalGemsMined >= 10) {
    mineTier = 2;
    mineName = 'きらめく銀のいわ 🪙✨';
    nextTierGoal = 30;
  }

  // 鉱石ランクに応じた岩のデザイン定義
  const getRockStyle = () => {
    if (mineTier === 3) {
      return {
        bg: 'bg-gradient-to-tr from-yellow-600 via-amber-400 to-yellow-100',
        border: 'border-yellow-500',
        shadow: 'shadow-[0_0_25px_rgba(245,158,11,0.6)] shadow-yellow-500/50',
      };
    } else if (mineTier === 2) {
      return {
        bg: 'bg-gradient-to-tr from-slate-400 via-zinc-300 to-slate-100',
        border: 'border-slate-400',
        shadow: 'shadow-[0_0_20px_rgba(203,213,225,0.5)] shadow-slate-300/40',
      };
    } else {
      return {
        bg: 'bg-gradient-to-tr from-stone-600 via-stone-500 to-stone-400',
        border: 'border-stone-700',
        shadow: 'shadow-stone-800/40',
      };
    }
  };

  const getEquippedRockStyle = () => {
    if (!equippedGemId) {
      return getRockStyle();
    }
    const gem = gems.find(g => g.id === equippedGemId);
    if (!gem) return getRockStyle();

    let bgGrad = 'from-stone-600 to-stone-400';
    if (gem.id === 'gem_ruby') bgGrad = 'from-rose-500 to-red-600';
    else if (gem.id === 'gem_sapphire') bgGrad = 'from-blue-500 to-indigo-600';
    else if (gem.id === 'gem_emerald') bgGrad = 'from-emerald-500 to-teal-600';
    else if (gem.id === 'gem_topaz') bgGrad = 'from-amber-400 to-yellow-500';
    else if (gem.id === 'gem_amethyst') bgGrad = 'from-purple-500 to-violet-600';
    else if (gem.id === 'gem_rainbow_diamond') bgGrad = 'from-pink-400 via-purple-400 to-cyan-400';

    return {
      bg: `bg-gradient-to-tr ${bgGrad}`,
      border: 'border-white/80',
      shadow: `shadow-[0_0_25px_rgba(255,255,255,0.5)]`,
    };
  };

  // ホスト判定と共有用URLの構築
  const isLocalhost = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  
  // @ts-ignore
  const localIp = typeof __LOCAL_IP__ !== 'undefined' ? __LOCAL_IP__ : 'localhost';
  const port = typeof window !== 'undefined' ? window.location.port : '3000';
  const shareUrl = isLocalhost
    ? `http://${localIp}:${port}`
    : (typeof window !== 'undefined' ? window.location.origin : '');

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 初期化（ローカルストレージからロード）
  useEffect(() => {
    try {
      const saved = localStorage.getItem('zakuzaku_save_v1');
      if (saved) {
        const parsed: SaveData = JSON.parse(saved);
        setOres(parsed.ores);
        setTotalOresEver(parsed.totalOresEver || parsed.ores);
        setClickPower(parsed.clickPower || 1);
        setAutoPower(parsed.autoPower || 0);
        setIsMuted(parsed.isMuted || false);
        audio.isMuted = parsed.isMuted || false;
        setEquippedGemId(parsed.equippedGemId !== undefined ? parsed.equippedGemId : null);

        // アップグレードレベルの復元
        if (parsed.upgrades) {
          setUpgrades(prev =>
            prev.map(item => {
              const lvl = parsed.upgrades[item.id] || 0;
              // コスト再計算: cost = baseCost * (1.15 ^ level)
              const newCost = Math.round(item.baseCost * Math.pow(1.25, lvl));
              return {
                ...item,
                level: lvl,
                cost: newCost,
              };
            })
          );
        }

        // ほうせきアンロック状態の復元
        if (parsed.unlockedGems) {
          setGems(prev =>
            prev.map(gem => {
              const count = parsed.unlockedGems[gem.id] || 0;
              return {
                ...gem,
                unlocked: count > 0,
                count: count,
              };
            })
          );
        }
      }
    } catch (e) {
      console.error('Save loading failed:', e);
    }
  }, []);

  // 自動生産タイマー（秒間 autoPower 分、スムーズに増やすため100msごとに加算、スキル効果を動的に反映）
  useEffect(() => {
    const hasEmeraldRain = activeSkills['emerald_rain'];
    if (autoPower <= 0 && !hasEmeraldRain) return;

    const interval = setInterval(() => {
      let currentTickAutoPower = autoPower;
      
      // 1. エメラルドレイン：ベース+30、自動パワー2倍
      if (activeSkills['emerald_rain']) {
        currentTickAutoPower = currentTickAutoPower * 2 + 30;
      }
      // 2. タイムフリーズ：自動パワー10倍
      if (activeSkills['sapphire_freeze']) {
        currentTickAutoPower *= 10;
      }
      // 3. レインボーオメガ：自動パワー10倍
      if (activeSkills['diamond_rainbow']) {
        currentTickAutoPower *= 10;
      }
      // 4. ダブルマジック：自動パワー3倍
      if (activeSkills['amethyst_magic']) {
        currentTickAutoPower *= 3;
      }

      const amount = currentTickAutoPower / 10;
      if (amount > 0) {
        setOres(prev => prev + amount);
        setTotalOresEver(prev => prev + amount);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [autoPower, activeSkills]);

  // スキル用クールダウンカウントダウンタイマー (1秒ごとに減少)
  useEffect(() => {
    const timer = setInterval(() => {
      setSkillCooldowns(prev => {
        const next = { ...prev };
        let updated = false;
        for (const id in next) {
          if (next[id] > 0) {
            next[id] -= 1;
            updated = true;
          }
        }
        return updated ? next : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ランクアップトーストの自動消滅
  useEffect(() => {
    if (rankUpMessage) {
      const timer = setTimeout(() => {
        setRankUpMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [rankUpMessage]);

  // 定期的なオートセーブ（2秒ごと）と、ミュート状態の連動
  useEffect(() => {
    const saveTimer = setInterval(() => {
      saveGame();
    }, 2000);

    return () => clearInterval(saveTimer);
  }, [ores, totalOresEver, clickPower, autoPower, upgrades, gems, isMuted, equippedGemId]);

  // セーブ処理
  const saveGame = () => {
    try {
      const upgradeLevels: { [id: string]: number } = {};
      upgrades.forEach(u => {
        upgradeLevels[u.id] = u.level;
      });

      const gemCounts: { [id: string]: number } = {};
      gems.forEach(g => {
        gemCounts[g.id] = g.count;
      });

      const saveData: SaveData = {
        ores: Math.floor(ores),
        totalOresEver: Math.floor(totalOresEver),
        clickPower,
        autoPower,
        upgrades: upgradeLevels,
        unlockedGems: gemCounts,
        isMuted,
        equippedGemId,
      };

      localStorage.setItem('zakuzaku_save_v1', JSON.stringify(saveData));
    } catch (e) {
      console.error('Save failed:', e);
    }
  };

  // ミュート切り替え
  const toggleMute = () => {
    const currentMute = audio.toggleMute();
    setIsMuted(currentMute);
  };

  // タップ処理のコアロジック (マウスクリック＆マルチタッチ共通)
  const triggerTap = (x: number, y: number) => {
    audio.playTap();

    // 触覚フィードバック（振動）を送る
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(15);
      } catch (err) {}
    }

    // 岩ぷるんアニメーションのトリガー
    setRockScale(0.9);
    setTimeout(() => setRockScale(1), 80);

    // スキルによるタップパワーの倍率計算
    let finalClickPower = clickPower;
    
    // 1. ルビー・バーニング：タップパワー 5倍
    if (activeSkills['ruby_burn']) {
      finalClickPower *= 5;
    }
    // 2. レインボーオメガ：タップパワー 10倍
    if (activeSkills['diamond_rainbow']) {
      finalClickPower *= 10;
    }
    // 3. ダブルマジック：タップパワー 2倍〜4倍ランダム
    if (activeSkills['amethyst_magic']) {
      const mult = Math.floor(Math.random() * 3) + 2; // 2, 3, or 4
      finalClickPower *= mult;
    }

    // ポイント追加
    setOres(prev => prev + finalClickPower);
    setTotalOresEver(prev => prev + finalClickPower);

    const newId = particleIdRef.current++;

    // 飛び散る絵文字をランダムセレクト
    const tapEmojis = ['✨', '💎', '⭐', '🪙', '⛏️', '🌈'];
    const randomEmoji = tapEmojis[Math.floor(Math.random() * tapEmojis.length)];

    const newParticle = {
      id: newId,
      x: x,
      y: y,
      text: `+${finalClickPower}`,
      emoji: randomEmoji,
    };

    setParticles(prev => [...prev].slice(-15).concat(newParticle)); // 最大15個保持

    // 1秒後に古いパーティクルを消す
    setTimeout(() => {
      setParticles(prev => prev.filter(p => p.id !== newId));
    }, 1000);

    // ほうせき（たからもの）のドロップ抽選！
    const normalLevel = upgrades.find(u => u.id === 'normal_pickaxe')?.level || 0;
    const magicLevel = upgrades.find(u => u.id === 'magic_pickaxe')?.level || 0;
    let dropChance = 0.008 + (normalLevel * 0.0005) + (magicLevel * 0.002);

    // 4. ラッキーラッシュ：ドロップ率 5倍
    if (activeSkills['topaz_luck']) {
      dropChance *= 5;
    }
    // 5. レインボーオメガ：ドロップ率 3倍
    if (activeSkills['diamond_rainbow']) {
      dropChance *= 3;
    }

    if (Math.random() < dropChance) {
      triggerGemDrop();
    }
  };

  // 岩をマウスクリックしたとき (PC用フォールバック)
  const handleTapRock = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - container.left;
    const y = e.clientY - container.top;
    triggerTap(x || container.width / 2, y || container.height / 2);
  };

  // 岩をタッチしたとき (スマホ用マルチタッチ対応・遅延なし)
  const handleTouchRock = (e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault(); // スクロールやピンチズーム等のデフォルト動作を完全に防止
    const container = e.currentTarget.getBoundingClientRect();
    
    // 同時に発生した新規タッチ全てを処理
    Array.from(e.changedTouches).forEach((touch: React.Touch) => {
      const x = touch.clientX - container.left;
      const y = touch.clientY - container.top;
      triggerTap(x, y);
    });
  };

  // たからもの（ほうせき）を発見したときの演出
  const triggerGemDrop = () => {
    // どのほうせきをドロップさせるか抽選
    const rand = Math.random() * 100;
    let targetRarity: 'common' | 'rare' | 'legendary' = 'common';

    if (rand < 2) {
      targetRarity = 'legendary'; // 2% 伝説ダイヤ
    } else if (rand < 30) {
      targetRarity = 'rare'; // 28% エメラルド、トパーズ、アメジスト
    } else {
      targetRarity = 'common'; // 70% ルビー、サファイア
    }

    // 鉱山ランクに応じたレア度制限
    if (mineTier === 1) {
      targetRarity = 'common';
    } else if (mineTier === 2 && targetRarity === 'legendary') {
      targetRarity = 'rare';
    }

    // 該当するレア度のほうせきをフィルタ
    const matchedGems = gems.filter(g => g.rarity === targetRarity);
    if (matchedGems.length === 0) return;

    // その中からランダムで1つ
    const chosenGem = matchedGems[Math.floor(Math.random() * matchedGems.length)];

    // ほうせきボーナスこうせき
    let bonus = 100;
    if (targetRarity === 'rare') bonus = 1000;
    if (targetRarity === 'legendary') bonus = 10000;

    // サウンド再生＆ステート更新
    audio.playShiny();
    setGemBonus(bonus);
    setFoundGem(chosenGem);

    // 既存の自動消滅タイマーがあればクリアし、3.5秒後に閉じるタイマーを新規セット
    if (gemTimeoutRef.current) {
      clearTimeout(gemTimeoutRef.current);
    }
    gemTimeoutRef.current = setTimeout(() => {
      setFoundGem(null);
    }, 3500);

    // ほうせき発見時のスペシャル振動演出
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        if (targetRarity === 'legendary') {
          navigator.vibrate([100, 50, 100, 50, 200]); // でんせつ：豪華な3連振動
        } else if (targetRarity === 'rare') {
          navigator.vibrate([65, 45, 100]); // めずらしい：2連振動
        } else {
          navigator.vibrate(80); // ふつう：長めの1回振動
        }
      } catch (err) {}
    }

    // ほうせきリストのアンロック＆カウントアップ
    setGems(prev => {
      const nextGems = prev.map(g => {
        if (g.id === chosenGem.id) {
          return {
            ...g,
            unlocked: true,
            count: g.count + 1,
          };
        }
        return g;
      });

      // 新旧の宝石総数を比較してランクアップ判定
      const oldTotal = prev.reduce((sum, g) => sum + g.count, 0);
      const newTotal = nextGems.reduce((sum, g) => sum + g.count, 0);

      if (oldTotal < 10 && newTotal >= 10) {
        audio.playShiny();
        setRankUpMessage('🥈 ぎんのいわ（銀鉱山）に ランクアップ！');
      } else if (oldTotal < 30 && newTotal >= 30) {
        audio.playShiny();
        setRankUpMessage('👑 きんのいわ（金鉱山）に ランクアップ！');
      }

      return nextGems;
    });

    // ボーナスのこうせきをあげる！
    setOres(prev => prev + bonus);
    setTotalOresEver(prev => prev + bonus);
    saveGame();
  };

  // おみせでパワーアップを買う
  const handleBuyUpgrade = (upgrade: UpgradeItem) => {
    if (ores < upgrade.cost) return;

    audio.playBuy();

    // こうせきを消費
    setOres(prev => prev - upgrade.cost);

    // レベルアップと新コスト算出 (コストは1.25倍ずつ増える)
    const nextLevel = upgrade.level + 1;
    const nextCost = Math.round(upgrade.baseCost * Math.pow(1.25, nextLevel));

    setUpgrades(prev =>
      prev.map(item => {
        if (item.id === upgrade.id) {
          return {
            ...item,
            level: nextLevel,
            cost: nextCost,
          };
        }
        return item;
      })
    );

    // パワーの再計算
    if (upgrade.type === 'click') {
      setClickPower(prev => prev + upgrade.multiplier);
    } else {
      setAutoPower(prev => prev + upgrade.multiplier);
    }

    // セーブマーク表示
    setShowSaveAlert(true);
    setTimeout(() => setShowSaveAlert(false), 1500);
  };

  // ゲームのリセット（さいしょからやりなおす）
  const handleResetGame = () => {
    localStorage.removeItem('zakuzaku_save_v1');
    setOres(0);
    setTotalOresEver(0);
    setClickPower(1);
    setAutoPower(0);
    setUpgrades(INITIAL_UPGRADES);
    setGems(INITIAL_GEMS);
    setEquippedGemId(null);
    setShowResetConfirm(false);
    audio.playBuy();
  };

  // レア度のおなまえをひらがなにする
  const getRarityLabel = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'ふつう ⭐️';
      case 'rare': return 'めずらしい 🌟';
      case 'legendary': return 'でんせつ 👑';
      default: return 'ふつう';
    }
  };

  // 現在いる鉱山の深さの称号 (こうき君が喜ぶ、掘れば掘るほど進む称号)
  const getMineTitle = () => {
    if (totalOresEver < 50) return '🔰 はじめての こうふ';
    if (totalOresEver < 200) return '⛏️ みならい ほりあてき';
    if (totalOresEver < 1000) return '🤖 ロボットの おともだち';
    if (totalOresEver < 5000) return '🔥 ざくざく はっくつたい';
    if (totalOresEver < 20000) return '💎 ほうせきハンター';
    if (totalOresEver < 100000) return '🌀 ちかていこくの ぬし';
    return '👑 でんせつの ほうせきマスター';
  };

  // アクティブスキル使用処理
  const handleUseSkill = (skill: Skill) => {
    const gem = gems.find(g => g.id === skill.gemId);
    const isUnlocked = gem && gem.unlocked; // 宝石を発見していれば、個数に関わらず永久に解放！
    if (!isUnlocked) return;

    // クールダウン中、またはこうせきが足りない場合は発動不可
    if ((skillCooldowns[skill.id] || 0) > 0 || ores < skill.cost) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(80); // 発動できない合図に短めのバイブ
        } catch (e) {}
      }
      return;
    }

    // 効果音再生
    audio.playBuy();

    // こうせきを消費！
    setOres(prev => Math.max(0, prev - skill.cost));

    // スキルを発動状態にする
    setActiveSkills(prev => ({ ...prev, [skill.id]: true }));

    // クールダウンをセット
    setSkillCooldowns(prev => ({ ...prev, [skill.id]: skill.cooldown }));

    // 振動フィードバック
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([40, 20, 40]);
      } catch (e) {}
    }

    // 効果時間が終了したら解除
    setTimeout(() => {
      setActiveSkills(prev => ({ ...prev, [skill.id]: false }));
    }, skill.duration * 1000);
  };

  // スキル発動時の岩のグロー・エフェクトクラス
  const getRockEffectClass = () => {
    if (activeSkills['diamond_rainbow']) return 'shadow-[0_0_35px_rgba(244,63,94,0.75)] border-pink-400 ring-4 ring-cyan-300 ring-offset-2 ring-offset-amber-100 animate-pulse scale-105';
    if (activeSkills['ruby_burn']) return 'shadow-[0_0_30px_rgba(239,68,68,0.85)] border-red-500 animate-pulse';
    if (activeSkills['sapphire_freeze']) return 'shadow-[0_0_30px_rgba(59,130,246,0.85)] border-blue-500';
    if (activeSkills['emerald_rain']) return 'shadow-[0_0_25px_rgba(16,185,129,0.7)] border-emerald-400';
    if (activeSkills['amethyst_magic']) return 'shadow-[0_0_25px_rgba(139,92,246,0.75)] border-purple-500 animate-bounce-short';
    return '';
  };

  // スキルボタンのレンダリング
  const renderSkillButton = (skill: Skill) => {
    const gem = gems.find(g => g.id === skill.gemId);
    const isUnlocked = gem && gem.unlocked; // 発見していれば永久解放
    const isActive = activeSkills[skill.id];
    const cooldown = skillCooldowns[skill.id] || 0;
    const hasEnoughOres = ores >= skill.cost;

    if (!isUnlocked) {
      let requiredTierText = '';
      const gemRarity = gem?.rarity;
      if (gemRarity === 'rare') {
        requiredTierText = 'ぎんのいわ🪙（ほうせき10こ）から！\n';
      } else if (gemRarity === 'legendary') {
        requiredTierText = 'きんのいわ🌟（ほうせき30こ）から！\n';
      }

      return (
        <div
          key={skill.id}
          className="w-11 h-11 rounded-full bg-stone-200/80 border-2 border-stone-300 flex items-center justify-center text-stone-400 select-none shadow-inner group relative"
          title="未解放のスキル"
        >
          <span className="text-xs">🔒</span>
          <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-[8px] font-bold p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-32 text-center leading-normal z-50 shadow-md whitespace-pre-wrap">
            {requiredTierText}{gems.find(g => g.id === skill.gemId)?.name} をみつけると かいほう！
          </div>
        </div>
      );
    }

    return (
      <button
        key={skill.id}
        onClick={() => handleUseSkill(skill)}
        disabled={cooldown > 0 || !hasEnoughOres}
        className={`w-11 h-11 rounded-full bg-gradient-to-br ${skill.color} text-white flex flex-col items-center justify-center relative select-none shadow-md border-2 border-white transition-all active:scale-90 group ${
          isActive 
            ? `ring-4 ${skill.activeColor} scale-105 animate-pulse` 
            : cooldown > 0 || !hasEnoughOres
              ? 'opacity-40 cursor-not-allowed saturate-50' 
              : 'hover:scale-105 hover:shadow-lg'
        }`}
      >
        <span className="text-lg leading-none select-none pointer-events-none">{skill.emoji}</span>
        
        {isActive && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
        )}

        {cooldown > 0 && !isActive && (
          <div className="absolute inset-0 bg-stone-900/85 rounded-full flex items-center justify-center text-[10px] font-black text-white select-none">
            {cooldown}s
          </div>
        )}

        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-stone-800 text-white text-[8px] font-bold p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-32 text-center leading-normal z-50 shadow-md">
          <p className="font-extrabold text-[9px] text-amber-200">{skill.name}</p>
          <p className="text-[7px] text-stone-300 mt-0.5 leading-tight">{skill.description}</p>
          <p className={`text-[8px] font-black mt-1 ${hasEnoughOres ? 'text-emerald-300' : 'text-rose-300 animate-pulse'}`}>
            消費こうせき: {skill.cost}こ {hasEnoughOres ? '✅' : '❌'}
          </p>
        </div>
      </button>
    );
  };

  return (
    <div id="game-container" className="w-full h-full max-w-md mx-auto flex flex-col justify-between overflow-hidden bg-gradient-to-b from-[#fffef3] to-[#ffeebf] p-3 text-slate-800 relative select-none">
      
      {/* 1. ヘッダーゾーン：こうせきカウンターと称号 (画面の約18%高) */}
      <div id="game-header" className="flex flex-col items-center pt-2 pb-1 relative z-10 shrink-0">
        <div className="flex justify-between w-full items-center px-1 mb-1">
          {/* しょうごう（称号） */}
          <span className="text-xs bg-amber-200 border-2 border-amber-400 text-amber-900 px-2 py-1 rounded-full font-bold shadow-xs">
            {getMineTitle()}
          </span>

          {/* セーブ表示＆スピーカー */}
          <div className="flex items-center gap-1.5">
            {showSaveAlert && (
              <span className="text-[10px] bg-emerald-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                せーぶしたよ 💾
              </span>
            )}
            {/* スマホ連携・共有ボタン */}
            <button
              onClick={() => setShowQrModal(true)}
              className="p-1.5 rounded-full bg-white border-2 border-amber-300 text-amber-600 active:scale-90 transition-transform shadow-xs flex items-center justify-center"
              title={isLocalhost ? 'スマホであそぶ' : 'URLを共有'}
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-full bg-white border-2 border-amber-300 text-amber-600 active:scale-90 transition-transform shadow-xs"
              title="おとのきりかえ"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* メインのこうせきカウンター */}
        <div className="text-center mt-0.5">
          <p className="text-xs font-bold text-amber-800 tracking-tight">✨ ほりあてた こうせき ✨</p>
          <div className="flex items-baseline justify-center gap-1 relative">
            <motion.span
              key={Math.floor(ores)}
              initial={{ scale: 1.15 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 10 }}
              className="text-4xl font-extrabold text-amber-600 drop-shadow-[0_2px_0px_rgba(255,255,255,1)]"
            >
              {Math.floor(ores).toLocaleString()}
            </motion.span>
            <span className="text-lg font-bold text-amber-800">こ</span>
          </div>
          {/* 自動増加レート */}
          {autoPower > 0 && (
            <p className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-0.5 border border-emerald-200">
              じどうで 1びょうに +{autoPower}こ ほりちゅう！ 🤖
            </p>
          )}
        </div>
      </div>

      {/* 2. メイン発掘エリア：大きな岩、パーティクル、および左右スキルボタン (画面の約43%高) */}
      <div id="game-mining-area" className="flex-1 flex justify-between items-center relative z-10 my-1 py-1 px-0.5 w-full max-w-md mx-auto shrink-0">
        
        {/* 左側スキルカラム (Ruby, Sapphire, Emerald) */}
        <div className="flex flex-col gap-2.5 justify-center items-center w-12 shrink-0 z-20">
          {SKILLS.slice(0, 3).map(skill => renderSkillButton(skill))}
        </div>

        {/* 中央：大きな岩とエフェクト */}
        <div className="flex-1 flex flex-col justify-center items-center relative h-full">
          
          {/* 鉱山ランクと進行状況バー */}
          <div className="w-full max-w-[140px] mb-2 text-center z-20">
            <div className="text-[10px] font-black text-amber-950 flex items-center justify-center gap-1 drop-shadow-[0_1px_0px_rgba(255,255,255,0.8)]">
              <span>{mineName}</span>
            </div>
            {mineTier < 3 && (
              <div className="mt-1 w-full h-3 bg-stone-200 border border-stone-300 rounded-full overflow-hidden relative shadow-inner">
                <motion.div
                  className={`h-full rounded-full bg-gradient-to-r ${
                    mineTier === 1 ? 'from-slate-400 to-slate-500' : 'from-yellow-400 to-amber-500'
                  }`}
                  style={{ width: `${(totalGemsMined / nextTierGoal) * 100}%` }}
                  layout
                />
                <span className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-stone-700 leading-none">
                  💎 {totalGemsMined} / {nextTierGoal}
                </span>
              </div>
            )}
            {mineTier === 3 && (
              <div className="mt-1 w-full bg-amber-100 border border-amber-300 rounded-full py-0.5 px-2 flex items-center justify-center text-[8px] font-black text-amber-800 shadow-xs animate-pulse">
                🏆 かんすと！ 💎 {totalGemsMined}こ
              </div>
            )}
          </div>

          {/* 岩のまわりのエネルギーサークル（自動生産が動いていると回転する） */}
          <div className="absolute w-52 h-52 rounded-full border-4 border-dashed border-amber-300 opacity-40 animate-spin"
               style={{ animationDuration: autoPower > 0 ? `${Math.max(1, 20 - autoPower * 0.1)}s` : '30s' }} />

          {/* きらきらの背景エフェクト */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[10%] left-[10%] text-xl opacity-20 animate-bounce">💎</div>
            <div className="absolute top-[65%] right-[10%] text-lg opacity-20 animate-bounce" style={{ animationDelay: '0.4s' }}>✨</div>
            <div className="absolute bottom-[10%] left-[20%] text-base opacity-15 animate-bounce" style={{ animationDelay: '0.8s' }}>⭐</div>
          </div>

          {/* 岩本体のタップ領域 */}
          <motion.div
            id="tap-rock"
            className="relative cursor-pointer select-none active:scale-95 touch-none z-10"
            onClick={handleTapRock}
            onTouchStart={handleTouchRock}
            animate={{ scale: rockScale }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            whileHover={{ scale: 1.05 }}
            style={{ touchAction: 'none' }}
          >
            {/* タップガイド（うっすらした波紋） */}
            <span className="absolute -top-3 -left-3 -right-3 -bottom-3 bg-amber-400/20 rounded-full blur-md animate-ping pointer-events-none" />

            {/* 大きな岩 / ほうせき */}
            <div className={`w-36 h-36 ${getEquippedRockStyle().bg} ${getEquippedRockStyle().border} ${getEquippedRockStyle().shadow} rounded-full flex items-center justify-center border-4 shadow-xl relative overflow-visible transition-all duration-500 ${getRockEffectClass()}`}>
              
              {/* 岩・ほうせきのテクスチャ */}
              <span className={`text-[100px] leading-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.3)] filter contrast-125 select-none touch-none ${equippedGemId === 'gem_rainbow_diamond' ? 'animate-pulse' : ''}`}>
                {equippedGemId ? gems.find(g => g.id === equippedGemId)?.emoji : '🪨'}
              </span>

              {/* ロボット自動採掘時のつるはしアニメーション風表示 */}
              {autoPower > 0 && (
                <motion.span
                  animate={{ rotate: [0, -30, 0] }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                  className="absolute top-1 right-1 text-3xl select-none pointer-events-none drop-shadow-md"
                >
                  ⛏️
                </motion.span>
              )}
              
              {/* タップして！のひらがなガイド */}
              <div className="absolute -bottom-2 bg-rose-500 border-2 border-white text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-md animate-bounce select-none pointer-events-none whitespace-nowrap">
                ここを タップ！ 👇
              </div>
            </div>
          </motion.div>
        </div>

        {/* 右側スキルカラム (Topaz, Amethyst, Diamond) */}
        <div className="flex flex-col gap-2.5 justify-center items-center w-12 shrink-0 z-20">
          {SKILLS.slice(3, 6).map(skill => renderSkillButton(skill))}
        </div>

        {/* コインや数のフライアップパーティクル（AnimatePresenceでアニメーション制御） */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <AnimatePresence>
            {particles.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 1, scale: 0.8, x: p.x - 20, y: p.y - 40, rotate: -15 }}
                animate={{
                  opacity: 0,
                  scale: 1.3,
                  y: p.y - 140, // 上に昇る
                  x: p.x + (Math.random() * 60 - 30), // 左右に少し散る
                  rotate: Math.random() * 30 - 15,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="absolute text-center z-30 select-none"
              >
                <div className="bg-amber-100 border-2 border-amber-400 rounded-full px-2 py-0.5 shadow-md flex items-center gap-0.5 pointer-events-none">
                  <span className="text-sm font-black text-amber-700">{p.text}</span>
                  {p.emoji && <span className="text-xs">{p.emoji}</span>}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* サブ設定ボタン類（画面の真ん中下あたり） */}
      <div id="game-sub-controls" className="flex justify-center items-center gap-2 mb-2 shrink-0">
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border-2 border-sky-300 text-sky-700 text-xs font-bold active:bg-sky-50 shadow-xs"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          あそびかた ❓
        </button>
        <button
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border-2 border-rose-200 text-rose-500 text-xs font-bold active:bg-rose-50 shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          やりなおす 🔄
        </button>
      </div>

      {/* 3. パワーアップショップ ＆ ずかん のタブ固定パネル (画面の約41%高、iPhone SE/短画面向けに高さを拡張) */}
      <div id="game-tab-panel" className="bg-white border-t-4 border-amber-400 rounded-t-3xl p-3 flex flex-col h-[41vh] min-h-[245px] shrink-0 shadow-[0_-8px_20px_rgba(217,119,6,0.15)] relative z-20">
        
        {/* タブ切り替えボタン */}
        <div id="panel-tabs" className="flex gap-2 mb-2.5">
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-black transition-all border-2 ${
              activeTab === 'shop'
                ? 'bg-amber-400 border-amber-500 text-amber-950 shadow-sm scale-[1.02]'
                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 active:scale-95'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            ⛏️ おみせ (パワーアップ)
          </button>
          <button
            onClick={() => setActiveTab('album')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-black transition-all border-2 ${
              activeTab === 'album'
                ? 'bg-amber-400 border-amber-500 text-amber-950 shadow-sm scale-[1.02]'
                : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 active:scale-95'
            }`}
          >
            <Trophy className="w-4 h-4" />
            🏆 ずかん (ほうせき)
          </button>
        </div>

        {/* タブの中身（個別スクロールエリア） */}
        <div id="panel-content" className="flex-1 overflow-y-auto pr-1 pb-1 scrollbar-thin">
          
          {/* おみせ (パワーアップ) タブ */}
          {activeTab === 'shop' && (
            <div className="flex flex-col gap-2">
              {upgrades.map(upgrade => {
                const isAffordable = ores >= upgrade.cost;
                return (
                  <div
                    key={upgrade.id}
                    className={`flex items-center gap-2 p-2.5 rounded-2xl border-2 transition-all ${
                      isAffordable
                        ? 'bg-amber-50/50 border-amber-300'
                        : 'bg-stone-50 border-stone-200 opacity-80'
                    }`}
                  >
                    {/* アイコン */}
                    <div className="text-3xl p-1 bg-white border-2 border-amber-200 rounded-xl shadow-xs shrink-0 select-none">
                      {upgrade.emoji}
                    </div>

                    {/* 説明とレベル */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-sm truncate text-amber-950">{upgrade.name}</span>
                        <span className="text-xs uppercase font-black bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-md shrink-0">
                          れべる {upgrade.level}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5 leading-tight">{upgrade.description}</p>
                    </div>

                    {/* 購入ボタン */}
                    <button
                      onClick={() => handleBuyUpgrade(upgrade)}
                      disabled={!isAffordable}
                      className={`px-3 py-2 rounded-xl text-xs font-black flex flex-col items-center justify-center shrink-0 min-w-[76px] shadow-sm border-2 transition-all active:scale-95 ${
                        isAffordable
                          ? 'bg-emerald-400 hover:bg-emerald-500 border-emerald-500 text-white'
                          : 'bg-stone-200 border-stone-300 text-stone-500 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-xs leading-none mb-0.5">こうにゅう</span>
                      <span className="font-bold tracking-tight">{upgrade.cost.toLocaleString()}こ</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ほうせきずかん タブ */}
          {activeTab === 'album' && (
            <div>
              {/* コレクション充足度の表示 */}
              <div className="mb-2 bg-amber-50 border border-amber-200 rounded-xl p-2 flex items-center justify-between text-[11px] font-bold text-amber-800">
                <span>💎 あつめた ほうせきのしゅるい</span>
                <span>
                  {gems.filter(g => g.unlocked).length} / {gems.length} しゅるい
                </span>
              </div>

              {/* 宝石グリッド（片手持ちで押しやすい大きめのカード） */}
              <div className="grid grid-cols-2 gap-2">
                {/* デフォルトのいわ */}
                <div
                  className={`relative p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition-all ${
                    !equippedGemId
                      ? 'bg-slate-50 border-amber-400 shadow-md ring-2 ring-amber-400'
                      : 'bg-stone-50 border-stone-200'
                  }`}
                >
                  <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md absolute top-1.5 right-1.5 bg-stone-200 text-stone-700 border border-stone-300">
                    いわ 🪨
                  </span>
                  
                  <div className="text-4xl my-2 drop-shadow-md select-none">
                    🪨
                  </div>
                  
                  <p className="text-xs font-black tracking-tight text-amber-950 mt-1 min-h-[16px]">
                    デフォルトのいわ
                  </p>
                  
                  <p className="text-[10px] text-stone-500 mt-1 leading-normal text-center min-h-[30px] flex items-center justify-center">
                    さいしょの いわ。
                  </p>

                  <button
                    onClick={() => {
                      audio.playTap();
                      setEquippedGemId(null);
                    }}
                    className={`mt-2.5 w-full py-1.5 px-3 rounded-xl text-[10px] font-black border-2 transition-all active:scale-95 ${
                      !equippedGemId
                        ? 'bg-amber-400 border-amber-500 text-amber-950 cursor-default font-black'
                        : 'bg-emerald-400 hover:bg-emerald-500 border-emerald-500 text-white'
                    }`}
                  >
                    {!equippedGemId ? 'セットちゅう ✅' : 'セットする'}
                  </button>
                </div>

                {gems.map(gem => (
                  <div
                    key={gem.id}
                    className={`relative p-2.5 rounded-2xl border-2 flex flex-col items-center justify-center text-center transition-all ${
                      gem.unlocked
                        ? equippedGemId === gem.id
                          ? 'bg-slate-50 border-amber-400 shadow-md ring-2 ring-amber-400'
                          : 'bg-slate-50 border-amber-300 shadow-xs'
                        : 'bg-stone-100 border-stone-200 select-none'
                    }`}
                  >
                    {/* レア度バッジ */}
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md absolute top-1.5 right-1.5 ${
                      gem.rarity === 'legendary' ? 'bg-purple-100 text-purple-700 border border-purple-300' :
                      gem.rarity === 'rare' ? 'bg-sky-100 text-sky-700 border border-sky-300' :
                      'bg-orange-100 text-orange-700 border border-orange-300'
                    }`}>
                      {getRarityLabel(gem.rarity)}
                    </span>

                    {/* 宝石絵文字またはクエスチョンマーク */}
                    {gem.unlocked ? (
                      <motion.div
                        className="text-4xl my-2 drop-shadow-md select-none"
                        animate={{ scale: [1, 1.08, 1] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        {gem.emoji}
                      </motion.div>
                    ) : (
                      <div className="text-4xl my-2 text-stone-300 pointer-events-none select-none">
                        ❓
                      </div>
                    )}

                    {/* 名前 */}
                    <p className="text-xs font-black tracking-tight text-amber-950 mt-1 min-h-[16px]">
                      {gem.unlocked ? gem.name : '？？？？'}
                    </p>

                    {/* 個数 */}
                    {gem.unlocked ? (
                      <p className="text-xs font-bold text-emerald-600 mt-0.5">
                        {gem.count}こ みつけた！
                      </p>
                    ) : (
                      <p className="text-[9px] text-stone-400 mt-0.5">
                        タップで たまに ドロップ！
                      </p>
                    )}

                    {/* こだわりの日本語説明（アンロック時のみ表示） */}
                    {gem.unlocked ? (
                      <p className="text-[10px] text-stone-500 leading-normal mt-1 px-1 border-t border-dashed border-stone-200 pt-1 text-center font-medium min-h-[30px] flex items-center justify-center">
                        {gem.description}
                      </p>
                    ) : (
                      <div className="min-h-[30px]" />
                    )}

                    {/* セット用ボタン（アンロック時のみ表示） */}
                    {gem.unlocked && (
                      <button
                        onClick={() => {
                          audio.playTap();
                          setEquippedGemId(gem.id);
                        }}
                        className={`mt-2.5 w-full py-1.5 px-3 rounded-xl text-[10px] font-black border-2 transition-all active:scale-95 ${
                          equippedGemId === gem.id
                            ? 'bg-amber-400 border-amber-500 text-amber-950 cursor-default font-black'
                            : 'bg-emerald-400 hover:bg-emerald-500 border-emerald-500 text-white'
                        }`}
                      >
                        {equippedGemId === gem.id ? 'セットちゅう ✅' : 'セットする'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. ほうせき発見トースト通知（ノンブロッキング・自動消滅・画面を塞がない） */}
      <AnimatePresence>
        {foundGem && (
          <motion.div
            initial={{ y: -80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={`absolute top-3 left-3 right-3 z-40 bg-gradient-to-r ${foundGem.color || 'from-amber-400 to-amber-500'} border-4 border-white rounded-3xl p-3.5 shadow-2xl flex items-center justify-between pointer-events-auto`}
          >
            <div className="flex items-center gap-3 text-white">
              {/* 宝石の巨大絵文字 */}
              <motion.div
                className="text-4xl filter drop-shadow-md select-none"
                animate={{ rotate: [0, 6, -6, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              >
                {foundGem.emoji}
              </motion.div>

              <div className="text-left">
                <p className="text-[9px] font-black text-amber-200 flex items-center gap-0.5 animate-pulse">
                  <Sparkles className="w-3 h-3" /> まぼろしのほうせき はっけん！
                </p>
                <h4 className="text-sm font-black text-white leading-tight drop-shadow-xs">
                  {foundGem.name}
                </h4>
                <p className="text-[10px] font-black text-emerald-100 mt-0.5">
                  ボーナス: こうせき +{gemBonus.toLocaleString()}こ！ 💎
                </p>
              </div>
            </div>

            {/* 閉じるボタン */}
            <button
              onClick={() => {
                if (gemTimeoutRef.current) clearTimeout(gemTimeoutRef.current);
                setFoundGem(null);
              }}
              className="p-1.5 rounded-full bg-white/20 hover:bg-white/35 text-white active:scale-90 transition-transform shadow-xs flex items-center justify-center shrink-0 ml-2"
              title="とじる"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. 鉱石ランクアップトースト通知 */}
      <AnimatePresence>
        {rankUpMessage && (
          <motion.div
            initial={{ y: -80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -80, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="absolute top-3 left-3 right-3 z-45 bg-gradient-to-r from-violet-600 via-fuchsia-500 to-pink-500 border-4 border-white rounded-3xl p-3.5 shadow-2xl flex items-center justify-between pointer-events-auto"
          >
            <div className="flex items-center gap-3 text-white">
              {/* クラッカー絵文字の動的アニメーション */}
              <motion.div
                className="text-4xl filter drop-shadow-md select-none"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              >
                🎉
              </motion.div>
              <div className="text-left">
                <p className="text-[9px] font-black text-pink-200 animate-pulse flex items-center gap-0.5">
                  <Sparkles className="w-3 h-3" /> おめでとうございます！
                </p>
                <h4 className="text-xs font-black text-white leading-tight">
                  {rankUpMessage}
                </h4>
                <p className="text-[9px] font-black text-amber-200 mt-0.5">
                  あたらしいうえの ほうせき＆スキルが かいほう！ 💎
                </p>
              </div>
            </div>
            {/* 閉じるボタン */}
            <button
              onClick={() => setRankUpMessage(null)}
              className="p-1.5 rounded-full bg-white/20 hover:bg-white/35 text-white active:scale-90 transition-transform shadow-xs flex items-center justify-center shrink-0 ml-2"
              title="とじる"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. モーダル2：あそびかたモーダル */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-white border-4 border-sky-300 rounded-3xl p-5 max-w-xs w-full shadow-xl"
            >
              <h3 className="text-lg font-black text-sky-800 text-center mb-3">
                ざくざく こうざんの あそびかた ❓
              </h3>
              
              <div className="flex flex-col gap-3 text-xs text-stone-700 leading-relaxed font-bold">
                <div className="flex items-start gap-1.5">
                  <span className="text-base shrink-0">1️⃣</span>
                  <p>まんなかの <strong className="text-amber-700">【おおきな岩🪨】</strong> をタップして、こうせきをあつめよう！</p>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-base shrink-0">2️⃣</span>
                  <p>こうせきが たまったら、したの <strong className="text-green-600">【おみせ⛏️】</strong> で「ピッケル」や「おてつだいロボ」をかわいくパワーアップしよう！</p>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-base shrink-0">3️⃣</span>
                  <p>タップしていると、たまにキラピカひかる <strong className="text-rose-500">【まぼろしのほうせき💎】</strong> がみつかるよ！ボーナスこうせきも いっぱい もらえるよ！</p>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="text-base shrink-0">4️⃣</span>
                  <p>ぜんぶで 6しゅるいの ほうせきを あつめて、<strong className="text-purple-600">【ずかん🏆】</strong> をかんせいさせよう！</p>
                </div>
              </div>

              <button
                onClick={() => setShowHelp(false)}
                className="w-full mt-4 py-2.5 bg-sky-400 border-2 border-sky-500 rounded-xl font-black text-white hover:bg-sky-500 shadow-sm active:translate-y-0.5 transition-transform text-xs"
              >
                わかった！ 👍
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. モーダル3：リセット確認モーダル */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white border-4 border-rose-300 rounded-3xl p-5 max-w-xs w-full text-center shadow-xl animate-bounce-short"
            >
              <span className="text-5xl select-none" role="img" aria-label="crying face">😭</span>
              <h3 className="text-base font-black text-rose-600 mt-2">
                ほんとうに はじめから やりなおす？
              </h3>
              <p className="text-[11px] text-stone-500 leading-relaxed mt-2 font-medium">
                あつめた こうせき、パワーアップ、ほうせきずかんが すべて ０に戻っちゃうよ。
              </p>

              <div className="flex gap-2.5 mt-4">
                <button
                  onClick={handleResetGame}
                  className="flex-1 py-2 bg-rose-500 border-2 border-rose-600 text-white font-black rounded-xl text-xs active:scale-95 transition-transform"
                >
                  リセットする 😢
                </button>
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="flex-1 py-2 bg-stone-200 border-2 border-stone-300 text-stone-700 font-black rounded-xl text-xs active:scale-95 transition-transform"
                >
                  やめる 🛑
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. モーダル4：スマホ連携・共有用QRコードモーダル */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-white border-4 border-amber-400 rounded-3xl p-5 max-w-xs w-full text-center shadow-xl"
            >
              <h3 className="text-base font-black text-amber-950 mb-2">
                {isLocalhost ? '📱 スマホで あそぼう！' : '🔗 おともだちに おしえよう！'}
              </h3>
              
              <div className="bg-amber-50 p-3 rounded-2xl border-2 border-amber-200 flex flex-col items-center gap-2 mb-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`}
                  alt="QR Code"
                  className="w-40 h-40 border-4 border-white rounded-lg shadow-sm"
                />
                
                <p className="text-[9px] text-stone-500 font-bold select-all break-all leading-tight">
                  {shareUrl}
                </p>
              </div>

              <p className="text-[11px] text-stone-600 font-bold leading-relaxed mb-4">
                {isLocalhost 
                  ? 'スマホのカメラで上のQRコードをスキャンしてね！PCと同じルーター（Wi-Fi）に繋がっている必要があります。'
                  : 'QRコードをスマホでスキャンするか、下のボタンでURLをコピーして送ね！'}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black border-2 transition-all flex items-center justify-center gap-1 active:scale-95 ${
                    copied 
                      ? 'bg-emerald-500 border-emerald-600 text-white'
                      : 'bg-white border-amber-400 text-amber-950 active:bg-amber-50'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> コピーしたよ！
                    </>
                  ) : (
                    <>
                      <Share2 className="w-3.5 h-3.5" /> URLをコピー
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowQrModal(false)}
                  className="px-4 py-2.5 bg-stone-200 border-2 border-stone-300 rounded-xl text-xs font-black text-stone-700 active:scale-95 transition-transform"
                >
                  とじる
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
