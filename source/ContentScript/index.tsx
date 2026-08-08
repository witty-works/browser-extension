import * as Sentry from '@sentry/react';
import {browser, Storage} from 'webextension-polyfill-ts';
import {
  BaseUrls,
  StorageKeys,
  wittyVersion,
  exposeWittyIdAllowList,
  DefaultBaseUrlKey,
  isDashboardAvailable,
  WTags,
  registerCustomEndpointFromStorage,
} from '../shared/constants';
import defaultConfig from '../witty.config.json';
import {
  getDomainWithoutSubdomain,
  makeAuthRequest,
  shouldInjectIntoWindow,
  isSignedInResult,
} from '../shared/utils';
import {sendErrorToSentry} from '../shared/errorUtils';
import {registerErrorReporter} from '../shared/errorReporting';
import {customRender} from './utils';
import {initI18n} from '../i18n/i18n';
import {setBaseUrls} from '../shared/ApiServices/requests';
import {v4 as uuidv4} from 'uuid';
import {isMicrosoftOnline} from '../shared/DOMutils';

initI18n();

const handleDomainsFromDashboard = (
  newValue: string | string[],
  scriptId: string
) => {
  const currentDomain = getDomainWithoutSubdomain(window.location.hostname);
  const currentDomainOnList = newValue?.includes(currentDomain);
  customRender(!currentDomainOnList, scriptId);
};

const storageChange = (
  changes: {[x: string]: Storage.StorageChange | {newValue: any}},
  scriptId: string
) => {
  const currentDomain = getDomainWithoutSubdomain(window.location.hostname);
  const changedItems = Object.keys(changes);

  for (const item of changedItems) {
    if (item === StorageKeys.DOMAINS) {
      handleDomainsFromDashboard(changes[item].newValue, scriptId);
    }

    if (item === StorageKeys.ORGANIZATION_DOMAINS) {
      const orgDomains = changes[item].newValue;
      const isOnOrgDomainList =
        (orgDomains?.type === 'deny' &&
          orgDomains.list?.includes(currentDomain)) ||
        (orgDomains?.type === 'allow' &&
          !orgDomains.list?.includes(currentDomain));
      customRender(!isOnOrgDomainList, scriptId);
    }
  }
};

const initialize = () => {
  const sentryDSN = defaultConfig.SENTRY_DSN;
  const {
    SENTRY_SAMPLE_RATE: sentrySampleRate,
    SENTRY_TRACE_RATE: sentryTraceRate,
  } = defaultConfig;
  const domain = getDomainWithoutSubdomain(window.location.hostname);
  const scriptId = uuidv4();

  const wittyIsInstalledElement = document.createElement('witty-is-installed');
  document.body.appendChild(wittyIsInstalledElement);

  if (
    Array.isArray(exposeWittyIdAllowList) &&
    exposeWittyIdAllowList.includes(domain)
  ) {
    wittyIsInstalledElement.setAttribute('extension-id', browser.runtime.id);
    wittyIsInstalledElement.setAttribute('extension-version', wittyVersion);

    browser.storage.local
      .get(null)
      .then((result) => {
        const wittyTeam = result[StorageKeys.TEAM_NAME];
        wittyIsInstalledElement.setAttribute('extension-team', wittyTeam);

        const apiEndpoint =
          result[StorageKeys.API_ENDPOINT_KEY] || DefaultBaseUrlKey;
        registerCustomEndpointFromStorage(result);
        setBaseUrls(apiEndpoint);

        if (!isSignedInResult(result) && isDashboardAvailable(result)) {
          // Points at the dashboard's own login page. It deliberately no longer
          // carries a `redirect_uri` back into the extension: the extension can
          // only be signed in from its own UI now, via the OAuth flow the
          // background worker runs. A page-supplied URL that hands credentials
          // to the extension is exactly the pattern that was removed.
          const loginUrl = `${BaseUrls[apiEndpoint].dashboard}login`;
          wittyIsInstalledElement.setAttribute('login-url', loginUrl);
        }
      })
      .catch(sendErrorToSentry);
  }

  browser.storage.local
    .get(null)
    .then((result) => {
      const orgDomains = result[StorageKeys.ORGANIZATION_DOMAINS];
      const isOnOrgDomainList =
        (orgDomains?.type === 'deny' && orgDomains.list?.includes(domain)) ||
        (orgDomains?.type === 'allow' && !orgDomains.list?.includes(domain));

      const isOnPersonalDomainList =
        result[StorageKeys.DOMAINS]?.includes(domain);
      const shouldDisable =
        isOnOrgDomainList ||
        isOnPersonalDomainList ||
        defaultConfig.DISABLED_SITES.includes(domain) ||
        isMicrosoftOnline(window.location.href);
      customRender(!shouldDisable, scriptId);
    })
    .catch(sendErrorToSentry);

  browser.storage.onChanged.addListener((changes) =>
    storageChange(changes, scriptId)
  );
  makeAuthRequest();

  const orphanMessageId = `${browser.runtime.id}orphanCheck`;
  window.dispatchEvent(new Event(orphanMessageId));
  window?.addEventListener(orphanMessageId, unregisterOrphan);

  async function unregisterOrphan() {
    if (!browser.runtime.id) {
      const el = document.querySelector(`${WTags.WW_POPOVER}-${scriptId}`);
      if (el) {
        try {
          const {safeUnmountAndRemove} = await import('./utils');
          safeUnmountAndRemove(el as HTMLElement);
        } catch (err) {
          try {
            el.remove();
          } catch (err2) {
            // ignore
          }
        }
      }
      browser.storage.onChanged.removeListener((changes) =>
        storageChange(changes, scriptId)
      );
      window.removeEventListener(orphanMessageId, unregisterOrphan);
    }
  }

  if (sentryDSN) {
    Sentry.init({
      dsn: sentryDSN,
      release: wittyVersion,
      integrations: [Sentry.browserTracingIntegration()],
      sampleRate: sentrySampleRate,
      tracesSampleRate: sentryTraceRate,
    });
    registerErrorReporter((error) => Sentry.captureException(error));
  }
};

if (shouldInjectIntoWindow(window.self)) {
  initialize();
}
