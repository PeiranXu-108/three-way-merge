/**
 * 自由编辑模式面板
 */

import React, { useRef, useMemo } from 'react';

interface FreeEditPanelProps {
  content: string;
  onChange: (content: string) => void;
  leftPanelRef: React.RefObject<HTMLDivElement>;
  middlePanelRef: React.RefObject<HTMLDivElement>;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
}

const FreeEditPanel: React.FC<FreeEditPanelProps> = ({
  content,
  onChange,
  leftPanelRef,
  middlePanelRef,
  onScroll,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const lineCount = useMemo(() => {
    return content.split('\n').length;
  }, [content]);

  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textarea.scrollTop;
    }
    if (leftPanelRef.current) {
      leftPanelRef.current.scrollTop = textarea.scrollTop;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  return (
    <div className="free-edit-panel">
      <div className="free-edit-container">
        <div className="free-edit-line-numbers" ref={lineNumbersRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="line-number-item">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="free-edit-textarea"
          value={content}
          onChange={handleChange}
          onScroll={handleScroll}
          spellCheck={false}
        />
      </div>
    </div>
  );
};

export default FreeEditPanel;
