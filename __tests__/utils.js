const extensionId = process.env.EXTENSION_ID_DEV;

exports.loginOptionsPage = async function (email, password, page) {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.selectOption('.dropdown-select', 'Dev');

    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.click('.wittyworks-options-button');
    await page.waitForTimeout(2000);
    await page.type('#email', email);
    await page.type('#password', password);
    await page.click('#next');
    await page.waitForTimeout(3000);
    return page;
}

exports.loginDashboard = async function (email, password, page) {
    await page.goto(`https://dev-54ta5gq-56xlfiudba6c2.fr-4.platformsh.site/en`);
    await page.waitForSelector('#CybotCookiebotDialog');
    await page.click('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');
    await page.click('.navigation-wrapper .navigation-link:nth-child(1)');
    await page.type('#email', email);
    await page.type('#password', password);
    await page.click('#next');
    await page.waitForTimeout(2000);
    return page;
}

exports.loginOptionsPageWhenAlreadyLoggedInDashboard = async function (page) {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.selectOption('.dropdown-select', 'Dev');
    await page.waitForTimeout(1000);

    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.click('.wittyworks-options-button');
    await page.waitForTimeout(3000);
    return page;
}

exports.evaluateToggleBackgroundBeforeAndAfterClick = async function (page, toggleSelector, toggleButtonSelector, locked) {
    const toggle = await page.waitForSelector(toggleSelector);
    const toggleBackgroundBefore = await toggle.evaluate((el) => {
        return window.getComputedStyle(el).getPropertyValue('background-color');
    });
    await page.click(toggleButtonSelector);
    await page.waitForTimeout(2000);
    const toggleBackgroundAfter = await toggle.evaluate((el) => {
        return window.getComputedStyle(el).getPropertyValue('background-color');
    });
    if (locked) {
        return toggleBackgroundBefore == toggleBackgroundAfter
    } else {
        return toggleBackgroundBefore != toggleBackgroundAfter
    }
}

exports.evaluateToggleBackgroundBeforeAndAfterClickPopupToOptionsPage = async function (page, toggleSelector, toggleButtonSelector) {
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.click('.wittyworks-options-content-section-title');
    let toggle = await page.waitForSelector(toggleSelector);
    const backgroundColorBefore = await toggle.evaluate((el) => {
        return window.getComputedStyle(el).getPropertyValue('background-color');
    });
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.click(toggleButtonSelector);
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.click('.wittyworks-options-content-section-title');

    toggle = await page.waitForSelector(toggleSelector);
    const backgroundColorAfter = await toggle.evaluate((el) => {
        return window.getComputedStyle(el).getPropertyValue('background-color');
    });
    return backgroundColorBefore != backgroundColorAfter;
}

exports.evaluateToggleBackgroundBeforeAndAfterClickOptionsToPopupPage = async function (page, toggleSelector, toggleButtonSelector) {
    let toggle = await page.waitForSelector(toggleSelector);
    const backgroundColorBefore = await toggle.evaluate((el) => {
        return window.getComputedStyle(el).getPropertyValue('background-color');
    });
    await page.goto(`chrome-extension://${extensionId}/options.html`);
    await page.click('.wittyworks-options-content-section-title');
    await page.click(toggleButtonSelector);
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    toggle = await page.waitForSelector(toggleSelector);
    const backgroundColorAfter = await toggle.evaluate((el) => {
        return window.getComputedStyle(el).getPropertyValue('background-color');
    });
    return backgroundColorBefore != backgroundColorAfter;
}
