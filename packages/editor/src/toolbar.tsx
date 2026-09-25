import React, {
  useCallback,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {useTranslation} from 'react-i18next';
import type {Editor} from '@tiptap/core';

import {namespaces} from '@witty/i18n/i18n.constants';
// The extension's own status logos, as its input overlay shows them.
import LoadingIcon from '@witty/core/StateIndicatorIcons/LoadingIcon';
import ActiveIcon from '@witty/assets/icons/wittyStateIndicator/witty-active.svg';
import WarningIcon from '@witty/assets/icons/wittyStateIndicator/witty-warning.svg';

import type {GenderFormatSwitchResult, SwitchLanguage} from './genderSwitch';
import {type MenuItem, WittyMenu} from './menu';
import {SettingsPanel, SwitchPanel} from './panels';
import type {PreferenceOptions} from './preferenceOptions';
import type {CheckStatus, SettingsStore, StatusStore} from './settings';

/** Where the W menu's Help and About entries lead. */
export const HELP_URL =
  'https://www.witty.works/en/help/how-do-i-use-the-witty-editor';
export const ABOUT_URL = 'https://www.witty.works/';

interface Tool {
  key: string;
  label: string;
  glyph: string;
  run: () => boolean;
  /** Toggle state, announced as aria-pressed. Absent for plain actions. */
  active?: boolean;
  enabled: boolean;
}

/** Re-render on every editor transaction, for active and enabled states. */
const useEditorVersion = (editor: Editor): number => {
  const version = useRef(0);
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const handler = (): void => {
        version.current += 1;
        onChange();
      };
      editor.on('transaction', handler);
      return () => {
        editor.off('transaction', handler);
      };
    },
    [editor]
  );
  return useSyncExternalStore(subscribe, () => version.current);
};

/** Announced text for a status; empty while checking, to stay quiet while typing. */
const useStatusText = (
  status: CheckStatus
): {text: string; announce: string} => {
  const {t} = useTranslation(namespaces.editor);
  switch (status.state) {
    case 'checking':
      return {text: t('statusChecking'), announce: ''};
    case 'idle': {
      const count = status.alerts
        ? t('statusAlerts', {count: status.alerts})
        : t('statusNoAlerts');
      const text = status.limitReached
        ? `${count}. ${t('limitReached')}`
        : count;
      return {text, announce: text};
    }
    case 'unauthorized':
      return {
        text: t('statusUnauthorized'),
        announce: t('statusUnauthorized'),
      };
    case 'outdated':
      return {text: t('statusOutdated'), announce: t('statusOutdated')};
    case 'unsupportedLanguage':
      return {text: t('statusLanguage'), announce: t('statusLanguage')};
    default:
      return {text: t('statusFailed'), announce: t('statusFailed')};
  }
};

const prefersReducedMotion = (): boolean =>
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The Witty logo in the state the extension would show it in. The animated
 * one loops for as long as a check runs, so with reduced motion requested the
 * static logo stands in; the live region still says what is happening.
 */
const StatusIcon: React.FC<{status: CheckStatus}> = ({status}) => {
  if (status.state === 'checking') {
    return prefersReducedMotion() ? (
      <ActiveIcon aria-hidden='true' style={{opacity: 0.5}} />
    ) : (
      <LoadingIcon />
    );
  }
  if (status.state === 'idle') return <ActiveIcon aria-hidden='true' />;
  return <WarningIcon aria-hidden='true' />;
};

/**
 * Formatting bar above the editor, ending in the W icon that opens the Witty
 * menu. A single tab stop with arrow-key navigation between the buttons (the
 * ARIA toolbar pattern).
 */
const Toolbar: React.FC<{
  editor: Editor;
  store: SettingsStore;
  status: StatusStore;
  loadOptions: () => Promise<PreferenceOptions>;
  onSwitch: (target: string) => Promise<GenderFormatSwitchResult>;
  switchSupported: (target?: string) => boolean;
  switchLanguages: () => SwitchLanguage[];
}> = ({
  editor,
  store,
  status: statusStore,
  loadOptions,
  onSwitch,
  switchSupported,
  switchLanguages,
}) => {
  const {t} = useTranslation(namespaces.editor);
  useEditorVersion(editor);
  const {status, notice} = useSyncExternalStore(
    statusStore.subscribe,
    statusStore.get
  );
  const statusText = useStatusText(status);
  const [focusIndex, setFocusIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<'settings' | 'switch' | null>(null);
  const menuId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const panelId = useId();

  const chain = (): ReturnType<Editor['chain']> => editor.chain().focus();
  const tools: Tool[] = [
    {
      key: 'bold',
      label: t('bold'),
      glyph: 'B',
      run: () => chain().toggleBold().run(),
      active: editor.isActive('bold'),
      enabled: editor.can().toggleBold(),
    },
    {
      key: 'italic',
      label: t('italic'),
      glyph: 'I',
      run: () => chain().toggleItalic().run(),
      active: editor.isActive('italic'),
      enabled: editor.can().toggleItalic(),
    },
    {
      key: 'underline',
      label: t('underline'),
      glyph: 'U',
      run: () => chain().toggleUnderline().run(),
      active: editor.isActive('underline'),
      enabled: editor.can().toggleUnderline(),
    },
    {
      key: 'heading',
      label: t('heading'),
      glyph: 'H',
      run: () => chain().toggleHeading({level: 2}).run(),
      active: editor.isActive('heading', {level: 2}),
      enabled: editor.can().toggleHeading({level: 2}),
    },
    {
      key: 'bulletList',
      label: t('bulletList'),
      glyph: '•',
      run: () => chain().toggleBulletList().run(),
      active: editor.isActive('bulletList'),
      enabled: editor.can().toggleBulletList(),
    },
    {
      key: 'orderedList',
      label: t('orderedList'),
      glyph: '1.',
      run: () => chain().toggleOrderedList().run(),
      active: editor.isActive('orderedList'),
      enabled: editor.can().toggleOrderedList(),
    },
    {
      key: 'quote',
      label: t('quote'),
      glyph: '❝',
      run: () => chain().toggleBlockquote().run(),
      active: editor.isActive('blockquote'),
      enabled: editor.can().toggleBlockquote(),
    },
    {
      key: 'undo',
      label: t('undo'),
      glyph: '↶',
      run: () => chain().undo().run(),
      enabled: editor.can().undo(),
    },
    {
      key: 'redo',
      label: t('redo'),
      glyph: '↷',
      run: () => chain().redo().run(),
      enabled: editor.can().redo(),
    },
  ];
  const count = tools.length + 1; // plus the settings button

  const moveFocus = (index: number): void => {
    const next = (index + count) % count;
    setFocusIndex(next);
    buttons.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const keys: Record<string, number> = {
      ArrowRight: focusIndex + 1,
      ArrowLeft: focusIndex - 1,
      Home: 0,
      End: count - 1,
    };
    if (event.key in keys) {
      event.preventDefault();
      moveFocus(keys[event.key]);
    }
  };

  const focusMenuButton = (): void => {
    buttons.current[count - 1]?.focus();
  };

  const closePanel = (): void => {
    setPanel(null);
    focusMenuButton();
  };

  const openPanel = (next: 'settings' | 'switch'): void => {
    setMenuOpen(false);
    setPanel(next);
  };

  const supported = switchSupported();
  const menuItems: MenuItem[] = [
    {
      key: 'settings',
      label: t('menuSettings'),
      run: () => openPanel('settings'),
    },
    {
      key: 'switch',
      label: t('menuSwitchGender'),
      run: () => openPanel('switch'),
      disabled: !supported,
      note: supported ? undefined : t('switchUnsupported'),
    },
    {key: 'help', label: t('menuHelp'), href: HELP_URL},
    {key: 'about', label: t('menuAbout'), href: ABOUT_URL},
  ];

  return (
    <>
      <div
        className='witty-editor-toolbar'
        role='toolbar'
        aria-label={t('toolbar')}
        onKeyDown={onKeyDown}
      >
        {tools.map((tool, index) => (
          <button
            key={tool.key}
            ref={(button) => {
              buttons.current[index] = button;
            }}
            type='button'
            className={`witty-editor-tool witty-editor-tool--${tool.key}`}
            aria-label={tool.label}
            title={tool.label}
            aria-pressed={tool.active}
            aria-disabled={!tool.enabled}
            tabIndex={index === focusIndex ? 0 : -1}
            onFocus={() => setFocusIndex(index)}
            // Keep the editor's selection: a mousedown would move focus first.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => tool.enabled && tool.run()}
          >
            {tool.glyph}
          </button>
        ))}
        <button
          ref={(button) => {
            buttons.current[count - 1] = button;
          }}
          type='button'
          className={`witty-editor-tool witty-editor-tool--settings is-${status.state}`}
          aria-label={t('menu')}
          title={`${t('menu')} · ${statusText.text}`}
          aria-haspopup='menu'
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? menuId : undefined}
          tabIndex={focusIndex === count - 1 ? 0 : -1}
          onFocus={() => setFocusIndex(count - 1)}
          onClick={() => setMenuOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              event.stopPropagation();
              setMenuOpen(true);
            }
          }}
        >
          <StatusIcon status={status} />
        </button>
        {menuOpen && (
          <WittyMenu
            id={menuId}
            label={t('menu')}
            items={menuItems}
            anchor={() => buttons.current[count - 1]}
            onClose={(returnFocus) => {
              setMenuOpen(false);
              if (returnFocus) focusMenuButton();
            }}
          />
        )}
      </div>
      <span className='witty-editor-sr-only' role='status' aria-live='polite'>
        {notice ?? statusText.announce}
      </span>
      {panel === 'settings' && (
        <SettingsPanel
          id={panelId}
          store={store}
          loadOptions={loadOptions}
          onClose={closePanel}
        />
      )}
      {panel === 'switch' && (
        <SwitchPanel
          id={panelId}
          store={store}
          loadOptions={loadOptions}
          onSwitch={onSwitch}
          supported={switchSupported}
          languages={switchLanguages()}
          onClose={closePanel}
        />
      )}
    </>
  );
};

export interface ToolbarHandle {
  destroy(): void;
}

/** Render the toolbar into `container`. */
export const mountToolbar = (
  container: HTMLElement,
  props: {
    editor: Editor;
    store: SettingsStore;
    status: StatusStore;
    loadOptions: () => Promise<PreferenceOptions>;
    onSwitch: (target: string) => Promise<GenderFormatSwitchResult>;
    switchSupported: (target?: string) => boolean;
    switchLanguages: () => SwitchLanguage[];
  }
): ToolbarHandle => {
  const root: Root = createRoot(container);
  root.render(<Toolbar {...props} />);
  return {destroy: (): void => root.unmount()};
};
