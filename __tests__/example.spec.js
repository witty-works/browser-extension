const { test: base, chromium, webkit } = require('@playwright/test')

const test = base.extend({
    context: async ({ browserName }, use) => {
        const browserTypes = { chromium, webkit }
        const pathToExtension = ('./extension/chrome');
        const launchOptions = {
            devtools: true,
            headless: false,
            viewport: {
                width: 1920,
                height: 1080
            },
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`
            ],
        }
        const context = await browserTypes[browserName].launchPersistentContext(
            '',
            launchOptions
        )
        await use(context)
        await context.close()
    }
})

test.use({ trace: 'on' })


test.describe('Popup', () => {
    test('our extension loads', async ({ page }) => {

        await page.goto(`chrome-extension://libbonaaegmcdbmeefoccaecokjgjmab/popup.html`);
        await page.bringToFront();
        await page.click('.toggle-button');

        await page.goto("https://www.witty.works/form");
        await page.bringToFront();
        await page.waitForSelector('#witty-test')
        const textarea = await page.$('#witty-test')
        await textarea.focus();

        await page.$('.canvas-container');
        // expect(canvasContainer).toBeNull();

        // Go to https://www.witty.works/form
        // await page.goto('https://www.witty.works/form');
        // // Click #CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll
        // await page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll').click();
        // // Click text=Hey guys, We are a team where ambition and perseverance count.
        // const witty = await page.waitForSelector('#witty-test');
        // await page.click('#witty-test');
        // //write in the textarea
        // await witty.fill('Hey guys, We are a team where ambition and perseverance count.');
        // await page.locator('[aria-label="Close"]').click();
        // // Click text=Hey guys, We are a team where ambition and perseverance count.
        // await page.locator('text=Hey guys, We are a team where ambition and perseverance count.').click();
        // // Fill text=Hey guys, We are a team where ambition and perseverance count.
        // await page.locator('text=Hey guys, We are a team where ambition and perseverance count.').fill('Hey guys, We are a team where ambition and perseverance count. This is a test alalal ');
        // // Click .row-fluid-wrapper.row-depth-1.row-number-5
        // await page.locator('.row-fluid-wrapper.row-depth-1.row-number-5').click();
    })
})
