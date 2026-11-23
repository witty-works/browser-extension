import {afterEach, describe, expect, it} from 'vitest';

import {
  buildCheckBody,
  buildRequestHeaders,
  credentialHeaders,
  JSON_HEADERS,
  setApiKey,
  setBaseUrls,
} from '@witty/core/ApiServices/requests';
import {
  apiKeyFromStorage,
  DefaultBaseUrlKey,
  isStoredEndpointConfigured,
  registerCustomEndpoint,
  StorageKeys,
} from '@witty/core/constants';

// The request builders the extension and the editor share: pinned here so a
// change to one product's requests is a visible change to both.

afterEach(() => {
  setApiKey('');
  setBaseUrls('');
  registerCustomEndpoint(null);
});

describe('credentialHeaders', () => {
  it('sends an API key as x-key, and only that', () => {
    expect(credentialHeaders({apiKey: 'k', token: 't'})).toEqual({
      'x-key': 'k',
    });
  });

  it('falls back to a bearer token', () => {
    expect(credentialHeaders({token: 't'})).toEqual({
      Authorization: 'Bearer t',
    });
  });

  it('sends nothing without a credential', () => {
    expect(credentialHeaders({apiKey: '', token: ''})).toEqual({});
  });
});

describe('buildRequestHeaders (extension)', () => {
  it('prefers the runtime API key over the OAuth token', () => {
    setApiKey('user-key');
    expect(buildRequestHeaders('oauth-token')).toEqual({
      ...JSON_HEADERS,
      'x-key': 'user-key',
    });
  });

  it('uses the OAuth token when there is no key', () => {
    expect(buildRequestHeaders('oauth-token')).toEqual({
      ...JSON_HEADERS,
      Authorization: 'Bearer oauth-token',
    });
  });
});

describe('buildRequestHeaders with a stored endpoint that names nothing', () => {
  // The token or key stored with such a key belongs to that other endpoint,
  // while setBaseUrls resolves the URL to the build default.
  it('sends no credential', () => {
    setApiKey('user-key');
    setBaseUrls('GoneEndpoint');
    expect(buildRequestHeaders('oauth-token')).toEqual({...JSON_HEADERS});
  });

  it('sends credentials again once the key names an endpoint', () => {
    setBaseUrls('GoneEndpoint');
    setBaseUrls(DefaultBaseUrlKey);
    expect(buildRequestHeaders('oauth-token')).toEqual({
      ...JSON_HEADERS,
      Authorization: 'Bearer oauth-token',
    });
  });

  it('treats an unset key as the default', () => {
    setBaseUrls('');
    expect(buildRequestHeaders('oauth-token')).toEqual({
      ...JSON_HEADERS,
      Authorization: 'Bearer oauth-token',
    });
  });
});

describe('isStoredEndpointConfigured', () => {
  const custom = {
    api: 'https://api.custom.example/',
    dashboard: '',
    oauth_client_id: '',
    posthog_url: '',
    posthog_key: '',
  };

  it('accepts an unset key and a compiled one', () => {
    expect(isStoredEndpointConfigured({})).toBe(true);
    expect(
      isStoredEndpointConfigured({
        [StorageKeys.API_ENDPOINT_KEY]: DefaultBaseUrlKey,
      })
    ).toBe(true);
  });

  it('accepts Custom only while the custom endpoint has an API URL', () => {
    expect(
      isStoredEndpointConfigured({
        [StorageKeys.API_ENDPOINT_KEY]: 'Custom',
        [StorageKeys.CUSTOM_ENDPOINT]: custom,
      })
    ).toBe(true);
    expect(
      isStoredEndpointConfigured({
        [StorageKeys.API_ENDPOINT_KEY]: 'Custom',
        [StorageKeys.CUSTOM_ENDPOINT]: {...custom, api: ''},
      })
    ).toBe(false);
    expect(
      isStoredEndpointConfigured({[StorageKeys.API_ENDPOINT_KEY]: 'Custom'})
    ).toBe(false);
  });

  it('rejects a key this build does not define', () => {
    expect(
      isStoredEndpointConfigured({
        [StorageKeys.API_ENDPOINT_KEY]: 'GoneEndpoint',
      })
    ).toBe(false);
  });
});

describe('apiKeyFromStorage', () => {
  const keyFor = (endpoint: string) => {
    return {
      [StorageKeys.AUTH_MODE]: 'apiKey',
      [StorageKeys.API_ENDPOINT_KEY]: endpoint,
      [StorageKeys.API_KEY]: {endpoint, value: 'user-key'},
    };
  };

  it('returns the key for a registered custom endpoint', () => {
    expect(
      apiKeyFromStorage({
        ...keyFor('Custom'),
        [StorageKeys.CUSTOM_ENDPOINT]: {api: 'https://api.custom.example/'},
      })
    ).toBe('user-key');
  });

  it('returns nothing once the custom endpoint is gone', () => {
    expect(apiKeyFromStorage(keyFor('Custom'))).toBe('');
    expect(apiKeyFromStorage(keyFor('GoneEndpoint'))).toBe('');
  });
});

describe('buildCheckBody', () => {
  it('leaves out optional fields that were not given', () => {
    expect(buildCheckBody({text: 'Hi', id: 'u', client: 'c'})).toEqual({
      text: 'Hi',
      lang: 'auto',
      id: 'u',
      client: 'c',
    });
  });

  it('includes them as given, empty hashes too', () => {
    expect(
      buildCheckBody({
        text: 'Hi',
        lang: 'de',
        id: 'u',
        client: 'c',
        config: {german_gender_ending: ':in'},
        configHash: '',
        organizationConfigHash: '',
      })
    ).toEqual({
      text: 'Hi',
      lang: 'de',
      id: 'u',
      client: 'c',
      config: {german_gender_ending: ':in'},
      config_hash: '',
      organization_config_hash: '',
    });
  });
});
