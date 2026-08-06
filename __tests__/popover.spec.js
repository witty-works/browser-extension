const {
  test,
  expect,
  signIn,
  typeAndWaitForHighlights,
  alternativeBoxes,
  openPopoverForWord,
  popoverBox,
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

  test('anchors the popover to the word that opened it', async ({
    page,
    context,
    extensionId,
  }) => {
    /**
     * Positioning is floating-ui's whole job, and the custom elementCords
     * middleware that computes the coordinates is typed `any`, so nothing
     * type-checks it. The other tests here only compare the popover against
     * itself — they would pass just as happily with it stranded at 0,0 or
     * pushed off-screen.
     *
     * The tolerance is deliberately loose. This is a smoke test for "attached
     * to the right place", not a pixel assertion that would break whenever the
     * popover's padding changes.
     */
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);
    const clicked = await openPopoverForWord(page, 'chairman');

    const box = await popoverBox(page);
    expect(box, 'popover element was not found').not.toBeNull();

    // On screen and actually laid out.
    expect(box.width).toBeGreaterThan(50);
    expect(box.height).toBeGreaterThan(20);

    const viewport = page.viewportSize();
    expect(box.x).toBeGreaterThan(-box.width);
    expect(box.y).toBeGreaterThan(-box.height);
    expect(box.x).toBeLessThan(viewport.width);
    expect(box.y).toBeLessThan(viewport.height);

    // And anchored near the word rather than parked in a corner.
    expect(
      Math.abs(box.x - clicked.x),
      `popover x ${box.x} is not near the clicked word at ${Math.round(clicked.x)}`
    ).toBeLessThan(400);
    expect(
      Math.abs(box.y - clicked.y),
      `popover y ${box.y} is not near the clicked word at ${Math.round(clicked.y)}`
    ).toBeLessThan(400);
  });

  test('renders the explanation markup as elements, not escaped text', async ({
    page,
    context,
    extensionId,
  }) => {
    // The popover feeds the API's long_text through html-react-parser. If that
    // ever returns a string instead of nodes, the explanation still "renders" —
    // it just shows the raw tags — which no geometry or screenshot assertion
    // here would notice.
    await signIn(context, extensionId);
    await page.goto('/textarea.html');
    await typeAndWaitForHighlights(page);
    await openPopoverForWord(page, 'chairman');

    const parsed = await page.evaluate(() => {
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.classList.contains('fixture-emphasis')) {
            return { tag: el.tagName, text: el.textContent };
          }
          if (el.shadowRoot) {
            const hit = walk(el.shadowRoot);
            if (hit) return hit;
          }
        }
        return null;
      };
      return walk(document);
    });

    expect(
      parsed,
      'explanation markup was not parsed into DOM nodes'
    ).not.toBeNull();
    expect(parsed.tag).toBe('STRONG');
    expect(parsed.text).toBe('explanation');
  });
});
