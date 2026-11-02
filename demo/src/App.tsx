import React, { useLayoutEffect, useRef, useState } from 'react';
import { ThreeWayDiffEditor, type ThreeWayDiffEditorHandle } from 'three-way-diff-editor';
import { ThreeWayDiffEditor as LegacyEditor } from 'three-way-diff-editor-legacy';
import { SAMPLES, isSampleKey, type SampleKey } from './samples';

/** Hooks for the Playwright suite (e2e/) */
interface DemoInstrumentation {
  ref: React.RefObject<ThreeWayDiffEditorHandle>;
  changes: string[];
  hasChangesCalls: boolean[];
  mountMs: number;
}

declare global {
  interface Window {
    __demo?: DemoInstrumentation;
  }
}

const params = new URLSearchParams(window.location.search);
const impl = params.get('impl') === 'legacy' ? 'legacy' : 'codemirror';
const sampleParam = params.get('sample');
const sampleKey: SampleKey = isSampleKey(sampleParam) ? sampleParam : 'json';
const useDefaultMiddle = params.get('middle') === 'default';
const startInEditMode = params.get('edit') === '1';
const renderStart = performance.now();

const OUTPUT_PREVIEW_LINES = 300;

const navigate = (updates: Record<string, string | null>) => {
  const next = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(updates)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  window.location.search = next.toString();
};

const preview = (text: string) => {
  const lines = text.split('\n');
  if (lines.length <= OUTPUT_PREVIEW_LINES) return text;
  return `${lines.slice(0, OUTPUT_PREVIEW_LINES).join('\n')}\n… (${lines.length - OUTPUT_PREVIEW_LINES} more lines)`;
};

const App: React.FC = () => {
  const sample = SAMPLES[sampleKey];
  const [mergedContent, setMergedContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(params.get('theme') === 'dark' ? 'dark' : 'light');
  const [locale, setLocale] = useState<'en' | 'zh'>(params.get('locale') === 'zh' ? 'zh' : 'en');
  const [collapse, setCollapse] = useState(params.get('collapse') !== '0');
  const editorRef = useRef<ThreeWayDiffEditorHandle>(null);
  const instrumentation = useRef<DemoInstrumentation>({ ref: editorRef, changes: [], hasChangesCalls: [], mountMs: 0 });

  useLayoutEffect(() => {
    instrumentation.current.mountMs = performance.now() - renderStart;
    window.__demo = instrumentation.current;
  }, []);

  const handleChange = (value: string) => {
    instrumentation.current.changes.push(value);
    setMergedContent(value);
  };

  const handleHasChanges = (value: boolean) => {
    instrumentation.current.hasChangesCalls.push(value);
    setHasChanges(value);
  };

  return (
    <div className="demo-shell" data-theme={theme}>
      <header className="demo-header">
        <div>
          <h1>Three-Way Diff Editor</h1>
        </div>
        <div className="demo-controls">
          <label>
            Implementation
            <select
              value={impl}
              onChange={(event) => navigate({ impl: event.target.value === 'legacy' ? 'legacy' : null })}
            >
              <option value="codemirror">CodeMirror 6 (this branch)</option>
              <option value="legacy">Legacy 0.1.1 (npm)</option>
            </select>
          </label>
          <label>
            Sample
            <select value={sampleKey} onChange={(event) => navigate({ sample: event.target.value })}>
              {Object.entries(SAMPLES).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </label>
          {impl === 'codemirror' && (
            <label>
              Theme
              <select value={theme} onChange={(event) => setTheme(event.target.value as 'light' | 'dark')}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          )}
          <label>
            Locale
            <select value={locale} onChange={(event) => setLocale(event.target.value as 'en' | 'zh')}>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </label>
          <label className="demo-checkbox">
            <input type="checkbox" checked={collapse} onChange={(event) => setCollapse(event.target.checked)} />
            Collapse unchanged
          </label>
          <span className={`demo-badge${hasChanges ? ' is-dirty' : ''}`} data-testid="has-changes">
            {hasChanges ? 'Unsaved changes' : 'No changes'}
          </span>
        </div>
      </header>

      <section className="demo-editor">
        {impl === 'legacy' ? (
          <LegacyEditor
            oldContent={sample.oldContent}
            newContent={sample.newContent}
            onChange={handleChange}
            onHasChangesChange={handleHasChanges}
            locale={locale}
            collapseUnchangedLines={collapse}
          />
        ) : (
          <ThreeWayDiffEditor
            ref={editorRef}
            oldContent={sample.oldContent}
            newContent={sample.newContent}
            middleContent={useDefaultMiddle ? sample.newContent : undefined}
            onChange={handleChange}
            onHasChangesChange={handleHasChanges}
            theme={theme}
            locale={locale}
            collapseUnchangedLines={collapse}
            defaultEditMode={startInEditMode}
          />
        )}
      </section>

      <section className="demo-output">
        <div className="output-header">Merge Result</div>
        <pre className="output-content" data-testid="merged-output">
          {mergedContent ? preview(mergedContent) : '(No changes)'}
        </pre>
      </section>
    </div>
  );
};

export default App;
