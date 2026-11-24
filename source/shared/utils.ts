import {confirmWrites} from './confirmBeforeChecking';
import browser from 'webextension-polyfill';
import {
  apiKeyFromStorage,
  DefaultBaseUrlKey,
  DEV_ENV,
  getAuthMode,
  isAllowedBaseUrlKey,
  isStoredEndpointConfigured,
  registerCustomEndpointFromStorage,
  STATIC_ACCESS_TOKEN,
  StorageKeys,
  wittyVersion,
  X_KEY,
} from './constants';
import {sendErrorToSentry} from './errorUtils';
import defaultConfig from '../witty.config.json';
import {
  isGoogleDocs,
  isMicrosoftOnline,
  isTextArea,
  requiresRectRecalculation,
} from './DOMutils';
import {setToken} from './ApiServices/requests';
import {isRefreshTokenRejected, refresh} from './ApiServices/oauth';
import {MessageTypes, RefreshTokenMessage} from './messages';
import {backgroundApiRequest} from './ApiServices/backgroundApi';
import {clearTokens, persistTokens, readTokens} from './tokenStore';
import {IAuthResponse} from './types';
import {getActiveDocument} from './activeDocument';
import {getStorage} from './platform/storage';

// Moved out so they can be used without the extension APIs; re-exported for
// existing importers.
export {extractSentenceNode, generateAlertId} from './alerts';

// Moved to DOMutils so they can be used without the extension APIs; re-exported
// for existing importers.
export {
  getDomainWithoutSubdomain,
  getScrollableParentClosestToElement,
} from './DOMutils';
export const isObjectEmpty = (obj: object) =>
  obj &&
  Object.keys(obj).length === 0 &&
  Object.getPrototypeOf(obj) === Object.prototype;

export const isFunction = (functionToCheck: Function) =>
  functionToCheck && {}.toString.call(functionToCheck) === '[object Function]';

export const storeInLocalStorage = (key: string, value: any) => {
  if (!key) {
    return;
  }
  getStorage()
    .local.set({[key]: value})
    .then(() => {
      //TODO bug, some values are not pronted correctly (for example arrays)
      const componentName = 'Utils';
      const message = value
        ? `${key}(${typeof value}) *${(typeof value === 'object'
            ? JSON.stringify(value)
            : value
          ).toString()}* correctly saved`
        : `value with key: ${key} is undefined`;
      // const data = typeof value === 'object' ? Object.keys(value) : value;

      DEV_ENV &&
        console.log(
          `%c[Witty v${wittyVersion}]%c[Component: ${componentName}] %c${message}`,
          `color: #55B8E9`,
          `color: #5fca7d`,
          `color: #000`
        );
    })
    .catch((error: unknown) => {
      const componentName = 'Utils';
      const message = `onBrowserStorage Error: ${error}`;

      DEV_ENV &&
        console.log(
          `%c[Witty v${wittyVersion}]%c[Component: ${componentName}] %c${message}`,
          `color: #55B8E9`,
          `color: #5fca7d`,
          `color: #f00`
        );

      sendErrorToSentry(error);
    });
};

export const singularTheyToBoolean = (value: string) =>
  value === 'he_or_she' ? false : true;

export const changeSingularThey = (value: boolean) =>
  value ? 'all_pronouns' : 'he_or_she';

export const maximumImportanceToBoolean = (value: number) =>
  value === 3 ? true : false;

export const changeMaximumImportance = (value: boolean) => (value ? 3 : 2);

export const addNotificationBadge = (numberOfNotifications: number) => {
  browser.action?.setBadgeBackgroundColor({
    color: '#E6635A',
  });

  browser.action?.setBadgeText({
    text: numberOfNotifications.toString(),
  });
  // for firefox mv2
  browser.browserAction?.setBadgeBackgroundColor({
    color: '#E6635A',
  });

  browser.browserAction?.setBadgeText({
    text: numberOfNotifications.toString(),
  });
};

export const addBadge = (text: string) => {
  browser.action?.setBadgeBackgroundColor({
    color: [190, 190, 190, 230],
  });
  browser.action?.setBadgeText({text: text});
  // for firefox mv2
  browser.browserAction?.setBadgeBackgroundColor({
    color: [190, 190, 190, 230],
  });
  browser.browserAction?.setBadgeText({text: text});
};

/**
 * What a token refresh came to.
 *
 * - `refreshed`: storage holds an access token other than the one that
 *   failed; read it back and retry once.
 * - `signedOut`: the dashboard rejected the refresh token, or there is none;
 *   the credentials were cleared.
 * - `failed`: nothing changed (offline, 429, 5xx, an unknown endpoint, a
 *   build-time key); retrying now would fail the same way.
 */
export type RefreshOutcome = 'refreshed' | 'signedOut' | 'failed';

const REFRESH_OUTCOMES: readonly string[] = [
  'refreshed',
  'signedOut',
  'failed',
];

let refreshInFlight: Promise<RefreshOutcome> | null = null;
// Counts sign-outs. A refresh that started before one and finishes after it
// must not write its tokens back and sign the user in again.
let signOutGeneration = 0;

/** Settles once no refresh is in flight; signing out waits for it. */
export const refreshSettled = async (): Promise<void> => {
  await refreshInFlight?.catch(() => undefined);
};

const refreshStoredTokens = async (): Promise<RefreshOutcome> => {
  const generation = signOutGeneration;
  const stored = await readTokens();

  if (!stored.refreshToken) {
    logOut();
    return 'signedOut';
  }

  const result = await getStorage().local.get([
    StorageKeys.API_ENDPOINT_KEY,
    StorageKeys.CUSTOM_ENDPOINT,
  ]);
  // The refresh token belongs to the stored endpoint. When that names no
  // endpoint, refreshing against the default would hand it to the wrong
  // dashboard; the background clears it instead (see storedEndpoint.ts).
  if (!isStoredEndpointConfigured(result)) {
    return 'failed';
  }
  registerCustomEndpointFromStorage(result);
  const urlKey =
    (result[StorageKeys.API_ENDPOINT_KEY] as string) || DefaultBaseUrlKey;

  try {
    // Passport rotates refresh tokens, so both values must be written back —
    // continuing to present the previous refresh token after a successful
    // rotation is rejected.
    const tokens = await refresh(urlKey, stored.refreshToken);
    // Signed out while the refresh was under way: the new pair is dropped.
    if (generation !== signOutGeneration) return 'signedOut';
    await persistTokens(tokens);
    setToken(tokens.accessToken);
    return 'refreshed';
  } catch (error) {
    if (isRefreshTokenRejected(error)) {
      // Expired, revoked, or issued by a different deployment: only a new
      // sign-in helps, so fail closed.
      logOut();
      return 'signedOut';
    }
    // Offline, rate-limited or a server error: keep the tokens, the next
    // failing request tries again.
    sendErrorToSentry(error);
    return 'failed';
  }
};

/**
 * Obtain a fresh access token using the stored refresh token, with the OAuth2
 * `refresh_token` grant against `/oauth/token`. Runs in the background worker
 * only: content scripts and the popup ask it with `requestTokenRefresh`.
 *
 * One refresh at a time. Passport rotates the refresh token, so two
 * concurrent refreshes with the same one would see the second rejected and
 * sign the user out; every caller during a refresh shares its outcome.
 *
 * `failedToken` is the access token the caller's request was refused with.
 * When storage already holds a different one, another caller refreshed in
 * the meantime and the caller only needs to read it back. Without it, the
 * refresh always runs.
 */
export const getNewAccessToken = async (
  failedToken?: string
): Promise<RefreshOutcome> => {
  // If X_KEY is configured, do not attempt to refresh tokens
  if (X_KEY) return 'failed';

  try {
    const stored = await readTokens();

    // If the access token matches a statically configured one, never refresh
    // it. Guarded on a non-empty value: in release builds STATIC_ACCESS_TOKEN
    // is '', and an unauthenticated install also has '' in storage, so an
    // unguarded comparison would match and skip the refresh entirely.
    if (STATIC_ACCESS_TOKEN && stored.accessToken === STATIC_ACCESS_TOKEN) {
      return 'failed';
    }

    if (
      failedToken !== undefined &&
      stored.accessToken &&
      stored.accessToken !== failedToken
    ) {
      return 'refreshed';
    }
  } catch (error) {
    sendErrorToSentry(error);
    return 'failed';
  }

  if (!refreshInFlight) {
    refreshInFlight = refreshStoredTokens()
      .catch((error: unknown): RefreshOutcome => {
        sendErrorToSentry(error);
        return 'failed';
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

/**
 * Ask the background worker to refresh the access token that `failedToken`
 * was refused with (see `getNewAccessToken`). For content scripts and the
 * popup; resolves `failed` if the worker cannot be reached.
 */
export const requestTokenRefresh = async (
  failedToken: string
): Promise<RefreshOutcome> => {
  try {
    const outcome = await browser.runtime.sendMessage({
      type: MessageTypes.REFRESH_TOKEN,
      failedToken,
    } as RefreshTokenMessage);
    return typeof outcome === 'string' && REFRESH_OUTCOMES.includes(outcome)
      ? (outcome as RefreshOutcome)
      : 'failed';
  } catch (error) {
    return 'failed';
  }
};

export const logOut = async (): Promise<void> => {
  signOutGeneration += 1;
  storeInLocalStorage(StorageKeys.APP_ID, getRandomToken());
  storeInLocalStorage(StorageKeys.USER_ID, '');
  storeInLocalStorage(StorageKeys.ID_WAS_ALIASED, false);
  storeInLocalStorage(StorageKeys.CHECK_ENDPOINT_SUCCESS, false);
  // The next account's organisation decides anew; until its answer arrives,
  // ask-before-checking is pending rather than this account's value.
  storeInLocalStorage(StorageKeys.CONFIRM_BEFORE_CHECKING_ORG, null);
  storeInLocalStorage(StorageKeys.CONFIRM_BEFORE_CHECKING_KNOWN, false);
  // Goes through the store so the session-held access token is cleared too,
  // not just the on-disk refresh token.
  setToken('');
  addBadge('Login');
  try {
    await clearTokens();
  } catch (error) {
    sendErrorToSentry(error);
  }
};

export const removeBadge = () => {
  browser.action?.setBadgeText({text: ''});
  // for firefox mv2
  browser.browserAction?.setBadgeText({text: ''});
};

export const getRandomToken = () => {
  const bytes = new Uint8Array(32); //256 bits token

  crypto.getRandomValues(bytes);

  // convert byte array to hexademical representation
  const bytesHex = bytes.reduce(
    (item, acc) => item + `00${acc.toString(16)}`.slice(-2),
    ''
  );

  // convert hexademical value to a decimal string
  return BigInt('0x' + bytesHex).toString(10);
};

export const updateLabelChrome = (domain: string) => {
  getStorage()
    .local.get(null)
    .then((result) => {
      if (!isSignedInResult(result)) {
        addBadge('Login');
        return;
      }

      const orgDomains = result[StorageKeys.ORGANIZATION_DOMAINS];
      const domainList = Array.isArray(orgDomains?.list) ? orgDomains.list : [];
      const isLocked = orgDomains
        ? (orgDomains.type === 'deny' && domainList.includes(domain)) ||
          (orgDomains.type === 'allow' && !domainList.includes(domain))
        : false;

      const isDisabled = result[StorageKeys.DOMAINS]?.includes(domain);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      browser.tabs
        .query({active: true, currentWindow: true})
        .then((tabs) => {
          if (!tabs[0]?.url) return;

          const domainOnDisabledSitesList =
            defaultConfig.DISABLED_SITES.includes(domain) ||
            isMicrosoftOnline(new URL(tabs[0].url).href);
          const numberOfNotifications =
            result[StorageKeys.NUMBER_OF_NOTIFICATIONS];

          if (isLocked || isDisabled || domainOnDisabledSitesList) {
            addBadge('OFF');
          } else if (numberOfNotifications > 0) {
            addNotificationBadge(numberOfNotifications);
          } else {
            removeBadge();
          }
        })
        .catch((error) => {
          sendErrorToSentry(error);
        });
    });
};

export const getCorrectedPosition = (
  elementRect: DOMRect,
  parentElement: HTMLElement | null,
  element: HTMLElement
) => {
  const parentRect = parentElement?.getBoundingClientRect();
  const isFirefox = navigator.userAgent.match(/firefox|fxios/i);
  const textArea = isTextArea(element);

  if (requiresRectRecalculation(element)) {
    elementRect = element.getBoundingClientRect();
  }
  const topLevelWindow = element.ownerDocument.defaultView;
  if (parentRect && !isObjectEmpty(parentRect) && topLevelWindow) {
    const scrollY = textArea ? 0 : topLevelWindow.scrollY;
    const scrollX = textArea ? 0 : topLevelWindow.scrollX;

    const top =
      isFirefox && !isGoogleDocs(element)
        ? 0
        : elementRect.top - parentRect.top - scrollY;
    const left = elementRect.left - parentRect.left - scrollX;

    return {top, left};
  }

  return {top: elementRect.top, left: elementRect.left};
};

export const getCorrectedPositionCanvas = (element: HTMLElement) => {
  const updatedElementRect = element.getBoundingClientRect();

  const scrollLeft = element.parentElement?.parentElement?.scrollLeft;
  const scrollTop = element.parentElement?.parentElement?.scrollTop;

  const isPageless =
    element.querySelectorAll('.kix-page-paginated').length === 0;
  const googleDocsToolbarLeftRect = getActiveDocument()
    .getElementsByClassName('left-sidebar-container-content')[0]
    ?.getBoundingClientRect();

  return {
    top: scrollTop ? scrollTop : 0,
    left:
      updatedElementRect.left +
      (scrollLeft ? scrollLeft : 0) +
      (isPageless ? googleDocsToolbarLeftRect?.width || 0 : 0),
  };
};

export const getFrameDepth = (windowToIdentify: Window): number => {
  if (windowToIdentify === window.top) {
    return 0;
  } else if (windowToIdentify.parent === window.top) {
    return 1;
  }

  return 1 + getFrameDepth(windowToIdentify.parent);
};

export const shouldInjectIntoWindow = (windowToCheck: Window) => {
  const frameDepth = getFrameDepth(windowToCheck);
  const isVisible =
    windowToCheck.innerWidth >= 10 && windowToCheck.innerHeight >= 10;
  return frameDepth < 2 && isVisible;
};

export const updateConfig = (response: IAuthResponse, force = false) => {
  getStorage()
    .local.get(null)
    .then((result) => {
      const confirm = confirmWrites(result, response);
      if (Object.keys(confirm).length > 0) {
        getStorage().local.set(confirm);
      }
      if (
        response?.config_hash === result[StorageKeys.CONFIG_HASH] &&
        response?.organization_config_hash ===
          result[StorageKeys.ORGANIZATION_CONFIG_HASH]
      ) {
        if (!force) {
          return; // config did not change
        }
        // config hash did not change, but we want to force update
      }
      storeInLocalStorage(
        StorageKeys.ORGANIZATION_ID,
        response?.organization_id
      );
      storeInLocalStorage(StorageKeys.USER_ID, response?.id);
      storeInLocalStorage(StorageKeys.DOMAINS, response?.domains.list); //type not relevant here -> always 'deny'
      // @ts-ignore
      storeInLocalStorage(
        StorageKeys.LLM_ALTERNATIVES,
        response?.organization_config?.llm_alternatives?.value
      );
      storeInLocalStorage(
        StorageKeys.ORGANIZATION_DOMAINS,
        response?.organization_domains
      );
      storeInLocalStorage(StorageKeys.CONFIG_HASH, response?.config_hash);
      storeInLocalStorage(
        StorageKeys.ORGANIZATION_CONFIG_HASH,
        response?.organization_config_hash
      );
      storeInLocalStorage(StorageKeys.TEAM_NAME, response?.organization_name);
      if (response?.organization_config?.categories) {
        storeInLocalStorage(
          StorageKeys.ORTHOGRAPHY,
          response.organization_config.categories.orthography
        );
        // Keep the reported category keys so the options page can offer
        // per-category toggles. Deployments that report none simply do not get
        // the section.
        storeInLocalStorage(
          StorageKeys.CATEGORIES,
          Object.keys(response.organization_config.categories)
        );
      }
    })
    .catch((error) => {
      sendErrorToSentry(error);
    });
};

/**
 * Ask the API for the user's configuration (`/v2.0/auth`) and store it. The
 * background worker makes the request with the credentials (apiProxy.ts), so
 * this works from content scripts, which do not hold them.
 */
export const makeAuthRequest = () => {
  getStorage()
    .local.get(null)
    .then(async (result) => {
      registerCustomEndpointFromStorage(result);
      const urls = result[StorageKeys.API_ENDPOINT_KEY]
        ? result[StorageKeys.API_ENDPOINT_KEY]
        : DefaultBaseUrlKey;
      // A stored key that names no endpoint (one from an earlier build, or a
      // custom endpoint that is gone) must not fall back to the default here:
      // the stored token or API key belongs to that other endpoint. The
      // background reports it, clears those credentials and resets the key
      // (see storedEndpoint.ts); until then this sends nothing.
      if (!isStoredEndpointConfigured(result) || !isAllowedBaseUrlKey(urls)) {
        storeInLocalStorage(StorageKeys.CHECK_ENDPOINT_SUCCESS, false);
        return;
      }

      // An account token (the signedIn marker; the token itself is only for
      // the background) or an API key.
      if (result[StorageKeys.SIGNED_IN] || X_KEY || apiKeyFromStorage(result)) {
        const response = await backgroundApiRequest({kind: 'auth'});
        if (response.ok) {
          updateConfig(response.data as IAuthResponse, true);
          storeInLocalStorage(StorageKeys.CHECK_ENDPOINT_SUCCESS, true);
        } else {
          storeInLocalStorage(StorageKeys.CHECK_ENDPOINT_SUCCESS, false);
        }
      } else if (STATIC_ACCESS_TOKEN) {
        // No token in storage but a default token is available in config — store and use it.
        storeInLocalStorage(StorageKeys.ACCESS_TOKEN, STATIC_ACCESS_TOKEN);
        storeInLocalStorage(StorageKeys.SIGNED_IN, true);
      }
    })
    .catch((error) => {
      sendErrorToSentry(error);
    });
};

/**
 * Decide sign-in state from a `storage.local.get(null)` snapshot.
 *
 * Reads the `signedIn` marker rather than the access token: the token now lives
 * in `storage.session` and is absent from this snapshot. `ACCESS_TOKEN` is still
 * consulted so installs that have not yet run the migration — or browsers
 * without session storage — keep working.
 */
export const isSignedInResult = (result: any): boolean => {
  if (X_KEY) {
    return true;
  }

  // In API-key mode the key *is* the credential — there is no account and no
  // token. Returning false here would make the extension consider itself signed
  // out and refuse to send any text, which is the correct behaviour for a
  // missing key and wrong for a present one.
  if (getAuthMode(result) === 'apiKey') {
    return !!apiKeyFromStorage(result);
  }

  return !!(
    result[StorageKeys.SIGNED_IN] ||
    result[StorageKeys.ACCESS_TOKEN] ||
    result[StorageKeys.CHECK_ENDPOINT_SUCCESS]
  );
};
