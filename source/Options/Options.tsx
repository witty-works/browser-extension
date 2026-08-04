import React, { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import { useTranslation } from 'react-i18next';

import '../i18n/i18n';
import { namespaces } from '../i18n/i18n.constants';
import {
  AuthMode,
  BaseUrl,
  BaseUrls,
  CUSTOM_BASE_URL_KEY,
  DefaultBaseUrlKey,
  HelpLinks,
  isAcceptableEndpointUrl,
  registerCustomEndpoint,
  StorageKeys,
} from '../shared/constants';
import { logOut, storeInLocalStorage } from '../shared/utils';
import { setApiKey } from '../shared/ApiServices/requests';
import { sendErrorToSentry } from '../shared/errorUtils';
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
  const { t } = useTranslation(namespaces.options);

  const [mode, setMode] = useState<AuthMode>('account');
  const [dashboard, setDashboard] = useState('');
  const [api, setApi] = useState('');
  const [clientId, setClientId] = useState('');
  const [apiKeyValue, setApiKeyValue] = useState('');
  const [current, setCurrent] = useState<string>(DefaultBaseUrlKey);

  const [orthography, setOrthography] = useState(true);
  const [llmAlternatives, setLlmAlternatives] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
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
        const stored = result[StorageKeys.CUSTOM_ENDPOINT] as
          | BaseUrl
          | undefined;
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
        setOrthography(result[StorageKeys.ORTHOGRAPHY] !== false);
        setLlmAlternatives(!!result[StorageKeys.LLM_ALTERNATIVES]);
        setCategories((result[StorageKeys.CATEGORIES] as string[]) || []);
        setDisabledCategories(
          (result[StorageKeys.DISABLED_CATEGORIES] as string[]) || []
        );
      })
      .catch(sendErrorToSentry);
  }, []);

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
            ? { endpoint: CUSTOM_BASE_URL_KEY, value: apiKeyValue.trim() }
            : { endpoint: '', value: '' },
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

  const toggleCategory = (category: string) => {
    const next = disabledCategories.includes(category)
      ? disabledCategories.filter((item) => item !== category)
      : [...disabledCategories, category];

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
          <a href={HelpLinks.ownServer} target='_blank' rel='noopener noreferrer'>
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
        that reports none simply does not offer the section — see Task 3 in
        NLP_API_TASKS.md.
      */}
      {categories.length > 0 && (
        <section id='categories-section'>
          <h2>{t('categoriesHeadline')}</h2>
          <p className='witty-options-muted'>{t('categoriesIntro')}</p>

          {categories.map((category) => (
            <label key={category}>
              <input
                type='checkbox'
                data-category={category}
                checked={!disabledCategories.includes(category)}
                onChange={() => toggleCategory(category)}
              />
              &nbsp;{category}
            </label>
          ))}
        </section>
      )}
    </div>
  );
};

export default Options;
