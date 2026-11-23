declare module '*.svg' {
  const content: any;
  export default content;
}

// Stylesheets imported for their side effect; webpack's loaders handle them.
declare module '*.scss';
