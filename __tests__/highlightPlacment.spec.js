const { test: base, chromium, expect } = require('@playwright/test') //add firefox
require('dotenv').config();
const utils = require('./utils');

const premiumUserEmail = process.env.PREMIUM_TEST_USER_EMAIL;
const premiumUserPassword = process.env.PREMIUM_TEST_USER_PASSWORD;
const testText = 'The basics: Witty highlights biased and gendered language in orange: Hey guys, we\'re excited to announce a new front-end developer will assume the leadership role. Taylor has extensive expertise and a strong technical background. Witty highlights inclusive terms in green: We are a creative team. Witty corrects grammar and spelling mistakes. They are highlighted in red: This is a spelling mistacke. Wait... there is more. Witty highlights style issues in yellow: This is actually a very long meeting.'
const testTextShort = ' Hey guys, we\'re excited to announce a new front-end developer will assume the leadership role.'

const test = base.extend({
    context: async ({ browserName }, use) => {
        const browserTypes = { chromium } //add firefox
        const pathToExtension = ('./extension/chrome');
        const launchOptions = {
            proxy: {
                server: process.env.PROXY_SERVER,
                username: process.env.PROXY_USERNAME,
                password: process.env.PROXY_PASSWORD
            },
            trace: 'on',
            devtools: false,
            headless: false,
            viewport: {
                width: 1920,
                height: 1080
            },


            args: [
                `--no-sandbox`,
                `--disable-setuid-sandbox`,
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
        await page.goto('https://www.witty.works/editor');
        await page.waitForLoadState('networkidle')
        await page.waitForSelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
        await page.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');

        await page.waitForSelector('#witty-test');
        await page.click('#witty-test');

        await page.waitForTimeout(3000); //wait for api to respond with highlights

        await page.locator('#witty-test').screenshot().then(async (screenshot) => {
            expect(screenshot).toMatchSnapshot({
                maxDiffPixels: 900,
            },
                'witty-form-not-logged-in.png')
        });
    });

    test('witty form', async ({ page, context }) => {
        const extensionId = await utils.getExtensionId(page);
        await utils.loginDashboard(premiumUserEmail, premiumUserPassword, page);
        await utils.enableAllToggles(page);
        await utils.loginPopupPage(page, extensionId, context);

        await page.goto('https://www.witty.works/editor');
        await page.waitForLoadState('networkidle')

        await page.waitForSelector('#witty-test');
        await page.click('#witty-test');
        await page.waitForTimeout(3000); //wait for api to respond with highlights

        await page.locator('#witty-test').screenshot().then(async (screenshot) => {
            //screenshot accuracy can be adjusted by: maxDiffPixels: 36000, maxDiffPixelRatio: 0.05
            expect(screenshot).toMatchSnapshot({
                maxDiffPixels: 300,
            },
                'witty-form.png')
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

