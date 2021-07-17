import * as React from 'react';
import ReactDOM from 'react-dom';
import ContentScriptApp from './ContentScriptApp';

//Main element to add extra markup
document.body.appendChild(document.createElement('witty-code'));

//Render it over React
ReactDOM.render(<ContentScriptApp />, document.querySelector('witty-code'));

export {};
