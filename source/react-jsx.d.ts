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
 */
import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
