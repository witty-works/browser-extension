import React, {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import {useTranslation} from 'react-i18next';

import CheckPreferences from '@witty/core/components/CheckPreferences/CheckPreferences';
import {namespaces} from '@witty/i18n/i18n.constants';

import {
  FORMAT_FIELD,
  type GenderFormatSwitchResult,
  INKLUSIVUM,
  SWITCHABLE_FORMATS,
  type SwitchLanguage,
} from './genderSwitch';
import {formatLabel, type PreferenceOptions} from './preferenceOptions';
import {
  type EditorSettings,
  languageFormatOf,
  type SettingsStore,
  withCategoryLevel,
  withFormatField,
} from './settings';
import {switchMessage} from './switchController';

const useSettings = (store: SettingsStore): EditorSettings =>
  useSyncExternalStore(store.subscribe, store.get);

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

/**
 * A panel below the toolbar: a labelled region with a close button, closed by
 * Escape from anywhere inside it. Focus moves into it when it opens (the menu
 * item that opened it is gone), so keyboard and screen reader users land in
 * it; closing returns focus to the W icon (the toolbar does that).
 */
const Panel: React.FC<{
  id: string;
  label: string;
  className?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({id, label, className, onClose, children}) => {
  const {t} = useTranslation(namespaces.editor);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    // Escape closes the panel from anywhere inside it; the controls in it are
    // the interactive elements, the region itself only takes focus on open.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      ref={ref}
      id={id}
      className={`witty-editor-settings witty-preferences${className ? ` ${className}` : ''}`}
      role='region'
      aria-label={label}
      tabIndex={-1}
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
      {children}
    </div>
  );
};

export const SettingsPanel: React.FC<{
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
    <Panel id={id} label={t('settings')} onClose={onClose}>
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
    </Panel>
  );
};

/** Choice of the format to switch the text to, and the switch's result. */
export const SwitchPanel: React.FC<{
  id: string;
  store: SettingsStore;
  loadOptions: () => Promise<PreferenceOptions>;
  onSwitch: (target: string) => Promise<GenderFormatSwitchResult>;
  /** Whether the API can switch to `target`, as far as the editor knows. */
  supported: (target: string) => boolean;
  /** The languages whose formats to offer, the main one first. */
  languages: SwitchLanguage[];
  onClose: () => void;
}> = ({id, store, loadOptions, onSwitch, supported, languages, onClose}) => {
  const {t} = useTranslation(namespaces.editor);
  const settings = useSettings(store);
  const options = usePreferenceOptions(loadOptions);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  // The panel may close before a switch finishes; the editor's live region
  // still announces the result.
  const mounted = useRef(true);
  useEffect(
    () => (): void => {
      mounted.current = false;
    },
    []
  );
  // Group headings only when both languages are offered.
  const grouped = languages.length > 1;

  const choose = (target: string): void => {
    setBusy(true);
    setMessage(t('switching'));
    onSwitch(target)
      .then((result) => {
        if (mounted.current) setMessage(switchMessage(t, result, options));
      })
      .catch(() => {
        if (mounted.current) setMessage(t('statusFailed'));
      })
      .finally(() => {
        if (mounted.current) setBusy(false);
      });
  };

  const formatButton = (
    language: SwitchLanguage,
    format: string
  ): React.ReactElement => {
    const current = settings.config[FORMAT_FIELD[language]] === format;
    const available = supported(format);
    // What the Inklusivum leaves as written, or why a format is not offered.
    let note: string | null = null;
    if (!available) note = t('switchUnsupportedNote');
    else if (format === INKLUSIVUM) note = t('switchInklusivumNote');
    const noteId = `${id}-${language}-${SWITCHABLE_FORMATS[language].indexOf(format as never)}`;
    return (
      <li key={format}>
        <button
          type='button'
          className='witty-editor-switch-format'
          aria-disabled={busy || !available || undefined}
          aria-current={current || undefined}
          aria-describedby={note ? noteId : undefined}
          onClick={() => !busy && available && choose(format)}
        >
          {formatLabel(options, format)}
          {current && ` (${t('switchCurrent')})`}
        </button>
        {note && (
          <span id={noteId} className='witty-options-muted'>
            {' '}
            {note}
          </span>
        )}
      </li>
    );
  };

  return (
    <Panel
      id={id}
      label={t('switchTitle')}
      className='witty-editor-switch'
      onClose={onClose}
    >
      <h2>{t('switchTitle')}</h2>
      <p className='witty-options-muted'>{t('switchIntro')}</p>
      {languages.map((language) => (
        <section
          key={language}
          aria-labelledby={grouped ? `${id}-${language}` : undefined}
        >
          {grouped && (
            <h3 id={`${id}-${language}`}>
              {t(language === 'de' ? 'switchGerman' : 'switchFrench')}
            </h3>
          )}
          <ul className='witty-editor-switch-formats'>
            {SWITCHABLE_FORMATS[language].map((format) =>
              formatButton(language, format)
            )}
          </ul>
        </section>
      ))}
      {/* Shown here, announced once: by the editor's live region. */}
      <p className='witty-editor-switch-result'>{message}</p>
    </Panel>
  );
};
