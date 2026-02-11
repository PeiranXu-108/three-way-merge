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
        <ThreeWayDiffEditor oldContent={oldContent} newContent={newContent} onChange={setMergedContent}/>
      </section>

      <section className="demo-output">
        <div className="output-header">Merge Result</div>
        <pre className="output-content">{mergedContent || '(No changes)'}</pre>
      </section>
    </div>
  );
};

export default App;
