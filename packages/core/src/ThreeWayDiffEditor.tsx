import React, { useEffect, useMemo, useRef, useState, useCallback, useLayoutEffect } from 'react';
import './styles/index.less';

import { CodeBlock, CollapsedBlockState, DiffLine, RenderRow, ThreeWayDiffEditorProps } from './types';
import {
  clamp,
  buildRowMetrics,
  findRowIndex,
  computeCharDiffs,
  parseDiffToLines,
  getMergedContent,
  identifyCodeBlocks,
  buildRenderRows,
  EXPAND_STEP,
  OVERSCAN_COUNT,
} from './utils';
import { getMessages, I18nContext } from './i18n';
import CollapsedRow from './components/CollapsedRow';
import DiffLineComponent from './components/DiffLineComponent';
import FreeEditPanel from './components/FreeEditPanel';
import MergedLineComponent from './components/MergedLineComponent';

const stripEmptyLines = (content: string) => {
  return content
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n');
};

// 主组件
const ThreeWayDiffEditor: React.FC<ThreeWayDiffEditorProps> = ({
  oldContent,
  newContent,
  middleContent,
  onChange,
  onHasChangesChange,
  leftColumnTitle,
  rightColumnTitle,
  collapseUnchangedLines = true,
  locale = 'en',
  messages: messagesOverride,
}) => {
  const messages = useMemo(
    () => getMessages(locale, messagesOverride),
    [locale, messagesOverride]
  );
  const effectiveLeftTitle = leftColumnTitle ?? messages.defaultLeftColumnTitle;
  const effectiveRightTitle = rightColumnTitle ?? messages.defaultRightColumnTitle;

  const [editMode, setEditMode] = useState<boolean>(false);
  const [freeEditContent, setFreeEditContent] = useState<string>('');
  const [initialFreeEditContent, setInitialFreeEditContent] = useState<string>('');
  const [saveModalVisible, setSaveModalVisible] = useState<boolean>(false);
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [initialLines, setInitialLines] = useState<DiffLine[]>([]);
  const [collapsedState, setCollapsedState] = useState<Record<string, CollapsedBlockState>>({});
  const [visibleRange, setVisibleRange] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const middlePanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const syncingScrollRef = useRef(false);
  const rangeRafRef = useRef<number | null>(null);
  const scrollStateRef = useRef({ scrollTop: 0, viewportHeight: 0 });
  const visibleRowsRef = useRef<RenderRow[]>([]);
  const hoveredLineIndexRef = useRef<number | null>(null);

  useEffect(() => {
    let lines = parseDiffToLines(oldContent, newContent);
    let mergedContent = getMergedContent(lines);

    if (middleContent !== undefined) {
      const middleLines = middleContent.split('\n');
      lines = lines.map((line, index) => {
        const middleLine = middleLines[index];
        if (middleLine === undefined) return line;
        return { ...line, mergedContent: middleLine, selectedFrom: 'manual' as const };
      });
      mergedContent = getMergedContent(lines);
    }

    setDiffLines(lines);
    setInitialLines(JSON.parse(JSON.stringify(lines)));
    setCollapsedState({});
    setFreeEditContent(mergedContent);
    setInitialFreeEditContent(mergedContent);
  }, [oldContent, newContent, middleContent]);

  // 检测是否有未保存的更改
  useEffect(() => {
    if (initialLines.length === 0) return;

    const hasChanges = JSON.stringify(diffLines) !== JSON.stringify(initialLines);
    onHasChangesChange?.(hasChanges);
  }, [diffLines, initialLines, onHasChangesChange]);

  const notifyChange = (lines: DiffLine[]) => {
    if (!onChange) return;
    onChange(getMergedContent(lines));
  };

  const isConflictLine = (line: DiffLine) =>
    line.leftContent !== null && line.rightContent !== null && line.leftContent !== line.rightContent;

  const handleSelectLeft = (lineIndex: number) => {
    setDiffLines((prev) => {
      const next = [...prev];
      const leftContent = next[lineIndex].leftContent;
      const rightContent = next[lineIndex].rightContent;
      // 重新计算字符级 diff
      const { oldDiffs, newDiffs } = computeCharDiffs(leftContent, rightContent);
      const updatedLine = {
        ...next[lineIndex],
        mergedContent: leftContent,
        selectedFrom: 'left' as const,
        leftCharDiffs: oldDiffs,
        rightCharDiffs: newDiffs,
      };
      next[lineIndex] = isConflictLine(updatedLine) ? { ...updatedLine, conflictResolved: true } : updatedLine;
      notifyChange(next);
      return next;
    });
  };

  const handleSelectRight = (lineIndex: number) => {
    setDiffLines((prev) => {
      const next = [...prev];
      const rightContent = next[lineIndex].rightContent;
      const leftContent = next[lineIndex].leftContent;
      // 重新计算字符级 diff
      const { oldDiffs, newDiffs } = computeCharDiffs(leftContent, rightContent);
      const updatedLine = {
        ...next[lineIndex],
        mergedContent: rightContent,
        selectedFrom: 'right' as const,
        leftCharDiffs: oldDiffs,
        rightCharDiffs: newDiffs,
      };
      next[lineIndex] = isConflictLine(updatedLine) ? { ...updatedLine, conflictResolved: true } : updatedLine;
      notifyChange(next);
      return next;
    });
  };

  const handleContentChange = (lineIndex: number, newContentValue: string) => {
    setDiffLines((prev) => {
      const next = [...prev];
      const updatedLine = { ...next[lineIndex], mergedContent: newContentValue, selectedFrom: 'manual' as const };
      next[lineIndex] = isConflictLine(updatedLine) ? { ...updatedLine, conflictResolved: true } : updatedLine;
      notifyChange(next);
      return next;
    });
  };

  const acceptAllLeft = () => {
    setDiffLines((prev) => {
      const next = prev.map((line) => ({
        ...line,
        mergedContent: line.leftContent,
        selectedFrom: 'left' as const,
        conflictResolved: isConflictLine(line) ? true : line.conflictResolved,
      }));
      notifyChange(next);
      return next;
    });
  };

  const acceptAllRight = () => {
    setDiffLines((prev) => {
      const next = prev.map((line) => ({
        ...line,
        mergedContent: line.rightContent,
        selectedFrom: 'right' as const,
        conflictResolved: isConflictLine(line) ? true : line.conflictResolved,
      }));
      notifyChange(next);
      return next;
    });
  };

  const reset = () => {
    const lines = JSON.parse(JSON.stringify(initialLines)) as DiffLine[];
    setDiffLines(lines);
    notifyChange(lines);
    setCollapsedState({});
  };

  const stats = useMemo(() => {
    const total = diffLines.length;
    const unchanged = diffLines.filter((l) => l.type === 'unchanged').length;
    const added = diffLines.filter((l) => l.type === 'added').length;
    const removed = diffLines.filter((l) => l.type === 'removed').length;
    const modified = diffLines.filter((l) => l.type === 'modified').length;

    // "冲突"：左右都有且不同（modified 里也会统计到）
    const conflicts = diffLines.filter((l) => isConflictLine(l) && !l.conflictResolved).length;

    return { total, unchanged, added, removed, modified, conflicts };
  }, [diffLines]);

  const handleScroll = (source: 'left' | 'middle' | 'right') => (e: React.UIEvent<HTMLDivElement>) => {
    if (syncingScrollRef.current) return;
    const scrollTop = e.currentTarget.scrollTop;
    const viewportHeight = e.currentTarget.clientHeight;
    syncingScrollRef.current = true;

    if (source !== 'left' && leftPanelRef.current) leftPanelRef.current.scrollTop = scrollTop;
    if (source !== 'middle' && middlePanelRef.current) middlePanelRef.current.scrollTop = scrollTop;
    if (source !== 'right' && rightPanelRef.current) rightPanelRef.current.scrollTop = scrollTop;

    scheduleVisibleRangeUpdate(scrollTop, viewportHeight);

    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  };

  const codeBlocks = useMemo(() => identifyCodeBlocks(diffLines), [diffLines]);

  const getCodeBlockForLine = (lineIndex: number): CodeBlock | null => {
    return codeBlocks.find((block) => lineIndex >= block.startIndex && lineIndex <= block.endIndex) || null;
  };

  // 计算每个 block 是否可接受左/右（允许接受空行，即使内容为 null 也可以合并）
  const blockAcceptability = useMemo(() => {
    const map = new Map<string, { canLeft: boolean; canRight: boolean }>();
    for (const b of codeBlocks) {
      let canLeft = false;
      let canRight = false;
      for (let i = b.startIndex; i <= b.endIndex; i += 1) {
        const line = diffLines[i];
        if (line) {
          canLeft = true; // 块内存在行，就可以接受左侧（包括空行）
          canRight = true; // 块内存在行，就可以接受右侧（包括空行）
          break; // 只要有一行存在，就可以接受，不需要继续检查
        }
      }
      map.set(`${b.startIndex}-${b.endIndex}`, { canLeft, canRight });
    }
    return map;
  }, [codeBlocks, diffLines]);

  const handleBlockSelectLeft = (block: CodeBlock) => {
    setDiffLines((prev) => {
      const next = [...prev];
      for (let i = block.startIndex; i <= block.endIndex; i += 1) {
        const leftContent = next[i].leftContent;
        const rightContent = next[i].rightContent;
        // 重新计算字符级 diff，对比新选中的内容和当前右侧内容
        const { oldDiffs, newDiffs } = computeCharDiffs(leftContent, rightContent);
        const updatedLine = {
          ...next[i],
          mergedContent: leftContent,
          selectedFrom: 'left' as const,
          leftCharDiffs: oldDiffs,
          rightCharDiffs: newDiffs,
        };
        next[i] = isConflictLine(updatedLine) ? { ...updatedLine, conflictResolved: true } : updatedLine;
      }
      notifyChange(next);
      return next;
    });
  };

  const handleBlockSelectRight = (block: CodeBlock) => {
    setDiffLines((prev) => {
      const next = [...prev];
      for (let i = block.startIndex; i <= block.endIndex; i += 1) {
        const rightContent = next[i].rightContent;
        const leftContent = next[i].leftContent;
        // 重新计算字符级 diff，对比左侧内容和新选中的内容
        const { oldDiffs, newDiffs } = computeCharDiffs(leftContent, rightContent);
        const updatedLine = {
          ...next[i],
          mergedContent: rightContent,
          selectedFrom: 'right' as const,
          leftCharDiffs: oldDiffs,
          rightCharDiffs: newDiffs,
        };
        next[i] = isConflictLine(updatedLine) ? { ...updatedLine, conflictResolved: true } : updatedLine;
      }
      notifyChange(next);
      return next;
    });
  };

  const renderRows = useMemo(
    () => buildRenderRows(diffLines, collapsedState, collapseUnchangedLines),
    [diffLines, collapsedState, collapseUnchangedLines]
  );
  const rowMetrics = useMemo(() => buildRowMetrics(renderRows), [renderRows]);

  // 窗口化渲染，避免一次性渲染全部行导致卡顿
  const updateVisibleRange = useCallback(
    (scrollTop: number, viewportHeight: number) => {
      const rowCount = renderRows.length;
      if (rowCount === 0) {
        setVisibleRange({ start: 0, end: 0 });
        return;
      }

      const startIndex = clamp(findRowIndex(rowMetrics.offsets, scrollTop) - OVERSCAN_COUNT, 0, rowCount - 1);
      const endIndex = clamp(findRowIndex(rowMetrics.offsets, scrollTop + viewportHeight) + OVERSCAN_COUNT + 1, startIndex + 1, rowCount);

      setVisibleRange((prev) => (prev.start === startIndex && prev.end === endIndex ? prev : { start: startIndex, end: endIndex }));
    },
    [renderRows.length, rowMetrics.offsets]
  );

  const scheduleVisibleRangeUpdate = useCallback(
    (scrollTop: number, viewportHeight: number) => {
      scrollStateRef.current = { scrollTop, viewportHeight };
      if (rangeRafRef.current !== null) return;

      rangeRafRef.current = requestAnimationFrame(() => {
        rangeRafRef.current = null;
        const { scrollTop: nextScrollTop, viewportHeight: nextViewportHeight } = scrollStateRef.current;
        updateVisibleRange(nextScrollTop, nextViewportHeight);
      });
    },
    [updateVisibleRange]
  );

  useLayoutEffect(() => {
    const panel = middlePanelRef.current || leftPanelRef.current || rightPanelRef.current;
    if (!panel) return;
    if (rangeRafRef.current !== null) {
      cancelAnimationFrame(rangeRafRef.current);
      rangeRafRef.current = null;
    }
    updateVisibleRange(panel.scrollTop, panel.clientHeight);
  }, [rowMetrics, updateVisibleRange]);

  useEffect(() => {
    return () => {
      if (rangeRafRef.current !== null) {
        cancelAnimationFrame(rangeRafRef.current);
      }
    };
  }, []);

  const safeStart = Math.min(visibleRange.start, renderRows.length);
  const safeEnd = Math.min(Math.max(visibleRange.end, safeStart), renderRows.length);
  const visibleRows = useMemo(() => renderRows.slice(safeStart, safeEnd), [renderRows, safeStart, safeEnd]);
  const topSpacerHeight = rowMetrics.offsets[safeStart] || 0;
  const bottomSpacerHeight = Math.max(0, rowMetrics.totalHeight - (rowMetrics.offsets[safeEnd] || 0));

  const showMoreAbove = (row: Extract<RenderRow, { kind: 'collapsed' }>) => {
    setCollapsedState((prev) => {
      const cur = prev[row.blockId] || { above: 0, below: 0, expanded: false };
      return { ...prev, [row.blockId]: { ...cur, above: (cur.above || 0) + EXPAND_STEP } };
    });
  };

  const showMoreBelow = (row: Extract<RenderRow, { kind: 'collapsed' }>) => {
    setCollapsedState((prev) => {
      const cur = prev[row.blockId] || { above: 0, below: 0, expanded: false };
      return { ...prev, [row.blockId]: { ...cur, below: (cur.below || 0) + EXPAND_STEP } };
    });
  };

  const showAll = (row: Extract<RenderRow, { kind: 'collapsed' }>) => {
    setCollapsedState((prev) => {
      const cur = prev[row.blockId] || { above: 0, below: 0, expanded: false };
      return { ...prev, [row.blockId]: { ...cur, expanded: true } };
    });
  };

  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);

  const handleToggleEditMode = () => {
    if (editMode) {
      // 检查编辑内容是否有改动
      if (freeEditContent !== initialFreeEditContent) {
        setSaveModalVisible(true);
      } else {
        setEditMode(false);
      }
      return;
    }

    // 进入编辑模式：初始化编辑内容
    const mergedContent = getMergedContent(diffLines);
    setFreeEditContent(mergedContent);
    setInitialFreeEditContent(mergedContent);
    setEditMode(true);
  };

  // 绘制连接线
  const drawConnectorLines = useCallback(() => {
    if (!canvasRef.current || !leftPanelRef.current || !rightPanelRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清除画布
    ctx.fillStyle = 'transparent';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;
    const leftRect = leftPanel.getBoundingClientRect();
    const rightRect = rightPanel.getBoundingClientRect();

    // 获取左右面板相对于容器的位置
    const leftPanelLeft = leftRect.left - containerRect.left;
    const leftPanelWidth = leftRect.width;
    const rightPanelLeft = rightRect.left - containerRect.left;
    const rightPanelWidth = rightRect.width;

    const rowsToDraw = visibleRowsRef.current;
    if (rowsToDraw.length === 0) return;

    // 遍历可见 diff 行，找到对应的 DOM 元素并绘制连接线
    const processedLines = new Set<number>();

    rowsToDraw.forEach((row) => {
      if (row.kind !== 'line') return;

      const lineIndex = row.lineIndex;
      const line = row.line;

      if (!line || processedLines.has(lineIndex)) return;

      // 只绘制有差异的行
      if (line.type === 'unchanged') return;

      processedLines.add(lineIndex);

      // 获取左侧行的 DOM 元素
      const leftLineEl = container.querySelector(`[data-line-index="${lineIndex}"][data-side="left"] .diff-line`) as HTMLElement;

      // 获取右侧行的 DOM 元素
      const rightLineEl = container.querySelector(`[data-line-index="${lineIndex}"][data-side="right"] .diff-line`) as HTMLElement;

      if (!leftLineEl || !rightLineEl) return;

      const leftLineRect = leftLineEl.getBoundingClientRect();
      const rightLineRect = rightLineEl.getBoundingClientRect();

      // 相对于容器的位置
      const leftY = leftLineRect.top - containerRect.top + leftLineRect.height / 2;
      const rightY = rightLineRect.top - containerRect.top + rightLineRect.height / 2;

      // 起点和终点
      const startX = leftPanelLeft + leftPanelWidth - 2;
      const endX = rightPanelLeft + 2;

      // 设置连接线样式：根据是否悬停改变样式
      const isHovered = hoveredLineIndexRef.current === lineIndex;
      ctx.strokeStyle = isHovered ? '#d4a373' : '#d4a373';
      ctx.lineWidth = isHovered ? 2.5 : 1.2;
      ctx.globalAlpha = isHovered ? 0.8 : 0.5;

      // 绘制连接线
      ctx.beginPath();
      ctx.moveTo(startX, leftY);

      // 使用二次贝塞尔曲线以获得更平滑的效果
      const cpX = (startX + endX) / 2;
      const cpY = (leftY + rightY) / 2;
      ctx.quadraticCurveTo(cpX, cpY, endX, rightY);
      ctx.stroke();
    });

    ctx.globalAlpha = 1;
  }, []);

  useEffect(() => {
    visibleRowsRef.current = visibleRows;
    hoveredLineIndexRef.current = hoveredLineIndex;
    drawConnectorLines();
  }, [visibleRows, hoveredLineIndex, drawConnectorLines]);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (canvasRef.current) {
      canvasRef.current.width = width;
      canvasRef.current.height = height;
    }

    drawConnectorLines();

    const handleScroll = () => {
      requestAnimationFrame(() => {
        drawConnectorLines();
      });
    };

    middlePanelRef.current?.addEventListener('scroll', handleScroll);
    leftPanelRef.current?.addEventListener('scroll', handleScroll);
    rightPanelRef.current?.addEventListener('scroll', handleScroll);

    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
      const panel = middlePanelRef.current || leftPanelRef.current || rightPanelRef.current;
      if (panel) {
        scheduleVisibleRangeUpdate(panel.scrollTop, panel.clientHeight);
      }
      drawConnectorLines();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      middlePanelRef.current?.removeEventListener('scroll', handleScroll);
      leftPanelRef.current?.removeEventListener('scroll', handleScroll);
      rightPanelRef.current?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [drawConnectorLines, scheduleVisibleRangeUpdate]);

  // 在初始化或内容变化时，一次性计算所有字符级 diff
  // 这样避免了虚拟滚动时的闪现问题
  useEffect(() => {
    setDiffLines((prev) => {
      if (prev.length === 0) return prev;

      return prev.map((line) => {
        // 如果已经有字符级 diff 数据，就不重新计算
        if (line.leftCharDiffs !== undefined && line.rightCharDiffs !== undefined) {
          return line;
        }

        const { oldDiffs, newDiffs } = computeCharDiffs(line.leftContent, line.rightContent);
        return {
          ...line,
          leftCharDiffs: oldDiffs.length > 0 ? oldDiffs : undefined,
          rightCharDiffs: newDiffs.length > 0 ? newDiffs : undefined,
        };
      });
    });
  }, [oldContent, newContent]);

  return (
    <I18nContext.Provider value={messages}>
    <div className="three-way-diff-container" ref={containerRef}>
      <canvas ref={canvasRef} className="connector-canvas" />
      <div className="diff-toolbar">
        <div className="toolbar-left">
          <button type="button" className="twd-btn twd-btn-sm" onClick={acceptAllLeft}>
            {messages.acceptAllLeft}
          </button>
          <button type="button" className="twd-btn twd-btn-sm" onClick={acceptAllRight}>
            {messages.acceptAllRight}
          </button>
          <button type="button" className="twd-btn twd-btn-sm" onClick={reset}>
            {messages.reset}
          </button>
        </div>
        <div className="toolbar-right">
          <span className="diff-stats">
            {messages.statsTotal}: {stats.total} | {messages.statsAdded}: <span className="stat-added">{stats.added}</span> | {messages.statsRemoved}:{' '}
            <span className="stat-removed">{stats.removed}</span> | {messages.statsModified}: <span className="stat-modified">{stats.modified}</span> | {messages.statsConflicts}:{' '}
            <span className="stat-conflicts">{stats.conflicts}</span>
          </span>
        </div>
      </div>

      <div className="diff-headers">
        <div className="panel-header left">{effectiveLeftTitle}</div>
        <div className="panel-header middle">
          {messages.mergeResult}
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
        <div className="panel-header right">{effectiveRightTitle}</div>
      </div>

      <div className="diff-panels">
        {/* 左侧面板 */}
        <div className="diff-panel left-panel" ref={leftPanelRef} onScroll={handleScroll('left')}>
          {topSpacerHeight > 0 && <div className="virtual-spacer" style={{ height: topSpacerHeight }} />}
          {visibleRows.map((row) => {
            if (row.kind === 'line') {
              return (
                <div
                  key={`l-${row.lineIndex}`}
                  data-line-index={row.lineIndex}
                  data-side="left"
                  onMouseEnter={() => setHoveredLineIndex(row.lineIndex)}
                  onMouseLeave={() => setHoveredLineIndex(null)}
                >
                  <DiffLineComponent line={row.line} side="left" />
                </div>
              );
            }
            return (
              <CollapsedRow
                key={`cl-${row.blockId}`}
                side="left"
                hiddenCount={row.hiddenCount}
                canShowMoreAbove={row.canShowMoreAbove}
                canShowMoreBelow={row.canShowMoreBelow}
                onShowMoreAbove={() => showMoreAbove(row)}
                onShowMoreBelow={() => showMoreBelow(row)}
                onShowAll={() => showAll(row)}
              />
            );
          })}
          {bottomSpacerHeight > 0 && <div className="virtual-spacer" style={{ height: bottomSpacerHeight }} />}
        </div>

        {/* 中间面板 */}
        <div className="diff-panel middle-panel" ref={middlePanelRef} onScroll={handleScroll('middle')}>
          {editMode ? (
            <FreeEditPanel
              content={freeEditContent}
              onChange={(newContent) => {
                setFreeEditContent(newContent);
                if (onChange) onChange(newContent);
              }}
              leftPanelRef={leftPanelRef}
              middlePanelRef={middlePanelRef}
              onScroll={handleScroll('middle')}
            />
          ) : (
            <>
              {topSpacerHeight > 0 && <div className="virtual-spacer" style={{ height: topSpacerHeight }} />}
              {visibleRows.map((row) => {
                if (row.kind === 'line') {
                  const codeBlock = getCodeBlockForLine(row.lineIndex);
                  const acc = codeBlock ? blockAcceptability.get(`${codeBlock.startIndex}-${codeBlock.endIndex}`) : undefined;

                  return (
                    <MergedLineComponent
                      key={`m-${row.lineIndex}`}
                      line={row.line}
                      lineIndex={row.lineIndex}
                      onSelectLeft={() => handleSelectLeft(row.lineIndex)}
                      onSelectRight={() => handleSelectRight(row.lineIndex)}
                      onContentChange={handleContentChange}
                      codeBlock={codeBlock}
                      canAcceptLeft={acc?.canLeft}
                      canAcceptRight={acc?.canRight}
                      onBlockSelectLeft={codeBlock ? () => handleBlockSelectLeft(codeBlock) : undefined}
                      onBlockSelectRight={codeBlock ? () => handleBlockSelectRight(codeBlock) : undefined}
                    />
                  );
                }
                return (
                  <CollapsedRow
                    key={`cm-${row.blockId}`}
                    side="middle"
                    hiddenCount={row.hiddenCount}
                    canShowMoreAbove={row.canShowMoreAbove}
                    canShowMoreBelow={row.canShowMoreBelow}
                    onShowMoreAbove={() => showMoreAbove(row)}
                    onShowMoreBelow={() => showMoreBelow(row)}
                    onShowAll={() => showAll(row)}
                  />
                );
              })}
              {bottomSpacerHeight > 0 && <div className="virtual-spacer" style={{ height: bottomSpacerHeight }} />}
            </>
          )}
        </div>

        {/* 右侧面板 */}
        <div className="diff-panel right-panel" ref={rightPanelRef} onScroll={handleScroll('right')}>
          {topSpacerHeight > 0 && <div className="virtual-spacer" style={{ height: topSpacerHeight }} />}
          {visibleRows.map((row) => {
            if (row.kind === 'line') {
              return (
                <div
                  key={`r-${row.lineIndex}`}
                  data-line-index={row.lineIndex}
                  data-side="right"
                  onMouseEnter={() => setHoveredLineIndex(row.lineIndex)}
                  onMouseLeave={() => setHoveredLineIndex(null)}
                >
                  <DiffLineComponent line={row.line} side="right" />
                </div>
              );
            }
            return (
              <CollapsedRow
                key={`cr-${row.blockId}`}
                side="right"
                hiddenCount={row.hiddenCount}
                canShowMoreAbove={row.canShowMoreAbove}
                canShowMoreBelow={row.canShowMoreBelow}
                onShowMoreAbove={() => showMoreAbove(row)}
                onShowMoreBelow={() => showMoreBelow(row)}
                onShowAll={() => showAll(row)}
              />
            );
          })}
          {bottomSpacerHeight > 0 && <div className="virtual-spacer" style={{ height: bottomSpacerHeight }} />}
        </div>
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
        <div className="twd-modal-mask" onClick={() => setSaveModalVisible(false)} role="presentation">
          <div className="twd-modal-wrap" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="twd-modal-title">
            <div className="twd-modal">
              <div className="twd-modal-content">
                <div className="twd-modal-header">
                  <span id="twd-modal-title" className="twd-modal-title">{messages.saveChanges}</span>
                  <button type="button" className="twd-modal-close" onClick={() => setSaveModalVisible(false)} aria-label={messages.close}>×</button>
                </div>
                <div className="twd-modal-body">{messages.confirmSaveMessage}</div>
                <div className="twd-modal-footer">
                  <button
                    type="button"
                    className="twd-btn twd-btn-sm"
                    onClick={() => {
                      setFreeEditContent(initialFreeEditContent);
                      setSaveModalVisible(false);
                      setEditMode(false);
                    }}
                  >
                    {messages.discard}
                  </button>
                  <button
                    type="button"
                    className="twd-btn twd-btn-sm twd-btn-primary"
                    onClick={() => {
                      const normalizedContent = stripEmptyLines(freeEditContent);
                      if (onChange) onChange(normalizedContent);
                      setFreeEditContent(normalizedContent);
                      setInitialFreeEditContent(normalizedContent);
                      const editedLines = normalizedContent ? normalizedContent.split('\n') : [];
                      const updatedLines = diffLines.map((line, idx) => {
                        const editedContent = editedLines[idx];
                        return {
                          ...line,
                          mergedContent: editedContent ?? null,
                          selectedFrom: 'manual' as const,
                        };
                      });
                      setDiffLines(updatedLines);
                      setSaveModalVisible(false);
                      setEditMode(false);
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
};

export default ThreeWayDiffEditor;
