// @vitest-environment happy-dom
import {describe, expect, it} from 'vitest';

import {computeDiff} from '../../../source/shared/diff';

/** Parse the diff as the popover does and return what it would render. */
const render = (html: string) => {
  const container = document.createElement('div');
  container.innerHTML = html;
  return container;
};

describe('computeDiff', () => {
  it('marks the changed words', () => {
    const html = computeDiff(
      'en',
      'The chairman is here.',
      'The chair is here.'
    );
    const container = render(html);

    expect(container.querySelector('del')?.textContent).toBe('chairman');
    expect(container.querySelector('ins')?.textContent).toBe('chair');
  });

  it('renders markup in the sentence as text, not elements', () => {
    const payload = '<img src=x onerror="alert(1)">';
    const container = render(
      computeDiff(
        'en',
        `Hey guys ${payload} and the chairman.`,
        `Hey team ${payload} and the chair.`
      )
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain(payload);
  });

  it('renders markup in the rewrite as text, not elements', () => {
    const container = render(
      computeDiff(
        'en',
        'Hey guys.',
        'Hey <script>alert(1)</script><b onmouseover="x">team</b>.'
      )
    );

    expect(container.querySelector('script, b')).toBeNull();
    expect(container.querySelector('ins')?.textContent).toContain('<script>');
  });
});
