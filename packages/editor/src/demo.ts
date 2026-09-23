import {mount} from './mount';
import {extractText} from './textMap';

/**
 * PoC demo. `?api=` picks the NLP API; the default is a local one. With the
 * e2e suite's mock: `node __tests__/fixtures/server.js`, then
 * `?api=http://localhost:5174/mock-api/`.
 */
const endpoint =
  new URLSearchParams(location.search).get('api') ?? 'http://localhost:8000/';

const extracted = document.querySelector<HTMLElement>('#extracted')!;
const status = document.querySelector<HTMLElement>('#status')!;
const apiKey = document.querySelector<HTMLInputElement>('#api-key')!;
document.querySelector<HTMLElement>('#endpoint')!.textContent = endpoint;

const handle = mount(document.querySelector<HTMLElement>('#editor')!, {
  endpoint,
  content:
    '<p>Hey guys, the chairman will assume the leadership role.</p>' +
    '<ul><li><p>First point</p></li><li><p>Second point</p></li></ul>' +
    '<p>Run <code>guysFn()</code> first.</p>',
  onStatus: (next) => {
    status.textContent =
      next.state === 'idle'
        ? `${next.alerts} alert${next.alerts === 1 ? '' : 's'}`
        : next.state === 'unauthorized'
          ? 'API key missing or rejected'
          : next.message;
  },
});

apiKey.addEventListener('change', () => handle.setApiKey(apiKey.value));

const showExtracted = (): void => {
  // Separators made visible, so block boundaries can be checked by eye.
  extracted.textContent = extractText(handle.editor.state.doc).text.replace(
    /\n/g,
    '⏎\n'
  );
};
handle.editor.on('update', showExtracted);
showExtracted();
