// @vitest-environment happy-dom
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {CATEGORIES, CONFIG_OPTIONS} from '@witty/test-fixtures/mockApi';
import type {Alert} from './checkPlugin';
import type {CheckConfig} from './checkClient';
import {
  bulkEdits,
  decideSwitch,
  hasFormsOutside,
  noSwitchReason,
  switchRequestConfig,
} from './genderSwitch';
import {type EditorStatus, mount, type WittyEditorHandle} from './mount';

const SUBCATEGORY = 'gendered_denominations_ending_advanced';

const alert = (data: Record<string, unknown>): Alert =>
  ({
    from: 1,
    to: 2,
    id: 1,
    detail: {data: {subcategory: SUBCATEGORY, alternatives: [], ...data}},
  }) as unknown as Alert;

describe('switchRequestConfig', () => {
  it('switches the gender-format alerts on without touching the rest', () => {
    const {config, needed} = switchRequestConfig(
      {
        disabled_categories: [SUBCATEGORY, 'gendered_nouns'],
        gendered_roles_format: 'none',
      },
      ':in'
    );

    expect(config).toEqual({
      disabled_categories: ['gendered_nouns'],
      gendered_roles_format: 'inclusive_gender',
      german_gender_ending: ':in',
    });
    expect(needed).toBe(true);
  });

  it('is not needed when the alerts are on already', () => {
    const {needed, config} = switchRequestConfig({}, '*in');
    expect(needed).toBe(false);
    expect(config).not.toHaveProperty('disabled_categories');
  });
});

describe('bulkEdits', () => {
  const one = [{text: 'Lehrer:innen'}];
  const several = [
    {text: 'Lehrkraft'},
    {text: 'Die:der Lehrer:in'},
    {text: 'Der Lehrer oder die Lehrerin'},
  ];
  const texts = (alerts: Alert[]) => bulkEdits(alerts).map(({text}) => text);

  it('applies the alternative bulk_alternative names', () => {
    expect(
      texts([
        alert({
          bulk: 'gender_format',
          alternatives: several,
          bulk_alternative: 1,
        }),
        alert({bulk: 'gender_format', alternatives: one, bulk_alternative: 0}),
      ])
    ).toEqual(['Die:der Lehrer:in', 'Lehrer:innen']);
  });

  it('skips an index out of range, or missing with several alternatives', () => {
    expect(
      texts([
        alert({
          bulk: 'gender_format',
          alternatives: several,
          bulk_alternative: 3,
        }),
        alert({
          bulk: 'gender_format',
          alternatives: several,
          bulk_alternative: -1,
        }),
        alert({
          bulk: 'gender_format',
          alternatives: several,
          bulk_alternative: 1.5,
        }),
        alert({bulk: 'gender_format', alternatives: several}),
        alert({
          bulk: 'gender_format',
          alternatives: several,
          bulk_alternative: null,
        }),
        alert({
          bulk: 'gender_format',
          alternatives: [{remove: true}, ...several],
          bulk_alternative: 0,
        }),
      ])
    ).toEqual([]);
  });

  it('takes the only alternative from an API without bulk_alternative', () => {
    expect(texts([alert({bulk: 'gender_format', alternatives: one})])).toEqual([
      'Lehrer:innen',
    ]);
  });

  it('takes only the gender_format group', () => {
    expect(
      texts([
        alert({bulk: 'something_new', alternatives: one, bulk_alternative: 0}),
        alert({alternatives: one}),
      ])
    ).toEqual([]);
  });
});

describe('noSwitchReason', () => {
  it('knows an API without bulk alerts', () => {
    expect(
      noSwitchReason('Lehrer*innen', ':in', [
        alert({alternatives: [{text: 'Lehrer:innen'}]}),
      ])
    ).toBe('unsupported');
  });

  it('sees alerts kept off when the text has other forms', () => {
    expect(noSwitchReason('Die Lehrer*innen', ':in', [])).toBe('disabled');
  });

  it('has nothing to do for a text in the target format', () => {
    expect(noSwitchReason('Die Lehrer:innen', ':in', [])).toBe('nothing');
    expect(noSwitchReason('Hallo', ':in', [])).toBe('nothing');
  });

  it.each([
    ['Lehrer*innen', '*in'],
    ['Lehrer/-in', '/-in'],
    ['Lehrer/innen', '/in'],
    ['LehrerInnen', 'In'],
    ['Lehrer(innen)', '()'],
    ['Lehrer(-in)', '(-)'],
    ['Lehrer_in', '_in'],
  ])('reads %s as %s', (text, format) => {
    expect(hasFormsOutside(text, format)).toBe(false);
    expect(hasFormsOutside(text, ':in')).toBe(true);
  });
});

describe('decideSwitch', () => {
  const bulk = alert({bulk: 'gender_format', alternatives: [{text: ':innen'}]});

  it('applies nothing when the API applied another format', () => {
    expect(
      decideSwitch(
        {separators: ['In'], bulkActions: [['gender_format']]},
        ':in',
        'Lehrer*innen',
        [bulk]
      )
    ).toEqual({outcome: 'forced', applied: 'In'});
  });

  it('applies the bulk alerts', () => {
    expect(
      decideSwitch(
        {separators: [':in'], bulkActions: [['gender_format']]},
        ':in',
        'Lehrer*innen',
        [bulk]
      )
    ).toEqual({
      outcome: 'switched',
      apply: [{from: 1, to: 2, text: ':innen'}],
    });
  });

  it('reads bulk_actions for why nothing was switched', () => {
    const decide = (bulkActions: (string[] | undefined)[]) =>
      decideSwitch({separators: [], bulkActions}, ':in', 'Lehrer*innen', [])
        .outcome;

    expect(decide([['gender_format']])).toBe('nothing');
    expect(decide([[]])).toBe('disabled');
    // Without bulk_actions, the guess from the text.
    expect(decide([undefined])).toBe('disabled');
    expect(decide([])).toBe('disabled');
  });
});

// A stand-in for the NLP API: every `*in`/`*innen` form is an alert in the
// gender-format subcategory, converted to the requested format.
let bodies: {text: string; config?: CheckConfig}[];
let api: {
  bulk: string | null;
  honoursConfig: boolean;
  /** Sends `bulk_actions`, as APIs after 2.4.8 do. */
  bulkActions: boolean;
  /** A format the account forces, whatever the request asks for. */
  forced: string | null;
  /** `bulk_alternative` of the generic masculine "Der Lehrer"; left out if undefined. */
  roleIndex: number | undefined;
};
let handle: WittyEditorHandle | undefined;
let statuses: EditorStatus[];

const applied = (config: CheckConfig = {}) =>
  api.forced ?? config.german_gender_ending ?? '*in';
const switchable = (config: CheckConfig = {}) =>
  api.honoursConfig && !config.disabled_categories?.includes(SUBCATEGORY);

const genderResults = (text: string, config: CheckConfig = {}) => {
  const target = applied(config);
  if (!switchable(config) || target === '*in') return [];
  const results: Record<string, unknown>[] = [
    ...text.matchAll(/\p{L}+\*in(?:nen)?/gu),
  ].map((match) => {
    return {
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      category: 'gendered',
      subcategory: SUBCATEGORY,
      alternatives: [
        {
          text:
            target === 'In'
              ? match[0].replace('*i', 'I')
              : match[0].replace('*', target.slice(0, -2)),
          remove: false,
        },
      ],
      explanation: {text: 'Gender format', long_text: ''},
      label: 'Gender format',
      gravity: 1,
      language: 'de',
      source: {text: '', url: ''},
      ...(api.bulk ? {bulk: api.bulk} : {}),
    };
  });
  // A role in the generic masculine: several alternatives, one for the switch.
  const role = text.indexOf('Der Lehrer ');
  if (role >= 0) {
    const separator = target.slice(0, -2);
    results.push({
      ...results[0],
      text: 'Der Lehrer',
      start: role,
      end: role + 10,
      subcategory: 'gendered_roles',
      alternatives: [
        {text: 'Die Lehrkraft', remove: false},
        {text: `Die${separator}der Lehrer${separator}in`, remove: false},
        {text: 'Der Lehrer oder die Lehrerin', remove: false},
      ],
      ...(api.roleIndex === undefined ? {} : {bulk_alternative: api.roleIndex}),
    });
  }
  // Not part of the switch, whatever the server calls it.
  const other = text.indexOf('Chef');
  if (other >= 0) {
    results.push({
      ...results[0],
      text: 'Chef',
      start: other,
      end: other + 4,
      subcategory: 'gendered_nouns',
      alternatives: [{text: 'Leitung', remove: false}],
      ...(api.bulk ? {bulk: 'some_future_group'} : {}),
    });
  }
  return results;
};

beforeEach(() => {
  bodies = [];
  statuses = [];
  api = {
    bulk: 'gender_format',
    honoursConfig: true,
    bulkActions: true,
    forced: null,
    roleIndex: 1,
  };
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
      return new Response(
        JSON.stringify({
          results: genderResults(body.text, body.config),
          language: 'de',
          limit_reached: false,
          gender_separator: applied(body.config),
          ...(api.bulkActions
            ? {
                bulk_actions: switchable(body.config) ? ['gender_format'] : [],
              }
            : {}),
        })
      );
    })
  );
});

afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});

const TEXT = 'Die Lehrer*innen und der Chef. Alle Schüler*innen kommen.';

const mountEditor = (options: Parameters<typeof mount>[1] = {}) => {
  const element = document.createElement('div');
  document.body.append(element);
  handle = mount(element, {
    endpoint: 'https://api.example/',
    content: `<p>${TEXT}</p>`,
    lang: 'de',
    delay: 0,
    onStatus: (status) => statuses.push(status),
    ...options,
  });
  return handle;
};

const liveRegion = () =>
  document.querySelector('.witty-editor-toolbar ~ [role="status"]');

const tool = (label: string) =>
  document.querySelector<HTMLButtonElement>(
    `.witty-editor-toolbar button[aria-label="${label}"]`
  )!;
const menuItems = () => [
  ...document.querySelectorAll<HTMLElement>('[role="menu"] [role="menuitem"]'),
];
const menuItem = (label: string) =>
  menuItems().find((item) => item.textContent?.startsWith(label))!;
const key = (target: Element, name: string) =>
  target.dispatchEvent(
    new KeyboardEvent('keydown', {key: name, bubbles: true})
  );

const openMenu = async () => {
  await vi.waitFor(() => expect(tool('Witty menu')).not.toBeNull());
  tool('Witty menu').click();
  await vi.waitFor(() => expect(menuItems()).toHaveLength(4));
};

describe('switchGenderFormat', () => {
  it('applies exactly the bulk alerts, undone in one step', async () => {
    const editor = mountEditor();
    await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0));

    const result = await editor.switchGenderFormat(':in');

    expect(result).toEqual({
      outcome: 'switched',
      target: ':in',
      count: 2,
      limitReached: false,
    });
    expect(editor.getText()).toBe(
      'Die Lehrer:innen und der Chef. Alle Schüler:innen kommen.'
    );
    expect(editor.getSettings().config.german_gender_ending).toBe(':in');
    expect(statuses.at(-1)).toMatchObject({genderFormatSwitch: result});
    await vi.waitFor(() =>
      expect(liveRegion()?.textContent).toBe(
        'Switched 2 forms to Colon, f.e Expert:in.'
      )
    );

    editor.editor.commands.undo();
    expect(editor.getText()).toBe(TEXT);
  });

  it('genders a generic masculine with the alternative the API names', async () => {
    const editor = mountEditor({
      content: '<p>Der Lehrer kommt. Die Schüler*innen warten.</p>',
    });

    const result = await editor.switchGenderFormat(':in');

    expect(editor.getText()).toBe(
      'Die:der Lehrer:in kommt. Die Schüler:innen warten.'
    );
    expect(result.count).toBe(2);
    editor.editor.commands.undo();
    expect(editor.getText()).toBe(
      'Der Lehrer kommt. Die Schüler*innen warten.'
    );
  });

  it.each([[5], [undefined]])(
    'leaves a generic masculine with bulk_alternative %s alone',
    async (index) => {
      api.roleIndex = index;
      const editor = mountEditor({
        content: '<p>Der Lehrer kommt. Die Schüler*innen warten.</p>',
      });

      const result = await editor.switchGenderFormat(':in');

      expect(editor.getText()).toBe(
        'Der Lehrer kommt. Die Schüler:innen warten.'
      );
      expect(result.count).toBe(1);
    }
  );

  it('waits for every batch of a long text', async () => {
    const sentences = Array.from(
      {length: 6},
      (_, i) => `Satz ${i} nennt die Lehrer*innen.`
    );
    const editor = mountEditor({
      content: `<p>${sentences.join(' ')}</p>`,
      maxRequestLength: 60,
    });
    await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    const before = bodies.length;

    const result = await editor.switchGenderFormat('_in');

    // One request can't hold the text: the switch saw all of it anyway.
    expect(bodies.length - before).toBeGreaterThan(2);
    expect(result.count).toBe(6);
    expect(editor.getText()).not.toContain('*');
  });

  it('switches what was checked and says part of the text was not', async () => {
    const editor = mountEditor({maxTextLength: 31});

    const result = await editor.switchGenderFormat(':in');

    expect(result).toMatchObject({count: 1, limitReached: true});
    expect(editor.getText()).toBe(
      'Die Lehrer:innen und der Chef. Alle Schüler*innen kommen.'
    );
    await vi.waitFor(() =>
      expect(liveRegion()?.textContent).toBe(
        'Switched 1 form to Colon, f.e Expert:in. Only part of this text was checked.'
      )
    );
  });

  it('asks for the alerts the account turned off, without changing its settings', async () => {
    const config: CheckConfig = {
      disabled_categories: [SUBCATEGORY],
      gendered_roles_format: 'none',
    };
    const editor = mountEditor({config});
    await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0));

    const result = await editor.switchGenderFormat(':in');

    expect(result.count).toBe(2);
    expect(
      bodies.some((body) => body.config?.disabled_categories?.length)
    ).toBe(true);
    const switchBody = bodies.find(
      (body) => body.config?.gendered_roles_format === 'inclusive_gender'
    );
    expect(switchBody?.config).toEqual({
      disabled_categories: [],
      gendered_roles_format: 'inclusive_gender',
      german_gender_ending: ':in',
    });
    expect(editor.getSettings().config).toEqual({
      ...config,
      german_gender_ending: ':in',
    });
    // Back to the user's own config for the underlines.
    await vi.waitFor(() =>
      expect(bodies.at(-1)?.config).toEqual({
        ...config,
        german_gender_ending: ':in',
      })
    );
  });

  it('changes nothing when the account forces another format', async () => {
    api.forced = 'In';
    const editor = mountEditor({config: {german_gender_ending: '*in'}});
    await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0));

    const result = await editor.switchGenderFormat(':in');

    expect(result).toEqual({
      outcome: 'forced',
      target: ':in',
      count: 0,
      limitReached: false,
      applied: 'In',
    });
    expect(editor.getText()).toBe(TEXT);
    expect(editor.getSettings().config).toEqual({german_gender_ending: '*in'});
    await vi.waitFor(() =>
      expect(liveRegion()?.textContent).toBe(
        'Your organisation sets the gender format to Binnen-I, f.e ExpertIn. The text was not changed.'
      )
    );
  });

  it('notices a forced format with the text checked already', async () => {
    api.forced = 'In';
    // The same config the switch asks with: every sentence is cached.
    const config: CheckConfig = {
      german_gender_ending: ':in',
      gendered_roles_format: 'inclusive_gender',
    };
    const editor = mountEditor({config});
    await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    await vi.waitFor(() =>
      expect(statuses.at(-1)).toMatchObject({state: 'idle'})
    );

    expect((await editor.switchGenderFormat(':in')).outcome).toBe('forced');
    expect(editor.getText()).toBe(TEXT);
  });

  it('switches to the format the account forces', async () => {
    api.forced = 'In';
    const editor = mountEditor({config: {german_gender_ending: 'In'}});
    await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0));

    // Already underlined for In: the switch checks afresh all the same.
    const result = await editor.switchGenderFormat('In');

    expect(result.outcome).toBe('switched');
    expect(editor.getText()).toContain('LehrerInnen');
  });

  it('says so when the account keeps the switch off', async () => {
    api.honoursConfig = false;
    const editor = mountEditor();

    const result = await editor.switchGenderFormat(':in');

    expect(result.outcome).toBe('disabled');
    expect(editor.getText()).toBe(TEXT);
    await vi.waitFor(() =>
      expect(liveRegion()?.textContent).toBe(
        'Switching the gender format is turned off for this account.'
      )
    );
  });

  it('guesses a disabled switch on an API without bulk_actions', async () => {
    api.honoursConfig = false;
    api.bulkActions = false;
    const editor = mountEditor();

    expect((await editor.switchGenderFormat(':in')).outcome).toBe('disabled');
  });

  it('says when nothing needed changing', async () => {
    const editor = mountEditor({content: '<p>Die Lehrer:innen.</p>'});

    const result = await editor.switchGenderFormat(':in');

    expect(result.outcome).toBe('nothing');
    await vi.waitFor(() =>
      expect(liveRegion()?.textContent).toBe(
        'Nothing to switch: the text already uses Colon, f.e Expert:in.'
      )
    );
  });

  it('ignores bulk groups it does not know', async () => {
    api.bulk = 'gender_format_v2';
    const editor = mountEditor();

    const result = await editor.switchGenderFormat(':in');

    expect(result.count).toBe(0);
    expect(editor.getText()).toBe(TEXT);
  });

  it('trusts bulk_actions over gender-format alerts without bulk', async () => {
    // Guessing from the alerts would call this API unsupported.
    api.bulk = null;
    const editor = mountEditor();

    expect((await editor.switchGenderFormat(':in')).outcome).toBe('nothing');
    await openMenu();
    expect(
      menuItem('Switch gender format').getAttribute('aria-disabled')
    ).toBeNull();
  });

  it('knows an API without bulk alerts, and says so in the menu', async () => {
    api.bulk = null;
    api.bulkActions = false;
    const editor = mountEditor();

    expect((await editor.switchGenderFormat(':in')).outcome).toBe(
      'unsupported'
    );
    expect(editor.getText()).toBe(TEXT);

    await openMenu();
    const entry = menuItem('Switch gender format');
    expect(entry.getAttribute('aria-disabled')).toBe('true');
    expect(entry.textContent).toContain(
      "The server doesn't support switching the gender format yet."
    );
  });

  it('does not switch to the Inklusivum', async () => {
    const editor = mountEditor();
    await vi.waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    const before = bodies.length;

    expect((await editor.switchGenderFormat('de-e')).outcome).toBe(
      'unavailable'
    );
    expect(bodies).toHaveLength(before);
    expect(editor.getSettings().config).toEqual({});
  });

  it('keeps its message until the next edit', async () => {
    const editor = mountEditor();
    await editor.switchGenderFormat(':in');
    await vi.waitFor(() =>
      expect(liveRegion()?.textContent).toContain('Switched 2 forms')
    );

    editor.editor.commands.insertContent('!');

    await vi.waitFor(() =>
      expect(liveRegion()?.textContent).not.toContain('Switched')
    );
  });
});

describe('W menu', () => {
  it('opens from the keyboard and moves with the arrow keys', async () => {
    mountEditor();
    await vi.waitFor(() => expect(tool('Witty menu')).not.toBeNull());
    const button = tool('Witty menu');
    expect(button.getAttribute('aria-haspopup')).toBe('menu');

    button.focus();
    key(button, 'ArrowDown');

    await vi.waitFor(() =>
      expect(document.activeElement).toBe(menuItem('Settings'))
    );
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(menuItems().map((item) => item.textContent)).toEqual([
      'Settings…',
      'Switch gender format…',
      'Help',
      'About Witty',
    ]);

    key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(menuItem('Switch gender format'));
    key(document.activeElement!, 'End');
    expect(document.activeElement).toBe(menuItem('About'));
    key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(menuItem('Settings'));
    key(document.activeElement!, 'ArrowUp');
    expect(document.activeElement).toBe(menuItem('About'));
    key(document.activeElement!, 'Home');
    expect(document.activeElement).toBe(menuItem('Settings'));
  });

  it('closes on Escape and returns focus to the W icon', async () => {
    mountEditor();
    await openMenu();

    key(menuItem('Settings'), 'Escape');

    await vi.waitFor(() => expect(menuItems()).toHaveLength(0));
    expect(document.activeElement).toBe(tool('Witty menu'));
    expect(tool('Witty menu').getAttribute('aria-expanded')).toBe('false');
  });

  it('closes when focus leaves it', async () => {
    mountEditor();
    await openMenu();

    menuItem('Settings').dispatchEvent(
      new FocusEvent('focusout', {bubbles: true, relatedTarget: null})
    );

    await vi.waitFor(() => expect(menuItems()).toHaveLength(0));
  });

  it('links to the help and the website in a new tab', async () => {
    mountEditor();
    await openMenu();

    const help = menuItem('Help') as HTMLAnchorElement;
    expect(help.href).toBe(
      'https://www.witty.works/en/help/how-do-i-use-the-witty-editor'
    );
    expect(help.target).toBe('_blank');
    expect(help.rel).toBe('noopener noreferrer');
    expect((menuItem('About') as HTMLAnchorElement).href).toBe(
      'https://www.witty.works/'
    );
  });

  it('switches the format from its panel', async () => {
    const editor = mountEditor();
    await openMenu();
    menuItem('Switch gender format').click();

    const formats = await vi.waitFor(() => {
      const buttons = [
        ...document.querySelectorAll<HTMLButtonElement>(
          '.witty-editor-switch-format'
        ),
      ];
      expect(buttons).toHaveLength(9);
      return buttons;
    });
    const labels = formats.map((button) => button.textContent);
    expect(labels[0]).toBe('Slash, f.e Expert/in');
    expect(labels[3]).toBe('Genderstar, f.e Expert*in');
    const inklusivum = formats[8];
    expect(inklusivum.textContent).toBe('Inklusivum, f.e Experte');
    expect(inklusivum.getAttribute('aria-disabled')).toBe('true');
    inklusivum.click();
    expect(editor.getSettings().config).toEqual({});

    formats[4].click(); // Colon

    await vi.waitFor(() =>
      expect(
        document.querySelector('.witty-editor-switch-result')?.textContent
      ).toBe('Switched 2 forms to Colon, f.e Expert:in.')
    );
    expect(editor.getText()).toContain('Lehrer:innen');
    await vi.waitFor(() =>
      expect(formats[4].getAttribute('aria-current')).toBe('true')
    );

    // Shown in the panel, announced by one live region only.
    const announcing = [
      ...document.querySelectorAll(
        '[aria-live], [role="status"], [role="alert"]'
      ),
    ].filter((region) => region.textContent?.includes('Switched'));
    expect(announcing).toEqual([liveRegion()]);
  });
});
