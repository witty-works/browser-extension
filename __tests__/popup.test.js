const { test: base, chromium, expect } = require('@playwright/test') //add firefox
const extensionId = 'libbonaaegmcdbmeefoccaecokjgjmab'

const test = base.extend({
    context: async ({ browserName }, use) => {
        const browserTypes = { chromium } //add firefox
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
test.use({ trace: 'off' })

test.describe('Popup', () => {
    // User not logged in
    // test('clicking logo opens a page in another window', async ({ page, context }) => {
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.click('#witty-logo');
    //     await page.waitForTimeout(5000);
    //     let pages = await context.pages();
    //     expect(pages.length).toBe(3);
    // });
    // test('popup contains five toggles with labels', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     let toggles = await page.$$('.toggle-encloser');
    //     expect(toggles.length).toBe(5);
    //     let labels = await page.$$('.toggle-label');
    //     expect(labels.length).toBe(5);
    // });
    // test('upgrade has a button that leads to another page', async ({ page, context }) => {
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.click('.wittyworks-upgrade-banner-popup-button');
    //     await page.waitForTimeout(5000);
    //     let pages = await context.pages();
    //     expect(pages.length).toBe(3);
    // });
    // test('popup has setting icons wich leads to settings page', async ({ page, context }) => {
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.click('#witty-settings');
    //     await page.waitForTimeout(5000);
    //     let pages = await context.pages();
    //     expect(await pages[1].url()).toBe(`chrome-extension://${extensionId}/options.html`);
    // });
    // test('clicking first toggle removes all other toggles', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.click('#toggle-button-enable-witty');
    //     let toggles = await page.$$('.toggle-encloser');
    //     expect(toggles.length).toBe(1);
    // });

    // test('clicking unlocked global toggle changes background color', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     //inclusive terms
    //     const element = await page.waitForSelector('#toggle-encloser-highlight-inclusive-terms');
    //     const backgroundColorBefore = await element.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-highlight-inclusive-terms');
    //     await page.waitForTimeout(2000);
    //     const backgroundColorAfter = await element.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(backgroundColorBefore).not.toBe(backgroundColorAfter);

    //     //style-issues
    //     const element2 = await page.waitForSelector('#toggle-encloser-highlight-style-issues');
    //     const backgroundColorBefore2 = await element2.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-highlight-style-issues');
    //     await page.waitForTimeout(2000);
    //     const backgroundColorAfter2 = await element2.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(backgroundColorBefore2).not.toBe(backgroundColorAfter2);

    //     //grammar
    //     const element3 = await page.waitForSelector('#toggle-encloser-check-grammar---spelling');
    //     const backgroundColorBefore3 = await element3.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-check-grammar---spelling');
    //     await page.waitForTimeout(2000);
    //     const backgroundColorAfter3 = await element3.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(backgroundColorBefore3).not.toBe(backgroundColorAfter3);
    // });

    // test('changing global toggle on options page changes popup', async ({ page, context }) => {
    // await page.goto(`chrome-extension://${extensionId}/popup.html`);
    // //inclusive terms
    // let element = await page.waitForSelector('#toggle-encloser-highlight-inclusive-terms');
    // const backgroundColorBefore = await element.evaluate((el) => {
    //     return window.getComputedStyle(el).getPropertyValue('background-color');
    // });

    // await page.goto(`chrome-extension://${extensionId}/options.html`);
    // await page.click('.wittyworks-options-content-section-title');
    // await page.click('#toggle-button-highlight-inclusive-terms');

    // await page.goto(`chrome-extension://${extensionId}/popup.html`);
    // element = await page.waitForSelector('#toggle-encloser-highlight-inclusive-terms');
    // const backgroundColorAfter = await element.evaluate((el) => {
    //     return window.getComputedStyle(el).getPropertyValue('#toggle-encloser-highlight-inclusive-terms');
    // });

    //     expect(backgroundColorBefore).not.toBe(backgroundColorAfter);

    //     //style-issues
    //     let element2 = await page.waitForSelector('#toggle-encloser-highlight-style-issues');
    //     const backgroundColorBefore2 = await element2.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });

    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-content-section-title');
    //     await page.click('#toggle-button-highlight-style-issues');

    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     element2 = await page.waitForSelector('#toggle-encloser-highlight-style-issues');
    //     const backgroundColorAfter2 = await element2.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });

    //     expect(backgroundColorBefore2).not.toBe(backgroundColorAfter2);

    //     //grammar
    //     let element3 = await page.waitForSelector('#toggle-encloser-check-grammar---spelling');
    //     const backgroundColorBefore3 = await element3.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });

    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-content-section-title');
    //     await page.click('#toggle-button-check-grammar---spelling');

    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     element3 = await page.waitForSelector('#toggle-encloser-check-grammar---spelling');
    //     const backgroundColorAfter3 = await element3.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });

    //     expect(backgroundColorBefore3).not.toBe(backgroundColorAfter3);
    // });

    // test('changing global toggles on popup changes toggles on options page', async ({ page, context }) => {
    //     //inclusive terms
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-content-section-title');
    //     let inclusiveTerms = await page.waitForSelector('#toggle-encloser-highlight-inclusive-terms');
    //     const backgroundColorBefore = await inclusiveTerms.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });

    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.click('#toggle-button-highlight-inclusive-terms');

    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-content-section-title');
    //     inclusiveTerms = await page.waitForSelector('#toggle-encloser-highlight-inclusive-terms');
    //     const backgroundColorAfter = await inclusiveTerms.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(backgroundColorBefore).not.toBe(backgroundColorAfter);

    //     //style-issues
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-content-section-title');
    //     let styleIssues = await page.waitForSelector('#toggle-encloser-highlight-style-issues');
    //     const backgroundColorBefore2 = await styleIssues.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });

    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.click('#toggle-button-highlight-style-issues');

    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-content-section-title');
    //     styleIssues = await page.waitForSelector('#toggle-encloser-highlight-style-issues');
    //     const backgroundColorAfter2 = await styleIssues.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });

    //     expect(backgroundColorBefore2).not.toBe(backgroundColorAfter2);

    //     //grammar
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-content-section-title');
    //     let grammar = await page.waitForSelector('#toggle-encloser-check-grammar---spelling');
    //     const backgroundColorBefore3 = await grammar.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });

    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.click('#toggle-button-check-grammar---spelling');

    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-content-section-title');
    //     grammar = await page.waitForSelector('#toggle-encloser-check-grammar---spelling');
    //     const backgroundColorAfter3 = await grammar.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });

    //     expect(backgroundColorBefore3).not.toBe(backgroundColorAfter3);
    // });

    //open toggle on website + tests of 'popup deactivated' popup (not sure if this is possible)
    // test('when user disables witty for a site, it appears on the options page', async ({ page, context }) => {
    //     //open popup on page & click disable for this site 
    // });

    // test('when opening popup on untested site, deactivated popup is shown', async ({ page, context }) => {
    // });

    // //User is logged in
    // test('when user is logged in, and has witty_teams a link to the dashboard in shown', async ({ page, context }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-button');
    //     await page.waitForTimeout(3000);
    //     await page.type('#email', 'witty.works.premium.user@gmail.com');
    //     await page.type('#password', 'nqz.dtj*feu3EQX6fdc');
    //     await page.click('#next');
    //     await page.waitForTimeout(3000);

    //     // await page.goto(`chrome-extension://${extensionId}/popup.html`);

    //     await page.waitForTimeout(3000);

    //     let dashboardButton = await page.waitForSelector('#wittyworks-dashboard-button');
    //     expect(dashboardButton).toBeTruthy();
    // });


    // test('when user is logged in, and has witty_me the upselling banner is shown', async ({ page, context }) => {
    // });

    // test('when user is logged in, locks made by administrators are show', async ({ page, context }) => {
    // });
})
