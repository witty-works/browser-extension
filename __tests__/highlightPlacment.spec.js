const { test: base, chromium, expect } = require('@playwright/test') //add firefox
require('dotenv').config();
const utils = require('./utils');
const testText = 'The basics: Witty highlights biased and gendered language in orange: Hey guys, we\'re excited to announce a new front-end developer will assume the leadership role. Taylor has extensive expertise and a strong technical background. Witty highlights inclusive terms in green: We are a creative team. Witty corrects grammar and spelling mistakes. They are highlighted in red: This is a spelling mistacke. Wait... there is more. Witty highlights style issues in yellow: This is actually a very long meeting.'
const premiumUserEmail = process.env.PREMIUM_TEST_USER_EMAIL;
const premiumUserPassword = process.env.PREMIUM_TEST_USER_PASSWORD;
const apiWaitTime = 5000;
const htaccessUsername = process.env.HTACCESS_USERNAME;
const htaccessPassword = process.env.HTACCESS_PASSWORD;
const test = base.extend({
    context: async ({ browserName }, use) => {
        const browserTypes = { chromium } //add firefox
        const pathToExtension = ('./extension/chrome');
        const launchOptions = {
            // proxy: {
            //     server: process.env.PROXY_SERVER,
            //     username: process.env.PROXY_USERNAME,
            //     password: process.env.PROXY_PASSWORD
            // },
            httpCredentials: {
                username: htaccessUsername,
                password: htaccessPassword,
            },
            trace: 'on',
            devtools: false,
            headless: false,
            viewport: {
                width: 1920,
                height: 1080
            },
            args: [
                `--disable-extensions-except=${pathToExtension}`,
                `--load-extension=${pathToExtension}`,
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

test.setTimeout(120000)
test.use({ screenshot: 'on' })


test.describe('Highlights', () => {
    test('witty form not logged in', async ({ page }) => {
        await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
        await page.waitForSelector('#hs-eu-confirmation-button');
        await page.click('#hs-eu-confirmation-button');
        await utils.unlockAllToggles(page);

        await page.goto('https://dev-54ta5gq-56xlfiudba6c2.fr-4.platformsh.site/en/editor');
        await page.waitForTimeout(apiWaitTime); 
        await page.waitForSelector('#example-1');
        await page.click('#example-1');
        await page.click('.fr-element');

        await page.waitForTimeout(apiWaitTime); //wait for api to respond with highlights

        await page.locator('.fr-element').screenshot().then(async (screenshot) => {
            expect(screenshot).toMatchSnapshot({
                maxDiffPixels: 300,
            },
                'witty-form-not-logged-in.png')
        });
    });

    test('witty form', async ({ page, context }) => {
        await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
        await page.waitForSelector('#hs-eu-confirmation-button');
        await page.click('#hs-eu-confirmation-button');
        await utils.unlockAllToggles(page);

        const extensionId = await utils.getExtensionId(page);
        await utils.loginPopupPage(page, extensionId, context);

        await page.goto('https://dev-54ta5gq-56xlfiudba6c2.fr-4.platformsh.site/en/editor');
        await page.waitForTimeout(apiWaitTime); 
        await page.waitForSelector('#example-1');
        await page.click('#example-1');
        await page.click('.fr-element');

        await page.waitForTimeout(apiWaitTime); //wait for api to respond with highlights

        await page.locator('.fr-element').screenshot().then(async (screenshot) => {
            //screenshot accuracy can be adjusted by: maxDiffPixels: 36000, maxDiffPixelRatio: 0.05
            expect(screenshot).toMatchSnapshot({
                maxDiffPixels: 300,
            },
                'witty-form.png')
        });
    });

    test('no highlights after disabling witty', async ({ page, context }) => {
        await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
        await page.waitForSelector('#hs-eu-confirmation-button');
        await page.click('#hs-eu-confirmation-button');

        const extensionId = await utils.getExtensionId(page);
        await utils.loginPopupPage(page, extensionId, context);

        //make sure witty is disabled
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        const enableWittyToggle = await page.waitForSelector('#toggle-encloser-enable-witty');
        const backgroundColorEnableToggle = await enableWittyToggle.evaluate((toggle) => {
            return window.getComputedStyle(toggle).getPropertyValue('background-color');
        });
        if (backgroundColorEnableToggle === 'rgb(95, 202, 125)') {
            await page.click('#toggle-encloser-enable-witty');
            await page.waitForTimeout(apiWaitTime);
        }
        
        await page.goto('https://dev-54ta5gq-56xlfiudba6c2.fr-4.platformsh.site/en/editor');
        await page.waitForLoadState('networkidle')
        await page.waitForSelector('#example-1');
        await page.click('#example-1');
        await page.click('.fr-element');

        await page.waitForTimeout(apiWaitTime); //wait for api to respond with highlights

        await page.locator('.fr-element').screenshot().then(async (screenshot) => {
            //enable witty again 
            await page.goto(`chrome-extension://${extensionId}/popup.html`);
            await page.click('#toggle-encloser-enable-witty');
            await page.waitForTimeout(apiWaitTime);

            expect(screenshot).toMatchSnapshot({
                maxDiffPixels: 300,
            },
                'no-highlights-after-disabling-witty.png')
        });
    });
    
    // //ASKING FOR reCAPTCHA
    // test('twitter writing post', async ({ page, context }) => {
    //     test.skip(process.env.CI, 'skip in pipeline');
    //     const extensionId = await utils.getExtensionId(page);
    //     await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
    //     await utils.loginPopupPage(page, extensionId, context);

    //     await utils.loginTwitter(premiumUserEmail, premiumUserPassword, page);
    //     await page.waitForSelector('.r-z2wwpe');
    //     await page.click('.r-z2wwpe');
    //     await page.type('.r-z2wwpe', testTextShort);
    //     await page.waitForTimeout(3000);

    //     await page.locator('.r-z2wwpe').screenshot().then(async (screenshot) => {
    //         expect(screenshot).toMatchSnapshot('twitter-post.png')
    //     });
    // });

    // test('twitter writing comment', async ({ page, context }) => {
    //     test.skip(process.env.CI, 'skip in pipeline');
    //     const extensionId = await utils.getExtensionId(page);
    //     await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
    //     await utils.loginPopupPage(page, extensionId, context);

    //     await utils.loginTwitter(premiumUserEmail, premiumUserPassword, page);
    //     await page.waitForSelector('.r-z2wwpe');
    //     await page.goto('https://twitter.com/lsmith/status/1481306915695210501?s=21');
    //     await page.waitForSelector('.r-z2wwpe');
    //     await page.click('.r-z2wwpe');
    //     await page.type('.r-z2wwpe', testTextShort);
    //     await page.waitForTimeout(3000);

    //     await page.locator('.r-z2wwpe').screenshot().then(async (screenshot) => {
    //         expect(screenshot).toMatchSnapshot('twitter-comment.png')
    //     });
    // });

    // //FONT ISSUE IN PIPELINE
    // test('linkedin post', async ({ page }) => {
    //     test.skip(process.env.CI, 'skip in pipeline');
    //     await utils.loginLinkedin(premiumUserEmail, premiumUserPassword, page);
    //     await page.click('#main > div:nth-child(1) > div > div.display-flex.align-items-center.mt2.mr4.ml4 > button');
    //     await page.click('.ql-editor');
    //     await page.type('.ql-editor', testText);
    //     await page.waitForTimeout(3000);

    //     await page.locator('.ql-editor > p').screenshot().then(async (screenshot) => {
    //         expect(screenshot).toMatchSnapshot('linkedin-post.png')
    //     });
    // });


    // test('linkedin message', async ({ page }) => {
    //     test.skip(process.env.CI, 'skip in pipeline');
    //     await utils.loginLinkedin(premiumUserEmail, premiumUserPassword, page);
    //     await page.goto('https://www.linkedin.com/messaging/thread/new/');
    //     await page.waitForSelector('.msg-form__contenteditable');
    //     await page.click('.msg-form__contenteditable');
    //     await page.type('.msg-form__contenteditable', testText);
    //     await page.waitForTimeout(3000); //wait for api to respond with highlights

    //     await page.locator('.msg-form__contenteditable').screenshot().then(async (screenshot) => {
    //         expect(screenshot).toMatchSnapshot('linkedin-message.png')
    //     });
    // });

    // //MANAGES TO BLOCK PROXY
    // test('github comment', async ({ page }) => {
    //     test.skip(process.env.CI, 'skip in pipeline');
    //     await utils.loginGithub(premiumUserEmail, premiumUserPassword, page);
    //     await page.goto('https://github.com/premiumUserWW/test/issues/1');
    //     await page.waitForLoadState('networkidle')
    //     await page.waitForSelector('#new_comment_field');
    //     await page.click('#new_comment_field');
    //     await page.type('#new_comment_field', testText);
    //     await page.waitForTimeout(3000);

    //     await page.locator('#new_comment_field').screenshot().then(async (screenshot) => {
    //         expect(screenshot).toMatchSnapshot('github-comment.png')
    //     });
    // });

    // test('github create issue', async ({ page }) => {
    //     test.skip(process.env.CI, 'skip in pipeline');
    //     await utils.loginGithub(premiumUserEmail, premiumUserPassword, page);
    //     await page.goto('https://github.com/premiumUserWW/test/issues/new');
    //     await page.waitForLoadState('networkidle')
    //     await page.waitForSelector('#issue_title');
    //     await page.click('#issue_body');
    //     await page.type('#issue_body', testText);
    //     await page.waitForTimeout(3000);

    //     await page.locator('#issue_body').screenshot().then(async (screenshot) => {
    //         expect(screenshot).toMatchSnapshot('github-create-issue.png')
    //     });
    // });

    // // test('gmail writing an email', async ({ page }) => {
    // //     await utils.loginGmail(premiumUserEmail, premiumUserPassword, page);
    // //     await page.waitForTimeout(3000);
    // //     expect(await page.screenshot()).toMatchSnapshot('gmail-email.png');
    // // });
});

