import { getActiveTabs } from '../source/Background/index'

describe("Web-Extension Helpers", () => {
    describe("getActiveTabs()", () => {
        it("should return active tabs", async () => {
            const tabs: any[] = [{id: 1}, {id: 2}];
            mockBrowser.tabs.query.expect({ active: true }).andResolve(tabs);

            expect(await getActiveTabs()).toEqual(tabs);
        });
    });
});
