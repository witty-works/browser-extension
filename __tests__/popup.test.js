const puppeteer = require('puppeteer');
const EXTENSION_PATH = './extension/chrome';
const extensionName = 'Witty Works'

// const getExtensionId = async (browser) => {
//     const targets = await browser.target();
//     const extensionTarget = targets.find(({ _targetInfo }) => {
//         return (
//             _targetInfo.title === extensionName &&
//             _targetInfo.type === 'background_page'
//         );
//     });

//     const extensionUrl = extensionTarget._targetInfo.url;
//     const urlSplit = extensionUrl.split('/');
//     const extensionId = urlSplit[2];
//     return extensionId;
// };

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

    // it("test popup icon", async () => {
    //     // const extensionId = await getExtensionId(browser); //TODO
    //     const browser = await puppeteer.launch({
    //         headless: false,
    //         devtools: true,
    //         args: [
    //             `--disable-extensions-except=${EXTENSION_PATH}`,
    //             `--load-extension=${EXTENSION_PATH}`
    //         ]
    //     });
    //     browserArray.push(browser);
    //     const page = await browser.newPage();
    //     await page.goto(`chrome-extension://libbonaaegmcdbmeefoccaecokjgjmab/popup.html`);
    //     const pageTarget = page.target();
    //     await page.click('.icon');

    //     const newTarget = await browser.waitForTarget(target => target.opener() === pageTarget);
    //     const newPage = await newTarget.page();
    //     const url = await newPage.url();
    //     console.log(url);
    //     expect(url).toBe('https://www.witty.works/');
    // });

    // it("test popup toggle off", async () => {
    //     // const extensionId = await getExtensionId(browser); //TODO
    //     const browser = await puppeteer.launch({
    //         headless: false,
    //         devtools: true,
    //         args: [
    //             `--disable-extensions-except=${EXTENSION_PATH}`,
    //             `--load-extension=${EXTENSION_PATH}`
    //         ]
    //     });
    //     browserArray.push(browser);
    //     const page = await browser.newPage()

    //     await page.goto(`chrome-extension://libbonaaegmcdbmeefoccaecokjgjmab/popup.html`);
    //     await page.bringToFront();
    //     await page.click('.toggle-button');

    //     await page.goto("https://www.witty.works/form");
    //     await page.bringToFront();
    //     await page.waitForSelector('#witty-test')
    //     const textarea = await page.$('#witty-test')
    //     await textarea.focus();

    //     const canvasContainer = await page.$('.canvas-container');
    //     expect(canvasContainer).toBeNull();
    // });

    // it("test popup toggle on", async () => {
    // const extensionId = await getExtensionId(browser); //TODO
    // const browser = await puppeteer.launch({
    //     headless: false,
    //     devtools: true,
    //     args: [
    //         `--disable-extensions-except=${EXTENSION_PATH}`,
    //         `--load-extension=${EXTENSION_PATH}`
    //     ]
    // });
    // browserArray.push(browser);
    // const page = await browser.newPage();

    // await page.goto(`chrome-extension://libbonaaegmcdbmeefoccaecokjgjmab/popup.html`);
    // await page.click('.toggle-button');
    // await page.click('.toggle-button');

    // await page.goto("https://www.witty.works/form");
    // await page.waitForSelector('#witty-test')
    // const textarea = await page.$('#witty-test')
    // await textarea.focus();

    // const canvasContainer = await page.$('.canvas-container');
    // console.log(canvasContainer) //this is null for some reason.. 
    // expect(canvasContainer).not.toBeNull();

    // });
});

