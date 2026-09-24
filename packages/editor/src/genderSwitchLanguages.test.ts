// @vitest-environment happy-dom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {CATEGORIES, CONFIG_OPTIONS} from '@witty/test-fixtures/mockApi';
import type {CheckConfig} from './checkClient';
import {mount, type WittyEditorHandle} from './mount';

/**
 * "Switch gender format…" for French texts and into the Inklusivum, against a
 * stand-in for the NLP API that tells French batches from German ones.
 */
const SUBCATEGORY = 'gendered_denominations_ending_advanced';

// French plural endings per `french_gender_separator`.
const FRENCH_ENDINGS: Record<string, string> = {
  '·': '·es',
  '·s': '·e·s',
  '.': '.es',
  '.s': '.e.s',
  '/': '/es',
  '/s': '/e/s',
};
const FRENCH_FORM = /(\p{L}+?)(\.e\.s|·e·s|·es|\.es|\/e\/s|\/es)(?!\p{L})/gu;
const GERMAN_FORM = /(\p{L}+)([*:])innen/gu;

let api: {
  /** Deployed: French requests get bulk alerts and `bulk_actions`. */
  french: boolean;
  /** Deployed: switching into the Inklusivum. */
  inklusivum: boolean;
  /** A French format the account forces. */
  forcedFrench: string | null;
};
let bodies: {text: string; config?: CheckConfig}[];
let handle: WittyEditorHandle | undefined;

const languageOf = (text: string) =>
  /\b(les|et|sont|le|la)\b/.test(text) ? 'fr' : 'de';

const alertFor = (
  text: string,
  start: number,
  alternatives: string[],
  bulkAlternative: number,
  language: string
) => {
  return {
    text,
    start,
    end: start + text.length,
    category: 'gendered',
    subcategory: SUBCATEGORY,
    alternatives: alternatives.map((alternative) => {
      return {
        text: alternative,
        remove: false,
      };
    }),
    explanation: {text: 'Gender format', long_text: ''},
    label: 'Gender format',
    gravity: 1,
    language,
    source: {text: '', url: ''},
    bulk: 'gender_format',
    bulk_alternative: bulkAlternative,
  };
};

const enabled = (config: CheckConfig = {}) =>
  config.gendered_roles_format !== 'none' &&
  !config.disabled_categories?.includes(SUBCATEGORY);

const respond = (text: string, config: CheckConfig = {}) => {
  if (languageOf(text) === 'fr') {
    const target = api.forcedFrench ?? config.french_gender_separator ?? '·';
    const on = api.french && enabled(config);
    const results = [];
    if (on) {
      for (const match of text.matchAll(FRENCH_FORM)) {
        if (match[2] === FRENCH_ENDINGS[target]) continue;
        results.push(
          alertFor(
            match[0],
            match.index,
            [match[1] + FRENCH_ENDINGS[target]],
            0,
            'fr'
          )
        );
      }
      // A doublet: one alert over all of it; the switch's alternative second.
      for (const match of text.matchAll(/(les|Les) (\p{L}+)es et les \2s/gu)) {
        results.push(
          alertFor(
            match[0],
            match.index,
            [
              'le personnel',
              `${match[1]} ${match[2]}${FRENCH_ENDINGS[target]}`,
            ],
            1,
            'fr'
          )
        );
      }
    }
    return {
      results,
      language: 'fr',
      limit_reached: false,
      gender_separator: target,
      bulk_actions: on ? ['gender_format'] : [],
    };
  }

  const target = config.german_gender_ending ?? '*in';
  const on = enabled(config) && (target !== 'de-e' || api.inklusivum);
  const results = [];
  if (on) {
    for (const match of text.matchAll(GERMAN_FORM)) {
      if (`${match[2]}in` === target) continue;
      const converted =
        target === 'de-e'
          ? `${match[1]}ne`
          : `${match[1]}${target.slice(0, -2)}innen`;
      results.push(alertFor(match[0], match.index, [converted], 0, 'de'));
    }
  }
  return {
    results,
    language: 'de',
    limit_reached: false,
    gender_separator: target,
    bulk_actions: on ? ['gender_format'] : [],
  };
};

beforeEach(() => {
  bodies = [];
  api = {french: true, inklusivum: true, forcedFrench: null};
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/v2.0/categories')) {
        return new Response(JSON.stringify(CATEGORIES));
      }
      if (url.includes('/v2.0/config-options')) {
        return new Response(JSON.stringify(CONFIG_OPTIONS));
      }
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      return new Response(JSON.stringify(respond(body.text, body.config)));
    })
  );
});

afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const mountEditor = (
  content: string,
  options: Parameters<typeof mount>[1] = {}
) => {
  const element = document.createElement('div');
  document.body.append(element);
  handle = mount(element, {
    endpoint: 'https://api.example/',
    content: `<p>${content}</p>`,
    delay: 0,
    // One sentence per request, so each batch has one language.
    maxRequestLength: 40,
    ...options,
  });
  return handle;
};

const checked = () =>
  vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0));

const liveRegion = () =>
  document.querySelector('.witty-editor-toolbar ~ [role="status"]');

const tool = (label: string) =>
  document.querySelector<HTMLButtonElement>(
    `.witty-editor-toolbar button[aria-label="${label}"]`
  )!;

/** Opens "Switch gender format…" and returns its format buttons. */
const openSwitchPanel = async () => {
  await vi.waitFor(() => expect(tool('Witty menu')).not.toBeNull());
  tool('Witty menu').click();
  const entry = await vi.waitFor(() => {
    const item = [
      ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].find((element) => element.textContent?.startsWith('Switch gender'));
    expect(item).toBeDefined();
    return item!;
  });
  entry.click();
  return vi.waitFor(() => {
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>(
        '.witty-editor-switch-format'
      ),
    ];
    expect(buttons.length).toBeGreaterThan(0);
    return buttons;
  });
};

const headings = () =>
  [...document.querySelectorAll('.witty-editor-switch h3')].map(
    (heading) => heading.textContent
  );

describe('the Inklusivum', () => {
  it('is offered and applied', async () => {
    const editor = mountEditor('Die Lehrer*innen kommen.');
    await checked();

    const formats = await openSwitchPanel();
    const inklusivum = formats.at(-1)!;
    expect(inklusivum.textContent).toBe('Inklusivum, f.e Experte');
    expect(inklusivum.getAttribute('aria-disabled')).toBeNull();
    expect(
      document.getElementById(inklusivum.getAttribute('aria-describedby')!)
        ?.textContent
    ).toContain('Compounds');

    const result = await editor.switchGenderFormat('de-e');

    expect(result).toMatchObject({outcome: 'switched', count: 1});
    expect(editor.getText()).toBe('Die Lehrerne kommen.');
    expect(editor.getSettings().config.german_gender_ending).toBe('de-e');
  });

  it('says that switching out of it is not supported yet', async () => {
    const editor = mountEditor('Die Lehrerne kommen.', {
      config: {german_gender_ending: 'de-e'},
    });
    await checked();

    const result = await editor.switchGenderFormat(':in');

    expect(result.outcome).toBe('fromInklusivum');
    await vi.waitFor(() =>
      expect(liveRegion()?.textContent).toBe(
        "Nothing switched: switching out of the Inklusivum isn't supported yet."
      )
    );
  });

  it('is unsupported where bulk_actions leaves it out', async () => {
    api.inklusivum = false;
    const editor = mountEditor('Die Lehrer*innen kommen.');
    await checked();

    const result = await editor.switchGenderFormat('de-e');

    expect(result.outcome).toBe('unsupported');
    expect(editor.getText()).toBe('Die Lehrer*innen kommen.');
    await vi.waitFor(() =>
      expect(liveRegion()?.textContent).toBe(
        "The server can't switch to Inklusivum, f.e Experte yet."
      )
    );
    // Marked in the panel; the other formats stay available.
    const formats = await openSwitchPanel();
    expect(formats.at(-1)!.getAttribute('aria-disabled')).toBe('true');
    expect(formats[4].getAttribute('aria-disabled')).toBeNull();
  });
});

describe('French', () => {
  const FRENCH = 'Les enseignant.e.s sont prêt.e.s.';

  it('offers the French formats for a French text', async () => {
    mountEditor(FRENCH);
    await checked();
    await vi.waitFor(() => expect(bodies.at(-1)?.text).toContain('enseignant'));

    const formats = await openSwitchPanel();

    expect(formats.map((button) => button.textContent)).toEqual([
      'Point médian, f.e. expert·es',
      '·s',
      '.',
      '.s',
      '/',
      '/s',
    ]);
    expect(headings()).toEqual([]);
  });

  it('offers the French formats when the host fixed the language', async () => {
    mountEditor('Hello there.', {lang: 'fr'});
    await checked();

    expect(await openSwitchPanel()).toHaveLength(6);
  });

  it('switches French, leaving the German setting alone', async () => {
    const editor = mountEditor(FRENCH, {
      config: {german_gender_ending: ':in'},
    });
    await checked();

    const result = await editor.switchGenderFormat('·');

    expect(result).toMatchObject({outcome: 'switched', count: 2});
    expect(editor.getText()).toBe('Les enseignant·es sont prêt·es.');
    expect(editor.getSettings().config).toEqual({
      german_gender_ending: ':in',
      french_gender_separator: '·',
    });
    const switchBody = bodies.find(
      (body) => body.config?.gendered_roles_format === 'inclusive_gender'
    );
    expect(switchBody?.config?.french_gender_separator).toBe('·');
  });

  it('applies a doublet as one alert', async () => {
    const editor = mountEditor('Les enseignantes et les enseignants.');
    await checked();

    const result = await editor.switchGenderFormat('/');

    expect(result.count).toBe(1);
    expect(editor.getText()).toBe('Les enseignant/es.');
  });

  it('changes nothing when the account forces another French format', async () => {
    api.forcedFrench = '/';
    const editor = mountEditor(FRENCH);
    await checked();

    const result = await editor.switchGenderFormat('·');

    expect(result).toMatchObject({outcome: 'forced', applied: '/'});
    expect(editor.getText()).toBe(FRENCH);
    expect(editor.getSettings().config).toEqual({});
  });

  it('is unsupported where bulk_actions is empty', async () => {
    api.french = false;
    const editor = mountEditor(FRENCH);
    await checked();

    expect((await editor.switchGenderFormat('·')).outcome).toBe('unsupported');
    expect(editor.getText()).toBe(FRENCH);
    const formats = await openSwitchPanel();
    expect(
      formats.every((button) => button.getAttribute('aria-disabled') === 'true')
    ).toBe(true);
  });
});

describe('a mixed document', () => {
  // German with a colon form, which a German switch to *in would change;
  // French in the "." format.
  const MIXED =
    'Die Lehrer:innen kommen. Les enseignant.e.s sont là. Die Schüler:innen auch.';

  it('offers both groups, the language of most of the text first', async () => {
    mountEditor(MIXED);
    await checked();
    await vi.waitFor(() =>
      expect(bodies.some((body) => body.text.includes('enseignant'))).toBe(true)
    );

    const formats = await openSwitchPanel();

    expect(headings()).toEqual(['German', 'French']);
    expect(formats).toHaveLength(9 + 6);
  });

  it('applies only the switched language', async () => {
    const editor = mountEditor(MIXED, {
      config: {german_gender_ending: '*in'},
    });
    await checked();

    const french = await editor.switchGenderFormat('·s');

    expect(french.count).toBe(1);
    expect(editor.getText()).toBe(
      'Die Lehrer:innen kommen. Les enseignant·e·s sont là. Die Schüler:innen auch.'
    );

    const german = await editor.switchGenderFormat('_in');

    expect(german.count).toBe(2);
    expect(editor.getText()).toBe(
      'Die Lehrer_innen kommen. Les enseignant·e·s sont là. Die Schüler_innen auch.'
    );
  });
});
