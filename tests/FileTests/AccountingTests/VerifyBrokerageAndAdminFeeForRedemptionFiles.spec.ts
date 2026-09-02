import { Download, Locator, Page } from '@playwright/test';
import { test, expect } from '../../../fixtures';
import { extractPdfText, openFileViaSearchbar } from '../../../helpers';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { CompaniesPage } from '../../../pages/CompaniesPage';
import { Accounting } from '../../../pages/FilePages/Accounting';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { Requests } from '../../../pages/FilePages/Requests';
import { FilesPage } from '../../../pages/FilesPage';
import { LoginPage } from '../../../pages/LoginPage';
import { APIServices } from '../../../services/apiServices';
import fs from 'fs';
import { FileSidebar } from '../../../pages/FilePages/FileSideBar';

const CLIENT_USERS = ['Automated Fee Bank User'];
const ADMIN_USERS = ['Auto Admin-Basic'];
const CLOSED_STAGE = 'Closed';
const CLOSED_STATUS = 'Redeemed';
const INVOICE_TYPE = 'Redemption';

test.describe('Verify Admin and Brokerage Fees are generated after Request is Approved (Redemption)', () => {
    let apiService: APIServices;
    let fileRef = '';
    let fileHomePage: FileHomePage;
    let assignments: Assignments;
    let filesPage: FilesPage;
    let companiesPage: CompaniesPage;
    let accounting: Accounting;
    let requests: Requests;
    let fileSideBar: FileSidebar;

    let adminFeeRow: Locator;
    let brokerageFeeRow: Locator;
    let fileBuffer: Buffer;

    test.afterEach(async () => {
        if (fileRef && apiService) {
            console.log(`Cleaning up file: ${fileRef}`);
            await apiService.deleteFile(fileRef);
        }
    });

    test('Verify Admin and Brokerage Fees are generated after Request is Approved for Redemption File', async ({
        page,
        request,
        loginAs,
    }) => {
        test.setTimeout(60000);
        apiService = await APIServices.create(request);

        await test.step('Setup: Create file, log in as Admin, and assign roles', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI('Automated Fee Bank');
            fileRef = fileDetails.accountNumber;

            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('super_admin');
            filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.search_textbox).toBeVisible();
            fileRef = await openFileViaSearchbar(page, fileRef);

            fileHomePage = await FileHomePage.getInstance(page);
            await expect(fileHomePage.assignmentOption).toBeVisible();
            await fileHomePage.assignmentOption.click();

            assignments = await Assignments.getInstance(page);
            await assignments.assignUsersToAssignedCompany(ADMIN_USERS, 'Admin');
            await assignments.assignUsersToAssignedCompany(CLIENT_USERS, 'Client');
        });

        await test.step('Verify Company Fee Schedule has Admin/Brokerage rows for Redeemed', async () => {
            await filesPage.companies_button.click();
            companiesPage = await CompaniesPage.getInstance(page);
            await expect(companiesPage.search_textbox).toBeVisible();
            await companiesPage.searchCompanyByName('Automated Fee Bank');

            const companyRow = page.locator(companiesPage.company_row_selector).filter({ hasText: 'Automated Fee Bank' });
            await expect(companyRow).toBeVisible();

            const editButton = companyRow.locator(companiesPage.edit_company_button);
            await expect(editButton).toBeVisible();
            await editButton.click();

            await expect(companiesPage.fees_tab).toBeVisible();
            await companiesPage.fees_tab.click();

            await expect(
                page.locator(companiesPage.fee_schedule_row_selector).filter({ hasText: 'Admin Fee' }).filter({ hasText: INVOICE_TYPE })
            ).toBeVisible();
            await expect(
                page.locator(companiesPage.fee_schedule_row_selector).filter({ hasText: 'Brokerage Fee' }).filter({ hasText: INVOICE_TYPE })
            ).toBeVisible();
        });

        await test.step('Prepare Accounting redemption data and Request to Close', async () => {
            await filesPage.files_button.click();
            await expect(filesPage.search_textbox).toBeVisible();
            await openFileViaSearchbar(page, fileRef);

            await fileHomePage.accountingOption.click();
            accounting = await Accounting.getInstance(page);
            await expect(accounting.arrears_radio_button).toBeVisible();
            await expect(accounting.arrears_redemption_tab).toBeVisible();
            await expect(accounting.arrears_radio_button).toBeVisible();
            await expect(accounting.collected_payment_save_button).toBeVisible();
            await accounting.addCollectedPaymentEntry();
            await accounting.addDataToArrearsRedemptionTab();

            await fileHomePage.requestsOption.click();
            requests = await Requests.getInstance(page);
            await requests.createRequest({
                requestType: 'Request to Close',
                reason: 'Testing Admin and Brokerage Fee Generation for Redemption',
                notifyByEmail: false,
                sendToUsers: CLIENT_USERS,
            });
        });

        await test.step('Verify initial Accounting state and first Approval', async () => {
            await fileHomePage.accountingOption.click();
            accounting = await Accounting.getInstance(page);
            await expect(accounting.add_fee_or_credit_button).toBeVisible();
            await expect(page.getByText('No Fees')).toBeVisible();

            await expect(requests.respond_to_request_button).toBeVisible();
            await requests.respond_to_request_button.click();
            await requests.approve_request_button.click();

            await expect(page.getByText('No Fees')).toBeVisible();
        });

        await test.step('Verify Fee generation via Send to Ops and Rejection logic', async () => {
            adminFeeRow = page.locator(accounting.fee_row_selector).filter({ hasText: 'Admin Fee' });
            brokerageFeeRow = page.locator(accounting.fee_row_selector).filter({ hasText: 'Brokerage Fee' });

            await requests.createSendToOpsRequest({
                fileType: INVOICE_TYPE,
                closedStatus: CLOSED_STATUS,
                sendToUsers: ADMIN_USERS,
            });
            await expect(page.getByText('No Fees')).toBeHidden();
            await expect(adminFeeRow).toBeVisible();
            await expect(brokerageFeeRow).toBeVisible();

            await requests.respond_to_request_button.click();
            await requests.reject_request_button.click();

            await expect(page.getByText('No Fees')).toBeVisible();
            await expect(adminFeeRow).toBeHidden();
            await expect(brokerageFeeRow).toBeHidden();
        });

        await test.step('Final validation: Re-approve and verify fees persist and move them to transferred state', async () => {
            adminFeeRow = page.locator(accounting.fee_row_selector).filter({ hasText: 'Admin Fee' });
            brokerageFeeRow = page.locator(accounting.fee_row_selector).filter({ hasText: 'Brokerage Fee' });

            await requests.createSendToOpsRequest({
                fileType: INVOICE_TYPE,
                closedStatus: CLOSED_STATUS,
                sendToUsers: ADMIN_USERS,
            });

            await requests.respond_to_request_button.click();
            await requests.approve_request_button.click();

            await expect(adminFeeRow).toBeVisible();
            await expect(brokerageFeeRow).toBeVisible();
            await expect(adminFeeRow.locator(accounting.transfer_fee_icon_selector)).toBeVisible();
            await expect(brokerageFeeRow.locator(accounting.transfer_fee_icon_selector)).toBeVisible();

            await brokerageFeeRow.locator(accounting.transfer_fee_icon_selector).click();
            let toastMessage = page.locator(accounting.toast_message_selector);
            await expect(toastMessage).toBeVisible();
            await expect(toastMessage).toContainText('Fee transferred to projected fees');
            await toastMessage.locator('[aria-label="Close"]').click();
        });

        await test.step('Generate Invoice and verify the invoice has these fees inside', async () => {
            await expect(accounting.add_invoice_button).toBeVisible();
            await expect(accounting.add_invoice_button).toBeEnabled();

            await accounting.add_invoice_button.click();
            await expect(accounting.generate_invoice_button).toBeDisabled();

            await expect(accounting.select_invoice_dropdown).toBeVisible();
            await accounting.select_invoice_dropdown.click();
            await expect(page.getByRole('option', { name: INVOICE_TYPE, exact: true })).toBeVisible();
            await page.getByRole('option', { name: INVOICE_TYPE, exact: true }).click();

            const invoicePreviewContainer = page.locator(accounting.invoice_preview_container_selector);
            await expect(invoicePreviewContainer).toBeVisible();

            await accounting.cancel_invoice_button.click();
        });

        await test.step('Verify users can update the automated fees generated', async () => {
            await expect(adminFeeRow.locator(accounting.edit_fee_icon_selector)).toBeVisible();
            await adminFeeRow.locator(accounting.edit_fee_icon_selector).click();

            await expect(accounting.description_textbox).toBeVisible();
            await accounting.description_textbox.fill('Updated Admin Fee Description');
            await expect(accounting.amount_textbox).toBeVisible();
            await accounting.amount_textbox.fill('150');
            await accounting.save_fee_button.click();

            await expect(adminFeeRow).toContainText('Updated Admin Fee Description');
            await expect(adminFeeRow).toContainText('150');

            await adminFeeRow.locator(accounting.transfer_fee_icon_selector).click();
            let toastMessage = page.locator(accounting.toast_message_selector);
            await expect(toastMessage).toBeVisible();
            await expect(toastMessage).toContainText('Fee transferred to projected fees');
            await toastMessage.locator('[aria-label="Close"]').click();
        });

        await test.step('Verify the change is reflected in generated invoice PDF', async () => {
            await expect(accounting.add_invoice_button).toBeVisible();
            await expect(accounting.add_invoice_button).toBeEnabled();

            await accounting.add_invoice_button.click();
            await expect(accounting.select_invoice_dropdown).toBeVisible();
            await accounting.select_invoice_dropdown.click();
            await page.getByRole('option', { name: INVOICE_TYPE, exact: true }).click();

            const invoicePreviewContainer = page.locator(accounting.invoice_preview_container_selector);
            await expect(invoicePreviewContainer).toBeVisible();
            await expect(invoicePreviewContainer).toContainText('$1,548.00');

            await accounting.generate_invoice_button.click();
            await expect(accounting.view_invoice_link).toBeVisible();

            const context = page.context();
            const contextDownloadPromise = new Promise<Download>((resolve) => {
                const onPage = (newPage: Page) => newPage.once('download', resolve);
                context.on('page', onPage);
                page.once('download', resolve);
            });

            const popupPromise = page.waitForEvent('popup').then((popup) => ({ type: 'popup' as const, payload: popup }));
            const downloadPromise = contextDownloadPromise.then((download) => ({ type: 'download' as const, payload: download }));

            await accounting.view_invoice_link.click();
            const result = await Promise.any([popupPromise, downloadPromise]);

            if (result.type === 'popup') {
                const pdftab = result.payload;
                try {
                    await pdftab.waitForLoadState('domcontentloaded', { timeout: 10000 });
                    await pdftab.waitForURL((url) => ['http:', 'https:', 'blob:'].includes(url.protocol), { timeout: 10000 });
                    const pdfUrl = pdftab.url();

                    if (pdfUrl.startsWith('blob:')) {
                        const client = await pdftab.context().newCDPSession(pdftab);
                        await client.send('Page.enable');
                        const { frameTree } = await client.send('Page.getFrameTree');
                        const { content, base64Encoded } = await client.send('Page.getResourceContent', {
                            frameId: frameTree.frame.id,
                            url: pdfUrl,
                        });
                        fileBuffer = base64Encoded ? Buffer.from(content, 'base64') : Buffer.from(content);
                        await client.detach();
                    } else {
                        const response = await pdftab.request.get(pdfUrl);
                        fileBuffer = await response.body();
                    }
                    await pdftab.close();
                } catch (err) {
                    const download = (await contextDownloadPromise) as Download;
                    const tempPath = await download.path();
                    if (!tempPath) throw new Error('Download path not found');
                    fileBuffer = fs.readFileSync(tempPath);
                }
            } else {
                const download = result.payload;
                const tempPath = await download.path();
                if (!tempPath) throw new Error('Download path not found');
                fileBuffer = fs.readFileSync(tempPath);
            }

            const pdfContent = await extractPdfText(fileBuffer);
            // Sale-amount-specific assertions from the Sold test are intentionally omitted —
            // the Redemption flow has no fixed sale price. Brokerage value is also flow-derived.
            const expectedTexts = [fileRef, 'Automated Fee Bank', 'ARREARS REMITTED', '$1,548.00'];

            for (const expectedText of expectedTexts) {
                expect(pdfContent.fullText).toContain(expectedText);
            }
        });

        await test.step('Verify the File is closed after generating the Redemption Invoice', async () => {
            // Redemption flow does not require sale GST/HST entry — close directly via sidebar.
            fileSideBar = await FileSidebar.getInstance(page);
            await expect(fileSideBar.file_status_dropdown).toBeVisible();
            await expect(fileSideBar.file_stage_dropdown).toBeVisible();

            await fileSideBar.file_stage_dropdown.click();
            const closedOption = page.getByRole('option', { name: CLOSED_STAGE, exact: true });
            await expect(closedOption).toBeVisible();
            await closedOption.click();

            await fileSideBar.file_status_dropdown.click();
            const redeemedOption = page.getByRole('option', { name: CLOSED_STATUS, exact: true });
            await expect(redeemedOption).toBeVisible();
            await redeemedOption.click();

            await expect(fileSideBar.update_button).toBeEnabled();
            await fileSideBar.update_button.click();

            await expect(fileSideBar.close_file_button).toBeVisible();
            await fileSideBar.close_file_button.click();

            await expect(fileSideBar.re_open_file_button).toBeVisible();
        });
    });
});
