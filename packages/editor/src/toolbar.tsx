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
  type CheckStatus,
  type EditorSettings,
  languageFormatOf,
  type SettingsStore,
  type StatusStore,
  withCategoryLevel,
  withFormatField,
} from './settings';

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

interface ApiOptions {
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

  const [categories, options] = await Promise.allSettled([
    get(categoriesPath(navigator.language || 'en-US')),
    get(CONFIG_OPTIONS_PATH),
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

/**
 * Formatting bar above the editor, ending in the Witty settings button. A
 * single tab stop with arrow-key navigation between the buttons (the ARIA
 * toolbar pattern).
 */
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
      return {text: t('statusUnauthorized'), announce: t('statusUnauthorized')};
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

const Toolbar: React.FC<{
  editor: Editor;
  store: SettingsStore;
  status: StatusStore;
  loadOptions: () => Promise<PreferenceOptions>;
}> = ({editor, store, status: statusStore, loadOptions}) => {
  const {t} = useTranslation(namespaces.editor);
  useEditorVersion(editor);
  const {status} = useSyncExternalStore(statusStore.subscribe, statusStore.get);
  const statusText = useStatusText(status);
  const [focusIndex, setFocusIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

  const closeSettings = (): void => {
    setSettingsOpen(false);
    buttons.current[count - 1]?.focus();
  };

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
          aria-label={t('settings')}
          title={`${t('settings')} · ${statusText.text}`}
          aria-expanded={settingsOpen}
          aria-controls={panelId}
          tabIndex={focusIndex === count - 1 ? 0 : -1}
          onFocus={() => setFocusIndex(count - 1)}
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <StatusIcon status={status} />
        </button>
      </div>
      <span className='witty-editor-sr-only' role='status' aria-live='polite'>
        {statusText.announce}
      </span>
      {settingsOpen && (
        <SettingsPanel
          id={panelId}
          store={store}
          loadOptions={loadOptions}
          onClose={closeSettings}
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
    api: ApiOptions;
    status: StatusStore;
  }
): ToolbarHandle => {
  // Loaded once per editor, when the panel first opens; a failed load is
  // tried again the next time.
  let cached: Promise<PreferenceOptions> | undefined;
  const loadOptions = (): Promise<PreferenceOptions> => {
    cached ??= loadPreferenceOptions(props.api).then((options) => {
      if (options.categoriesError) cached = undefined;
      return options;
    });
    return cached;
  };

  const root: Root = createRoot(container);
  root.render(
    <Toolbar
      editor={props.editor}
      store={props.store}
      status={props.status}
      loadOptions={loadOptions}
    />
  );
  return {destroy: (): void => root.unmount()};
};
