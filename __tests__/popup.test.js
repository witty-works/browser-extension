const { test: base, chromium, expect } = require('@playwright/test') //add firefox
require('dotenv').config();
const utils = require('./utils');

const userEmail = process.env.TEST_USER_EMAIL;
const userPassword = process.env.TEST_USER_PASSWORD;
const premiumUserEmail = process.env.PREMIUM_TEST_USER_EMAIL;
const premiumUserPassword = process.env.PREMIUM_TEST_USER_PASSWORD;

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
                `--no-sandbox`,
                `--disable-setuid-sandbox`,
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

test.setTimeout(120000); //probably not needed here

test.describe('Popup', () => {
    // test('login popup through dashboard', async ({ page, context }) => {
    //     const extensionId = await utils.getExtensionId(page);
    //     await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
    //     await utils.loginPopupPage(premiumUserEmail, premiumUserPassword, page, extensionId, context);
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.waitForLoadState('networkidle')

    //     await page.waitForSelector('.wittyworks-button-yes');
    //     expect(await page.$('.wittyworks-button-yes')).not.toBeNull();
    // })

    // test('clicking logo opens a page in another window', async ({ page, context }) => {
    //     const extensionId = await utils.getExtensionId(page);
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.waitForSelector('#witty-logo');
    //     await page.click('#witty-logo');
    //     await page.waitForLoadState('networkidle')
    //     let pages = await context.pages();
    //     expect(pages.length).toBe(3);
    // });

    // // add survey tests here

    // test('popup contains three toggles with labels when survey response yes', async ({ page, context }) => {
    //     const extensionId = await utils.getExtensionId(page);
    //     await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
    //     await utils.loginPopupPage(premiumUserEmail, premiumUserPassword, page, extensionId, context);
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.waitForLoadState('networkidle')

    //     await page.waitForSelector('.wittyworks-button-yes');
    //     await page.click('.wittyworks-button-yes');
    //     await page.waitForTimeout(2000);

    //     let toggles = await page.$$('.toggle-encloser');
    //     expect(toggles.length).toBe(3);
    //     let labels = await page.$$('.toggle-label');
    //     expect(labels.length).toBe(3);
    //     await page.waitForTimeout(5000);
    // });

    // test('popup has setting icons wich leads to dashboard', async ({ page, context }) => {
    //     const extensionId = await utils.getExtensionId(page);
    //     await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
    //     await utils.loginPopupPage(premiumUserEmail, premiumUserPassword, page, extensionId, context);
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.waitForLoadState('networkidle')
    //     await page.click('#witty-settings');
    //     await page.waitForLoadState('networkidle')
    //     await page.waitForTimeout(5000);
    //     let pages = await context.pages();
    //     expect(await pages[2].url()).toBe('https://dev-54ta5gq-56xlfiudba6c2.fr-4.platformsh.site/en/user/profile');
    // });


    // test('clicking unlocked global toggle changes background color', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);

    //     const inclusiveToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-highlight-inclusive-terms', '#toggle-button-highlight-inclusive-terms', false);
    //     expect(inclusiveToggle).toBe(true);

    //     const styleIssuesToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-highlight-style-issues', '#toggle-button-highlight-style-issues', false);
    //     expect(styleIssuesToggle).toBe(true);

    //     const grammarToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-check-grammar---spelling', '#toggle-button-check-grammar---spelling', false);
    //     expect(grammarToggle).toBe(true);
    // });

    // test('changing global toggles on popup changes toggles on dashboard page', async ({ page }) => {
    //     const inclusiveToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClickPopupToOptionsPage(page, '#toggle-encloser-highlight-inclusive-terms', '#toggle-button-highlight-inclusive-terms');
    //     expect(inclusiveToggle).toBe(true);

    //     const styleIssuesToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClickPopupToOptionsPage(page, '#toggle-encloser-highlight-style-issues', '#toggle-button-highlight-style-issues');
    //     expect(styleIssuesToggle).toBe(true);

    //     const grammarToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClickPopupToOptionsPage(page, '#toggle-encloser-check-grammar---spelling', '#toggle-button-check-grammar---spelling');
    //     expect(grammarToggle).toBe(true);
    // });


    // test('locks made by administrators are show', async ({ page }) => {
    //     await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);

    //     //create a lock on orthography
    //     await page.click('.onboarding-quick-links-container .onboarding-iconWrapper:nth-child(2)');
    //     await page.waitForTimeout(1000);
    //     await page.evaluate(() => {
    //         window.scrollTo(0, document.body.scrollHeight);
    //     });
    //     const element = await page.waitForSelector('.max-w-7xl:nth-child(8) .guidelines-enable-for-all .slider');
    //     const backgroundColor = await element.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     if (backgroundColor === 'rgb(204, 204, 204)') {
    //         await page.click('.max-w-7xl:nth-child(8) .guidelines-enable-for-all .slider');
    //     }
    //     await page.click('.max-w-7xl:nth-child(8) .inline-flex');

    //     await utils.loginOptionsPageWhenAlreadyLoggedInDashboard(page);

    //     //check if orthography is locked
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.waitForTimeout(2000);
    //     const grammarToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-check-grammar---spelling', '#toggle-button-check-grammar---spelling', true);
    //     expect(grammarToggle).toBe(true);
    // });
})

