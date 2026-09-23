import {afterEach, describe, expect, it} from 'vitest';

import {
  buildCheckBody,
  buildRequestHeaders,
  credentialHeaders,
  JSON_HEADERS,
  setApiKey,
} from '@witty/core/ApiServices/requests';

// The request builders the extension and the editor share: pinned here so a
// change to one product's requests is a visible change to both.

afterEach(() => {
  setApiKey('');
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
