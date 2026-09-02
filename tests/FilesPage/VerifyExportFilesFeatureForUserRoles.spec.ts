import { test, expect } from '../../fixtures';
import { openFileViaSearchbar } from '../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../navigation-helpers';
import { FilesPage } from '../../pages/FilesPage';
import { LoginPage } from '../../pages/LoginPage';
import { APIServices } from '../../services/apiServices';

const EXPECTED_EXPORT_HEADER =
    'refNumber,accountNumber,debtor,province,client,stage,status,assignmentDate,closedDate,lastActivity';
const CLIENT_EXPECTED_EXPORT_HEADER =
    'refNumber,accountNumber,debtor,province,stage,status,assignmentDate,closedDate,lastActivity,principalBalanceOutstanding';

test.describe('Export Files Feature for User Roles', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Verify Admin, Bailiff, and Client Roles can export active files', async ({ page, request, loginAs }) => {
        apiService = await APIServices.create(request);

        // Updated helper to accept a 'role' parameter
        const exportAndVerifyFiles = async (filesPage: FilesPage, role: 'admin' | 'bailiff' | 'client') => {
            await expect(filesPage.create_file_button).toBeVisible();
            await expect(filesPage.active_files_button).toBeVisible();
            await page.waitForTimeout(500);

            // Wait for the backend to load the number before grabbing the text
            await expect(filesPage.active_files_button).toHaveText(/\d/);

            let activeFilesText = await filesPage.active_files_button.innerText();
            const activeFilesNumber = activeFilesText ? parseInt(activeFilesText.replace(/\D/g, ''), 10) : 0;

            const downloadPromise = page.waitForEvent('download');
            await filesPage.export_to_excel_button.click();

            const download = await downloadPromise;
            const stream = await download.createReadStream();
            if (!stream) {
                throw new Error('Failed to create read stream from the download.');
            }

            const chunks: Buffer[] = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            const fileContent = Buffer.concat(chunks).toString('utf8');

            // Split by newline (handling Windows/Mac formats) and filter empty rows
            const rows = fileContent.split(/\r?\n/).filter((row) => row.trim() !== '');

            // Dynamically assign expected header based on role
            const expectedHeader = role === 'client' ? CLIENT_EXPECTED_EXPORT_HEADER : EXPECTED_EXPORT_HEADER;
            const actualHeader = rows[0].trim();
            expect(actualHeader).toBe(expectedHeader);

            // Dynamically calculate row count based on role
            const dataRowsCount = role === 'admin' ? rows.length : rows.length - 1;

            // This allows a difference of 0, 1, 2, or 3 (both positive and negative)
            expect(Math.abs(dataRowsCount - activeFilesNumber)).toBeLessThanOrEqual(3);
        };

        await test.step('Action: Admin logs in and successfully exports active files', async () => {
            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('basic_admin');

            const filesPage = await FilesPage.getInstance(page);
            await exportAndVerifyFiles(filesPage, 'admin');

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Bailiff logs in and successfully exports active files', async () => {
            await loginAs('bailiff');

            const filesPage = await FilesPage.getInstance(page);
            await exportAndVerifyFiles(filesPage, 'bailiff');

            await logoutAsCurrentUser(page);
        });

        await test.step('Action: Client logs in and successfully exports active files', async () => {
            await loginAs('client');

            const filesPage = await FilesPage.getInstance(page);
            await exportAndVerifyFiles(filesPage, 'client');

            await logoutAsCurrentUser(page);
        });
    });
});
