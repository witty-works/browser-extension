import React from 'react';
import parse, {
  domToReact,
  type DOMNode,
  type Element,
  type HTMLReactParserOptions,
} from 'html-react-parser';

/**
 * The tags the curated explanation texts from the API use. Everything else is
 * unwrapped to its text, so a stray or hostile tag cannot add behaviour to
 * the page the popover is shown on (an iframe, a form, a meta refresh, a base
 * URL, an event handler).
 */
const ALLOWED_TAGS = new Set([
  'p',
  'br',
  'em',
  'strong',
  'i',
  'b',
  'ul',
  'ol',
  'li',
  'a',
  'span',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
]);

/** Tags removed together with their content, which is code or not text. */
const DROPPED_WITH_CONTENT = new Set([
  'script',
  'style',
  'template',
  'noscript',
  'iframe',
  'object',
  'embed',
  'textarea',
  'select',
  'title',
  'svg',
  'math',
]);

const LINK_PROTOCOLS = new Set(['https:', 'http:', 'mailto:']);

/** The link target if it is an absolute http(s) or mailto URL, else undefined. */
export const safeHref = (href: string | undefined): string | undefined => {
  if (!href) return undefined;
  try {
    const url = new URL(href.trim());
    return LINK_PROTOCOLS.has(url.protocol) ? url.href : undefined;
  } catch (error) {
    // Relative or malformed: it would resolve against the host page.
    return undefined;
  }
};

/**
 * Whether the node is an element. By its fields rather than `instanceof`: the
 * parser's nodes can come from another copy of domhandler than the one
 * html-react-parser exports (in Node, htmlparser2 brings its own).
 */
const isElement = (node: DOMNode): node is Element =>
  'name' in node && 'attribs' in node;

const options: HTMLReactParserOptions = {
  replace(domNode, index) {
    if (!isElement(domNode)) return undefined;

    const tag = domNode.name.toLowerCase();
    if (DROPPED_WITH_CONTENT.has(tag)) return <></>;

    const children = domToReact(domNode.children as DOMNode[], options);
    if (!ALLOWED_TAGS.has(tag))
      return <React.Fragment key={index}>{children}</React.Fragment>;
    if (tag === 'br') return <br key={index} />;

    // No attributes survive except a checked link target.
    const props: Record<string, string | number> = {key: index};
    if (tag === 'a') {
      const href = safeHref(domNode.attribs.href);
      if (href) {
        props.href = href;
        props.target = '_blank';
        props.rel = 'noopener noreferrer';
      }
    }
    return React.createElement(tag, props, children);
  },
};

/**
 * Render a curated HTML text from the API (an explanation's `long_text`) as
 * React elements, keeping only the tags in ALLOWED_TAGS and, on links, an
 * http(s) or mailto `href`.
 */
export const renderCuratedHtml = (html: string): ReturnType<typeof parse> =>
  parse(html, options);
