const { test: base, chromium, expect } = require('@playwright/test') //add firefox

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

test.describe('Integration', () => {
    test('witty-is-installed tag is present', async ({ page }) => {
        await page.goto(`https://www.witty.works/editor`)
        const wittyIsInstalledTag = await page.evaluate(() => {
            return document.querySelector('witty-is-installed')
        })
        expect(wittyIsInstalledTag).toBeTruthy()
    });
});