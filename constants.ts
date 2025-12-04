import { Role } from './types';

export const GM_ID = 'GAME_MASTER';
export const GM_NAME = 'ゲームマスター';
export const GM_AVATAR = 'https://ui-avatars.com/api/?name=GM&background=000&color=fff&size=128&font-size=0.5';

export const AVATARS = [
  "https://picsum.photos/seed/p1/100/100",
  "https://picsum.photos/seed/p2/100/100",
  "https://picsum.photos/seed/p3/100/100",
  "https://picsum.photos/seed/p4/100/100",
  "https://picsum.photos/seed/p5/100/100",
  "https://picsum.photos/seed/p6/100/100",
  "https://picsum.photos/seed/p7/100/100",
  "https://picsum.photos/seed/p8/100/100",
];

export const NAMES = [
  "サトウ", "スズキ", "タカハシ", "タナカ", "イトウ", "ワタナベ", "ヤマモト", "ナカムラ"
];

export const PERSONALITIES = [
  "論理的で冷静。事実に焦点を当てる。",
  "感情的で攻撃的。すぐに他人を疑う。",
  "無口で観察眼が鋭い。口数は少ないが核心を突く。",
  "混沌としていて予測不能。意見を頻繁に変える。",
  "リーダーシップがあり、グループをまとめようとする。",
  "疑り深く、誰も信用しない。",
  "友好的だが防衛的。平和を保とうとする。",
  "分析的。発言の矛盾を探すのが得意。"
];

// 5 Player Setup for faster games
export const INITIAL_ROLES_5 = [
  Role.WEREWOLF,
  Role.SEER,
  Role.VILLAGER,
  Role.VILLAGER,
  Role.VILLAGER
];

// 7 Player Setup
export const INITIAL_ROLES_7 = [
  Role.WEREWOLF,
  Role.WEREWOLF,
  Role.SEER,
  Role.BODYGUARD,
  Role.VILLAGER,
  Role.VILLAGER,
  Role.VILLAGER
];