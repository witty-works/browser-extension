# Workspace packages

Planned layout (see ../EDITOR_COMPONENT_PLAN.md, decision 4):

- `core/` — platform-neutral checking domain: API client services, alert model, offset mapping, staleness protocol, i18n resources. No React, no DOM, no browser-extension APIs, no storage — everything injected.
- `ui/` — popover view model + React view + stylesheet.
- `editor/` — the `<witty-editor>` custom element.

`editor/` exists as the TipTap proof of concept (`npm run dev|test -w @witty-works/editor`). `core/` and `ui/` arrive with the Phase 2 extraction; until then the editor will import from `source/shared`.
