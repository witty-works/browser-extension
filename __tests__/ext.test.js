const puppeteer = require('puppeteer');
const EXTENSION_PATH = './extension/chrome';
const extensionName = 'Witty Works'

const getExtensionId = async (browser) => {
  const targets = await browser.target();
  const extensionTarget = targets.find(({ _targetInfo }) => {
    return (
      _targetInfo.title === extensionName &&
      _targetInfo.type === 'background_page'
    );
  });

  const extensionUrl = extensionTarget._targetInfo.url;
  const urlSplit = extensionUrl.split('/');
  const extensionId = urlSplit[2];
  return extensionId;
};

let browserArray = [];
describe('Witty Works', () => {
  // afterAll(async () => {
  //   console.log('clean up');
  //   try {
  //     await Promise.all(
  //       browserArray.map(async (browser) => {
  //         try {
  //           const closeBrowser = await browser.close();
  //         } catch (error) {
  //           console.log(error);
  //         }
  //       })
  //     );
  //   } catch (error) {
  //     console.log(error);
  //   }
  // });
  // it("first test", async () => {
  //     const browser = await puppeteer.launch({
  //         headless: false,
  //         devtools: true,
  //         args: [
  //             `--disable-extensions-except=${EXTENSION_PATH}`,
  //             `--load-extension=${EXTENSION_PATH}`
  //         ]
  //     });
  //     browserArray.push(browser);
  //     const extensionId = await getExtensionId(browser);

  //     const page = await browser.pages();
  //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
  //     await page.bringToFront();
  //     await page.waitForSelector('h2'); //TODO
  //     const textEl = await page.$('h2');
  //     const text = await textEl.evaluate(e => e.innerText);
  //     console.log(text);
  //     expect(text).toEqual(expect.stringContaining('Settings')); //TODO
  // });

  it('second test', async () => {
    const browser = await puppeteer.launch({
      headless: false,
      devtools: true,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    browserArray.push(browser);

    var [page] = await browser.pages();
    await page.goto('https://www.witty.works/form');
    await page.bringToFront();
    //click textarea
    await page.waitForSelector('textarea');
    const textarea = await page.$('textarea');
    await textarea.focus();

    //see if <witty-code> is there
    await page.waitForSelector('witty-code');
    await page.$('witty-code');

    //write in the textarea
    await textarea.type('hello');
  });
});
