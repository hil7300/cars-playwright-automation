import { test, expect } from '../../../fixtures';
import {
    getDaysDifference,
    getEndOfMonthDate,
    getFutureDate,
    getPastDate,
    getTodaysDate,
    openFileViaSearchbar,
} from '../../../helpers';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { RepoDetails } from '../../../pages/FilePages/RepoDetails';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';

test.describe('Verify Days Past Due Calculation', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Verify Days Past Due Calculation inside Repo section', async ({ page, request, loginAs }) => {
        apiService = await APIServices.create(request);

        // Define Page Objects and Variables at the test level to share across steps
        let repoDetails: RepoDetails;
        let assignmentDate: string;
        let pastDueDate: string;
        let futureDueDate: string;
        let monthEndDate: string;

        await test.step('Setup: Create file, log in as Admin, and navigate to Repo Details', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('basic_admin');
            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

            const fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.repoDetailsOption).toBeVisible();
            await fileHomePage.repoDetailsOption.click();

            repoDetails = await RepoDetails.getInstance(page);
            await expect(repoDetails.next_payment_date_textbox).toBeVisible();
        });

        await test.step('Input Payment Dates and Save', async () => {
            // Generate dates
            assignmentDate = await getTodaysDate();
            pastDueDate = await getPastDate();
            futureDueDate = await getFutureDate();
            monthEndDate = getEndOfMonthDate(assignmentDate);

            // Fill Next Payment Date
            await repoDetails.next_payment_date_textbox.fill(futureDueDate);
            await page.keyboard.press('Tab'); // Trigger onBlur validation if any

            // Fill Last Payment Date
            await expect(repoDetails.last_payment_date_textbox).toBeVisible();
            await repoDetails.last_payment_date_textbox.fill(pastDueDate);
            await page.keyboard.press('Tab'); // Trigger onBlur validation if any

            // Save the form
            await expect(repoDetails.repo_save_button).toBeEnabled();
            await repoDetails.repo_save_button.click();

            // Wait briefly for the UI to calculate and render the new Days Past Due values
            // (Ideally, replace this with a wait for a network response or a success toast)
            await page.waitForTimeout(1000);
        });

        await test.step('Validate Calculated Days Past Due Values', async () => {
            // Calculate expected days (returns numbers)
            const expectedDpdAtAssignment: number = getDaysDifference(pastDueDate, assignmentDate);
            const expectedDpdToday: number = getDaysDifference(pastDueDate, assignmentDate);
            const expectedDpdAtMonthEnd: number = getDaysDifference(pastDueDate, monthEndDate);

            // Assert UI matches expected calculations
            await expect(repoDetails.days_past_due_at_assignment_textbox).toHaveValue(String(expectedDpdAtAssignment));
            await expect(repoDetails.days_past_due_today_textbox).toHaveValue(String(expectedDpdToday));
            await expect(repoDetails.days_past_due_at_month_end_textbox).toHaveValue(String(expectedDpdAtMonthEnd));
        });
    });
});
