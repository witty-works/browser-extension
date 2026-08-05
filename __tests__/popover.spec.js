const {
  test,
  expect,
  signIn,
  typeAndWaitForHighlights,
} = require('./helpers/extension');

/**
 * Regression cover for: "the alternatives move on hover, making it impossible
 * to click them."
 *
 * Two independent causes, both now fixed in HighlightPopover.tsx:
 *
 *  1. The explanation block above the list toggled its variants with
 *     `display: none`, so the grid row collapsed to whichever variant was
 *     showing. Hovering swapped variants, the block changed height, and the
 *     alternatives below were pushed up or down.
 *  2. `renderAlternative` expanded a truncated alternative to its full text
 *     while hovered, growing the button and potentially rewrapping its row.
 *
 * Either way the button moved out from under the pointer, which fired
 * mouseleave, which reverted the layout, which moved it back — an oscillation
 * that made clicking a matter of luck.
 *
 * The assertion is geometric rather than visual: hovering must not move the
 * thing being hovered, nor any of its siblings.
 */

/** Bounding boxes of every alternative button, shadow-DOM aware. */
const alternativeBoxes = (page) =>
  page.evaluate(() => {
    const found = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (
          el.classList.contains(
            'witty-works-ext-wittyworks-popover-alternative-btn'
          )
        ) {
          const r = el.getBoundingClientRect();
          found.push({
            text: el.textContent,
            x: Math.round(r.x),
            y: Math.round(r.y),
            width: Math.round(r.width),
            height: Math.round(r.height),
          });
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return found;
  });

/**
 * Click the highlighted `word` to open its popover.
 *
 * The coordinate is measured rather than guessed: the fixture font is
 * proportional, so the x offset of a word is the rendered width of the text
 * before it. Guessing put the click on the wrong alert, which silently opened a
 * popover whose alternatives were all short — and therefore never exercised the
 * truncation path this test exists to cover.
 */
const openPopoverForWord = async (page, word) => {
  const target = await page.evaluate((needle) => {
    const el = document.querySelector('#editor');
    const text = el instanceof HTMLTextAreaElement ? el.value : el.textContent;
    const index = text.indexOf(needle);
    if (index === -1) throw new Error(`fixture text has no "${needle}"`);

    const style = getComputedStyle(el);
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.font = style.font || `${style.fontSize} ${style.fontFamily}`;

    const before = ctx.measureText(text.slice(0, index)).width;
    const half = ctx.measureText(needle).width / 2;
    const r = el.getBoundingClientRect();

    return {
      x:
        r.x +
        parseFloat(style.paddingLeft) +
        parseFloat(style.borderLeftWidth) +
        before +
        half,
      // Vertical middle of the first line.
      y:
        r.y +
        parseFloat(style.paddingTop) +
        parseFloat(style.borderTopWidth) +
        parseFloat(style.lineHeight) / 2,
    };
  }, word);

  await page.mouse.click(target.x, target.y);
  await page.waitForFunction(
    () => {
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (
            el.classList.contains(
              'witty-works-ext-wittyworks-popover-alternative-btn'
            )
          ) {
            return true;
          }
          if (el.shadowRoot && walk(el.shadowRoot)) return true;
        }
        return false;
      };
      return walk(document);
    },
    null,
    { timeout: 15000 }
  );
};

test.describe('Popover alternatives', () => {
  test('hovering an alternative does not move any alternative', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);
    await openPopoverForWord(page, 'chairman');

    const before = await alternativeBoxes(page);
    expect(before.length).toBeGreaterThan(0);
    // Without a truncated alternative this test cannot detect the
    // expand-on-hover regression at all, so assert the fixture provides one.
    expect(
      before.some((b) => b.text.endsWith('...')),
      'expected a truncated alternative in the popover'
    ).toBe(true);

    for (let i = 0; i < before.length; i += 1) {
      const box = before[i];
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      // Long enough for a reflow-and-revert oscillation to show up.
      await page.waitForTimeout(400);

      const during = await alternativeBoxes(page);
      expect(
        during,
        `hovering alternative ${i} ("${box.text}") moved or resized an alternative`
      ).toEqual(before);
    }

    // And everything is back where it started once the pointer leaves.
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    expect(await alternativeBoxes(page)).toEqual(before);
  });

  test('an alternative stays clickable while hovered', async ({
    page,
    context,
    extensionId,
  }) => {
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);
    await openPopoverForWord(page, 'chairman');

    const boxes = await alternativeBoxes(page);
    // Prefer a truncated alternative: that is the one that used to grow on
    // hover and slide out from under the pointer.
    const target = boxes.find((b) => b.text.endsWith('...')) || boxes[0];
    const cx = target.x + target.width / 2;
    const cy = target.y + target.height / 2;

    await page.mouse.move(cx, cy);
    await page.waitForTimeout(400);

    // The element under the pointer after hovering must still be the button —
    // if the layout shifted, the pointer would now be over something else.
    const stillOnButton = await page.evaluate(
      ({ x, y }) => {
        const hit = (root) => {
          const el = root.elementFromPoint(x, y);
          if (!el) return null;
          if (el.shadowRoot) return hit(el.shadowRoot) || el;
          return el;
        };
        const el = hit(document);
        return !!el?.closest?.(
          '.witty-works-ext-wittyworks-popover-alternative-btn'
        );
      },
      { x: cx, y: cy }
    );

    expect(stillOnButton).toBe(true);
  });
});
