/**
 * Lets the custom `ww-*` elements the content script renders (ww-clone,
 * ww-highlights, ww-activity-indicator and friends — see WTags) pass JSX type
 * checking.
 *
 * React 19's types no longer expose a global `JSX` namespace, so the previous
 * `declare namespace JSX` in custom.d.ts stopped being picked up. Augmenting
 * `react` is the supported replacement, and augmentation only works from a
 * module — hence the import, and hence this living outside custom.d.ts, which
 * has to stay ambient for its wildcard `*.svg` declaration.
 *
 * The tags are listed by name rather than through a string index signature:
 * an index signature makes every string a valid tag, so libraries that map
 * over `keyof JSX.IntrinsicElements` (react-spring's `animated.div`) lose
 * their per-tag types.
 */
import type {DetailedHTMLProps, HTMLAttributes} from 'react';
import type {WTags} from './shared/constants';

type WittyElements = {
  [Tag in `${WTags}`]: DetailedHTMLProps<
    HTMLAttributes<HTMLElement>,
    HTMLElement
  >;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements extends WittyElements {}
  }
}
