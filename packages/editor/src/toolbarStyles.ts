/** The toolbar's, menu's and panels' styles, injected by mount. */
export const TOOLBAR_STYLES = `
.witty-editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 4px 0;
  border-bottom: 1px solid #e6e6e6;
}
.witty-editor-tool {
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.4rem;
  border: 1px solid transparent;
  border-radius: 4px;
  background: none;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.witty-editor-tool--italic { font-style: italic; }
.witty-editor-tool--underline { text-decoration: underline; }
.witty-editor-toolbar { position: relative; }
.witty-editor-menu {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 10;
  min-width: 14rem;
  margin: 0;
  padding: 0.25rem 0;
  list-style: none;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
.witty-editor-menu-item {
  display: block;
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 0;
  background: none;
  font: inherit;
  color: #1a1a1a;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.witty-editor-menu-item:hover { background: #f2f2f2; }
.witty-editor-menu-item:focus-visible { background: #f2f2f2; outline: 2px solid #55b8e9; outline-offset: -2px; }
.witty-editor-menu-item[aria-disabled='true'] { color: #595959; cursor: default; }
.witty-editor-menu-note { display: block; font-size: 0.85em; }
.witty-editor-switch h2 { font-size: 17px; margin: 0 0 0.4em; }
.witty-editor-switch-formats { list-style: none; margin: 0.5rem 0; padding: 0; display: grid; gap: 0.25rem; }
.witty-editor-switch-format {
  font: inherit;
  padding: 0.35rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  text-align: left;
}
.witty-editor-switch-format[aria-current='true'] { border-color: #9fb8ea; background: #e8eefb; }
.witty-editor-switch-format[aria-disabled='true'] { color: #595959; cursor: default; }
.witty-editor-switch-format:focus-visible { outline: 2px solid #55b8e9; outline-offset: 1px; }
.witty-editor-switch-result { min-height: 1.5em; font-weight: 600; }
.witty-editor-tool--settings {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.witty-editor-tool--settings svg { display: block; }
.witty-editor-tool:hover { background: #f2f2f2; }
.witty-editor-tool[aria-pressed='true'] { background: #e8eefb; border-color: #9fb8ea; }
.witty-editor-tool[aria-disabled='true'] { opacity: 0.4; cursor: default; }
.witty-editor-tool:focus-visible { outline: 2px solid #55b8e9; outline-offset: 1px; }
.witty-editor-settings {
  position: relative;
  padding: 0.75rem 2.5rem 0.75rem 0.25rem;
  border-bottom: 1px solid #e6e6e6;
  max-height: 60vh;
  overflow: auto;
}
.witty-editor-settings-close {
  position: absolute;
  top: 0.5rem;
  right: 0.25rem;
  width: 2rem;
  height: 2rem;
  border: 0;
  background: none;
  font-size: 1.25rem;
  cursor: pointer;
}
`;
