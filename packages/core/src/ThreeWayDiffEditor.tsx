import React, {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Extension } from '@codemirror/state';
import { MergeController } from './editor/MergeController';
import { getMessages, I18nContext } from './i18n';
import editorStyles from './styles/index.generated';
import type { DiffStats, ThreeWayDiffEditorHandle, ThreeWayDiffEditorProps } from './types';

const STYLE_ELEMENT_ID = 'three-way-diff-editor-styles-v2';
const EMPTY_STATS: DiffStats = { total: 0, unchanged: 0, added: 0, removed: 0, modified: 0, conflicts: 0 };
const NO_EXTENSIONS: Extension[] = [];

/** useLayoutEffect on the client, useEffect during SSR (avoids the server warning) */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const ThreeWayDiffEditor = forwardRef<ThreeWayDiffEditorHandle, ThreeWayDiffEditorProps>(function ThreeWayDiffEditor(
  {
    oldContent,
    newContent,
    middleContent,
    onChange,
    onHasChangesChange,
    defaultEditMode = false,
    leftColumnTitle,
    rightColumnTitle,
    collapseUnchangedLines = true,
    locale = 'en',
    messages: messagesOverride,
    theme = 'light',
    language = 'auto',
    extensions,
    normalizeJson = true,
    trimEmptyLinesOnSave = true,
  },
  ref
) {
  const messages = useMemo(() => getMessages(locale, messagesOverride), [locale, messagesOverride]);
  const effectiveLeftTitle = leftColumnTitle ?? messages.defaultLeftColumnTitle;
  const effectiveRightTitle = rightColumnTitle ?? messages.defaultRightColumnTitle;

  const [stats, setStats] = useState<DiffStats>(EMPTY_STATS);
  const [editMode, setEditMode] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const modalTitleId = useId();

  const panelsRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const middleRef = useRef<HTMLDivElement>(null);
  const freeRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const gapLeftRef = useRef<HTMLDivElement>(null);
  const gapRightRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<MergeController | null>(null);

  const callbacksRef = useRef({ onChange, onHasChangesChange });
  useIsomorphicLayoutEffect(() => {
    callbacksRef.current = { onChange, onHasChangesChange };
  });

  useIsomorphicLayoutEffect(() => {
    if (typeof document === 'undefined' || document.getElementById(STYLE_ELEMENT_ID)) return;
    const el = document.createElement('style');
    el.id = STYLE_ELEMENT_ID;
    el.textContent = editorStyles;
    document.head.appendChild(el);
  }, []);

  useIsomorphicLayoutEffect(() => {
    const panels = panelsRef.current;
    const left = leftRef.current;
    const middle = middleRef.current;
    const free = freeRef.current;
    const right = rightRef.current;
    const gapLeft = gapLeftRef.current;
    const gapRight = gapRightRef.current;
    const canvas = canvasRef.current;
    if (!panels || !left || !middle || !free || !right || !gapLeft || !gapRight || !canvas) return;

    const controller = new MergeController(
      { panels, left, middle, free, right, gaps: [gapLeft, gapRight], canvas },
      { messages, theme, language, extensions: extensions ?? NO_EXTENSIONS, collapse: collapseUnchangedLines },
      {
        onChange: (merged) => callbacksRef.current.onChange?.(merged),
        onHasChanges: (hasChanges) => callbacksRef.current.onHasChangesChange?.(hasChanges),
        onStats: setStats,
        onEditModeChange: setEditMode,
      }
    );
    controllerRef.current = controller;
    controller.load({ oldContent, newContent, middleContent, normalizeJson });
    if (defaultEditMode) controller.enterFreeEdit();
    return () => {
      controllerRef.current = null;
      controller.destroy();
    };
    // The controller is created once; prop changes are forwarded by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    controllerRef.current?.load({ oldContent, newContent, middleContent, normalizeJson });
  }, [oldContent, newContent, middleContent, normalizeJson]);

  useEffect(() => {
    controllerRef.current?.setMessages(messages);
  }, [messages]);

  useEffect(() => {
    controllerRef.current?.setTheme(theme);
  }, [theme]);

  useEffect(() => {
    controllerRef.current?.setLanguage(language, extensions ?? NO_EXTENSIONS);
  }, [language, extensions]);

  useEffect(() => {
    controllerRef.current?.setCollapseEnabled(collapseUnchangedLines);
  }, [collapseUnchangedLines]);

  useImperativeHandle(
    ref,
    () => ({
      getMergedContent: () => controllerRef.current?.getMergedContent() ?? '',
      acceptAllLeft: () => controllerRef.current?.acceptAll('left'),
      acceptAllRight: () => controllerRef.current?.acceptAll('right'),
      reset: () => controllerRef.current?.reset(),
      goToNextChange: () => controllerRef.current?.goToChange(1),
      goToPreviousChange: () => controllerRef.current?.goToChange(-1),
    }),
    []
  );

  const handleToggleEditMode = () => {
    const controller = controllerRef.current;
    if (!controller) return;
    if (!editMode) {
      controller.enterFreeEdit();
      return;
    }
    if (controller.requestExitFreeEdit() === 'confirm') setSaveModalVisible(true);
  };

  const closeModal = () => setSaveModalVisible(false);

  return (
    <I18nContext.Provider value={messages}>
      <div
        className={`three-way-diff-container${editMode ? ' is-free-editing' : ''}`}
        data-theme={theme}
      >
        <div className="diff-toolbar">
          <div className="toolbar-left">
            <button
              type="button"
              className="twd-btn twd-btn-sm"
              disabled={editMode}
              onClick={() => controllerRef.current?.acceptAll('left')}
            >
              {messages.acceptAllLeft}
            </button>
            <button
              type="button"
              className="twd-btn twd-btn-sm"
              disabled={editMode}
              onClick={() => controllerRef.current?.acceptAll('right')}
            >
              {messages.acceptAllRight}
            </button>
            <button
              type="button"
              className="twd-btn twd-btn-sm"
              disabled={editMode}
              onClick={() => controllerRef.current?.reset()}
            >
              {messages.reset}
            </button>
          </div>
          <div className="toolbar-right">
            <span className="diff-stats">
              {messages.statsTotal}: {stats.total} | {messages.statsAdded}: <span className="stat-added">{stats.added}</span> |{' '}
              {messages.statsRemoved}: <span className="stat-removed">{stats.removed}</span> | {messages.statsModified}:{' '}
              <span className="stat-modified">{stats.modified}</span> | {messages.statsConflicts}:{' '}
              <span className="stat-conflicts">{stats.conflicts}</span>
            </span>
          </div>
        </div>

        <div className="diff-headers">
          <div className="panel-header left" title={effectiveLeftTitle}>
            <span className="panel-header-title">{effectiveLeftTitle}</span>
          </div>
          <div className="panel-header middle">
            <span className="panel-header-title">{messages.mergeResult}</span>
            <div className="header-actions">
              <button
                type="button"
                className={editMode ? 'twd-btn twd-btn-sm twd-btn-primary' : 'twd-btn twd-btn-sm'}
                onClick={handleToggleEditMode}
              >
                {editMode ? messages.exitEdit : messages.freeEdit}
              </button>
            </div>
          </div>
          <div className="panel-header right" title={effectiveRightTitle}>
            <span className="panel-header-title">{effectiveRightTitle}</span>
          </div>
        </div>

        <div className="diff-panels" ref={panelsRef}>
          <div className="diff-panel left-panel" ref={leftRef} />
          <div className="twd-gap" ref={gapLeftRef} />
          <div className="diff-panel middle-panel">
            <div className="twd-structured" ref={middleRef} />
            <div className="twd-free" ref={freeRef} />
          </div>
          <div className="twd-gap" ref={gapRightRef} />
          <div className="diff-panel right-panel" ref={rightRef} />
          <canvas ref={canvasRef} className="connector-canvas" aria-hidden="true" />
        </div>

        <div className="diff-footer">
          <span className="diff-legend-item legend-added">
            <span className="legend-swatch" />
            {messages.statsAdded}
          </span>
          <span className="diff-legend-item legend-removed">
            <span className="legend-swatch" />
            {messages.statsRemoved}
          </span>
          <span className="diff-legend-item legend-modified">
            <span className="legend-swatch" />
            {messages.statsModified}
          </span>
        </div>

        {saveModalVisible && (
          <div className="twd-modal-mask" onClick={closeModal} role="presentation">
            <div
              className="twd-modal-wrap"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === 'Escape') closeModal();
              }}
              role="dialog"
              aria-modal="true"
              aria-labelledby={modalTitleId}
            >
              <div className="twd-modal">
                <div className="twd-modal-content">
                  <div className="twd-modal-header">
                    <span id={modalTitleId} className="twd-modal-title">
                      {messages.saveChanges}
                    </span>
                    <button type="button" className="twd-modal-close" onClick={closeModal} aria-label={messages.close}>
                      ×
                    </button>
                  </div>
                  <div className="twd-modal-body">{messages.confirmSaveMessage}</div>
                  <div className="twd-modal-footer">
                    <button
                      type="button"
                      className="twd-btn twd-btn-sm"
                      onClick={() => {
                        closeModal();
                        controllerRef.current?.discardFreeEdit();
                      }}
                    >
                      {messages.discard}
                    </button>
                    <button
                      type="button"
                      className="twd-btn twd-btn-sm twd-btn-primary"
                      autoFocus
                      onClick={() => {
                        closeModal();
                        controllerRef.current?.saveFreeEdit(trimEmptyLinesOnSave);
                      }}
                    >
                      {messages.save}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </I18nContext.Provider>
  );
});

ThreeWayDiffEditor.displayName = 'ThreeWayDiffEditor';

export default ThreeWayDiffEditor;
