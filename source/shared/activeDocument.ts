/**
 * The document the extension is currently operating on.
 *
 * Almost always the page's own document; Google Docs swaps in the hidden
 * text-event iframe's document (see ContentScriptApp). Lives in shared/ so
 * shared code does not have to import from the content-script module graph —
 * a prerequisite for extracting shared code into a platform-neutral package
 * (EDITOR_COMPONENT_PLAN.md, Phase 1 item 5).
 */
let activeDocument = document;

export const setActiveDocument = (doc: Document): void => {
  if (doc?.body) {
    activeDocument = doc;
  }
};

export const getActiveDocument = (): Document => activeDocument;
