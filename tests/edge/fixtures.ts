import { test as base, type Page } from "@playwright/test";
export { expect } from "@playwright/test";

/** The once-a-day coin popup covers the home screen; tests close it when it shows. */
export function skipDaily(page: Page) {
  void page.addLocatorHandler(
    page.getByText(/^(Today's reward|جایزه‌ی امروز)$/),
    async () => {
      await page
        .getByRole("button", { name: /^(Later|بعداً)$/ })
        .click({ timeout: 2000 })
        .catch(() => undefined);
    },
  );
}

export const test = base.extend<object, object>({
  browser: [
    async ({ browser }, use) => {
      const newContext = browser.newContext.bind(browser);
      browser.newContext = async (options) => {
        const context = await newContext(options);
        context.on("page", skipDaily);
        return context;
      };
      await use(browser);
    },
    { scope: "worker" },
  ],
  page: async ({ page }, use) => {
    skipDaily(page);
    await use(page);
  },
});
