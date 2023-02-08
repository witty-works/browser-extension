'use strict';
const injectCode = (e) => {
    const a = document.createElement('script');
    (a.textContent = e),
        (document.head || document.documentElement).appendChild(a);
};
const e = 'hokifickgkhplphjiodbggjmoafhignh';
injectCode(`(function() {window['_docs_annotate_canvas_by_ext'] ='${e}';})();`);