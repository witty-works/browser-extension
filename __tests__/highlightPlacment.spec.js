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

test.describe('Highlights', () => {
    test('witty form', async ({ page }) => {
        await page.goto('https://www.witty.works/editor');
        await page.waitForLoadState('networkidle')
        await page.waitForSelector('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
        await page.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
        await page.waitForSelector('#witty-test');
        await page.click('#witty-test');
        // await page.type('#witty-test', 'a');
        await page.waitForTimeout(3000); //wait for api to respond with highlights

        await page.locator('#witty-test').screenshot().then(async (screenshot) => {
            expect(screenshot).toMatchSnapshot('witty-form.png', {
                maxDiffPixels: 50,
            })
        });
    });



    // test('linkedin post', async ({ page }) => {
    //     await utils.loginLinkedin(premiumUserEmail, premiumUserPassword, page);

    //     await page.waitForSelector('#ember27');
    //     await page.click('#ember27');
    //     await page.waitForSelector('.ql-editor > p');
    //     await page.click('.ql-editor > p');
    //     await page.type('.ql-editor > p', testText);
    //     await page.waitForTimeout(3000);

    //     expect(await page.screenshot({
    //         clip: {
    //             x: 430,
    //             y: 0,
    //             width: 550,
    //             height: 450
    //         }
    //     })).toMatchSnapshot('linkedin-post.png');
    // });

    // test('linkedin message', async ({ page }) => {
    //     await utils.loginLinkedin(premiumUserEmail, premiumUserPassword, page);

    //     await page.goto('https://www.linkedin.com/messaging/thread/new/');
    //     await page.waitForSelector('.msg-form__contenteditable');
    //     await page.click('.msg-form__contenteditable');
    //     await page.type('.msg-form__contenteditable', testText);
    //     await page.waitForTimeout(3000); //wait for api to respond with highlights

    //     expect(await page.screenshot({
    //         clip: {
    //             x: 430,
    //             y: 500,
    //             width: 500,
    //             height: 250
    //         }
    //     })).toMatchSnapshot('linkedin-message.png');
    // });

    // test('twitter writing post', async ({ page }) => {
    //     await utils.loginTwitter(premiumUserEmail, premiumUserPassword, page);

    //     await page.click('.public-DraftStyleDefault-block');
    //     await page.type('.public-DraftStyleDefault-block', testTextShort);
    //     await page.waitForTimeout(3000);

    //     expect(await page.screenshot({
    //         clip: {
    //             x: 370,
    //             y: 0,
    //             width: 600,
    //             height: 300
    //         }
    //     })).toMatchSnapshot('twitter-post.png');
    // });

    // test('twitter writing comment', async ({ page }) => {
    //     await utils.loginTwitter(premiumUserEmail, premiumUserPassword, page);

    //     await page.goto('https://twitter.com/lsmith/status/1481306915695210501?s=21');
    //     await page.click('.public-DraftStyleDefault-block');
    //     await page.type('.public-DraftStyleDefault-block', testTextShort);
    //     await page.waitForTimeout(3000);

    //     expect(await page.screenshot({
    //         clip: {
    //             x: 350,
    //             y: 400,
    //             width: 600,
    //             height: 250
    //         }
    //     })).toMatchSnapshot('twitter-comment.png');
    // });

    // test('github comment', async ({ page }) => {
    //     await utils.loginGithub(premiumUserEmail, premiumUserPassword, page);
    //     await page.goto('https://github.com/premiumUserWW/test/issues/1');
    //     await page.click('#new_comment_field');
    //     await page.type('#new_comment_field', testText);
    //     await page.waitForTimeout(3000);
    //     expect(await page.screenshot({
    //         clip: {
    //             x: 0,
    //             y: 450,
    //             width: 1400,
    //             height: 450
    //         }
    //     })).toMatchSnapshot('github-comment.png');
    // });

    // test('github create issue', async ({ page }) => {
    //     await utils.loginGithub(premiumUserEmail, premiumUserPassword, page);
    //     await page.goto('https://github.com/premiumUserWW/test/issues/new');
    //     await page.click('#issue_body');
    //     await page.type('#issue_body', testText);
    //     await page.waitForTimeout(3000);
    //     expect(await page.screenshot({
    //         clip: {
    //             x: 0,
    //             y: 300,
    //             width: 1400,
    //             height: 350
    //         }
    //     })).toMatchSnapshot('github-create-issue.png');
    // });

    // // test('gmail writing an email', async ({ page }) => {
    // //     await utils.loginGmail(premiumUserEmail, premiumUserPassword, page);
    // //     expect(await page.screenshot()).toMatchSnapshot('gmail-email.png');
    // // });
});
