const {
  test,
  expect,
  signIn,
  typeAndWaitForHighlights,
  openPopoverForWord,
  alternativeBoxes,
} = require('./helpers/extension');

/**
 * Coverage for rich-text editors, which the extension handles very differently
 * from a plain textarea:
 *
 * - CKEditor 5 has a dedicated detection (`isCkEditor`, keyed on .ck-content)
 *   and its own replacement path — a synthetic Delete keydown followed by a
 *   synthetic paste event — because a naive execCommand would bypass the
 *   editor's model and get reverted.
 * - Quill and inline TinyMCE are handled as generic contenteditables, but
 *   both reconcile DOM changes back into an internal document model, so they
 *   cover the class of editors where a replacement only "sticks" if the
 *   editor accepts it.
 *
 * TinyMCE runs in inline mode deliberately: its classic mode edits inside an
 * about:blank iframe that the manifest's content scripts never inject into
 * (no match_about_blank), so the extension cannot function there.
 *
 * The editors are devDependencies served locally under /vendor/ by the
 * fixture server — the test contexts block all non-localhost requests.
 */

const EDITORS = [
  {
    name: 'CKEditor 5',
    path: '/ckeditor.html',
    // The CKEditor replacement path ends in a synthetic paste; give the
    // editor's clipboard pipeline a beat before reading the text back.
    applySettleMs: 500,
  },
  {
    name: 'Quill',
    path: '/quill.html',
    applySettleMs: 200,
  },
  {
    name: 'TinyMCE inline',
    path: '/tinymce.html',
    applySettleMs: 200,
  },
];

const waitForEditor = (page) =>
  page.waitForFunction(() => window.__editorReady === true, null, {
    timeout: 15000,
  });

const editorText = (page) =>
  page.evaluate(() => document.querySelector('#editor')?.textContent || '');

for (const editor of EDITORS) {
  test.describe(editor.name, () => {
    test('highlights the sample text', async ({
      page,
      context,
      extensionId,
    }) => {
      await signIn(context, extensionId);
      await page.goto(editor.path);
      await waitForEditor(page);

      // typeAndWaitForHighlights asserts painted highlight pixels, which is
      // the actual signal that the extension recognized this editor's DOM.
      await typeAndWaitForHighlights(page);
    });

    test('opens the popover with alternatives on a flagged word', async ({
      page,
      context,
      extensionId,
    }) => {
      await signIn(context, extensionId);
      await page.goto(editor.path);
      await waitForEditor(page);
      await typeAndWaitForHighlights(page);

      await openPopoverForWord(page, 'chairman');

      const boxes = await alternativeBoxes(page);
      const texts = boxes.map((b) => b.text);
      expect(texts).toContain('chairperson');
    });

    test('applying an alternative updates the editor content', async ({
      page,
      context,
      extensionId,
    }) => {
      await signIn(context, extensionId);
      await page.goto(editor.path);
      await waitForEditor(page);
      await typeAndWaitForHighlights(page);
      await openPopoverForWord(page, 'chairman');

      const boxes = await alternativeBoxes(page);
      const target = boxes.find((b) => b.text === 'chairperson');
      expect(target, 'no "chairperson" alternative offered').toBeTruthy();

      // The buttons react to pointerdown (not click), so drive the mouse.
      await page.mouse.move(
        target.x + target.width / 2,
        target.y + target.height / 2
      );
      await page.mouse.down();
      await page.mouse.up();

      // The replacement must survive the editor's own model reconciliation —
      // model-based editors revert DOM edits they did not accept.
      await page.waitForFunction(
        (settle) =>
          new Promise((resolve) => {
            setTimeout(() => {
              const text =
                document.querySelector('#editor')?.textContent || '';
              resolve(text.includes('chairperson') && !text.includes('chairman'));
            }, settle);
          }),
        editor.applySettleMs,
        { timeout: 15000 }
      );

      const text = await editorText(page);
      expect(text).toContain('chairperson');
      expect(text).not.toContain('chairman');
    });
  });
}
