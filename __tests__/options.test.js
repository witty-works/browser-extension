require('dotenv').config();
const utils = require('./utils');
const { test: base, chromium, expect } = require('@playwright/test') //add firefox

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
            timeout: 10000,
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

test.describe('Options', () => {
    // User not logged in
    test('clicking logo opens a page in another window', async ({ page, context }) => {
        await page.goto(`chrome-extension://${extensionId}/options.html`);
        await page.click('#witty-logo-white');
        await page.waitForTimeout(5000);
        let pages = await context.pages();
        expect(pages.length).toBe(3);
    });

    // test('clicking help button opens a page in another window', async ({ page, context }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-header-button');
    //     await page.waitForTimeout(5000);
    //     let pages = await context.pages();
    //     expect(pages.length).toBe(3);
    // });

    // test('upgrade banner is visible and upgrade button opens a page in another window', async ({ page, context }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.waitForSelector('.wittyworks-upgrade-banner');
    //     await page.click('.wittyworks-upgrade-banner-button');
    //     await page.waitForTimeout(5000);
    //     let pages = await context.pages();
    //     expect(pages.length).toBe(3);
    // });

    // test('login section only contains the login button', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     const loginSection = await page.$('.wittyworks-options-login');
    //     const loginSectionChildren = await loginSection.$$('*');
    //     expect(loginSectionChildren.length).toBe(1);
    // });

    // test('options page contains two content sections', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     const contentSection = await page.$$('.wittyworks-options-content-section');
    //     expect(contentSection.length).toBe(2);
    // });

    // //first dropdown section options page
    // test('when opening the first section, there are 9 sub sections containing 3 dropdowns and 6 toggles', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('#wittyworks-options-content-section-configure-rules');
    //     const settings = await page.$$('.wittyworks-options-content-section-container-item');
    //     expect(settings.length).toBe(9);

    //     const dropdowns = await page.$$('.dropdown-title-wrapper');
    //     expect(dropdowns.length).toBe(3);

    //     const toggles = await page.$$('.toggle-encloser');
    //     expect(toggles.length).toBe(6);
    // });

    // test('there are three premium only labels and three locks', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('#wittyworks-options-content-section-configure-rules');

    //     const premiumOnlyLabelsDropdown = await page.$$('.dropdown-premium-only');
    //     const premiumLabelsToggle = await page.$$('.toggle-premium-only');
    //     expect(premiumOnlyLabelsDropdown.length).toBe(1);
    //     expect(premiumLabelsToggle.length).toBe(2);

    //     const locksDropdown = await page.$$('.dropdown-lock');
    //     const locksToggle = await page.$$('.toggle-lock');
    //     expect(locksDropdown.length).toBe(1);
    //     expect(locksToggle.length).toBe(2);
    // });

    // test('when clicking locked toggles, they remain the same', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('#wittyworks-options-content-section-configure-rules');

    //     const inclusiveToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-become-an-inclusion-pro', '#toggle-button-become-an-inclusion-pro', true);
    //     expect(inclusiveToggle).toBe(true);

    //     const inspirationToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-show-inspirations-to-rephrase-entire-sentences', '#toggle-button-show-inspirations-to-rephrase-entire-sentences', true);
    //     expect(inspirationToggle).toBe(true);
    // });

    // test('when clicking unlocked toggles, they change color', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('#wittyworks-options-content-section-configure-rules');

    //     const genderNeutralToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-use-gender-neutral-pronouns-in-english', '#toggle-button-use-gender-neutral-pronouns-in-english', false);
    //     expect(genderNeutralToggle).toBe(true)

    //     const inclusiveToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-highlight-inclusive-terms', '#toggle-button-highlight-inclusive-terms', false);
    //     expect(inclusiveToggle).toBe(true);

    //     const styleToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-highlight-style-issues', '#toggle-button-highlight-style-issues', false);
    //     expect(styleToggle).toBe(true);

    //     const grammarToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-check-grammar---spelling', '#toggle-button-check-grammar---spelling', false);
    //     expect(grammarToggle).toBe(true);
    // });

    // //second dropdown section options page
    // test('when opening the second section, there is a button to add domain', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('#wittyworks-options-content-section-disable-witty');
    //     const button = await page.$('.wittyworks-options-content-section-container-add-domain');
    //     expect(button).toBeTruthy();
    // });

    // test('when clicking add domain, input field is visible', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('#wittyworks-options-content-section-disable-witty');
    //     await page.click('.wittyworks-options-content-section-container-add-domain');
    //     const input = await page.$('.wittyworks-options-content-section-container-input');
    //     expect(input).toBeTruthy();
    // });

    // test('when adding a domain, it is displayed in a list', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('#wittyworks-options-content-section-disable-witty');

    //     await page.click('.wittyworks-options-content-section-container-add-domain');
    //     await page.type('.wittyworks-options-content-section-container-input', 'google.com');
    //     await page.click('.wittyworks-options-content-section-container-button');

    //     await page.click('.wittyworks-options-content-section-container-add-domain');
    //     await page.type('.wittyworks-options-content-section-container-input', 'facebook.com');
    //     await page.click('.wittyworks-options-content-section-container-button');

    //     const list = await page.$$('.wittyworks-options-content-section-container-site-url');
    //     expect(list.length).toBe(2);
    // });

    // test('when deleting a domain, it is removed from the list', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('#wittyworks-options-content-section-disable-witty');

    //     await page.click('.wittyworks-options-content-section-container-add-domain');
    //     await page.type('.wittyworks-options-content-section-container-input', 'google.com');
    //     await page.click('.wittyworks-options-content-section-container-button');

    //     await page.click('.wittyworks-options-content-section-container-site-icon');
    //     const list = await page.$$('.wittyworks-options-content-section-container-site-url');
    //     expect(list.length).toBe(0);
    // });

    // //user is logged in 
    // test('user can login', async ({ page }) => {
    //     await utils.loginOptionsPage(userEmail, userPassword, page);

    //     const logout = await page.$('.wittyworks-options-logout');
    //     expect(logout).toBeTruthy();

    //     const accountInfo = await page.$('.wittyworks-options-login-text');
    //     expect(accountInfo).toBeTruthy();
    // });

    // test('premium banners disspear when logged in with witty_teams and reappear when logged out', async ({ page }) => {
    //     await utils.loginOptionsPage(premiumUserEmail, premiumUserPassword, page);

    //     await page.click('#wittyworks-options-content-section-configure-rules');
    //     const premiumOnlyLabelsDropdownLoggedIn = await page.$$('.dropdown-premium-only');
    //     const premiumLabelsToggleLoggedIn = await page.$$('.toggle-premium-only');
    //     expect(premiumOnlyLabelsDropdownLoggedIn.length).toBe(0);
    //     expect(premiumLabelsToggleLoggedIn.length).toBe(0);

    //     await page.click('.wittyworks-options-button');
    //     await page.reload();

    //     await page.click('#wittyworks-options-content-section-configure-rules');
    //     const premiumOnlyLabelsDropdownLoggedOut = await page.$$('.dropdown-premium-only');
    //     const premiumLabelsToggleLoggedOut = await page.$$('.toggle-premium-only');
    //     expect(premiumOnlyLabelsDropdownLoggedOut.length).toBe(1);
    //     expect(premiumLabelsToggleLoggedOut.length).toBe(2);
    // });

    // test('when user chages name in team settings on dashboard, options page is updated', async ({ page }) => {
    //     await utils.loginDashboard(userEmail, userPassword, page);

    //     const randomName = Math.random().toString(36).substring(7);
    //     await page.click('.onboarding-quick-links-container .onboarding-iconWrapper:nth-child(1)');
    //     await page.waitForTimeout(2000);
    //     const elementHandle = await page.$('#name');
    //     await elementHandle.click({ clickCount: 3 });
    //     await elementHandle.press('Backspace');
    //     await elementHandle.type(randomName);
    //     await page.click('.max-w-7xl > div > .guidelines-wrapper .inline-flex');

    //     await utils.loginOptionsPageWhenAlreadyLoggedInDashboard(page);

    //     const teamName = await page.$('#team-name')
    //     const teamNameText = await page.evaluate(element => element.textContent, teamName);
    //     expect(teamNameText.replace(/\s/g, '')).toBe(randomName);
    // });

    // test('when premium user, the upselling banner is not shown', async ({ page }) => {
    //     await utils.loginOptionsPage(premiumUserEmail, premiumUserPassword, page);
    //     const upsellingBanner = await page.$('.wittyworks-upgrade-banner');
    //     expect(upsellingBanner).toBeFalsy();
    // });

    // test('when premium user, premium features can be used', async ({ page }) => {
    //     await utils.loginOptionsPage(premiumUserEmail, premiumUserPassword, page);
    //     await page.click('#wittyworks-options-content-section-configure-rules');

    //     const inclusiveToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-become-an-inclusion-pro', '#toggle-button-become-an-inclusion-pro', false);
    //     expect(inclusiveToggle).toBe(true);

    //     const inspirationToggle = await utils.evaluateToggleBackgroundBeforeAndAfterClick(page, '#toggle-encloser-show-inspirations-to-rephrase-entire-sentences', '#toggle-button-show-inspirations-to-rephrase-entire-sentences', false);
    //     expect(inspirationToggle).toBe(true);
    // });

    // test('when preium user, reset to team settings button is visible', async ({ page }) => {
    //     await utils.loginOptionsPage(premiumUserEmail, premiumUserPassword, page);
    //     await page.click('#wittyworks-options-content-section-configure-rules');
    //     const resetToTeamSettingsButton = await page.waitForSelector('.wittyworks-options-button-wrapper .wittyworks-options-button');
    //     expect(resetToTeamSettingsButton).toBeTruthy();
    // });
});