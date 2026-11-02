/**
 * VS Code Light+ / Dark+ inspired editor themes.
 *
 * Colours that are shared with the surrounding chrome come from CSS custom properties defined on
 * `.three-way-diff-container` (see styles/index.css), so the React shell and the editors switch
 * theme together.
 */

import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

export type ThemeName = 'light' | 'dark';

export const EDITOR_FONT = 'Menlo, Monaco, Consolas, "Droid Sans Mono", "Courier New", monospace';
/** Every pane must use the same line height so rows stay aligned */
export const LINE_HEIGHT = 20;

const editorTheme = (dark: boolean) =>
  EditorView.theme(
    {
      '&': {
        height: '100%',
        fontSize: '13px',
        backgroundColor: 'var(--twd-editor-bg)',
        color: 'var(--twd-editor-fg)',
      },
      '&.cm-focused': { outline: 'none' },
      '.cm-scroller': {
        fontFamily: EDITOR_FONT,
        lineHeight: `${LINE_HEIGHT}px`,
        overflow: 'auto',
      },
      '.cm-content': { padding: '0', caretColor: 'var(--twd-cursor)' },
      '.cm-line': { padding: '0 12px 0 6px' },
      '.cm-gutters': {
        backgroundColor: 'var(--twd-editor-bg)',
        color: 'var(--twd-line-number)',
        border: 'none',
      },
      '.cm-gutters.cm-gutters-after': { borderLeft: 'none' },
      '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px', minWidth: '24px' },
      '.cm-activeLine': { backgroundColor: 'var(--twd-active-line)' },
      '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--twd-line-number-active)' },
      '.cm-cursor, .cm-dropCursor': { borderLeft: '2px solid var(--twd-cursor)' },
      '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
        { backgroundColor: 'var(--twd-selection)' },
      '.cm-selectionMatch': { backgroundColor: 'var(--twd-selection-match)' },
      '&.cm-focused .cm-matchingBracket': {
        backgroundColor: 'transparent',
        outline: '1px solid var(--twd-bracket-match)',
      },
      '.cm-searchMatch': {
        backgroundColor: 'var(--twd-search-match)',
        outline: 'none',
      },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--twd-search-match-selected)' },
      '.cm-panels': {
        backgroundColor: 'var(--twd-panel-bg)',
        color: 'var(--twd-editor-fg)',
        fontFamily: 'var(--twd-font-ui)',
      },
      '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--twd-border)' },
      '.cm-panel.cm-search input, .cm-panel.cm-search button': { fontFamily: 'var(--twd-font-ui)' },
      '.cm-tooltip': {
        backgroundColor: 'var(--twd-panel-bg)',
        color: 'var(--twd-editor-fg)',
        border: '1px solid var(--twd-border)',
      },
    },
    { dark }
  );

const lightHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.bool, t.null, t.atom, t.self], color: '#0000ff' },
  { tag: [t.string, t.special(t.string)], color: '#a31515' },
  { tag: t.number, color: '#098658' },
  { tag: t.propertyName, color: '#0451a5' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#008000', fontStyle: 'italic' },
  { tag: [t.typeName, t.className, t.namespace], color: '#267f99' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#795e26' },
  { tag: [t.variableName, t.attributeName], color: '#001080' },
  { tag: [t.regexp, t.escape], color: '#811f3f' },
  { tag: t.tagName, color: '#800000' },
  { tag: t.heading, color: '#0000ff', fontWeight: 'bold' },
  { tag: t.link, color: '#0451a5', textDecoration: 'underline' },
  { tag: t.invalid, color: '#cd3131' },
]);

const darkHighlight = HighlightStyle.define([
  { tag: [t.keyword, t.bool, t.null, t.atom, t.self], color: '#569cd6' },
  { tag: [t.string, t.special(t.string)], color: '#ce9178' },
  { tag: t.number, color: '#b5cea8' },
  { tag: t.propertyName, color: '#9cdcfe' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: '#6a9955', fontStyle: 'italic' },
  { tag: [t.typeName, t.className, t.namespace], color: '#4ec9b0' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#dcdcaa' },
  { tag: [t.variableName, t.attributeName], color: '#9cdcfe' },
  { tag: [t.regexp, t.escape], color: '#d16969' },
  { tag: t.tagName, color: '#569cd6' },
  { tag: t.heading, color: '#569cd6', fontWeight: 'bold' },
  { tag: t.link, color: '#3794ff', textDecoration: 'underline' },
  { tag: t.invalid, color: '#f44747' },
]);

export const themeExtension = (theme: ThemeName): Extension => {
  const dark = theme === 'dark';
  return [editorTheme(dark), syntaxHighlighting(dark ? darkHighlight : lightHighlight)];
};
