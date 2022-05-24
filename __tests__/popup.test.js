const { test: base, chromium, expect } = require('@playwright/test') //add firefox
const extensionId = 'libbonaaegmcdbmeefoccaecokjgjmab'

const test = base.extend({
    context: async ({ browserName }, use) => {
        const browserTypes = { chromium } //add firefox
        const pathToExtension = ('./extension/chrome');
        const launchOptions = {
            devtools: false,
            headless: false,
            viewport: {
                width: 1400,
                height: 700
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
    // // User not logged in
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

    // test('upgrade banner has a button that leads to another page', async ({ page, context }) => {
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.click('.wittyworks-upgrade-banner-popup-button');
    //     await page.waitForTimeout(5000);
    //     let pages = await context.pages();
    //     expect(pages.length).toBe(3);
    // });

    // test('popup has setting icons wich leads to options page', async ({ page, context }) => {
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
    //     const inclusive = await page.waitForSelector('#toggle-encloser-highlight-inclusive-terms');
    //     const backgroundColorBefore = await inclusive.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-highlight-inclusive-terms');
    //     await page.waitForTimeout(2000);
    //     const backgroundColorAfter = await inclusive.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(backgroundColorBefore).not.toBe(backgroundColorAfter);

    //     const style = await page.waitForSelector('#toggle-encloser-highlight-style-issues');
    //     const backgroundColorBefore2 = await style.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-highlight-style-issues');
    //     await page.waitForTimeout(2000);
    //     const backgroundColorAfter2 = await style.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(backgroundColorBefore2).not.toBe(backgroundColorAfter2);

    //     const grammar = await page.waitForSelector('#toggle-encloser-check-grammar---spelling');
    //     const backgroundColorBefore3 = await grammar.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-check-grammar---spelling');
    //     await page.waitForTimeout(2000);
    //     const backgroundColorAfter3 = await grammar.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(backgroundColorBefore3).not.toBe(backgroundColorAfter3);
    // });

    // test('changing global toggle on options page updates toggles in popup', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);

    //     let inclusive = await page.waitForSelector('#toggle-encloser-highlight-inclusive-terms');
    //     const backgroundColorBefore = await inclusive.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-content-section-title');
    //     await page.click('#toggle-button-highlight-inclusive-terms');
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     inclusive = await page.waitForSelector('#toggle-encloser-highlight-inclusive-terms');
    //     const backgroundColorAfter = await inclusive.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('#toggle-encloser-highlight-inclusive-terms');
    //     });
    //     expect(backgroundColorBefore).not.toBe(backgroundColorAfter);

    //     let style = await page.waitForSelector('#toggle-encloser-highlight-style-issues');
    //     const backgroundColorBefore2 = await style.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-content-section-title');
    //     await page.click('#toggle-button-highlight-style-issues');
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     style = await page.waitForSelector('#toggle-encloser-highlight-style-issues');
    //     const backgroundColorAfter2 = await style.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(backgroundColorBefore2).not.toBe(backgroundColorAfter2);

    //     let grammar = await page.waitForSelector('#toggle-encloser-check-grammar---spelling');
    //     const backgroundColorBefore3 = await grammar.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-content-section-title');
    //     await page.click('#toggle-button-check-grammar---spelling');
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     grammar = await page.waitForSelector('#toggle-encloser-check-grammar---spelling');
    //     const backgroundColorAfter3 = await grammar.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(backgroundColorBefore3).not.toBe(backgroundColorAfter3);
    // });

    // test('changing global toggles on popup changes toggles on options page', async ({ page, context }) => {
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

    // //User is logged in
    // test('when user is logged in and has witty_teams, a link to the dashboard in shown in popup', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.selectOption('.dropdown-select', 'Dev');
    //     await page.waitForTimeout(1000);

    //     //login on options page
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-button');
    //     await page.waitForTimeout(3000);
    //     await page.type('#email', 'witty.works.premium.user@gmail.com');
    //     await page.type('#password', 'nqz.dtj*feu3EQX6fdc');
    //     await page.click('#next');
    //     await page.waitForTimeout(6000);

    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.waitForTimeout(1000);
    //     let dashboardButton = await page.waitForSelector('.wittyworks-dashboard-button');
    //     expect(dashboardButton).toBeTruthy();
    // });

    // test('when user is logged in, locks made by administrators are show', async ({ page, context }) => {
    //     //login to dashboard
    //     await page.goto(`https://dev-54ta5gq-56xlfiudba6c2.fr-4.platformsh.site/en`);
    //     await page.waitForSelector('#CybotCookiebotDialog');
    //     await page.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
    //     await page.click('.navigation-wrapper .navigation-link:nth-child(1)');
    //     await page.type('#email', 'witty.works.premium.user@gmail.com');
    //     await page.type('#password', 'nqz.dtj*feu3EQX6fdc');
    //     await page.click('#next');
    //     await page.waitForTimeout(2000);

    //     //create a lock on orthography
    //     await page.click('.onboarding-quick-links-container .onboarding-iconWrapper:nth-child(2)');
    //     await page.waitForTimeout(2000);
    //     await page.click('.onboarding-quick-links-container .onboarding-iconWrapper:nth-child(1)');
    //     await page.waitForTimeout(2000);
    //     await page.evaluate(() => {
    //         window.scrollTo(0, document.body.scrollHeight);
    //     });
    //     const element = await page.waitForSelector('.max-w-7xl:nth-child(8) .guidelines-form-section--apply-for-all .slider');
    //     const backgroundColor = await element.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     if (backgroundColor === 'rgb(204, 204, 204)') {
    //         await page.click('.max-w-7xl:nth-child(8) .guidelines-form-section--apply-for-all .slider');
    //     }
    //     await page.click('.max-w-7xl:nth-child(8) form');

    //     //change login url popup -> Dev
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.selectOption('.dropdown-select', 'Dev');
    //     await page.waitForTimeout(1000);

    //     //login options page
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-button');
    //     await page.$('.wittyworks-options-logout');
    //     await page.reload();

    //     await page.waitForTimeout(3000);

    //     //check if orthography is locked
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     const orthography = await page.waitForSelector('#toggle-encloser-check-grammar---spelling');
    //     await page.waitForTimeout(2000);
    //     const backgroundColorBefore = await orthography.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-check-grammar---spelling');
    //     await page.waitForTimeout(1000);
    //     const backgroundColorAfter = await orthography.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(backgroundColorBefore).toBe(backgroundColorAfter);
    // });

    // //TODO: open toggle on website + tests of 'popup deactivated' popup(not sure if this is possible)
    // // test('when user disables witty for a site, it appears on the options page', async ({ page, context }) => {
    // // });

    // // test('when opening popup on untested site, deactivated popup is shown', async ({ page, context }) => {
    // // });
})
