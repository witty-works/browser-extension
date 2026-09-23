import React, {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {useTranslation} from 'react-i18next';
import type {Editor} from '@tiptap/core';

import CheckPreferences from '@witty/core/components/CheckPreferences/CheckPreferences';
import {
  categoriesPath,
  CONFIG_OPTIONS_PATH,
  JSON_HEADERS,
} from '@witty/core/ApiServices/requests';
import type {
  ICategoriesResponse,
  ICategory,
  ICategoryGroup,
  IConfigOption,
  IConfigOptionsResponse,
} from '@witty/core/types';
import {namespaces} from '@witty/i18n/i18n.constants';
// The extension's own status logos, as its input overlay shows them.
import LoadingIcon from '@witty/core/StateIndicatorIcons/LoadingIcon';
import ActiveIcon from '@witty/assets/icons/wittyStateIndicator/witty-active.svg';
import WarningIcon from '@witty/assets/icons/wittyStateIndicator/witty-warning.svg';

import {
  type GenderFormatSwitchResult,
  INKLUSIVUM,
  SWITCHABLE_FORMATS,
} from './genderSwitch';
import {
  type CheckStatus,
  type EditorSettings,
  languageFormatOf,
  type SettingsStore,
  type StatusStore,
  withCategoryLevel,
  withFormatField,
} from './settings';

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

const useSettings = (store: SettingsStore): EditorSettings =>
  useSyncExternalStore(store.subscribe, store.get);

export interface ApiOptions {
  endpoint: string;
  headers: () => Record<string, string>;
}

export interface PreferenceOptions {
  categories: ICategory[];
  categoryGroups: ICategoryGroup[];
  configOptions: Record<string, IConfigOption>;
  categoriesError: boolean;
}

/**
 * Category list and gender-format options, as the options page loads them.
 * Both endpoints are public, so this works before a key is entered.
 */
const loadPreferenceOptions = async (
  api: ApiOptions
): Promise<PreferenceOptions> => {
  const get = async (path: string): Promise<unknown> => {
    const response = await fetch(`${api.endpoint}${path}`, {
      headers: {...JSON_HEADERS, ...api.headers()},
    });
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  };

  const locale = navigator.language || 'en-US';
  const [categories, options] = await Promise.allSettled([
    get(categoriesPath(locale)),
    // Labels in the UI's language; APIs up to 2.4.8 refuse `locale`.
    get(
      `${CONFIG_OPTIONS_PATH}?locale=${encodeURIComponent(locale.split('-')[0])}`
    ).catch(() => get(CONFIG_OPTIONS_PATH)),
  ]);
  const list =
    categories.status === 'fulfilled'
      ? (categories.value as ICategoriesResponse)
      : undefined;

  return {
    categories: list?.categories || [],
    categoryGroups: list?.groups || [],
    categoriesError: !list,
    configOptions:
      options.status === 'fulfilled'
        ? (options.value as IConfigOptionsResponse).options || {}
        : {},
  };
};

/**
 * Loads the options once per editor, on first use; a failed load is tried
 * again the next time.
 */
export const createOptionsLoader = (
  api: ApiOptions
): (() => Promise<PreferenceOptions>) => {
  let cached: Promise<PreferenceOptions> | undefined;
  return (): Promise<PreferenceOptions> => {
    cached ??= loadPreferenceOptions(api).then((options) => {
      if (options.categoriesError) cached = undefined;
      return options;
    });
    return cached;
  };
};

/** Human label of a gender format, as the settings panel shows it. */
export const formatLabel = (
  options: PreferenceOptions | null,
  value: string
): string =>
  options?.configOptions.german_gender_ending?.labels?.[value] || value;

const usePreferenceOptions = (
  load: () => Promise<PreferenceOptions>
): PreferenceOptions | null => {
  const [options, setOptions] = useState<PreferenceOptions | null>(null);
  useEffect(() => {
    let current = true;
    load().then((loaded) => {
      if (current) setOptions(loaded);
    });
    return (): void => {
      current = false;
    };
  }, [load]);
  return options;
};

const SettingsPanel: React.FC<{
  id: string;
  store: SettingsStore;
  loadOptions: () => Promise<PreferenceOptions>;
  onClose: () => void;
}> = ({id, store, loadOptions, onClose}) => {
  const {t} = useTranslation(namespaces.editor);
  const settings = useSettings(store);
  const options = usePreferenceOptions(loadOptions);
  const {config} = settings;

  return (
    // Escape closes the panel from anywhere inside it; the controls in it are
    // the interactive elements.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      id={id}
      className='witty-editor-settings witty-preferences'
      role='region'
      aria-label={t('settings')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <button
        type='button'
        className='witty-editor-settings-close'
        aria-label={t('closeSettings')}
        title={t('closeSettings')}
        onClick={onClose}
      >
        ×
      </button>
      {!options && <p aria-live='polite'>{t('settingsLoading')}</p>}
      <CheckPreferences
        idPrefix={`${id}-`}
        orthography={settings.orthography}
        onOrthographyChange={(orthography) => store.set({orthography})}
        llmAlternatives={settings.llmAlternatives}
        onLlmAlternativesChange={(llmAlternatives) =>
          store.set({llmAlternatives})
        }
        configOptions={options?.configOptions ?? {}}
        languageFormat={languageFormatOf(config)}
        onFormatFieldChange={(field, value) =>
          store.set({config: withFormatField(config, field, value)})
        }
        categories={options?.categories ?? []}
        categoryGroups={options?.categoryGroups ?? []}
        disabledCategories={config.disabled_categories ?? []}
        onCategoryLevelChange={(category, level) =>
          store.set({config: withCategoryLevel(config, category, level)})
        }
        categoriesError={options?.categoriesError}
      />
    </div>
  );
};

interface MenuItem {
  key: string;
  label: string;
  /** A link opens in a new tab; otherwise `run`. */
  href?: string;
  run?: () => void;
  disabled?: boolean;
  note?: string;
}

/**
 * The W icon's menu (the ARIA menu button pattern): arrow keys, Home and End
 * move, Enter or Space activates, Escape closes and returns focus to the icon,
 * Tab closes.
 */
const WittyMenu: React.FC<{
  id: string;
  label: string;
  items: MenuItem[];
  /** The button that opens the menu: moving focus there is not leaving it. */
  anchor: () => HTMLElement | null;
  onClose: (returnFocus: boolean) => void;
}> = ({id, label, items, anchor, onClose}) => {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [current, setActive] = useState(0);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const move = (index: number): void => {
    const next = (index + items.length) % items.length;
    setActive(next);
    refs.current[next]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    // The menu sits inside the toolbar, whose keys are not the menu's.
    event.stopPropagation();
    const focused = refs.current.indexOf(document.activeElement as HTMLElement);
    const active = focused < 0 ? current : focused;
    const keys: Record<string, number> = {
      ArrowDown: active + 1,
      ArrowUp: active - 1,
      Home: 0,
      End: items.length - 1,
    };
    if (event.key in keys) {
      event.preventDefault();
      move(keys[event.key]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose(true);
    } else if (event.key === 'Tab') {
      onClose(false);
    }
  };

  return (
    <div
      id={id}
      className='witty-editor-menu'
      role='menu'
      // Focus goes to the items; this only keeps a click on the gaps inside.
      tabIndex={-1}
      aria-label={label}
      onKeyDown={onKeyDown}
      // Clicking or tabbing elsewhere closes it.
      onBlur={(event) => {
        const next = event.relatedTarget as Node | null;
        if (next && (event.currentTarget.contains(next) || next === anchor())) {
          return;
        }
        onClose(false);
      }}
    >
      {items.map((item, index) => {
        const common = {
          ref: (element: HTMLElement | null): void => {
            refs.current[index] = element;
          },
          role: 'menuitem',
          tabIndex: index === current ? 0 : -1,
          className: 'witty-editor-menu-item',
          onFocus: (): void => setActive(index),
          // Safari does not focus a clicked button, which would blur the menu
          // and close it before the click.
          onMouseDown: (event: React.MouseEvent): void =>
            event.preventDefault(),
        };
        return (
          <div key={item.key} role='none'>
            {item.href ? (
              <a
                {...common}
                href={item.href}
                target='_blank'
                rel='noopener noreferrer'
                onClick={() => onClose(false)}
              >
                {item.label}
              </a>
            ) : (
              <button
                {...common}
                type='button'
                aria-disabled={item.disabled || undefined}
                onClick={() => !item.disabled && item.run?.()}
              >
                {item.label}
                {item.note && (
                  <span className='witty-editor-menu-note'>{item.note}</span>
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/** What a switch did, in words; shared by the panel and the live region. */
export const switchMessage = (
  t: Translate,
  result: GenderFormatSwitchResult,
  options: PreferenceOptions | null
): string => {
  const format = formatLabel(options, result.target);
  const text = {
    switched: t('switched', {count: result.count, format}),
    nothing: t('switchNothing', {format}),
    disabled: t('switchDisabled'),
    unsupported: t('switchUnsupported'),
    unavailable: t('switchInklusivum'),
    forced: t('switchForced', {
      format: formatLabel(options, result.applied ?? ''),
    }),
  }[result.outcome];
  // What was checked is switched; the rest may still hold other forms.
  return result.limitReached &&
    (result.outcome === 'switched' || result.outcome === 'nothing')
    ? `${text} ${t('limitReached')}`
    : text;
};

/** Choice of the format to switch the text to, and the switch's result. */
const SwitchPanel: React.FC<{
  id: string;
  store: SettingsStore;
  loadOptions: () => Promise<PreferenceOptions>;
  onSwitch: (target: string) => Promise<GenderFormatSwitchResult>;
  onClose: () => void;
}> = ({id, store, loadOptions, onSwitch, onClose}) => {
  const {t} = useTranslation(namespaces.editor);
  const settings = useSettings(store);
  const options = usePreferenceOptions(loadOptions);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const current = settings.config.german_gender_ending;

  const choose = (target: string): void => {
    setBusy(true);
    setMessage(t('switching'));
    onSwitch(target)
      .then((result) => setMessage(switchMessage(t, result, options)))
      .catch(() => setMessage(t('statusFailed')))
      .finally(() => setBusy(false));
  };

  return (
    // Escape closes the panel from anywhere inside it; the controls in it are
    // the interactive elements.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      id={id}
      className='witty-editor-settings witty-editor-switch witty-preferences'
      role='region'
      aria-label={t('switchTitle')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <button
        type='button'
        className='witty-editor-settings-close'
        aria-label={t('closeSettings')}
        title={t('closeSettings')}
        onClick={onClose}
      >
        ×
      </button>
      <h2>{t('switchTitle')}</h2>
      <p className='witty-options-muted'>{t('switchIntro')}</p>
      <ul className='witty-editor-switch-formats'>
        {SWITCHABLE_FORMATS.map((format) => (
          <li key={format}>
            <button
              type='button'
              className='witty-editor-switch-format'
              aria-disabled={busy || undefined}
              aria-current={format === current || undefined}
              onClick={() => !busy && choose(format)}
            >
              {formatLabel(options, format)}
              {format === current && ` (${t('switchCurrent')})`}
            </button>
          </li>
        ))}
        <li>
          <button
            type='button'
            className='witty-editor-switch-format'
            aria-disabled='true'
            aria-describedby={`${id}-inklusivum`}
          >
            {formatLabel(options, INKLUSIVUM)}
          </button>
          <span id={`${id}-inklusivum`} className='witty-options-muted'>
            {' '}
            {t('switchInklusivum')}
          </span>
        </li>
      </ul>
      <p
        className='witty-editor-switch-result'
        role='status'
        aria-live='polite'
      >
        {message}
      </p>
    </div>
  );
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
  switchSupported: () => boolean;
}> = ({
  editor,
  store,
  status: statusStore,
  loadOptions,
  onSwitch,
  switchSupported,
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
          onClose={closePanel}
        />
      )}
    </>
  );
};

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
    switchSupported: () => boolean;
  }
): ToolbarHandle => {
  const root: Root = createRoot(container);
  root.render(<Toolbar {...props} />);
  return {destroy: (): void => root.unmount()};
};
