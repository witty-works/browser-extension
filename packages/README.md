# Workspace packages

Planned layout (see ../EDITOR_COMPONENT_PLAN.md, decision 4):

- `core/` — platform-neutral checking domain: API client services, alert model, offset mapping, staleness protocol, i18n resources. No React, no DOM, no browser-extension APIs, no storage — everything injected.
- `ui/` — popover view model + React view + stylesheet.
- `editor/` — the `<witty-editor>` custom element.

Empty until the Phase 2 extraction; the extension decouples in place first (Phase 1) so these become file moves.
