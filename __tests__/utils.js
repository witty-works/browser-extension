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
    await page.waitForTimeout(2000);
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

exports.loginLinkedin = async function (email, password, page) {
    await page.goto('https://www.linkedin.com/login?fromSignIn=true&trk=guest_homepage-basic_nav-header-signin');
    await page.click('#username');
    await page.type('#username', email);
    await page.click('#password');
    await page.type('#password', password);
    await page.click('#organic-div > form > div.login__form_action_container > button');
    return page;
}

exports.loginTwitter = async function (email, password, page) {
    await page.goto('https://twitter.com/login');
    await page.waitForTimeout(2000);
    await page.click('.r-30o5oe');
    await page.type('.r-30o5oe', email);
    await page.keyboard.press('Enter');

    await page.waitForTimeout(2000);
    //because twitter asks for username when suspicious behavior is detected
    if (await page.$('[data-testid=ocfEnterTextTextInput]')) {
        await page.click('[data-testid=ocfEnterTextTextInput]');
        await page.type('[data-testid=ocfEnterTextTextInput]', 'test_user_ww');
        await page.keyboard.press('Enter');
    }

    await page.click('.r-homxoj');
    await page.type('.r-homxoj', password);
    await page.click('.r-1inkyih > .css-901oao');
    await page.waitForTimeout(2000);
    return page;
}

exports.loginGithub = async function (email, password, page) {
    await page.goto('https://github.com/login');
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('#login_field');
    await page.click('#login_field');
    await page.type('#login_field', email);
    await page.click('#password');
    await page.type('#password', password);
    await page.keyboard.press('Enter');
    await page.waitForSelector('body');
    return page;
}

// exports.loginGmail = async function (email, password, page) {
// await page.goto('https://accounts.google.com/signin/v2/identifier?continue=https%3A%2F%2Fmail.google.com%2Fmail%2F&service=mail&sacu=1&rip=1&ifkv=AQN2RmVSKBRduno3H3r8dltSOH6cTX3XQQJDr6_LhAGMvMJUiQkvwh7DCdb-rNRDmd9EsKIz8MqB&flowName=GlifWebSignIn&flowEntry=ServiceLogin');

// await page.waitForTimeout(2000);
// await page.click('#identifierId');
// await page.type('#identifierId', email);
// await page.keyboard.press('Enter');

// await page.waitForTimeout(2000);
// await page.click('#password .whsOnd');
// await page.type('#password .whsOnd', password);
// await page.keyboard.press('Enter');

// await page.waitForTimeout(2000);
// return page;
// }

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