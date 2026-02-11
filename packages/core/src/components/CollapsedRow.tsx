/**
 * 折叠行组件（展示未显示的行）
 */

import React from 'react';

interface CollapsedRowProps {
  side: 'left' | 'middle' | 'right';
  hiddenCount: number;
  canShowMoreAbove: boolean;
  canShowMoreBelow: boolean;
  onShowMoreAbove: () => void;
  onShowMoreBelow: () => void;
  onShowAll: () => void;
}

const CollapsedRow: React.FC<CollapsedRowProps> = ({
  side,
  hiddenCount,
  canShowMoreAbove,
  canShowMoreBelow,
  onShowMoreAbove,
  onShowMoreBelow,
  onShowAll,
}) => {
  return (
    <div className={`collapsed-row collapsed-row-${side}`}>
      {side === 'middle' ? (
        <div className="collapsed-row-controls">
          <button type="button" className="twd-btn twd-btn-sm collapse-btn-all" onClick={onShowAll}>
            显示全部 {hiddenCount} 行
          </button>
          <div className="collapse-buttons-right">
            <button type="button" className="twd-btn twd-btn-sm collapse-btn-up" onClick={onShowMoreAbove} disabled={!canShowMoreAbove}>
              ▲ 10
            </button>
            <button type="button" className="twd-btn twd-btn-sm collapse-btn-down" onClick={onShowMoreBelow} disabled={!canShowMoreBelow}>
              ▼ 10
            </button>
          </div>
        </div>
      ) : (
        <span className="collapsed-row-placeholder">…</span>
      )}
    </div>
  );
};

export default CollapsedRow;
