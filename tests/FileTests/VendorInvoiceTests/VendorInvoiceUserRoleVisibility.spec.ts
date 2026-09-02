import { approveVendorInvoice, openFileViaSearchbar, openRandomFile } from '../../../helpers';
import { logoutAsCurrentUser, navigateToInvoicesPage, navigateToLoginPage } from '../../../navigation-helpers';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { VendorInvoices } from '../../../pages/FilePages/VendorInvoices';
import { LoginPage } from '../../../pages/LoginPage';
import { expect, test } from '../../../fixtures';
import { APIServices } from '../../../services/apiServices';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { InvoicePage } from '../../../pages/InvoicePage';
import { Locator } from '@playwright/test';

// Determine the current environment (defaults to 'dev')
const currentEnv = (process.env.ENV || 'dev').toLowerCase();
const isStg = currentEnv === 'stg';

// Centralized test data and timeout configurations
const TEST_DATA = {
    // Dynamic company selection based on environment
    bailiffCompany: isStg ? 'ABCD | ABC Bailiff Moncton' : 'ABCD | ABC Bailiff Toronto',
    bailiffAssignment: ['Auto Bailiff-Toronto-Two', 'Auto Bailiff-Toronto', 'Auto Bailiff-Vancouver'],
    clientType: 'Client',
    clientBank: 'Bank 3',
    bailiffType: 'Bailiff',
    adminFee: 'Admin Fee',
    bailiffFee: 'Bailiff Fee',
    syncTimeOut: 5000,
};

test('Verify invoice approval/exception/manually posted/rejected workflow @requires-triggers', async ({ page, request, loginAs }) => {
    test.setTimeout(90000);

    let apiService: APIServices;
    let fileRef: string;
    let fileDetails: { accountNumber: string; randomFirstName: string; randomLastName: string };
    let fileHomePage: FileHomePage;
    let assignmentSection: Assignments;
    let vendorInvoiceSection: VendorInvoices;
    let invoiceNumber: string; // "Bank 3" Invoice
    let exceptionInvoiceNumber: string; // "Bailiff Company" Invoice
    let bailiffInvoiceNumber: string; // Subcontractor Invoice
    let adminInvoiceRow: Locator;
    let exceptionInvoiceRow: Locator;
    let bailiffInvoiceRow: Locator;

    // ─── SETUP & NAVIGATION ───────────────────────────────────────────────────

    await test.step('Setup: Create file via API and navigate to login page', async () => {
        apiService = await APIServices.create(request);
        fileDetails = await apiService.createNewAutoAssetFileViaAPI();
        await navigateToLoginPage(page);
        const loginPage = await LoginPage.getInstance(page);
        await expect(loginPage.login_button).toBeVisible();
    });

    // ─── ADMIN: ASSIGN BAILIFF & UPLOAD INVOICES ─────────────────────────────

    await test.step('Admin: Login, assign Bailiff to file, and upload invoices', async () => {
        await loginAs('basic_admin');
        fileRef = await openFileViaSearchbar(page, fileDetails.accountNumber);

        fileHomePage = await FileHomePage.getInstance(page);
        await expect(fileHomePage.assignmentOption).toBeVisible();
        await fileHomePage.assignmentOption.click();

        assignmentSection = await Assignments.getInstance(page);
        await assignmentSection.assignCompanyToFile(
            'Bailiff',
            TEST_DATA.bailiffCompany,
            TEST_DATA.bailiffAssignment,
            false
        );

        await fileHomePage.vendorInvoicesOption.click();

        vendorInvoiceSection = await VendorInvoices.getInstance(page);
        await expect(vendorInvoiceSection.upload_invoice_button).toBeVisible();

        // 1. Upload Bank 3 Invoice
        invoiceNumber = await vendorInvoiceSection.uploadInvoiceAsAdmin('Client', TEST_DATA.clientBank);

        // 2. Upload Bailiff Company Invoice
        exceptionInvoiceNumber = await vendorInvoiceSection.uploadInvoiceAsAdmin('Bailiff', TEST_DATA.bailiffCompany);

        // Verify duplicate detection
        await vendorInvoiceSection.uploadInvoiceAsAdmin('Client', TEST_DATA.clientBank, invoiceNumber);
        await expect(page.locator('#toast-1')).toHaveText(
            `Vendor invoice already exists for invoiceNumber: ${invoiceNumber}`
        );
        await vendorInvoiceSection.vendor_invoice_cancel_button.click();

        adminInvoiceRow = await vendorInvoiceSection.getVendorInvoiceRowByInvoiceNumber(invoiceNumber);
        exceptionInvoiceRow = await vendorInvoiceSection.getVendorInvoiceRowByInvoiceNumber(exceptionInvoiceNumber);
    });

    // ─── BAILIFF: ACCEPT ASSIGNMENT & UPLOAD INVOICE ─────────────────────────

    await test.step('Bailiff: Login, accept assignment without quote, and upload invoice', async () => {
        await logoutAsCurrentUser(page);
        await loginAs('bailiff');
        await openFileViaSearchbar(page, fileRef);

        fileHomePage = await FileHomePage.getInstance(page);
        await expect(fileHomePage.assignmentOption).toBeVisible();
        await fileHomePage.assignmentOption.click();

        assignmentSection = await Assignments.getInstance(page);
        await assignmentSection.acceptAssignmentWithoutQuote();

        await fileHomePage.vendorInvoicesOption.click();

        vendorInvoiceSection = await VendorInvoices.getInstance(page);
        await expect(vendorInvoiceSection.upload_invoice_button).toBeVisible();

        await expect(adminInvoiceRow).toBeHidden();

        // 3. Upload Subcontractor Invoice
        bailiffInvoiceNumber = await vendorInvoiceSection.uploadInvoiceAsSubcontractor();
    });

    // ─── MANAGER ADMIN: VERIFY VISIBILITY & APPROVE ALL INVOICES ─────────────

    await test.step('Manager Admin: Login, verify all invoices are visible, and approve them', async () => {
        await logoutAsCurrentUser(page);
        await loginAs('manager_admin');
        await openFileViaSearchbar(page, fileRef);

        await fileHomePage.vendorInvoicesOption.click();
        vendorInvoiceSection = await VendorInvoices.getInstance(page);

        bailiffInvoiceRow = await vendorInvoiceSection.getVendorInvoiceRowByInvoiceNumber(bailiffInvoiceNumber);
        await expect(bailiffInvoiceRow).toBeVisible();
        await expect(adminInvoiceRow).toBeVisible();
        await expect(exceptionInvoiceRow).toBeVisible();
        
        await approveVendorInvoice(page, invoiceNumber, TEST_DATA.adminFee);
        await approveVendorInvoice(page, exceptionInvoiceNumber, TEST_DATA.bailiffFee);
        await approveVendorInvoice(page, bailiffInvoiceNumber, TEST_DATA.bailiffFee);
        await expect(bailiffInvoiceRow).toBeVisible()
        await expect(adminInvoiceRow).toBeVisible();
        await expect(exceptionInvoiceRow).toBeVisible();
    });

    // ─── POST-APPROVAL: TRIGGER & VERIFY STATUSES ────────────────────────────

    await test.step('Verify invoice statuses after triggering pending vendor invoices', async () => {
        await apiService.triggerPendingVendorInvoices();
        await page.reload();
        await fileHomePage.vendorInvoicesOption.click();

        // Map expected statuses based on environment
        const expectedBank3Status = isStg ? 'Exception' : 'Pending Payment';
        const expectedBailiffCoStatus = isStg ? 'Pending Payment' : 'Exception';

        // Bank 3 Invoice (adminInvoiceRow)
        await expect(
            adminInvoiceRow.filter({
                has: page.getByRole('cell', { name: expectedBank3Status, exact: true }),
            })
        ).toBeVisible({ timeout: TEST_DATA.syncTimeOut });

        // Bailiff Company Invoice (exceptionInvoiceRow)
        await expect(
            exceptionInvoiceRow.filter({
                has: page.getByRole('cell', { name: expectedBailiffCoStatus, exact: true }),
            })
        ).toBeVisible({ timeout: TEST_DATA.syncTimeOut });

        // Subcontractor Invoice -> Always Approved
        await expect(
            bailiffInvoiceRow.filter({
                has: page.getByRole('cell', { name: 'Approved', exact: true }),
            })
        ).toBeVisible({ timeout: TEST_DATA.syncTimeOut });
    });

    // ─── PROCESS EXCEPTION INVOICE FLOW ──────────────────────────────────────

    await test.step('Process the "Exception" invoice manually to Sage, then update to Paid', async () => {
        // Dynamically select which invoice went to "Exception" status
        const targetInvoiceNum = isStg ? invoiceNumber : exceptionInvoiceNumber;
        const targetRow = isStg ? adminInvoiceRow : exceptionInvoiceRow;

        await vendorInvoiceSection.openEditInvoiceModal(targetInvoiceNum);

        await expect(vendorInvoiceSection.post_to_sage_button).toBeEnabled();
        await expect(vendorInvoiceSection.manually_posted_to_sage_button).toBeEnabled();
        await vendorInvoiceSection.manually_posted_to_sage_button.click();

        await expect(
            targetRow.filter({
                has: page.getByRole('cell', { name: 'Exception', exact: true }),
            })
        ).not.toBeVisible({ timeout: TEST_DATA.syncTimeOut });
        
        await expect(
            targetRow.filter({
                has: page.getByRole('cell', { name: 'Manually Posted', exact: true }),
            })
        ).toBeVisible({ timeout: TEST_DATA.syncTimeOut });

        await vendorInvoiceSection.openEditInvoiceModal(targetInvoiceNum);
        await expect(page.getByRole('button', { name: 'Manually Posted' })).toBeDisabled();
        await expect(vendorInvoiceSection.update_to_paid_button).toBeEnabled();
        await vendorInvoiceSection.update_to_paid_button.click();

        await expect(
            targetRow.filter({
                has: page.getByRole('cell', { name: 'Manually Posted to Sage', exact: true }),
            })
        ).not.toBeVisible({ timeout: TEST_DATA.syncTimeOut });
        
        await expect(
            targetRow.filter({
                has: page.getByRole('cell', { name: 'Paid', exact: true }),
            })
        ).toBeVisible({ timeout: TEST_DATA.syncTimeOut });
    });

    // ─── PROCESS PENDING PAYMENT INVOICE FLOW ────────────────────────────────

    await test.step('Process the "Pending Payment" invoice to Paid', async () => {
        // Dynamically select which invoice went to "Pending Payment" status
        const targetInvoiceNum = isStg ? exceptionInvoiceNumber : invoiceNumber;
        const targetRow = isStg ? exceptionInvoiceRow : adminInvoiceRow;

        await vendorInvoiceSection.openEditInvoiceModal(targetInvoiceNum);

        await expect(page.getByRole('button', { name: 'Pending Payment' })).toBeDisabled();
        await expect(vendorInvoiceSection.update_to_paid_button).toBeEnabled();
        await vendorInvoiceSection.update_to_paid_button.click();

        await expect(
            targetRow.filter({
                has: page.getByRole('cell', { name: 'Pending Payment', exact: true }),
            })
        ).not.toBeVisible({ timeout: TEST_DATA.syncTimeOut });

        await expect(
            targetRow.filter({
                has: page.getByRole('cell', { name: 'Paid', exact: true }),
            })
        ).toBeVisible({ timeout: TEST_DATA.syncTimeOut });
    });

    // ─── INVOICES PAGE: FINAL GLOBAL STATUS VERIFICATION ─────────────────────

    await test.step('Invoices page: Verify final Paid and Approved statuses globally', async () => {
        await navigateToInvoicesPage(page);
        let invoicesPage = await InvoicePage.getInstance(page);

        // Bank 3 and Bailiff Company invoices should both appear under the Paid card
        await invoicesPage.paid_card.click();

        let adminPaidInvoiceCell = page.locator(invoicesPage.invoice_cell_selector).filter({ hasText: invoiceNumber });
        await expect(adminPaidInvoiceCell).toBeVisible({ timeout: TEST_DATA.syncTimeOut });

        let exceptionPaidInvoiceCell = page
            .locator(invoicesPage.invoice_cell_selector)
            .filter({ hasText: exceptionInvoiceNumber });
        await expect(exceptionPaidInvoiceCell).toBeVisible({ timeout: TEST_DATA.syncTimeOut });

        // Subcontractor invoice should still appear under Approved (not yet marked Paid)
        await invoicesPage.approved_card.click();
        let bailiffApprovedInvoiceCell = page
            .locator(invoicesPage.invoice_cell_selector)
            .filter({ hasText: bailiffInvoiceNumber });
        await expect(bailiffApprovedInvoiceCell).toBeVisible({ timeout: TEST_DATA.syncTimeOut });
    });

    // ─── CLEANUP ─────────────────────────────────────────────────────────────

    await test.step('Cleanup: Delete test file via API', async () => {
        await apiService.deleteFile(fileRef);
    });
});