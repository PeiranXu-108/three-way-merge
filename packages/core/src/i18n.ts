/**
 * Internationalization for ThreeWayDiffEditor (en / zh, default en).
 */

import React from 'react';

export type Locale = 'en' | 'zh';

export interface ThreeWayMessages {
  acceptAllLeft: string;
  acceptAllRight: string;
  reset: string;
  statsTotal: string;
  statsAdded: string;
  statsRemoved: string;
  statsModified: string;
  statsConflicts: string;
  mergeResult: string;
  exitEdit: string;
  freeEdit: string;
  saveChanges: string;
  close: string;
  confirmSaveMessage: string;
  discard: string;
  save: string;
  showAllLines: (count: number) => string;
  showMoreAbove: (n: number) => string;
  showMoreBelow: (n: number) => string;
  acceptLeftBlock: (count: number) => string;
  acceptRightBlock: (count: number) => string;
  defaultLeftColumnTitle: string;
  defaultRightColumnTitle: string;
}

const messagesEn: ThreeWayMessages = {
  acceptAllLeft: 'Accept all left',
  acceptAllRight: 'Accept all right',
  reset: 'Reset',
  statsTotal: 'Total',
  statsAdded: 'Added',
  statsRemoved: 'Removed',
  statsModified: 'Modified',
  statsConflicts: 'Conflicts left',
  mergeResult: 'Merge result',
  exitEdit: 'Exit edit',
  freeEdit: 'Free edit',
  saveChanges: 'Save changes',
  close: 'Close',
  confirmSaveMessage: 'Content has been modified. Save?',
  discard: 'Discard',
  save: 'Save',
  showAllLines: (count) => `Show all ${count} lines`,
  showMoreAbove: (n) => `▲ ${n}`,
  showMoreBelow: (n) => `▼ ${n}`,
  acceptLeftBlock: (count) => `Accept left block (${count} lines)`,
  acceptRightBlock: (count) => `Accept right block (${count} lines)`,
  defaultLeftColumnTitle: 'Version 1',
  defaultRightColumnTitle: 'Version 2',
};

const messagesZh: ThreeWayMessages = {
  acceptAllLeft: '全部接受左侧',
  acceptAllRight: '全部接受右侧',
  reset: '重置',
  statsTotal: '总行数',
  statsAdded: '新增',
  statsRemoved: '删除',
  statsModified: '修改',
  statsConflicts: '剩余冲突',
  mergeResult: '合并结果',
  exitEdit: '退出编辑',
  freeEdit: '自由编辑',
  saveChanges: '保存更改',
  close: '关闭',
  confirmSaveMessage: '编辑内容已更改，是否保存？',
  discard: '丢弃',
  save: '保存',
  showAllLines: (count) => `显示全部 ${count} 行`,
  showMoreAbove: (n) => `▲ ${n}`,
  showMoreBelow: (n) => `▼ ${n}`,
  acceptLeftBlock: (count) => `接受左侧块（${count}行）`,
  acceptRightBlock: (count) => `接受右侧块（${count}行）`,
  defaultLeftColumnTitle: '版本1',
  defaultRightColumnTitle: '版本2',
};

export function getMessages(
  locale: Locale,
  overrides?: Partial<ThreeWayMessages>
): ThreeWayMessages {
  const base = locale === 'zh' ? messagesZh : messagesEn;
  if (!overrides) return base;
  return { ...base, ...overrides } as ThreeWayMessages;
}

const defaultMessages = getMessages('en');
export const I18nContext = React.createContext<ThreeWayMessages>(defaultMessages);
