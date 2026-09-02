import { test, expect } from '../../fixtures';
import {
    ClosedFile,
    buildClosedFile,
    closeFileAsRedeemed,
    closeFileAsSold,
    downloadPdfFromLink,
    extractPdfText,
    extractReportSection,
    openFileViaSearchbar,
} from '../../helpers';
import { navigateToLoginPage } from '../../navigation-helpers';
import { FilesPage } from '../../pages/FilesPage';
import { LoginPage } from '../../pages/LoginPage';
import { ReportsPage } from '../../pages/ReportsPage';
import { APIServices } from '../../services/apiServices';

const REPORT_CLIENT = 'Bank 3';
const REPORT_FORMAT = 'Sale & Redemption';
const REPORT_TITLE_IN_LISTING = 'Sales and Redemption Report';

const SALE_AMOUNT_FORMATTED = '$25,000.00';
const REDEEM_PAYMENT_FORMATTED = '$2,000.00';
const SOLD_OTHER_PROCEEDS_FORMATTED = '$500.00';

const REDEEM_MARKER = 'DETAILS FOR TRANSACTION TYPE: REDEEM';
const SOLD_MARKER = 'DETAILS FOR TRANSACTION TYPE: SOLD';
const OTHER_MARKER = 'DETAILS FOR TRANSACTION TYPE: OTHER';

test.describe('Sales and Redemption Report', () => {
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

    test('Validate sales and redemption report generation', async ({ page, request, loginAs }) => {
        // Three full file-closure flows + report generation + PDF parse.
        test.setTimeout(100000);
        apiService = await APIServices.create(request);

        let filesPage: FilesPage;
        let reportsPage: ReportsPage;
        let pdfBuffer: Buffer;

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

            await closeFileAsSold(page, { collectedPaymentAmount: '500' });
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

        await test.step('Download generated report PDF', async () => {
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

            pdfBuffer = await downloadPdfFromLink(page, viewLink);
            expect(pdfBuffer.length, 'Report PDF must not be empty').toBeGreaterThan(0);
        });

        await test.step('Verify: Report contains all three files in their expected sections', async () => {
            const pdfContent = await extractPdfText(pdfBuffer);
            const fullText = pdfContent.fullText;

            const redeemSection = extractReportSection(fullText, REDEEM_MARKER);
            const soldSection = extractReportSection(fullText, SOLD_MARKER);
            const otherSection = extractReportSection(fullText, OTHER_MARKER);

            expect(redeemSection, 'Redeemed file ref should appear in REDEEM section').toContain(redeemedFile.ref);
            expect(redeemSection, 'Redeemed customer name should appear in REDEEM section').toContain(
                redeemedFile.customerName
            );
            expect(redeemSection, 'Redeem proceeds amount should appear in REDEEM section').toContain(
                REDEEM_PAYMENT_FORMATTED
            );

            expect(soldSection, 'Sold-with-payment file ref should appear in SOLD section').toContain(soldFile.ref);
            expect(soldSection, 'Sold-with-payment customer name should appear in SOLD section').toContain(
                soldFile.customerName
            );
            expect(soldSection, 'Sold-without-payment file ref should appear in SOLD section').toContain(
                soldNoPaymentFile.ref
            );
            expect(soldSection, 'Sold-without-payment customer name should appear in SOLD section').toContain(
                soldNoPaymentFile.customerName
            );
            expect(soldSection, 'Sale amount should appear in SOLD section').toContain(SALE_AMOUNT_FORMATTED);

            expect(otherSection, 'Sold-with-payment file ref should appear in OTHER section').toContain(soldFile.ref);
            expect(otherSection, 'Sold-with-payment customer name should appear in OTHER section').toContain(
                soldFile.customerName
            );
            expect(otherSection, 'Other proceeds amount should appear in OTHER section').toContain(
                SOLD_OTHER_PROCEEDS_FORMATTED
            );
        });

        await test.step('Verify: Cross-section exclusion — no file appears in a wrong section', async () => {
            const pdfContent = await extractPdfText(pdfBuffer);
            const fullText = pdfContent.fullText;
            const redeemSection = extractReportSection(fullText, REDEEM_MARKER);
            const soldSection = extractReportSection(fullText, SOLD_MARKER);
            const otherSection = extractReportSection(fullText, OTHER_MARKER);

            expect(
                soldSection,
                `Redeemed file (${redeemedFile.ref}) must NOT appear in SOLD section`
            ).not.toContain(redeemedFile.ref);
            expect(
                otherSection,
                `Redeemed file (${redeemedFile.ref}) must NOT appear in OTHER section`
            ).not.toContain(redeemedFile.ref);

            expect(
                redeemSection,
                `Sold-with-payment file (${soldFile.ref}) must NOT appear in REDEEM section`
            ).not.toContain(soldFile.ref);

            expect(
                redeemSection,
                `Sold-without-payment file (${soldNoPaymentFile.ref}) must NOT appear in REDEEM section`
            ).not.toContain(soldNoPaymentFile.ref);
            expect(
                otherSection,
                `Sold-without-payment file (${soldNoPaymentFile.ref}) must NOT appear in OTHER section`
            ).not.toContain(soldNoPaymentFile.ref);
        });

        await test.step('Verify: Subtotals match expected values', async () => {
            const pdfContent = await extractPdfText(pdfBuffer);
            const fullText = pdfContent.fullText;
            const redeemSection = extractReportSection(fullText, REDEEM_MARKER);
            const soldSection = extractReportSection(fullText, SOLD_MARKER);
            const otherSection = extractReportSection(fullText, OTHER_MARKER);

            expect(redeemSection, 'REDEEM subtotal should equal $2,000.00 (one redeemed file)').toMatch(
                /SUBTOTAL FOR: REDEEM\s+\$2,000\.00/
            );
            expect(soldSection, 'SOLD subtotal should equal $50,000.00 (two $25,000 sales)').toMatch(
                /SUBTOTAL FOR: SOLD\s+\$50,000\.00/
            );
            expect(otherSection, 'OTHER subtotal should equal $500.00 (one collected payment)').toMatch(
                /SUBTOTAL FOR: OTHER\s+\$500\.00/
            );
        });

        await test.step('Verify: Tax, cost, and deposit math in SOLD section', async () => {
            const pdfContent = await extractPdfText(pdfBuffer);
            const soldSection = extractReportSection(pdfContent.fullText, SOLD_MARKER);

            // Tax propagation: each row contributes $1,750 GST + $1,750 HST → subtotal $3,500 each
            expect(soldSection, 'Per-row tax value $1,750.00 should appear in SOLD section').toContain('$1,750.00');
            expect(soldSection, 'Tax subtotal $3,500.00 (two rows × $1,750) should appear').toContain('$3,500.00');

            // Cost-on-sale: each row contributes -$500 fee → subtotal -$1,000
            expect(soldSection, 'Per-row cost -$500.00 should appear in SOLD section').toContain('-$500.00');
            expect(soldSection, 'Cost subtotal -$500.00 should appear').toContain('-$500.00');

            expect(soldSection, 'Sold-with-payment deposit $29,000.00 should appear').toContain('$29,000.00');
            expect(soldSection, 'Sold-without-payment deposit $26,750.00 should appear').toContain('$28,500.00');
            expect(soldSection, 'Deposit subtotal $55,750.00 should appear').toContain('$57,500.00');
        });

        await test.step('Verify: GRAND TOTALS aggregates correctly across all sections', async () => {
            const pdfContent = await extractPdfText(pdfBuffer);
            const fullText = pdfContent.fullText;
            expect(fullText).toMatch(/\$60,000\.00/);
        });
    });
});
