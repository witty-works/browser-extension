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

test.describe('Options', () => {
    // User not logged in
    // test('clicking logo opens a page in another window', async ({ page, context }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('#witty-logo-white');
    //     await page.waitForTimeout(5000);
    //     let pages = await context.pages();
    //     expect(pages.length).toBe(3);
    // });

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

    ////first section
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

    //     const inclusionPro = await page.waitForSelector('#toggle-encloser-become-an-inclusion-pro');
    //     const inclusionProBackgroundBefore = await inclusionPro.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-become-an-inclusion-pro');
    //     const inclusionProBackgroundAfter = await inclusionPro.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(inclusionProBackgroundBefore).toBe(inclusionProBackgroundAfter);

    //     const inspirations = await page.waitForSelector('#toggle-encloser-show-inspirations-to-rephrase-entire-sentences');
    //     const inspirationsBackgroundBefore = await inspirations.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-show-inspirations-to-rephrase-entire-sentences');
    //     const inspirationsBackgroundAfter = await inspirations.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(inspirationsBackgroundBefore).toBe(inspirationsBackgroundAfter);
    // });

    // test('when clicking unlocked toggles, they change color', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('#wittyworks-options-content-section-configure-rules');

    //     const neutralPronouns = await page.waitForSelector('#toggle-encloser-use-gender-neutral-pronouns-in-english');
    //     const neutralPronounsBackgroundBefore = await neutralPronouns.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-use-gender-neutral-pronouns-in-english');
    //     await page.waitForTimeout(2000);
    //     const neutralPronounsBackgroundAfter = await neutralPronouns.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(neutralPronounsBackgroundBefore).not.toBe(neutralPronounsBackgroundAfter);


    //     const inclusive = await page.waitForSelector('#toggle-encloser-highlight-inclusive-terms');
    //     const InclusiveBackgroundBefore = await inclusive.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-highlight-inclusive-terms');
    //     await page.waitForTimeout(2000);
    //     const InclusiveBackgroundAfter = await inclusive.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(InclusiveBackgroundBefore).not.toBe(InclusiveBackgroundAfter);


    //     const style = await page.waitForSelector('#toggle-encloser-highlight-style-issues');
    //     const StyleIssuesBackgroundBefore = await style.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-highlight-style-issues');
    //     await page.waitForTimeout(2000);
    //     const StyleIssuesBackgroundAfter = await style.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(StyleIssuesBackgroundBefore).not.toBe(StyleIssuesBackgroundAfter);

    //     const grammar = await page.waitForSelector('#toggle-encloser-check-grammar---spelling');
    //     const GrammarBackgroundBefore = await grammar.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     await page.click('#toggle-button-check-grammar---spelling');
    //     await page.waitForTimeout(2000);
    //     const GrammarBackgroundAfter = await grammar.evaluate((el) => {
    //         return window.getComputedStyle(el).getPropertyValue('background-color');
    //     });
    //     expect(GrammarBackgroundBefore).not.toBe(GrammarBackgroundAfter);
    // });


    ////secons section 
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

    ////user is logged in 
    // test('user can log in', async ({ page }) => {
    //     await page.goto(`chrome-extension://${extensionId}/options.html`);
    //     await page.click('.wittyworks-options-button');
    //     await page.waitForTimeout(3000);
    //     await page.type('#email', 'witty.works.user@gmail.com');
    //     await page.type('#password', 'gdx@PGM-vdz6pjg5rkm');
    //     await page.click('#next');
    //     await page.waitForTimeout(3000);

    //     const logout = await page.$('.wittyworks-options-logout');
    //     expect(logout).toBeTruthy();

    //     const accountInfo = await page.$('.wittyworks-options-login-text');
    //     expect(accountInfo).toBeTruthy();
    // });

    //if subscription is witty me, the upgrade banner is shown 
    // test('if subscription is witty me, the upgrade banner is shown', async ({ page }) => {
    // });


    ////interaction with dashboard
    test('when user makes changes on dashboard, options page is updated', async ({ page }) => {
        await page.goto(`https://dev-54ta5gq-56xlfiudba6c2.fr-4.platformsh.site/en`);
        await page.waitForSelector('#CybotCookiebotDialog');
        await page.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
        await page.click('.navigation-wrapper .navigation-link:nth-child(1)');

        await page.waitForTimeout(2000);

        await page.type('#email', 'witty.works.user@gmail.com');
        await page.type('#password', 'gdx@PGM-vdz6pjg5rkm');
        await page.click('#next');
        await page.waitForTimeout(3000);

        await page.click('.onboarding-quick-links-container .onboarding-iconWrapper:nth-child(2)');
        await page.waitForTimeout(2000);
        await page.click('.onboarding-quick-links-container .onboarding-iconWrapper:nth-child(1)');

        await page.waitForTimeout(2000);

        //edit settings

        //go tooptions page and confirm settings are updated


    });

});
