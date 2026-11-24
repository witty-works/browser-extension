// @vitest-environment happy-dom
import {createElement, Fragment} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it} from 'vitest';

import {renderCuratedHtml, safeHref} from '@witty/ui/curatedHtml';

/** The markup the popover would put on the page for an explanation text. */
const render = (html: string): string =>
  renderToStaticMarkup(createElement(Fragment, null, renderCuratedHtml(html)));

describe('renderCuratedHtml', () => {
  it('keeps the tags curated texts use', () => {
    const html =
      '<h3 style="color:red">Why</h3><p>Use <em>people</em> or <strong>staff</strong>, <i>not</i> <b>men</b>.<br>See below.</p>' +
      '<ul><li>one</li><li><span>two</span></li></ul><ol><li>three</li></ol>' +
      '<div>More on <a href="https://witty.works/en/guide" class="x" style="color:blue">the guide</a>.</div>';
    expect(render(html)).toBe(
      '<h3>Why</h3><p>Use <em>people</em> or <strong>staff</strong>, <i>not</i> <b>men</b>.<br/>See below.</p>' +
        '<ul><li>one</li><li><span>two</span></li></ul><ol><li>three</li></ol>' +
        '<div>More on <a href="https://witty.works/en/guide" target="_blank" rel="noopener noreferrer">the guide</a>.</div>'
    );
  });

  it('drops an iframe and its srcdoc', () => {
    const markup = render(
      '<p>a</p><iframe srcdoc="<script>alert(1)</script>"></iframe><p>b</p>'
    );
    expect(markup).toBe('<p>a</p><p>b</p>');
  });

  it('drops scripts and styles with their content', () => {
    expect(
      render('<p>a<script>alert(1)</script><style>p{color:red}</style></p>')
    ).toBe('<p>a</p>');
  });

  it('keeps the text of a javascript: link but not the link target', () => {
    const markup = render('<a href="javascript:alert(1)">click</a>');
    expect(markup).toBe('<a>click</a>');
    expect(markup).not.toContain('javascript');
  });

  it('drops images and their event handlers', () => {
    const markup = render('<p>x<img src="x" onerror="alert(1)"></p>');
    expect(markup).toBe('<p>x</p>');
  });

  it('unwraps a form to its text', () => {
    const markup = render(
      '<form action="https://evil.example/"><input name="password"><button>Send</button></form>'
    );
    expect(markup).toBe('Send');
  });

  it('drops meta refresh and base', () => {
    const markup = render(
      '<meta http-equiv="refresh" content="0;url=https://evil.example/"><base href="https://evil.example/"><p>ok</p>'
    );
    expect(markup).toBe('<p>ok</p>');
  });

  it('drops event handlers on allowed tags', () => {
    const markup = render(
      '<p onclick="alert(1)" id="x"><span onmouseover="alert(1)">t</span></p>'
    );
    expect(markup).toBe('<p><span>t</span></p>');
  });

  it('renders plain text and the empty string', () => {
    expect(render('just text')).toBe('just text');
    expect(render('')).toBe('');
  });
});

describe('safeHref', () => {
  it('accepts http, https and mailto', () => {
    expect(safeHref('https://witty.works/')).toBe('https://witty.works/');
    expect(safeHref('http://witty.works/')).toBe('http://witty.works/');
    expect(safeHref('mailto:hello@witty.works')).toBe(
      'mailto:hello@witty.works'
    );
  });

  it('rejects other schemes, relative and missing targets', () => {
    expect(safeHref(' javascript:alert(1)')).toBeUndefined();
    expect(safeHref('JaVaScRiPt:alert(1)')).toBeUndefined();
    expect(
      safeHref('data:text/html,<script>alert(1)</script>')
    ).toBeUndefined();
    expect(safeHref('/relative')).toBeUndefined();
    expect(safeHref('')).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });
});
