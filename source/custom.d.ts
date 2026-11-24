declare module '*.svg' {
  const content: any;
  export default content;
}

// Stylesheets imported for their side effect; webpack's loaders handle them.
declare module '*.scss';

// A stylesheet compiled to a string (webpack.config.js, `?inline`), for the
// content script's closed shadow roots.
declare module '*.scss?inline' {
  const css: string;
  export default css;
}
