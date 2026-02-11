/**
 * 合并结果行组件（中间）
 */

import React, { useEffect, useRef } from 'react';
import { DiffLine, CodeBlock } from '../types';

interface MergedLineComponentProps {
  line: DiffLine;
  lineIndex: number;
  onSelectLeft: () => void;
  onSelectRight: () => void;
  onContentChange?: (lineIndex: number, newContent: string) => void;
  codeBlock?: CodeBlock | null;
  canAcceptLeft?: boolean;
  canAcceptRight?: boolean;
  onBlockSelectLeft?: () => void;
  onBlockSelectRight?: () => void;
}

const MergedLineComponent: React.FC<MergedLineComponentProps> = ({
  line,
  lineIndex,
  onSelectLeft,
  onSelectRight,
  onContentChange,
  codeBlock,
  canAcceptLeft,
  canAcceptRight,
  onBlockSelectLeft,
  onBlockSelectRight,
}) => {
  // 只在"左右都有内容且不同"时显示双向选择按钮（减少 added/removed 行的噪音）
  const hasConflict = line.leftContent !== null && line.rightContent !== null && line.leftContent !== line.rightContent;
  const showButtons = hasConflict;

  const isBlockFirstLine = !!codeBlock && codeBlock.startIndex === lineIndex;
  const isBlockLastLine = !!codeBlock && codeBlock.endIndex === lineIndex;
  const showBlockControlsLeft = !!codeBlock && isBlockFirstLine;
  const showBlockControlsRight = !!codeBlock && isBlockLastLine;

  const blockClass = codeBlock ? `code-block-${codeBlock.type}` : '';
  const firstLineClass = isBlockFirstLine ? 'code-block-first-line' : '';
  const lastLineClass = isBlockLastLine ? 'code-block-last-line' : '';
  const blockLineClass = codeBlock ? 'code-block-line' : '';

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line.mergedContent]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.replace(/[\r\n]/g, '');
    adjustTextareaHeight();
    onContentChange?.(lineIndex, value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onContentChange?.(lineIndex, newValue);

      requestAnimationFrame(() => {
        if (!textareaRef.current) return;
        textareaRef.current.setSelectionRange(start + 2, start + 2);
        adjustTextareaHeight();
      });
    } else if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  return (
    <div
      className={`diff-line merged-line ${hasConflict ? 'has-conflict' : 'no-conflict'} from-${
        line.selectedFrom
      } ${blockClass} ${firstLineClass} ${lastLineClass} ${blockLineClass}`}
    >
      <span className="line-number">{line.mergedContent !== null ? line.lineNumber : ''}</span>

      {showBlockControlsLeft && (
        <div className="block-controls block-controls-left">
          <button
            type="button"
            className="twd-btn twd-btn-sm"
            onClick={onBlockSelectLeft}
            disabled={!codeBlock || !canAcceptLeft}
            title={`接受左侧块（${codeBlock?.lineCount ?? 0}行）`}
          >
            ▶
          </button>
        </div>
      )}

      {showBlockControlsRight && (
        <div className="block-controls block-controls-right">
          <button
            type="button"
            className="twd-btn twd-btn-sm"
            onClick={onBlockSelectRight}
            disabled={!codeBlock || !canAcceptRight}
            title={`接受右侧块（${codeBlock?.lineCount ?? 0}行）`}
          >
            ◀
          </button>
        </div>
      )}

      <textarea
        ref={textareaRef}
        className="line-content editable-content"
        value={line.mergedContent ?? ''}
        onChange={handleContentChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        rows={1}
      />
    </div>
  );
};

export default MergedLineComponent;
