import { expect, test, type Page } from '@playwright/test';
import { SAMPLES } from '../demo/src/samples';
import { formatJsonSafe } from '../packages/core/src/model/text';

/** The demo uses the default `normalizeJson`, so JSON inputs are pretty-printed like the legacy editor did */
const JSON_OLD = formatJsonSafe(SAMPLES.json.oldContent);
const JSON_NEW = formatJsonSafe(SAMPLES.json.newContent);

const PANES = { left: '.left-panel', middle: '.twd-structured', right: '.right-panel' } as const;
const MOD = process.platform === 'darwin' ? 'Meta' : 'Control';

const trackErrors = (page: Page) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
};

const open = async (page: Page, query = '') => {
  await page.goto(`/${query}`);
  await page.waitForSelector(`${PANES.middle} .cm-line[data-row]`);
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const merged = (page: Page) => page.evaluate(() => (window as any).__demo.ref.current.getMergedContent() as string);
const changes = (page: Page) => page.evaluate(() => (window as any).__demo.changes as string[]);
const hasChangesCalls = (page: Page) => page.evaluate(() => (window as any).__demo.hasChangesCalls as boolean[]);
/* eslint-enable @typescript-eslint/no-explicit-any */

const row = (page: Page, pane: keyof typeof PANES, index: number) =>
  page.locator(`${PANES[pane]} .cm-line[data-row="${index}"]`);

const rowTop = (page: Page, pane: keyof typeof PANES, index: number) =>
  row(page, pane, index).evaluate((el) => el.getBoundingClientRect().top);

const expectAligned = async (page: Page, index: number) => {
  const tops = await Promise.all((['left', 'middle', 'right'] as const).map((pane) => rowTop(page, pane, index)));
  expect(Math.abs(tops[0] - tops[1]), `row ${index} left/middle`).toBeLessThanOrEqual(1);
  expect(Math.abs(tops[2] - tops[1]), `row ${index} right/middle`).toBeLessThanOrEqual(1);
};

/** Row indices currently rendered in all three panes */
const commonRows = async (page: Page) => {
  const sets = await Promise.all(
    Object.values(PANES).map((selector) =>
      page.locator(`${selector} .cm-line[data-row]`).evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-row'))))
    )
  );
  return sets[0].filter((r) => sets[1].includes(r) && sets[2].includes(r));
};

const conflicts = async (page: Page) => Number(await page.locator('.stat-conflicts').textContent());

test.describe('three-way diff editor (CodeMirror)', () => {
  test('renders three aligned panes with legacy-identical stats and no errors', async ({ page }) => {
    const errors = trackErrors(page);
    await open(page);
    const visible = await commonRows(page);
    expect(visible.length).toBeGreaterThan(10);
    for (const index of visible.filter((_, i) => i % 5 === 0)) await expectAligned(page, index);
    const stats = await page.locator('.diff-stats').textContent();

    await page.goto('/?impl=legacy');
    await page.waitForSelector('.diff-stats');
    await expect(page.locator('.diff-stats')).toHaveText(stats ?? '');
    expect(errors).toEqual([]);
  });

  test('scroll sync keeps rows aligned in a 20k-line file', async ({ page }) => {
    await open(page, '?sample=large');
    await page.locator(`${PANES.middle} .cm-scroller`).evaluate((el) => (el.scrollTop = 120_000));
    await page.waitForTimeout(300);
    const tops = await Promise.all(
      Object.values(PANES).map((selector) =>
        page.locator(`${selector} .cm-scroller`).evaluate((el) => el.scrollTop)
      )
    );
    expect(tops[0]).toBeCloseTo(tops[1], 0);
    expect(tops[2]).toBeCloseTo(tops[1], 0);
    const visible = await commonRows(page);
    expect(visible.length).toBeGreaterThan(10);
    for (const index of visible.filter((_, i) => i % 7 === 0)) await expectAligned(page, index);

    await page.locator(`${PANES.right} .cm-scroller`).evaluate((el) => (el.scrollTop = 40_000));
    await page.waitForTimeout(300);
    const middleTop = await page.locator(`${PANES.middle} .cm-scroller`).evaluate((el) => el.scrollTop);
    expect(middleTop).toBeCloseTo(40_000, 0);
  });

  test('per-line and per-block accept update text, stats and onChange exactly once', async ({ page }) => {
    await open(page);
    const lineButton = page.locator('.twd-action[data-action="line-left"]').first();
    const index = Number(await lineButton.getAttribute('data-row'));
    const leftText = await row(page, 'left', index).textContent();
    const before = (await changes(page)).length;
    const conflictsBefore = await conflicts(page);

    await lineButton.click();
    expect((await changes(page)).length).toBe(before + 1);
    await expect(row(page, 'middle', index)).toHaveText(leftText ?? '');
    expect(await conflicts(page)).toBe(conflictsBefore - 1);
    await expect(page.locator(`.twd-action[data-action="line-left"][data-row="${index}"]`)).toHaveClass(/active/);
    await expect(page.getByTestId('has-changes')).toHaveText('Unsaved changes');

    const blockButton = page.locator('.twd-action[data-action="block-left"]').nth(1);
    const start = Number(await blockButton.getAttribute('data-row'));
    await blockButton.click();
    expect((await changes(page)).length).toBe(before + 2);
    await expect(row(page, 'middle', start)).toHaveText((await row(page, 'left', start).textContent()) ?? '');
  });

  test('accept all, undo and reset', async ({ page }) => {
    await open(page);
    const [oldContent, newContent] = [JSON_OLD, JSON_NEW];
    // Like the legacy editor, a merge action reports the result even when nothing changes.
    await page.getByRole('button', { name: 'Accept all right' }).click();
    expect(await changes(page)).toEqual([newContent]);
    await page.getByRole('button', { name: 'Accept all left' }).click();
    expect(await merged(page)).toBe(oldContent);
    expect(await conflicts(page)).toBe(0);

    await row(page, 'middle', 0).click();
    await page.keyboard.press(`${MOD}+z`);
    expect(await merged(page)).toBe(newContent);

    await page.getByRole('button', { name: 'Accept all right' }).click();
    await page.getByRole('button', { name: 'Reset' }).click();
    expect(await merged(page)).toBe(newContent);
    expect((await changes(page)).at(-1)).toBe(newContent);
    await expect(page.getByTestId('has-changes')).toHaveText('No changes');
  });

  test('typing in the merged pane is line-locked like the legacy editor', async ({ page }) => {
    await open(page);
    const target = row(page, 'middle', 1);
    const original = (await target.textContent()) ?? '';
    const lineCount = await page.locator(`${PANES.middle} .cm-line`).count();
    await target.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('XYZ');
    await expect(target).toHaveText(`${original}XYZ`);
    expect(await page.locator(`${PANES.middle} .cm-line`).count()).toBe(lineCount);
    await expect(target).toHaveClass(/from-manual/);
    await page.keyboard.insertText('p1\np2');
    await expect(target).toHaveText(`${original}XYZp1p2`);
  });

  test('collapse controls expand unchanged regions in every pane', async ({ page }) => {
    await open(page, '?sample=large');
    const middleWidgets = page.locator(`${PANES.middle} .collapsed-row-middle`);
    const count = await middleWidgets.count();
    expect(count).toBeGreaterThan(0);
    expect(await page.locator(`${PANES.left} .collapsed-row-left`).count()).toBe(count);

    const first = middleWidgets.first();
    const blockId = await first.getAttribute('data-block-id');
    const label = (await first.locator('.collapse-btn-all').textContent()) ?? '';
    const hidden = Number(label.match(/\d+/)?.[0]);
    await first.locator('.collapse-btn-down').click();
    const widget = page.locator(`${PANES.middle} .collapsed-row-middle[data-block-id="${blockId}"]`);
    await expect(widget.locator('.collapse-btn-all')).toHaveText(`Show all ${hidden - 10} lines`);
    await widget.locator('.collapse-btn-all').click();
    await expect(page.locator(`${PANES.left} [data-block-id="${blockId}"]`)).toHaveCount(0);
    for (const index of (await commonRows(page)).filter((_, i) => i % 5 === 0)) await expectAligned(page, index);
  });

  test('free edit: discard restores the parent value, save keeps every added line', async ({ page }) => {
    await open(page);
    const newContent = JSON_NEW;
    const freeEdit = page.locator('.panel-header.middle button');

    await freeEdit.click();
    const editor = page.locator('.twd-free .cm-content');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.insertText('scratch');
    expect((await changes(page)).at(-1)).toBe('scratch');
    await freeEdit.click();
    await page.getByRole('button', { name: 'Discard' }).click();
    expect((await changes(page)).at(-1)).toBe(newContent);
    expect(await merged(page)).toBe(newContent);

    const edited = newContent.replace('"version": 2,', '"version": 2,\n  "extra1": true,\n  "extra2": false,');
    await freeEdit.click();
    await editor.click();
    await page.keyboard.press(`${MOD}+a`);
    await page.keyboard.insertText(edited);
    await freeEdit.click();
    await page.getByRole('button', { name: 'Save' }).click();
    expect(await merged(page)).toBe(edited);
    expect((await changes(page)).at(-1)).toBe(edited);
    await expect(page.getByTestId('has-changes')).toHaveText('Unsaved changes');
    // The panes keep the free editor's scroll position; inspect the top of the file.
    await page.locator(`${PANES.middle} .cm-scroller`).evaluate((el) => (el.scrollTop = 0));
    const inserted = page.locator(`${PANES.middle} .twd-inserted`);
    await expect(inserted).toHaveCount(2);
    for (const index of await inserted.evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-row'))))) {
      await expect(row(page, 'left', index)).toHaveClass(/twd-placeholder/);
      await expect(row(page, 'right', index)).toHaveClass(/twd-placeholder/);
      await expectAligned(page, index);
    }

    await freeEdit.click();
    await expect.poll(() => page.locator('.twd-free .cm-content').innerText()).toContain('"extra2": false,');
  });

  test('middleContent equal to the default merge is a no-op', async ({ page }) => {
    await open(page, '?middle=default');
    expect(await merged(page)).toBe(JSON_NEW);
    // StrictMode mounts twice; every report must still be "no changes".
    const calls = await hasChangesCalls(page);
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every((value) => value === false)).toBe(true);
    await expect(page.locator(`${PANES.middle} .from-manual`)).toHaveCount(0);
  });

  test('edge inputs: empty side, blank lines, CRLF', async ({ page }) => {
    await open(page, '?sample=empty');
    await expect(page.locator(`${PANES.left} .cm-line.twd-placeholder`)).toHaveCount(2);
    expect(await page.locator(`${PANES.left} .cm-content`).innerText()).not.toContain('{}');
    expect(await merged(page)).toBe(SAMPLES.empty.newContent);

    await open(page, '?sample=blank');
    const numbers = await page
      .locator(`${PANES.left} .cm-lineNumbers .cm-gutterElement`)
      .evaluateAll((els) =>
        els
          .filter((el) => (el as HTMLElement).style.visibility !== 'hidden')
          .map((el) => el.textContent)
          .filter((t) => t && /^\d+$/.test(t))
      );
    expect(numbers).toEqual(['1', '2', '3', '4', '5']);
    expect(await merged(page)).toBe(SAMPLES.blank.newContent);

    await open(page, '?sample=crlf');
    expect(await merged(page)).toBe(SAMPLES.crlf.newContent);
    await page.getByRole('button', { name: 'Accept all left' }).click();
    expect(await merged(page)).toBe(SAMPLES.crlf.oldContent);
  });

  test('theme and locale switch', async ({ page }) => {
    await open(page, '?theme=dark');
    await expect(page.locator('.three-way-diff-container')).toHaveAttribute('data-theme', 'dark');
    const background = await page.locator(`${PANES.middle} .cm-editor`).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(background).toBe('rgb(31, 31, 31)');
    await page.locator('select').nth(3).selectOption('zh');
    await expect(page.getByRole('button', { name: '全部接受左侧' })).toBeVisible();
    await expect(page.locator('.collapsed-row-middle .collapse-btn-all').first()).toContainText('显示全部');
  });

  test('connector strips are drawn in the gaps and follow the hover', async ({ page }) => {
    await open(page);
    const changed = page.locator(`${PANES.left} .cm-line.modified-line`).first();
    const index = Number(await changed.getAttribute('data-row'));
    const box = await changed.boundingBox();
    const gap = await page.locator('.twd-gap').first().boundingBox();
    if (!box || !gap) throw new Error('missing geometry');
    const alpha = await page.evaluate(
      ({ x, y }) => {
        const canvas = document.querySelector('.connector-canvas') as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const dpr = canvas.width / rect.width;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
        return ctx.getImageData(Math.round((x - rect.left) * dpr), Math.round((y - rect.top) * dpr), 1, 1).data[3];
      },
      { x: gap.x + gap.width / 2, y: box.y + box.height / 2 }
    );
    expect(alpha).toBeGreaterThan(0);

    await changed.hover();
    await expect(row(page, 'middle', index)).toHaveClass(/twd-hover/);
    await expect(row(page, 'right', index)).toHaveClass(/twd-hover/);
  });

  test('F7 jumps to the next change', async ({ page }) => {
    await open(page);
    const firstBlock = Number(await page.locator('.twd-action[data-action="block-left"]').first().getAttribute('data-row'));
    await row(page, 'middle', 0).click();
    await page.keyboard.press('F7');
    await expect(page.locator(`${PANES.middle} .cm-activeLine`)).toHaveAttribute('data-row', String(firstBlock));
  });

  test('stays fast on a 20k-line file', async ({ page }) => {
    await open(page, '?sample=large');
    const mountMs = await page.evaluate(() => (window as unknown as { __demo: { mountMs: number } }).__demo.mountMs);
    console.log(`20k-line mount: ${mountMs.toFixed(0)} ms`);
    expect(mountMs).toBeLessThan(1500);

    await row(page, 'middle', 3).click();
    await page.keyboard.press('End');
    const start = Date.now();
    await page.keyboard.type('abcdefghijklmnopqrst');
    const perKey = (Date.now() - start) / 20;
    console.log(`20k-line keystroke: ${perKey.toFixed(1)} ms`);
    expect(perKey).toBeLessThan(50);
    await expect(row(page, 'middle', 3)).toContainText('abcdefghijklmnopqrst');
  });
});
