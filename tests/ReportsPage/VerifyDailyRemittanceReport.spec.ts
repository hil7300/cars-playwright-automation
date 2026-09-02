import { test, expect } from '../../fixtures';
import {
    ClosedFile,
    buildClosedFile,
    closeFileAsRedeemed,
    closeFileAsSold,
    openFileViaSearchbar,
} from '../../helpers';
import { navigateToLoginPage } from '../../navigation-helpers';
import { FilesPage } from '../../pages/FilesPage';
import { LoginPage } from '../../pages/LoginPage';
import { ReportsPage } from '../../pages/ReportsPage';
import { APIServices } from '../../services/apiServices';
import * as xlsx from 'xlsx';

const REPORT_CLIENT = 'Bank 3';
const REPORT_FORMAT = 'Daily Remittance';
const REPORT_TITLE_IN_LISTING = 'Remittance Report';

const COLLECTED_PAYMENT_AMOUNT = '500';

test.describe('Daily Remittance Report', () => {
    let apiService: APIServices;
    let soldFile: ClosedFile = { ref: '', customerName: '', firstName: '', lastName: '' };
    let redeemedFile: ClosedFile = { ref: '', customerName: '', firstName: '', lastName: '' };
    let soldNoPaymentFile: ClosedFile = { ref: '', customerName: '', firstName: '', lastName: '' };

    test.afterEach(async () => {
        if (!apiService) return;
        for (const file of [soldFile, redeemedFile, soldNoPaymentFile]) {
            if (!file.ref) continue;
            console.log(`Cleaning up file: ${file.ref}`);
            await apiService
                .deleteFile(file.ref)
                .catch((e) => console.error(`Cleanup failed for ${file.ref}: ${e.message}`));
        }
    });

    test('Validate daily remittance report generation', async ({ page, request, loginAs }) => {
        test.setTimeout(100000);
        apiService = await APIServices.create(request);

        let filesPage: FilesPage;
        let reportsPage: ReportsPage;

        await test.step('Setup: Log in as Super Admin', async () => {
            await navigateToLoginPage(page);
            const loginPage = await LoginPage.getInstance(page);
            await expect(loginPage.login_button).toBeVisible();

            await loginAs('super_admin');
            filesPage = await FilesPage.getInstance(page);
            await expect(filesPage.create_file_button).toBeVisible();
            await expect(filesPage.reports_button).toBeVisible();
        });

        await test.step('Setup: Create file and close as Sold - Deficiency Recovery (with collected payment)', async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();
            const ref = await openFileViaSearchbar(page, fileDetails.accountNumber);
            soldFile = buildClosedFile(ref, fileDetails.randomFirstName, fileDetails.randomLastName);

            await closeFileAsSold(page, { collectedPaymentAmount: COLLECTED_PAYMENT_AMOUNT });
        });

        await test.step('Setup: Create file and close as Redeemed', async () => {
            await expect(filesPage.files_button).toBeVisible();
            await filesPage.files_button.click();
            await expect(filesPage.search_textbox).toBeVisible();

            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();
            const ref = await openFileViaSearchbar(page, fileDetails.accountNumber);
            redeemedFile = buildClosedFile(ref, fileDetails.randomFirstName, fileDetails.randomLastName);

            await closeFileAsRedeemed(page);
        });

        await test.step('Setup: Create file and close as Sold - Deficiency Recovery (NO collected payment)', async () => {
            await expect(filesPage.files_button).toBeVisible();
            await filesPage.files_button.click();
            await expect(filesPage.search_textbox).toBeVisible();

            const fileDetails = await apiService.createNewAutoAssetFileViaAPI();
            const ref = await openFileViaSearchbar(page, fileDetails.accountNumber);
            soldNoPaymentFile = buildClosedFile(ref, fileDetails.randomFirstName, fileDetails.randomLastName);

            await closeFileAsSold(page); // no collectedPaymentAmount → omitted
        });

        await test.step(`Action: Navigate to Reports and generate ${REPORT_FORMAT} report`, async () => {
            await filesPage.files_button.click();
            await expect(filesPage.reports_button).toBeVisible();
            await filesPage.reports_button.click();

            reportsPage = await ReportsPage.getInstance(page);
            await expect(reportsPage.create_report_button).toBeVisible();
            await reportsPage.createReportForClient(REPORT_FORMAT, REPORT_CLIENT);
        });

        await test.step('Action: Locate generated report row and read download stream into memory', async () => {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const formattedDate = `${yyyy}-${mm}-${dd}`;

            const reportRow = page
                .locator(reportsPage.report_row_selector)
                .filter({ hasText: REPORT_CLIENT })
                .filter({ hasText: REPORT_TITLE_IN_LISTING })
                .filter({ hasText: formattedDate })
                .first();
            await expect(reportRow).toBeVisible();

            const viewLink = reportRow.locator(reportsPage.download_link_selector);
            await expect(viewLink).toBeVisible();

            await page.reload();
            await page.waitForTimeout(500);
            await expect(viewLink).toBeVisible();

            // 1. Trigger the download event
            const downloadPromise = page.waitForEvent('download');
            await viewLink.click();
            const download = await downloadPromise;

            // 2. Stream the remote file directly into memory
            const stream = await download.createReadStream();
            expect(stream).toBeTruthy();

            const chunks: Buffer[] = [];
            for await (const chunk of stream!) {
                chunks.push(Buffer.from(chunk));
            }
            const fileBuffer = Buffer.concat(chunks);

            // 3. Parse the downloaded XLSX file from the Buffer
            const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // 4. Convert sheet to JSON array mapping headers to keys
            const records: any[] = xlsx.utils.sheet_to_json(worksheet);

            // =========================================================
            // Assertions mapping directly to your newly created files
            // =========================================================

            // Expected per-record amounts produced by the closure helpers in helpers.ts
            const EXPECTED_SALE_PRICE = 25000;
            const EXPECTED_SALE_GST_HST = 3500; // $1,750 GST + $1,750 HST
            const EXPECTED_SALE_TOTAL = 28500; // sale + GST/HST + 0 QST
            const EXPECTED_REDEEM_AMOUNT = 2000;

            // Customer-name format used by this report: "LastName, FirstName"
            const soldName = `${soldFile.lastName}, ${soldFile.firstName}`;
            const redeemedName = `${redeemedFile.lastName}, ${redeemedFile.firstName}`;
            const soldNoPaymentName = `${soldNoPaymentFile.lastName}, ${soldNoPaymentFile.firstName}`;

            // A. Verify "Sold" file with collected payment
            const soldRecords = records.filter(r => r['Case / Contract #'] === soldFile.ref);
            expect(soldRecords.length, `Expected records for sold file ${soldFile.ref}`).toBeGreaterThan(0);

            const soldSaleRecord = soldRecords.find(r => r['Status'] === 'Sale');
            expect(soldSaleRecord, 'Expected a "Sale" record for sold-with-payment file').toBeDefined();
            expect(soldSaleRecord!['Customer Name']).toBe(soldName);
            expect(Number(soldSaleRecord!['Sale Price'])).toBe(EXPECTED_SALE_PRICE);
            expect(Number(soldSaleRecord!['GST/HST Collected on Sale'])).toBe(EXPECTED_SALE_GST_HST);
            expect(Number(soldSaleRecord!['TOTAL SALE'])).toBe(EXPECTED_SALE_TOTAL);

            const soldArrearsRecord = soldRecords.find(r => r['Status'] === 'Arrears');
            expect(soldArrearsRecord, 'Expected an "Arrears" record for sold-with-payment file').toBeDefined();
            expect(soldArrearsRecord!['Customer Name']).toBe(soldName);
            expect(Number(soldArrearsRecord!['Sale Price'])).toBe(Number(COLLECTED_PAYMENT_AMOUNT));
            expect(Number(soldArrearsRecord!['TOTAL SALE'])).toBe(Number(COLLECTED_PAYMENT_AMOUNT));

            // B. Verify "Redeemed" file
            const redeemedRecords = records.filter(r => r['Case / Contract #'] === redeemedFile.ref);
            expect(redeemedRecords.length, `Expected records for redeemed file ${redeemedFile.ref}`).toBeGreaterThan(0);

            const redeemRecord = redeemedRecords.find(r => r['Status'] === 'Redemption');
            expect(redeemRecord, 'Expected a "Redemption" record for redeemed file').toBeDefined();
            expect(redeemRecord!['Customer Name']).toBe(redeemedName);
            expect(Number(redeemRecord!['Sale Price'])).toBe(EXPECTED_REDEEM_AMOUNT);
            expect(Number(redeemRecord!['TOTAL SALE'])).toBe(EXPECTED_REDEEM_AMOUNT);

            // Symmetric exclusion: a redeemed file must not be miscategorized as Sale or Arrears
            const redeemedHasWrongStatus = redeemedRecords.some(
                r => r['Status'] === 'Sale' || r['Status'] === 'Arrears'
            );
            expect(
                redeemedHasWrongStatus,
                'Redeemed file must NOT have any "Sale" or "Arrears" record'
            ).toBeFalsy();

            // C. Verify "Sold" file with NO collected payment
            const soldNoPaymentRecords = records.filter(r => r['Case / Contract #'] === soldNoPaymentFile.ref);
            expect(soldNoPaymentRecords.length, `Expected records for sold (no payment) file ${soldNoPaymentFile.ref}`).toBeGreaterThan(0);

            const soldNoPaySaleRecord = soldNoPaymentRecords.find(r => r['Status'] === 'Sale');
            expect(soldNoPaySaleRecord, 'Expected a "Sale" record for sold-without-payment file').toBeDefined();
            expect(soldNoPaySaleRecord!['Customer Name']).toBe(soldNoPaymentName);
            expect(Number(soldNoPaySaleRecord!['Sale Price'])).toBe(EXPECTED_SALE_PRICE);
            expect(Number(soldNoPaySaleRecord!['GST/HST Collected on Sale'])).toBe(EXPECTED_SALE_GST_HST);
            expect(Number(soldNoPaySaleRecord!['TOTAL SALE'])).toBe(EXPECTED_SALE_TOTAL);

            const hasNoArrearsPayment = soldNoPaymentRecords.some(r => r['Status'] === 'Arrears');
            expect(hasNoArrearsPayment, 'Did not expect an "Arrears" payment record for a file with no collected payment').toBeFalsy();
        });
    });
});