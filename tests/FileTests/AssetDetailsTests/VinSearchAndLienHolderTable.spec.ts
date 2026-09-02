import path from 'path';
import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { AssetDetails } from '../../../pages/FilePages/AssetDetails';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';
import { FileSidebar } from '../../../pages/FilePages/FileSideBar';
import { Documents } from '../../../pages/FilePages/Documents';

test.describe('Verify VIN Search Functionality', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Verify VIN Search request status updates to Complete', async ({ page, request, loginAs }) => {
        test.setTimeout(60000); // Set timeout to 1 minute for this test
        apiService = await APIServices.create(request);

        // --- Page Objects Shared Across Steps ---
        let assetDetails: AssetDetails;
        let fileHomePage: FileHomePage;
        let fileSidebar: FileSidebar;
        let documents: Documents;

        await test.step('Setup: Create file, log in as Admin, and navigate to Asset Details', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('basic_admin');
            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

            fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assetDetailsOption).toBeVisible();
            await fileHomePage.assetDetailsOption.click();
        });

        await test.step('Request VIN search and verify Pending status', async () => {
            assetDetails = await AssetDetails.getInstance(page);
            await expect(assetDetails.request_VIN_search_button).toBeVisible();
            await expect(assetDetails.request_VIN_search_button).toBeEnabled();
            await assetDetails.request_VIN_search_button.click();

            await expect.soft(assetDetails.request_VIN_search_button).toContainText('Pending', { timeout: 10000 });
            await expect(assetDetails.request_VIN_search_button).toBeDisabled();
        });

        await test.step('Trigger backend processing and wait for Complete status', async () => {
            await assetDetails.confirmVinSearchCompleted(apiService);
        });

        await test.step('Verify Lien Holder table is displayed with correct data', async () => {
            await expect(assetDetails.save_lien_discharge_button).toBeVisible();
            await expect(assetDetails.request_lien_discharge_button).toBeVisible();

            let lienHolderTable = page.locator(assetDetails.lien_holder_table_selector);
            await expect(lienHolderTable).toBeVisible();

            let lienStatusCells = lienHolderTable.locator(assetDetails.lien_status_cell_selector);

            await expect(lienStatusCells).toHaveCount(3);
            await expect(lienStatusCells.nth(0)).toContainText('Active');

            await lienStatusCells.nth(0).click();
            await lienStatusCells.nth(0).getByRole('combobox').selectOption('Discharged');
        });

        await test.step('Verify that a lien discharge statement can be uploaded successfully', async () => {
            await expect(assetDetails.choose_lien_file_button).toBeVisible();
            await expect(assetDetails.lien_discharge_upload_button).toBeDisabled();
            const fileChooserPromise = page.waitForEvent('filechooser');
            await assetDetails.choose_lien_file_button.click();

            const fileChooser = await fileChooserPromise;
            let filePath = path.join(__dirname, '../../..', 'test-resources', 'test_invoice_1MB.pdf');
            await fileChooser.setFiles(filePath);

            await assetDetails.lien_discharge_type_dropdown.click();
            await page.getByRole('option', { name: '3rd Party Lien Release' }).click();
            await expect(assetDetails.lien_discharge_upload_button).toBeEnabled();
            await assetDetails.lien_discharge_description_textbox.fill('Test Lien Discharge Description');
            await assetDetails.lien_discharge_upload_button.click();

            await expect(assetDetails.lien_discharge_upload_button).toBeHidden();
        });

        await test.step('Verify that lien is discharged', async () => {
            fileSidebar = await FileSidebar.getInstance(page);
            await expect(fileSidebar.audit_log_tab).toBeVisible();
            await fileSidebar.audit_log_tab.click();
            let firstAuditLogEntry = page.locator(fileSidebar.audit_log_entries_selector).first();
            await expect(firstAuditLogEntry).toContainText('Discharged');
        });

        await test.step('Verify the documents section and deletion log', async () => {
            await expect(fileHomePage.documentsOption).toBeVisible();
            await fileHomePage.documentsOption.click();

            documents = await Documents.getInstance(page);
            const documentRows = page
                .locator(documents.documents_table_selector)
                .locator(documents.document_row_selector);

            await expect(documentRows).toHaveCount(3);

            const firstRow = documentRows.first();
            await expect(firstRow).toContainText('3rd Party Lien Release');

            // Delete the document
            await firstRow.locator(documents.delete_document_icon_selector).click();
            await page.getByRole('button', { name: 'Delete' }).click();

            // Verify Audit Logs updated
            const auditLogs = page.locator(fileSidebar.audit_log_entries_selector);
            await expect(auditLogs.first()).toContainText('3rd Party Lien Release document');
            await expect(auditLogs.nth(1)).toContainText('Active');
        });
    });
});
