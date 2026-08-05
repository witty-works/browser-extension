import React, {useEffect, useState} from 'react';
import browser from 'webextension-polyfill';
import {useTranslation} from 'react-i18next';

import '../i18n/i18n';
import {namespaces} from '../i18n/i18n.constants';
import CategoryToggle from './CategoryToggle';
import {
  applyLevelToDisabled,
  AuthMode,
  CONFIG_OPTION_FIELDS,
  BaseUrl,
  BaseUrls,
  CUSTOM_BASE_URL_KEY,
  DefaultBaseUrlKey,
  HelpLinks,
  isAcceptableEndpointUrl,
  levelFromDisabled,
  LOCKED_PROFICIENCY,
  ProficiencyLevel,
  registerCustomEndpoint,
  registerCustomEndpointFromStorage,
  StorageKeys,
} from '../shared/constants';
import {logOut, storeInLocalStorage} from '../shared/utils';
import {
  getCategories,
  getConfigOptions,
  setApiKey,
  setBaseUrls,
} from '../shared/ApiServices/requests';
import {
  ICategoriesResponse,
  ICategory,
  ICategoryGroup,
  IConfigOption,
  IConfigOptionsResponse,
} from '../shared/types';
import {sendErrorToSentry} from '../shared/errorUtils';
import './Options.scss';

/**
 * Options page: connection, customisation and category settings.
 *
 * This page used to double as the OAuth landing page — the dashboard redirected
 * here with `access_token` in the query string and the component wrote it
 * straight into storage. `options.html` was web-accessible at the time, so any
 * website could navigate to it and inject its own tokens. Sign-in now runs
 * through `identity.launchWebAuthFlow` in the background worker, where the
 * browser hands the redirect only to the extension.
 *
 * Invariants (AUTH_SECURITY_PLAN.md §4):
 *
 *  1. Credentials and endpoints change only through deliberate action *here*.
 *  2. Changing either clears the other — a key or token issued by one
 *     deployment must never reach another.
 *  3. `https` is required, loopback excepted, so credentials never travel in
 *     plaintext.
 *  4. A custom endpoint never becomes the build default.
 */
const Options: React.FC = () => {
  const {t} = useTranslation(namespaces.options);

  const [mode, setMode] = useState<AuthMode>('account');
  const [dashboard, setDashboard] = useState('');
  const [api, setApi] = useState('');
  const [clientId, setClientId] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [current, setCurrent] = useState<string>(DefaultBaseUrlKey);

  const [orthography, setOrthography] = useState(true);
  const [llmAlternatives, setLlmAlternatives] = useState(false);
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<ICategoryGroup[]>([]);
  const [categoriesError, setCategoriesError] = useState(false);
  // The endpoint is resolved from storage asynchronously. Without this flag the
  // category fetch runs on mount while BASE_URL_API is still empty, bails out,
  // and never retries — `current` keeps its initial value, so nothing re-triggers
  // the effect.
  const [endpointReady, setEndpointReady] = useState(false);
  const [configOptions, setConfigOptions] = useState<
    Record<string, IConfigOption>
  >({});
  const [languageFormat, setLanguageFormat] = useState<Record<string, string>>(
    {}
  );
  const [disabledCategories, setDisabledCategories] = useState<string[]>([]);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const redirectUri = browser.identity?.getRedirectURL
    ? browser.identity.getRedirectURL()
    : '';

  useEffect(() => {
    browser.storage.local
      .get(null)
      .then((result) => {
        // The options page makes its own API call (the category list), so it has
        // to resolve the endpoint like every other context does — otherwise
        // BASE_URL_API is empty and the request is silently skipped.
        registerCustomEndpointFromStorage(result);
        setBaseUrls(
          (result[StorageKeys.API_ENDPOINT_KEY] as string) || DefaultBaseUrlKey
        );

        const stored = result[StorageKeys.CUSTOM_ENDPOINT] as
          BaseUrl | undefined;
        if (stored) {
          setDashboard(stored.dashboard || '');
          setApi(stored.api || '');
          setClientId(stored.oauth_client_id || '');
        }
        setMode(
          result[StorageKeys.AUTH_MODE] === 'apiKey' ? 'apiKey' : 'account'
        );
        setApiKeyValue(result[StorageKeys.API_KEY]?.value || '');
        setCurrent(
          (result[StorageKeys.API_ENDPOINT_KEY] as string) || DefaultBaseUrlKey
        );
        setEndpointReady(true);
        setOrthography(result[StorageKeys.ORTHOGRAPHY] !== false);
        setLlmAlternatives(!!result[StorageKeys.LLM_ALTERNATIVES]);
        setDisabledCategories(
          (result[StorageKeys.DISABLED_CATEGORIES] as string[]) || []
        );
        setLanguageFormat(
          (result[StorageKeys.LANGUAGE_FORMAT] as Record<string, string>) || {}
        );
      })
      .catch(sendErrorToSentry);
  }, []);

  // Fetched rather than read from storage: /v2.0/categories is unauthenticated
  // and cacheable, and unlike /v2.0/auth it answers the same for a deployment
  // running on API keys alone.
  useEffect(() => {
    if (!endpointReady) {
      return;
    }

    const request = getCategories(browser.i18n?.getUILanguage?.() || 'en-US');
    if (!request.url || !request.config) {
      return;
    }

    fetch(request.url, request.config)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(String(response.status));
        }
        const body: ICategoriesResponse = await response.json();
        setCategories(body.categories || []);
        setCategoryGroups(body.groups || []);
        setCategoriesError(false);
      })
      .catch(() => {
        // A deployment that does not serve the endpoint simply gets no section.
        setCategoriesError(true);
        setCategories([]);
      });

    const optionsRequest = getConfigOptions();
    if (optionsRequest.url && optionsRequest.config) {
      fetch(optionsRequest.url, optionsRequest.config)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(String(response.status));
          }
          const body: IConfigOptionsResponse = await response.json();
          setConfigOptions(body.options || {});
        })
        .catch(() => setConfigOptions({}));
    }
  }, [endpointReady, current]);

  const setFormatField = (field: string, value: string) => {
    // An empty choice removes the field entirely rather than storing a blank,
    // so the API falls back to its own default instead of being sent ''.
    const next = {...languageFormat};
    if (value) {
      next[field] = value;
    } else {
      delete next[field];
    }

    setLanguageFormat(next);
    storeInLocalStorage(StorageKeys.LANGUAGE_FORMAT, next);
  };

  /**
   * Human label for a value.
   *
   * Comes from the API, which serves the dashboard's own wording via the same
   * data files that carry the category labels — so the two surfaces cannot
   * drift. Values the dashboard has no wording for (punctuation such as `(-)`)
   * fall back to the value itself, which reads fine untranslated.
   */
  const formatValueLabel = (field: string, value: string) =>
    configOptions[field]?.labels?.[value] || value;

  const withTrailingSlash = (value: string) =>
    value.endsWith('/') ? value : `${value}/`;

  const saveConnection = async () => {
    setError('');
    setNotice('');

    if (!isAcceptableEndpointUrl(api)) {
      setError(t('invalidUrl'));
      return;
    }

    if (mode === 'account') {
      if (!isAcceptableEndpointUrl(dashboard)) {
        setError(t('invalidUrl'));
        return;
      }
      if (!clientId.trim()) {
        setError(t('clientIdRequired'));
        return;
      }
    } else if (!apiKeyValue.trim()) {
      setError(t('apiKeyRequired'));
      return;
    }

    // PostHog settings come from the build default: a self-hoster has no reason
    // to supply them, and leaving them undefined breaks analytics init.
    const template = BaseUrls[DefaultBaseUrlKey];
    const endpoint: BaseUrl = {
      // No dashboard in API-key mode — the dashboard-backed UI is hidden, so an
      // empty value here is what makes `isDashboardAvailable` false.
      dashboard: mode === 'account' ? withTrailingSlash(dashboard.trim()) : '',
      api: withTrailingSlash(api.trim()),
      oauth_client_id: mode === 'account' ? clientId.trim() : '',
      posthog_url: template?.posthog_url || '',
      posthog_key: template?.posthog_key || '',
    };

    try {
      registerCustomEndpoint(endpoint);
      await browser.storage.local.set({
        [StorageKeys.CUSTOM_ENDPOINT]: endpoint,
        [StorageKeys.API_ENDPOINT_KEY]: CUSTOM_BASE_URL_KEY,
        [StorageKeys.AUTH_MODE]: mode,
        // Stored together with the endpoint it belongs to, so it can never be
        // presented to a different deployment.
        [StorageKeys.API_KEY]:
          mode === 'apiKey'
            ? {endpoint: CUSTOM_BASE_URL_KEY, value: apiKeyValue.trim()}
            : {endpoint: '', value: ''},
      });

      // Invariant 2: credentials never survive a connection change.
      logOut();
      setApiKey(mode === 'apiKey' ? apiKeyValue.trim() : '');
      setCurrent(CUSTOM_BASE_URL_KEY);
      setNotice(t('saved'));
    } catch (caught) {
      sendErrorToSentry(caught);
      setError(String(caught));
    }
  };

  const reset = async () => {
    setError('');
    setNotice('');

    try {
      registerCustomEndpoint(null);
      await browser.storage.local.remove([
        StorageKeys.CUSTOM_ENDPOINT,
        StorageKeys.API_KEY,
        StorageKeys.AUTH_MODE,
      ]);
      storeInLocalStorage(StorageKeys.API_ENDPOINT_KEY, DefaultBaseUrlKey);
      logOut();
      setApiKey('');
      setMode('account');
      setDashboard('');
      setApi('');
      setClientId('');
      setApiKeyValue('');
      setCurrent(DefaultBaseUrlKey);
      setNotice(t('resetDone'));
    } catch (caught) {
      sendErrorToSentry(caught);
      setError(String(caught));
    }
  };

  const setCategoryLevel = (category: ICategory, level: ProficiencyLevel) => {
    const next = applyLevelToDisabled(
      category.key,
      category.advanced_key,
      level,
      disabledCategories
    );

    setDisabledCategories(next);
    storeInLocalStorage(StorageKeys.DISABLED_CATEGORIES, next);
  };

  return (
    <div className='witty-options'>
      <h1>{t('settingsHeadline')}</h1>

      <section>
        <h2>{t('connectionHeadline')}</h2>
        <p>{t('endpointIntro')}</p>
        <p className='witty-options-warning'>{t('endpointWarning')}</p>
        <p className='witty-options-muted'>{t('signOutNotice')}</p>
        <p className='witty-options-muted'>
          <a
            href={HelpLinks.ownServer}
            target='_blank'
            rel='noopener noreferrer'
          >
            {t('helpOwnServer')}
          </a>
          {' · '}
          <a
            href={HelpLinks.withoutDashboard}
            target='_blank'
            rel='noopener noreferrer'
          >
            {t('helpWithoutDashboard')}
          </a>
        </p>
        <p className='witty-options-muted'>
          {t('currentEndpoint')}: <code>{current}</code>
        </p>

        <label>
          <input
            type='radio'
            name='auth-mode'
            id='mode-account'
            checked={mode === 'account'}
            onChange={() => setMode('account')}
          />
          &nbsp;{t('modeAccount')}
        </label>
        <label>
          <input
            type='radio'
            name='auth-mode'
            id='mode-api-key'
            checked={mode === 'apiKey'}
            onChange={() => setMode('apiKey')}
          />
          &nbsp;{t('modeApiKey')}
        </label>

        <label htmlFor='api-url'>{t('apiUrl')}</label>
        <input
          id='api-url'
          type='url'
          inputMode='url'
          placeholder='https://api.example.com/'
          value={api}
          onChange={(event) => setApi(event.target.value)}
        />

        {mode === 'account' && (
          <>
            <label htmlFor='dashboard-url'>{t('dashboardUrl')}</label>
            <input
              id='dashboard-url'
              type='url'
              inputMode='url'
              placeholder='https://dashboard.example.com/'
              value={dashboard}
              onChange={(event) => setDashboard(event.target.value)}
            />

            <label htmlFor='client-id'>{t('oauthClientId')}</label>
            <input
              id='client-id'
              type='text'
              value={clientId}
              onChange={(event) => setClientId(event.target.value)}
            />

            {redirectUri && (
              <p className='witty-options-muted'>
                {t('redirectUriHint')} <code>{redirectUri}</code>
              </p>
            )}
          </>
        )}

        {mode === 'apiKey' && (
          <>
            <label htmlFor='api-key'>{t('apiKey')}</label>
            <input
              id='api-key'
              type='password'
              autoComplete='off'
              value={apiKeyValue}
              onChange={(event) => setApiKeyValue(event.target.value)}
            />
            <p className='witty-options-muted'>{t('apiKeyHint')}</p>
          </>
        )}

        {error && <p className='witty-options-error'>{error}</p>}
        {notice && <p className='witty-options-notice'>{notice}</p>}

        <div className='witty-options-actions'>
          <button type='button' id='save-connection' onClick={saveConnection}>
            {t('save')}
          </button>
          <button
            type='button'
            id='reset-connection'
            className='secondary'
            onClick={reset}
          >
            {t('reset')}
          </button>
        </div>
      </section>

      <section>
        <h2>{t('customisationHeadline')}</h2>
        <p className='witty-options-muted'>{t('orgOverrideNote')}</p>

        <label>
          <input
            type='checkbox'
            id='opt-orthography'
            checked={orthography}
            onChange={(event) => {
              setOrthography(event.target.checked);
              storeInLocalStorage(
                StorageKeys.ORTHOGRAPHY,
                event.target.checked
              );
            }}
          />
          &nbsp;{t('orthography')}
        </label>

        <label>
          <input
            type='checkbox'
            id='opt-llm-alternatives'
            checked={llmAlternatives}
            onChange={(event) => {
              setLlmAlternatives(event.target.checked);
              storeInLocalStorage(
                StorageKeys.LLM_ALTERNATIVES,
                event.target.checked
              );
            }}
          />
          &nbsp;{t('llmAlternatives')}
        </label>
      </section>

      {/*
        Rendered from whatever category list the server reported. A deployment
        that reports none simply does not offer the section; the NLP API has to
        expose the list before this appears.
      */}
      {Object.keys(configOptions).length > 0 && (
        <section id='language-format-section'>
          <h2>{t('languageHeadline')}</h2>
          <p className='witty-options-muted'>{t('orgOverrideNote')}</p>

          {CONFIG_OPTION_FIELDS.filter((field) => configOptions[field]).map(
            (field) => {
              const option = configOptions[field];
              const labelKey = {
                gendered_roles_format: 'genderedRolesFormat',
                german_gender_ending: 'germanGenderEnding',
                french_gender_separator: 'frenchGenderSeparator',
              }[field];

              return (
                <div className='witty-format-field' key={field}>
                  <label htmlFor={`opt-${field}`}>{t(labelKey)}</label>
                  <p className='witty-options-muted'>{t(`${labelKey}Hint`)}</p>
                  <select
                    id={`opt-${field}`}
                    data-field={field}
                    value={languageFormat[field] || ''}
                    onChange={(event) =>
                      setFormatField(field, event.target.value)
                    }
                  >
                    <option value=''>
                      {t('useApiDefault')}
                      {option.default ? ` (${option.default})` : ''}
                    </option>
                    {option.values.map((value) => (
                      <option value={value} key={value}>
                        {formatValueLabel(field, value)}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }
          )}
        </section>
      )}

      {categories.length > 0 && (
        <section id='categories-section'>
          <h2>{t('categoriesHeadline')}</h2>
          <p className='witty-options-muted'>{t('categoriesIntro')}</p>

          {categoryGroups.map((group) => {
            const inGroup = categories.filter(
              (category) => category.parent === group.key
            );
            if (!inGroup.length) {
              return null;
            }

            return (
              <div className='witty-category-group' key={group.key}>
                <h3>{group.label || group.key}</h3>
                {inGroup.map((category) => (
                  <CategoryToggle
                    key={category.key}
                    categoryKey={category.key}
                    label={category.label || category.key}
                    hasAdvanced={!!category.advanced_key}
                    locked={category.proficiency_level === LOCKED_PROFICIENCY}
                    value={levelFromDisabled(
                      category.key,
                      category.advanced_key,
                      disabledCategories
                    )}
                    onChange={(level) => setCategoryLevel(category, level)}
                  />
                ))}
              </div>
            );
          })}
        </section>
      )}

      {categoriesError && (
        <p className='witty-options-muted'>{t('categoriesFailed')}</p>
      )}
    </div>
  );
};

export default Options;
