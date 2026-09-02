import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export class LoginPage {
    private page: Page;
    username_textbox: Locator;
    password_textbox: Locator;
    login_button: Locator;

    constructor(page: Page) {
        this.page = page;
    }

    private async initialize() {
        this.username_textbox = this.page.locator('[name="username"]');
        this.password_textbox = this.page.locator('[name="password"]');
        this.login_button = this.page.getByRole('button', { name: 'Continue' });
    }

    static async getInstance(page: Page) {
        const instance = new LoginPage(page);
        await instance.initialize();
        return instance;
    }

    async loginAs(userType: string): Promise<void> {
        const ENV = process.env.ENV || 'dev';
        let username: string;
        let password: string;
        if (process.env.CI) {
            // Expect CI secrets like ADMIN_USERNAME_STG, AGENT_USERNAME_DEV, etc.
            const unameKey = `CARS_${ENV.toUpperCase()}_${userType.toUpperCase()}_USERNAME`;
            const pwdKey = `CARS_${ENV.toUpperCase()}_${userType.toUpperCase()}_PASSWORD`;
            if (!process.env[unameKey] || !process.env[pwdKey]) {
                throw new Error(`Missing CI secrets for ${userType} in ${ENV} environment.`);
            }
            username = process.env[unameKey];
            password = process.env[pwdKey];
            if (!username || !password) {
                throw new Error(`Missing CI secrets for ${userType} in ${ENV} environment.`);
            }
        } else {
            const credentialsPath = path.resolve(__dirname, '..', 'credentials.json');
            if (!fs.existsSync(credentialsPath)) {
                throw new Error('Local credentials.json not found.');
            }
            const raw = fs.readFileSync(credentialsPath, 'utf-8');
            const creds = JSON.parse(raw);
            if (!creds[ENV] || !creds[ENV][userType]) {
                throw new Error(`No credentials found for ${userType} in ${ENV} environment.`);
            }
            username = creds[ENV][userType].username;
            password = creds[ENV][userType].password;
        }

        // Perform login
        await expect(this.username_textbox).toBeVisible({ timeout: 10000 });
        await this.username_textbox.fill(username);
        await this.password_textbox.fill(password);
        await this.login_button.click();
        await expect(this.page.getByRole('banner').filter({ hasText: 'Welcome Back!' })).toBeVisible();
        await this.page.getByRole('banner').filter({ hasText: 'Welcome Back!' }).getByRole('button').click();
    }

    async loginWithCredentials(username: string, password: string): Promise<void> {
        await expect(this.username_textbox).toBeVisible({ timeout: 10000 });
        await expect(this.password_textbox).toBeVisible({ timeout: 10000 });
        await expect(this.login_button).toBeVisible({ timeout: 10000 });
        await this.username_textbox.fill(username);
        await expect(this.password_textbox).toBeVisible({ timeout: 10000 });
        await this.password_textbox.fill(password);
        await this.login_button.click();
        await expect(this.login_button).not.toBeVisible({ timeout: 10000 }); // Wait for login to complete

        // Handle Welcome banner
        // const banner = this.page.getByRole('banner').filter({ hasText: 'Welcome Back!' });
        // await expect(banner).toBeVisible({ timeout: 30000 });
        // await banner.getByRole('button').click();
    }
}
