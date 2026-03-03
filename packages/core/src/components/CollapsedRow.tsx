/**
 * Collapsed row component (displays hidden lines)
 */

import React, { useContext } from 'react';
import { I18nContext } from '../i18n';
import { EXPAND_STEP } from '../utils';

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
  const messages = useContext(I18nContext);
  return (
    <div className={`collapsed-row collapsed-row-${side}`}>
      {side === 'middle' ? (
        <div className="collapsed-row-controls">
          <button type="button" className="twd-btn twd-btn-sm collapse-btn-all" onClick={onShowAll}>
            {messages.showAllLines(hiddenCount)}
          </button>
          <div className="collapse-buttons-right">
            <button type="button" className="twd-btn twd-btn-sm collapse-btn-up" onClick={onShowMoreAbove} disabled={!canShowMoreAbove}>
              {messages.showMoreAbove(EXPAND_STEP)}
            </button>
            <button type="button" className="twd-btn twd-btn-sm collapse-btn-down" onClick={onShowMoreBelow} disabled={!canShowMoreBelow}>
              {messages.showMoreBelow(EXPAND_STEP)}
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
