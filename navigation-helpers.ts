import { expect, Locator, Page } from '@playwright/test';
import links from './links.json';
import { FilesPage } from './pages/FilesPage';
import { LoginPage } from './pages/LoginPage';

const ENV = process.env.ENV || 'dev'; // default to 'dev'

async function navigateToPage(page: Page, url: string): Promise<boolean> {
    try {
        await page.goto(url);
        return true;
    } catch (e) {
        throw new Error(`Navigation failed: ${e}`);
    }
}

type Env = keyof typeof links.loginPages;

async function navigateToLoginPage(page: Page) {
    const env: Env = (ENV in links.loginPages ? ENV : 'dev') as Env;
    const loginUrl = links.loginPages[env];

    if (!loginUrl) {
        throw new Error(`Login URL not found for environment: ${env}`);
    }

    await navigateToPage(page, loginUrl);
}

async function navigateToSection(page: Page, name: string): Promise<void> {
    const buttonLocator: Locator = page.getByRole('button', { name }).first();
    const linkLocator: Locator = page.getByRole('link', { name }).first();
    const [isButtonVisible, isLinkVisible] = await Promise.all([buttonLocator.isVisible(), linkLocator.isVisible()]);
    if (isButtonVisible) {
        await buttonLocator.click();
        return;
    }
    if (isLinkVisible) {
        await linkLocator.click();
        return;
    }
    throw new Error(`No visible button or link found with name: "${name}"`);
}

async function logoutAsCurrentUser(page: Page) {
    let filesPage = await FilesPage.getInstance(page);
    await expect(filesPage.logout_button).toBeVisible();
    await filesPage.logout_button.click();
    await expect(filesPage.logout_button).toBeHidden();
    let loginPage = await LoginPage.getInstance(page);
    await expect(loginPage.login_button).toBeVisible();
}

async function navigateToInvoicesPage(page: Page) {
    let filesPage = await FilesPage.getInstance(page);
    await expect(filesPage.invoices_button).toBeVisible();
    await filesPage.invoices_button.click();
    await expect(page.getByRole('heading', { name: 'Vendor Invoices' })).toBeVisible();
}

export { navigateToLoginPage, navigateToSection, logoutAsCurrentUser, navigateToInvoicesPage };
