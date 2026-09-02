import { openFileViaSearchbar } from '../../../helpers';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { VendorInvoices } from '../../../pages/FilePages/VendorInvoices';
import { LoginPage } from '../../../pages/LoginPage';
import { expect, test } from '../../../fixtures';
import { APIServices } from '../../../services/apiServices';
import { FilesPage } from '../../../pages/FilesPage';
import { InvoicePage } from '../../../pages/InvoicePage';
import { Locator } from '@playwright/test';

/**
 * TEST DATA CONSTANTS
 */
const expectedHeaders = [
    'Vendor',
    'File Name',
    'Invoice Number',
    'Invoice Amount',
    'Invoice Date',
    'Upload Date',
    'Uploaded By',
    'Status',
    'Status Date',
];

const expectedFeeTypes = [
    'Admin Fee',
    'Bailiff Fee',
    'Brokerage Fee',
    'Carfax Fee',
    'Credit Bureau Fee',
    'Dealer Misrep Fee',
    'Doorknock Fee',
    'Fuel Fee',
    'Impound Fee',
    'Insolvency Storage Fee',
    'Insurance Search',
    'Key Replacement Fee',
    'Legal Fee',
    'Miscellaneous Fee',
    'MVS Fee',
    'No Fee',
    'Postage Fee',
    'PPSA Amendment Fee',
    'PPSA Search',
    'Priority Lien',
    'Recon Fee',
    'Redemption Fee',
    'Registration Fee',
    'Repair Fee',
    'Sale Fee',
    'Sale Fee (Not Pass Through)',
    'Skip Trace Fee',
    'Storage Fee',
    'Transport Fee',
    'Vehicle History Search',
    'VIN Search Fee',
    'Wire Fee',
];

test('Verify full fee-type catalog and invoice approval/exception workflow @requires-triggers', async ({ page, request, loginAs }) => {
    // Extended timeout to 1 minute to accommodate the large number of row entries (32+ rows)
    test.setTimeout(90000);

    // Declare shared variables at test scope
    let apiService: APIServices;
    let fileRef: string;
    let fileHomePage: FileHomePage;
    let fileVendorInvoices: VendorInvoices;
    let invoiceNumber: string;
    let invoiceRow: Locator;

    // ─── SETUP & NAVIGATION ───────────────────────────────────────────────────

    await test.step('Setup: Create file via API, login as super admin, and navigate to Vendor Invoices', async () => {
        apiService = await APIServices.create(request);
        const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

        await navigateToLoginPage(page);
        const loginPage = await LoginPage.getInstance(page);
        await expect(loginPage.login_button).toBeVisible();

        await loginAs('super_admin');
        fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

        fileHomePage = await FileHomePage.getInstance(page);
        await expect(fileHomePage.assignmentOption).toBeVisible();
        await fileHomePage.vendorInvoicesOption.click();
    });

    // ─── UPLOAD PROCESS & TABLE UI VALIDATION ────────────────────────────────

    await test.step('Upload invoice and verify Vendor Invoice summary table headers', async () => {
        fileVendorInvoices = await VendorInvoices.getInstance(page);
        await expect(fileVendorInvoices.upload_invoice_button).toBeVisible();

        // Upload an invoice and capture the dynamic invoice number for later tracking
        invoiceNumber = await fileVendorInvoices.uploadInvoiceAsAdmin();

        // Define the specific table row for this invoice to verify status updates later
        invoiceRow = await fileVendorInvoices.getVendorInvoiceRowByInvoiceNumber(invoiceNumber);
        await expect(invoiceRow).toBeVisible({ timeout: 5000 });

        // Verify that all required columns are present in the summary table
        for (const headerText of expectedHeaders) {
            const header = page.getByRole('columnheader', { name: headerText, exact: true });
            await expect(header).toBeVisible();
        }
    });

    // ─── EDIT MODAL & INITIAL STATE VALIDATION ───────────────────────────────

    await test.step('Open edit modal and verify initial Zero Balance rule and button states', async () => {
        await fileVendorInvoices.openEditInvoiceModal(invoiceNumber);

        // Verify 'Zero Balance' rule is enforced initially
        let zeroBalanceAlert = page.getByRole('cell', { name: 'Balance must be zero before' });
        await expect(zeroBalanceAlert).toBeVisible();

        // Verify Action buttons are in the correct initial state
        await expect(fileVendorInvoices.review_invoice_approve_button).toBeDisabled();
        await expect(fileVendorInvoices.review_invoice_reject_button).toBeEnabled();
    });

    // ─── MASS DATA ENTRY LOOP ────────────────────────────────────────────────

    await test.step('Populate invoice with all fee types and final balancing row', async () => {
        const addRowIcon = page.locator(fileVendorInvoices.review_vendor_invoice_add_row_icon);

        // Mass Data Entry Loop (32 Rows)
        for (let i = 0; i < expectedFeeTypes.length; i++) {
            // Step 1: Add a new row starting from the second iteration
            if (i > 0) {
                await addRowIcon.scrollIntoViewIfNeeded();
                await addRowIcon.dblclick();
            }

            // Step 2: Handle Fee Type Selection
            const feeTypeDropdown = page.getByRole('cell', { name: 'Select...' });
            await expect(feeTypeDropdown).toBeVisible();
            await feeTypeDropdown.click();

            // Safety check: ensure dropdown list is visible before clicking option
            let isDropdownVisible = await page
                .getByRole('option', { name: expectedFeeTypes[i], exact: true })
                .isVisible();
            if (!isDropdownVisible) {
                await feeTypeDropdown.click(); // Re-click if dropdown didn't open correctly
            }
            await page.getByRole('option', { name: expectedFeeTypes[i], exact: true }).click();

            // Step 3: Populate Row Inputs (Amount & Description)
            await fileVendorInvoices.fillInvoiceRowData(i, {
                amount: '10',
                description: `Automatic entry for ${expectedFeeTypes[i]}`,
            });
        }

        // Add one last row (Index 32) to balance the total invoice amount
        await addRowIcon.dblclick();

        const lastFeeDropdown = page.getByRole('cell', { name: 'Select...' });
        await expect(lastFeeDropdown).toBeVisible();
        await lastFeeDropdown.dblclick();
        if (await page.getByRole('option', { name: 'Admin Fee', exact: true }).isVisible({ timeout: 2000 })) {
            await page.getByRole('option', { name: 'Admin Fee', exact: true }).click();
        } else {
            await lastFeeDropdown.click();
            await page.getByRole('option', { name: 'Admin Fee', exact: true }).click();
        }

        // Populate final row with specific values needed for zero-balance
        await fileVendorInvoices.fillInvoiceRowData(32, {
            amount: '565',
            description: 'Final Admin Row',
            hst: '73.40',
        });

        // Trigger UI calculation logic by tabbing out of the final field
        const hstInput = page.locator('input[name="rows.32.HST"]');
        await hstInput.press('Tab');
    });

    // ─── VALIDATION & SUBMISSION ─────────────────────────────────────────────

    await test.step('Verify balance alert clears, approve invoice, and check Approved status', async () => {
        // The balance alert should vanish once the math is correct
        await expect(page.getByRole('cell', { name: 'Balance must be zero before' })).toBeHidden();

        // Approve the invoice and verify the status change in the main table
        await fileVendorInvoices.review_invoice_approve_button.click();

        // Verify the status cell within our specific invoice row updates to 'Approved'
        await expect(
            invoiceRow.filter({
                has: page.getByRole('cell', { name: 'Approved', exact: true }),
            })
        ).toBeVisible({ timeout: 5000 });
    });

    // ─── TRIGGER JOB & VERIFY ACCOUNTING SECTION ─────────────────────────────

    await test.step('Trigger pending invoices job and verify fee entries in Accounting section', async () => {
        await apiService.triggerPendingVendorInvoices();

        // Navigate to the Accounting section to confirm the new invoice is listed with correct details
        await fileHomePage.accountingOption.click();

        let feeEntries = page.locator('[class="mb-4"]').filter({ hasText: invoiceNumber });
        await expect(feeEntries).toHaveCount(expectedFeeTypes.length + 1); // 32 fee types + 1 final admin row
    });

    // ─── FINAL STATUS VERIFICATION ───────────────────────────────────────────

    await test.step('Verify final Exception status on File page and global Invoices page', async () => {
        await page.reload(); // Refresh to ensure all dynamic data is loaded
        await fileHomePage.vendorInvoicesOption.click();

        // Asserting status change after triggering cloud scheduled job
        await expect(
            invoiceRow.filter({
                has: page.getByRole('cell', { name: 'Exception', exact: true }),
            })
        ).toBeVisible({ timeout: 5000 });

        // Going to invoices page and asserting the invoice is visible in the list with correct status
        let filesPage = await FilesPage.getInstance(page);
        await filesPage.invoices_button.click();

        let invoicesPage = await InvoicePage.getInstance(page);
        await invoicesPage.exception_card.click();

        let invoiceCell = page.locator(invoicesPage.invoice_cell_selector).filter({ hasText: invoiceNumber });
        await expect(invoiceCell).toBeVisible({ timeout: 5000 });
    });

    // ─── CLEANUP ─────────────────────────────────────────────────────────────

    await test.step('Cleanup: Delete test file via API', async () => {
        if (apiService && fileRef) {
            await apiService.deleteFile(fileRef);
        }
    });
});
