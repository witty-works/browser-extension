const { test: base, chromium, expect } = require('@playwright/test') //add firefox
require('dotenv').config();
const utils = require('./utils');

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

test.setTimeout(120000);


test.describe('Popup', () => {
    test('login popup', async ({ page, context }) => {
        const extensionId = await utils.getExtensionId(page);
        await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
        await utils.loginPopupPage(page, extensionId, context);
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        await page.waitForLoadState('networkidle')

        await page.waitForSelector('.lato-popup-title');
        expect(await page.$('.lato-popup-title')).not.toBeNull();
    })

    // test('clicking logo opens a page in another window', async ({ page, context }) => {
    //     const extensionId = await utils.getExtensionId(page);
    //     await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
    //     await utils.loginPopupPage(page, extensionId, context);
    //     await page.goto(`chrome-extension://${extensionId}/popup.html`);
    //     await page.waitForSelector('#witty-logo');
    //     await page.click('#witty-logo');
    //     await page.waitForLoadState('networkidle')
    //     let pages = await context.pages();
    //     expect(await pages[2].url()).toBe('https://www.witty.works/');
    // });

    test('popup contains three toggles with labels when survey response yes', async ({ page, context }) => {
        const extensionId = await utils.getExtensionId(page);
        await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
        await utils.loginPopupPage(page, extensionId, context);
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        await page.waitForLoadState('networkidle')

        await page.waitForSelector('.lato-popup-title');
        let toggles = await page.$$('.toggle-encloser');
        expect(toggles.length).toBe(3);
    });

    test('popup has setting icons wich leads to dashboard', async ({ page, context }) => {
        const extensionId = await utils.getExtensionId(page);
        await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
        await utils.loginPopupPage(page, extensionId, context);
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        await page.waitForLoadState('networkidle')
        await page.click('#witty-settings');
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(5000);
        let pages = await context.pages();
        expect(await pages[2].url()).toBe('https://dev-54ta5gq-56xlfiudba6c2.fr-4.platformsh.site/en/team/language/language-settings');
    });


    test('clicking unlocked global toggle changes background color', async ({ page, context }) => {
        const extensionId = await utils.getExtensionId(page);
        await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
        await utils.unlockAllToggles(page);
        await utils.loginPopupPage(page, extensionId, context);
        await page.goto(`chrome-extension://${extensionId}/popup.html`);

        await page.waitForSelector('.lato-popup-title');
        await page.waitForTimeout(2000);

        const inclusiveToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-highlight-inclusive-terms', '#toggle-button-highlight-inclusive-terms', false);
        expect(inclusiveToggle).toBe(true);

        const styleIssuesToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-highlight-style-issues', '#toggle-button-highlight-style-issues', false);
        expect(styleIssuesToggle).toBe(true);

        const grammarToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-check-grammar---spelling', '#toggle-button-check-grammar---spelling', false);
        expect(grammarToggle).toBe(true);
    });


    test('locks made by administrators are show', async ({ page, context }) => {
        await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
        await utils.unlockAllToggles(page);
        await page.goto('https://dev-54ta5gq-56xlfiudba6c2.fr-4.platformsh.site/en/team/language/language-settings');
        const element = await page.waitForSelector('.max-w-7xl:nth-child(8) .guidelines-enable-for-all .slider');
        const backgroundColor = await element.evaluate((el) => {
            return window.getComputedStyle(el).getPropertyValue('background-color');
        });
        if (backgroundColor === 'rgb(204, 204, 204)') {
            await page.click('.max-w-7xl:nth-child(8) .guidelines-enable-for-all .slider');
        }
        await page.click('.max-w-7xl:nth-child(8) .wittyworks-button');

        const extensionId = await utils.getExtensionId(page);
        await utils.loginPopupPage(page, extensionId, context);

        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        await page.waitForSelector('.lato-popup-title');
        const grammarToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-check-grammar---spelling', '#toggle-button-check-grammar---spelling', true);
        expect(grammarToggle).toBe(true);
    });
})

