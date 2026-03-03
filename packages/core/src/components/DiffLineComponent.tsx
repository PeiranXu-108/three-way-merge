/**
 * Single line diff display component (left/right panels)
 */

import React from 'react';
import { DiffLine } from '../types';

interface DiffLineComponentProps {
  line: DiffLine;
  side: 'left' | 'right';
}

const DiffLineComponent: React.FC<DiffLineComponentProps> = React.memo(({ line, side }) => {
  const content = side === 'left' ? line.leftContent : line.rightContent;
  const charDiffs = (side === 'left' ? line.leftCharDiffs : line.rightCharDiffs) || [];

  const getClassName = () => {
    const baseClass = 'diff-line';
    if (!content) return `${baseClass} empty-line`;

    const typeClass =
      {
        unchanged: '',
        removed: side === 'left' ? 'removed-line' : '',
        added: side === 'right' ? 'added-line' : '',
        modified: 'modified-line',
      }[line.type] || '';

    return `${baseClass} ${typeClass}`.trim();
  };

  const renderContent = () => {
    if (!content) {
      return '';
    }
    // If character-level diff data already exists, use it; otherwise, use plain text.
    // Key point: do not rely on isVisible to determine display, to avoid flickering during scrolling.
    if (charDiffs.length === 0) {
      return content;
    }

    return charDiffs.map((diff, idx) => {
      if (diff.type === 'unchanged') {
        return <span key={idx}>{diff.value}</span>;
      }
      if (diff.type === 'removed') {
        return (
          <span key={idx} className="char-diff char-removed">
            {diff.value}
          </span>
        );
      }
      if (diff.type === 'added') {
        return (
          <span key={idx} className="char-diff char-added">
            {diff.value}
          </span>
        );
      }
      return null;
    });
  };

  return (
    <div className={getClassName()}>
      <span className="line-number">{content ? line.lineNumber : ''}</span>
      <pre className="line-content">{renderContent()}</pre>
    </div>
  );
});

DiffLineComponent.displayName = 'DiffLineComponent';

export default DiffLineComponent;
