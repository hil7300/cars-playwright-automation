// fixtures.ts
import { test as base, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { CredentialManager } from './credential-manager';
import { FilesPage } from './pages/FilesPage';

// Define the custom fixtures we want to use in tests
type MyFixtures = {
    loginAs: (userType: string) => Promise<void>;
};

export const test = base.extend<MyFixtures>({
    loginAs: async ({ page }, use, testInfo) => {
        // Define the helper function that the test will call
        const loginAction = async (userType: string) => {
            // 1. Get the Worker Index (0, 1, 2...)
            const workerId = testInfo.parallelIndex;

            // 2. Get the specific credentials for this worker
            const { username, password } = CredentialManager.getCredentials(userType, workerId);

            console.log(`Worker ${workerId} logging in as ${userType} (${username})`);

            // 3. Perform the login using the Page Object
            const loginPage = await LoginPage.getInstance(page);
            await loginPage.loginWithCredentials(username, password);

            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.notifications_button).toBeVisible({ timeout: 10000 });
            await expect(filesPage.search_textbox).toBeVisible({ timeout: 10000 });
        };

        // Pass this function to the test
        await use(loginAction);
    },
});

export { expect } from '@playwright/test';
