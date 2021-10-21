const isObjectEmpty = (obj: object) => {
  return obj && Object.keys(obj).length === 0 && Object.getPrototypeOf(obj) === Object.prototype;
}

const convertHTMLToText = (str: string = ''):string => {

  // Ensure string.
  let value: string = String(str);

  // Convert encoding.
  value = value.replace(/&nbsp;/gi, ' ');
  value = value.replace(/&amp;/gi, '&');

  // Replace `<br>`.
  value = value.replace(/<br>/gi, '\n');

  // Replace `<div>` (from Chrome).
  value = value.replace(/<div>/gi, '\n');

  // Replace `<p>` (from IE).
  value = value.replace(/<p>/gi, '\n');

  // Remove extra tags.
  value = value.replace(/<(.*?)>/g, '');

  // Trim each line.
  value = value
    .split('\n')
    .map((line = '') => {
      return line.trim();
    })
    .join('\n');

  //Element's innerHTML does not provide the correct spacing when there are line-breaks.
  //(e.g. <div><br></div> provides two spaces when transformed to string)
  //So we need a specific fix for that
  value = value.replace(/(\n+)/g, ($1) =>  new Array(Math.ceil($1.length/2)).fill('\n',0).join(''));

  // Clean up spaces.
  value = value.replace(/[ ]+/g, ' ');
  // value = value.trim();

  // Expose string.
  return value;
}

export {
  isObjectEmpty,
  convertHTMLToText
}