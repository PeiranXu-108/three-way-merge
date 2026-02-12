/**
 * Diff parsing and content helpers
 */

import * as Diff from 'diff';
import { CharDiff, CodeBlock, DiffLine } from '../types';

export const normalizeJson = (content: string): string => {
  if (!content) return '{}';
  try {
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
};

export const splitLines = (v: string) => {
  const arr = v.split('\n');
  if (arr[arr.length - 1] === '') arr.pop();
  return arr;
};

export const computeCharDiffs = (
  oldStr: string | null,
  newStr: string | null
): { oldDiffs: CharDiff[]; newDiffs: CharDiff[] } => {
  if (!oldStr && !newStr) return { oldDiffs: [], newDiffs: [] };
  if (!oldStr) {
    const newDiffs: CharDiff[] = (newStr || '')
      .split('')
      .map((char, idx) => ({
        type: 'added' as const,
        value: char,
        index: idx,
      }));
    return { oldDiffs: [], newDiffs };
  }
  if (!newStr) {
    const oldDiffs: CharDiff[] = (oldStr || '')
      .split('')
      .map((char, idx) => ({
        type: 'removed' as const,
        value: char,
        index: idx,
      }));
    return { oldDiffs, newDiffs: [] };
  }

  const charDiffResult = Diff.diffChars(oldStr, newStr);
  const oldDiffs: CharDiff[] = [];
  const newDiffs: CharDiff[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  for (const part of charDiffResult) {
    if (!part.added && !part.removed) {
      const chars = part.value.split('');
      chars.forEach((char: string) => {
        oldDiffs.push({ type: 'unchanged', value: char, index: oldIndex });
        newDiffs.push({ type: 'unchanged', value: char, index: newIndex });
        oldIndex += 1;
        newIndex += 1;
      });
    } else if (part.removed) {
      const chars = part.value.split('');
      chars.forEach((char: string) => {
        oldDiffs.push({ type: 'removed', value: char, index: oldIndex });
        oldIndex += 1;
      });
    } else if (part.added) {
      const chars = part.value.split('');
      chars.forEach((char: string) => {
        newDiffs.push({ type: 'added', value: char, index: newIndex });
        newIndex += 1;
      });
    }
  }

  return { oldDiffs, newDiffs };
};

export const parseDiffToLines = (oldContent: string, newContent: string): DiffLine[] => {
  const oldJson = normalizeJson(oldContent);
  const newJson = normalizeJson(newContent);

  const diffResult = Diff.diffLines(oldJson, newJson);
  const lines: DiffLine[] = [];
  let lineNumber = 1;

  for (let p = 0; p < diffResult.length; p += 1) {
    const part = diffResult[p];

    if (!part.added && !part.removed) {
      for (const content of splitLines(part.value)) {
        lines.push({
          lineNumber: lineNumber++,
          type: 'unchanged',
          leftContent: content,
          rightContent: content,
          mergedContent: content,
          selectedFrom: 'right',
          conflictResolved: true,
          leftCharDiffs: [],
          rightCharDiffs: [],
        });
      }
      continue;
    }

    if (part.removed && diffResult[p + 1]?.added) {
      const removedLines = splitLines(part.value);
      const addedLines = splitLines(diffResult[p + 1].value);
      const n = Math.max(removedLines.length, addedLines.length);

      for (let i = 0; i < n; i += 1) {
        const l = removedLines[i] ?? null;
        const r = addedLines[i] ?? null;
        const { oldDiffs, newDiffs } = computeCharDiffs(l, r);
        const isConflict = l !== null && r !== null && l !== r;
        lines.push({
          lineNumber: lineNumber++,
          type: 'modified',
          leftContent: l,
          rightContent: r,
          mergedContent: r,
          selectedFrom: 'right',
          conflictResolved: !isConflict,
          leftCharDiffs: oldDiffs,
          rightCharDiffs: newDiffs,
        });
      }

      p += 1;
      continue;
    }

    if (part.removed) {
      for (const content of splitLines(part.value)) {
        const { oldDiffs } = computeCharDiffs(content, null);
        lines.push({
          lineNumber: lineNumber++,
          type: 'removed',
          leftContent: content,
          rightContent: null,
          mergedContent: null,
          selectedFrom: 'right',
          conflictResolved: true,
          leftCharDiffs: oldDiffs,
          rightCharDiffs: [],
        });
      }
      continue;
    }

    if (part.added) {
      for (const content of splitLines(part.value)) {
        const { newDiffs } = computeCharDiffs(null, content);
        lines.push({
          lineNumber: lineNumber++,
          type: 'added',
          leftContent: null,
          rightContent: content,
          mergedContent: content,
          selectedFrom: 'right',
          conflictResolved: true,
          leftCharDiffs: [],
          rightCharDiffs: newDiffs,
        });
      }
      continue;
    }
  }

  return lines;
};

export const getMergedContent = (diffLines: DiffLine[]): string => {
  return diffLines
    .filter((line) => line.mergedContent !== null)
    .map((line) => line.mergedContent ?? '')
    .join('\n');
};

export const identifyCodeBlocks = (lines: DiffLine[]): CodeBlock[] => {
  const blocks: CodeBlock[] = [];
  let currentBlock: CodeBlock | null = null;

  lines.forEach((line, index) => {
    if (line.type === 'unchanged') {
      if (currentBlock) {
        blocks.push(currentBlock);
        currentBlock = null;
      }
      return;
    }

    const t = line.type as 'removed' | 'added' | 'modified';

    if (currentBlock && currentBlock.type === t && currentBlock.endIndex === index - 1) {
      currentBlock.endIndex = index;
      currentBlock.lineCount += 1;
    } else {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { startIndex: index, endIndex: index, type: t, lineCount: 1 };
    }
  });

  if (currentBlock) blocks.push(currentBlock);
  return blocks;
};
