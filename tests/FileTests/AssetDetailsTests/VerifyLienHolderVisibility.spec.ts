import { test, expect } from '../../../fixtures';
import { openFileViaSearchbar } from '../../../helpers';
import { logoutAsCurrentUser, navigateToLoginPage } from '../../../navigation-helpers';
import { AssetDetails } from '../../../pages/FilePages/AssetDetails';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';
import { FilesPage } from '../../../pages/FilesPage';
import { SettingsPage } from '../../../pages/SettingsPage';
import { Assignments } from '../../../pages/FilePages/Assignments';

test.describe('Verify Lien Holder Visibility Based on User Roles', () => {
    let apiService: APIServices;
    let fileRef = '';

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Verify Lien Holder Read/Write Visibility across different User Roles', async ({ page, request, loginAs }) => {
        // Extended timeout to accommodate 4 different logins + VIN API polling
        test.setTimeout(90000);

        apiService = await APIServices.create(request);

        // --- Page Objects Shared Across Steps ---
        let assetDetails: AssetDetails;
        let fileHomePage: FileHomePage;
        let assignments: Assignments;

        // --- Test Data ---
        let fileDetails: { accountNumber: string };
        const permissionSection = 'Files - Asset Details section';
        const settingName = 'Asset Details - Lien Holder Data';

        await test.step('Setup: Create asset file via API', async () => {
            fileDetails = await apiService.createNewAutoAssetFileViaAPI();
        });

        await test.step('Verify default Lien Holder permissions in Settings as Super Admin', async () => {
            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('super_admin');
            const filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.search_textbox).toBeVisible();
            await expect(filesPage.settings_button).toBeVisible();
            await expect(filesPage.companies_button).toBeVisible();
            await filesPage.settings_button.click();

            const settingsPage = await SettingsPage.getInstance(page);
            await expect(settingsPage.user_roles_tab).toBeVisible();
            await settingsPage.user_roles_tab.click();

            // Check Subcontractor (Expected: No Read, No Write)
            await settingsPage.subcontractor_role_setting_dropdown.click();
            const subcontractorSettings = await settingsPage.getSettingToggleLocator(permissionSection, settingName);
            await expect(subcontractorSettings.readToggle).toHaveAttribute('aria-checked', 'false');
            await expect(subcontractorSettings.writeToggle).toHaveAttribute('aria-checked', 'false');
            await settingsPage.subcontractor_role_setting_dropdown.click(); // Collapse

            // Check Client (Expected: Read Only)
            await settingsPage.client_role_setting_dropdown.click();
            const clientSettings = await settingsPage.getSettingToggleLocator(permissionSection, settingName);
            await expect(clientSettings.readToggle).toHaveAttribute('aria-checked', 'true');
            await expect(clientSettings.writeToggle).toHaveAttribute('aria-checked', 'false');
            await settingsPage.client_role_setting_dropdown.click(); // Collapse

            // Check Basic Admin (Expected: Read and Write)
            await settingsPage.basic_admin_role_setting_dropdown.click();
            const basicAdminSettings = await settingsPage.getSettingToggleLocator(permissionSection, settingName);
            await expect(basicAdminSettings.readToggle).toHaveAttribute('aria-checked', 'true');
            await expect(basicAdminSettings.writeToggle).toHaveAttribute('aria-checked', 'true');
            await settingsPage.basic_admin_role_setting_dropdown.click(); // Collapse

            await logoutAsCurrentUser(page);
        });

        await test.step('Log in as Basic Admin, assign file, and request VIN Search', async () => {
            await loginAs('basic_admin');

            // Note: Keeping your existing logic that openFileViaSearchbar returns a file reference
            fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

            fileHomePage = await FileHomePage.getInstance(page);
            await fileHomePage.assignmentOption.click();

            assignments = await Assignments.getInstance(page);
            await assignments.assignCompanyToFile(
                'Bailiff',
                'ABCD | ABC Bailiff Toronto',
                ['Auto Bailiff-Toronto-Two', 'Auto Bailiff-Toronto', 'Auto Bailiff-Vancouver'],
                false
            );

            await fileHomePage.assetDetailsOption.click();
            assetDetails = await AssetDetails.getInstance(page);

            // Request VIN Search
            await expect(assetDetails.request_VIN_search_button).toBeEnabled();
            await assetDetails.request_VIN_search_button.click();
            await expect.soft(assetDetails.request_VIN_search_button).toContainText('Pending', { timeout: 10000 });
            await expect(assetDetails.request_VIN_search_button).toBeDisabled();
        });

        await test.step('Confirm VIN search processing completes', async () => {
            await assetDetails.confirmVinSearchCompleted(apiService);
        });

        await test.step('Verify Basic Admin role has full Read/Write access to Lien Holders', async () => {
            const lienHolderTable = page.locator(assetDetails.lien_holder_table_selector);

            await expect(lienHolderTable).toBeVisible();
            await expect(assetDetails.save_lien_discharge_button).toBeVisible();
            await expect(assetDetails.request_lien_discharge_button).toBeVisible();

            await logoutAsCurrentUser(page);
        });

        await test.step('Verify Subcontractor role cannot view Lien Holders (No Read/Write)', async () => {
            await loginAs('bailiff');
            await openFileViaSearchbar(page, fileRef);

            await fileHomePage.assignmentOption.click();
            await assignments.acceptAssignmentWithoutQuote();

            await fileHomePage.assetDetailsOption.click();
            const lienHolderTable = page.locator(assetDetails.lien_holder_table_selector);

            await expect(assetDetails.request_VIN_search_button).toBeHidden();
            await expect(lienHolderTable).toBeHidden();

            await logoutAsCurrentUser(page);
        });

        await test.step('Verify Client role has Read-Only access to Lien Holders', async () => {
            await loginAs('client');
            await openFileViaSearchbar(page, fileRef);

            await fileHomePage.assetDetailsOption.click();
            const lienHolderTable = page.locator(assetDetails.lien_holder_table_selector);

            await expect(lienHolderTable).toBeVisible();
            await expect(assetDetails.save_lien_discharge_button).toBeHidden();
            await expect(assetDetails.request_lien_discharge_button).toBeHidden();
        });
    });
});
