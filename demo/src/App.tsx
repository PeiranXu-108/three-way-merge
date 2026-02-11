import React, { useState } from 'react';
import { ThreeWayDiffEditor } from 'three-way-diff-editor';
import { newContent, oldContent } from './demoData';

const App: React.FC = () => {
  const [mergedContent, setMergedContent] = useState('');

  return (
    <div className="demo-shell">
      <header className="demo-header">
        <div>
          <h1>Three-Way Diff Editor</h1>
        </div>
      </header>

      <section className="demo-editor">
        <ThreeWayDiffEditor oldContent={oldContent} newContent={newContent} onChange={setMergedContent} leftColumnTitle='本地版本' rightColumnTitle='线上版本'/>
      </section>

      <section className="demo-output">
        <div className="output-header">合并结果</div>
        <pre className="output-content">{mergedContent || '（暂无更改）'}</pre>
      </section>
    </div>
  );
};

export default App;
