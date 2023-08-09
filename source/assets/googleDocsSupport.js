'use strict';
const injectCode = (e) => {
    const a = document.createElement('script');
    (a.textContent = e),
        (document.head || document.documentElement).appendChild(a);
};
const e = 'hokifickgkhplphjiodbggjmoafhignh';
injectCode(`(function() {window['_docs_annotate_canvas_by_ext'] ='${e}';})();`);

const injectFile = (e) => {
    const a = document.createElement('script');
    const browserApi = (typeof chrome != 'undefined') ? chrome : (typeof browser != 'undefined' ? browser : {});
    (a.type = 'text/javascript'), (a.src = browserApi.runtime.getURL(e)), document.documentElement.appendChild(a);
}

injectFile('assets/googleDocsSpellCheck.js');
