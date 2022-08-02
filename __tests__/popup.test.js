const { test: base, chromium, expect } = require('@playwright/test') //add firefox
require('dotenv').config();
const utils = require('./utils');

const extensionId = process.env.EXTENSION_ID_DEV;
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
    // // User not logged in
    test('clicking logo opens a page in another window', async ({ page, context }) => {
        await page.goto(`chrome-extension://libbonaaegmcdbmeefoccaecokjgjmab/popup.html`);
        await page.waitForSelector('#witty-logo');
        await page.click('#witty-logo');
        await page.waitForLoadState('networkidle')
        let pages = await context.pages();
        expect(pages.length).toBe(3);
    });

    test('popup contains three toggles with labels', async ({ page }) => {
        //it is 3 toggles, not 5, because it is a chrome page (we dont show the site specific settings)
        await page.goto(`chrome-extension://libbonaaegmcdbmeefoccaecokjgjmab/popup.html`);
        await page.waitForLoadState('networkidle')
        let toggles = await page.$$('.toggle-encloser');
        expect(toggles.length).toBe(3);
        let labels = await page.$$('.toggle-label');
        expect(labels.length).toBe(3);
    });

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

    // //this test no logner works as we dont show site specific settings on chorme page
    // // test('clicking first toggle removes all other toggles', async ({ page }) => {
    // //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    // //     await page.click('#toggle-button-enable-witty');
    // //     let toggles = await page.$$('.toggle-encloser');
    // //     expect(toggles.length).toBe(1);
    // // });

    // test('clicking unlocked global toggle changes background color', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);

    //     const inclusiveToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-highlight-inclusive-terms', '#toggle-button-highlight-inclusive-terms', false);
    //     expect(inclusiveToggle).toBe(true);

    //     const styleIssuesToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-highlight-style-issues', '#toggle-button-highlight-style-issues', false);
    //     expect(styleIssuesToggle).toBe(true);

    //     const grammarToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-check-grammar---spelling', '#toggle-button-check-grammar---spelling', false);
    //     expect(grammarToggle).toBe(true);
    // });

    // test('changing global toggle on options page updates toggles in popup', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);

    //     const inclusiveToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClickOptionsToPopupPage(page, '#toggle-encloser-highlight-inclusive-terms', '#toggle-button-highlight-inclusive-terms');
    //     expect(inclusiveToggle).toBe(true);

    //     const styleIssuesToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClickOptionsToPopupPage(page, '#toggle-encloser-highlight-style-issues', '#toggle-button-highlight-style-issues');
    //     expect(styleIssuesToggle).toBe(true);

    //     const grammarToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClickOptionsToPopupPage(page, '#toggle-encloser-check-grammar---spelling', '#toggle-button-check-grammar---spelling');
    //     expect(grammarToggle).toBe(true);
    // });

    // test('changing global toggles on popup changes toggles on options page', async ({ page }) => {
    //     const inclusiveToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClickPopupToOptionsPage(page, '#toggle-encloser-highlight-inclusive-terms', '#toggle-button-highlight-inclusive-terms');
    //     expect(inclusiveToggle).toBe(true);

    //     const styleIssuesToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClickPopupToOptionsPage(page, '#toggle-encloser-highlight-style-issues', '#toggle-button-highlight-style-issues');
    //     expect(styleIssuesToggle).toBe(true);

    //     const grammarToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClickPopupToOptionsPage(page, '#toggle-encloser-check-grammar---spelling', '#toggle-button-check-grammar---spelling');
    //     expect(grammarToggle).toBe(true);
    // });

    // //User is logged in
    // test('when user is logged in and has witty_teams, a link to the dashboard in shown in popup', async ({ page }) => {
    //     await utils.loginOptionsPage(premiumUserEmail, premiumUserPassword, page);
    //     await page.waitForTimeout(2000);

    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.waitForTimeout(2000);
    //     let dashboardButton = await page.waitForSelector('.wittyworks-dashboard-button');
    //     expect(dashboardButton).toBeTruthy();
    // });

    // test('when user is logged in, locks made by administrators are show', async ({ page }) => {
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

