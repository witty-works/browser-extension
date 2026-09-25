// A host project's view of the package: compiled against
// dist/witty-editor.d.ts through the package's `exports`
// (`npm run test:types`, after `npm run build`). A type error here, or an
// unused @ts-expect-error, fails the check.
import {
  type EditorStatus,
  type GenderFormatSwitchResult,
  mount,
  type WittyEditorHandle,
} from '@witty-works/editor';

const describe = (status: EditorStatus): string => {
  switch (status.state) {
    case 'idle':
      return `${status.alerts} alerts${status.limitReached ? ', partly' : ''}`;
    case 'outdated':
    case 'error':
      return status.message;
    default:
      return status.state;
  }
};

const handle: WittyEditorHandle = mount(document.createElement('div'), {
  endpoint: 'https://api.example/',
  lang: 'de-CH',
  config: {german_gender_ending: ':in', french_gender_separator: '·'},
  onStatus: (status) => describe(status),
  onSettingsChange: (settings) => settings.config.disabled_categories,
});

handle.setApiKey('key');
handle.updateSettings({llmAlternatives: false, orthography: true});
// @ts-expect-error settings are booleans
handle.updateSettings({llmAlternatives: 'false'});
handle
  .switchGenderFormat('de-e')
  .then((result: GenderFormatSwitchResult) => result.outcome === 'forced');
// The TipTap editor, typed through the optional @tiptap/core peer.
handle.editor.commands.focus();

// @ts-expect-error not a language the API checks
mount(document.createElement('div'), {lang: 'it'});
// @ts-expect-error not a German gender format
handle.setConfig({german_gender_ending: '#in'});
