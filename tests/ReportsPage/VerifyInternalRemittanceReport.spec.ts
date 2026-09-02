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

const REPORT_FORMAT = 'Internal Remittance Report'; 
const REPORT_TITLE_IN_LISTING = 'Internal Remittance Report'; 
const DEFAULT_BANK = 'Bank 3'; 
const AUTOMATED_FEE_BANK = 'Automated Fee Bank';

test.describe('Internal Remittance Report', () => {
    let apiService: APIServices;
    let soldNoPaymentFile: ClosedFile = { ref: '', customerName: '', firstName: '', lastName: '' };
    let redeemedFile: ClosedFile = { ref: '', customerName: '', firstName: '', lastName: '' };

    test.afterEach(async () => {
        if (!apiService) return;
        for (const file of [soldNoPaymentFile, redeemedFile]) {
            if (!file.ref) continue;
            console.log(`Cleaning up file: ${file.ref}`);
            await apiService
                .deleteFile(file.ref)
                .catch((e) => console.error(`Cleanup failed for ${file.ref}: ${e.message}`));
        }
    });

    test('Validate internal remittance report aggregates files across clients', async ({
        page,
        request,
        loginAs,
    }) => {
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

        await test.step(`Setup: Create file under '${DEFAULT_BANK}' and close as Sold (NO collected payment)`, async () => {
            const fileDetails = await apiService.createNewAutoAssetFileViaAPI(DEFAULT_BANK);
            const ref = await openFileViaSearchbar(page, fileDetails.accountNumber);
            soldNoPaymentFile = buildClosedFile(
                ref,
                fileDetails.randomFirstName,
                fileDetails.randomLastName,
                fileDetails.accountNumber
            );

            await closeFileAsSold(page); // no collectedPaymentAmount → omitted
        });

        await test.step(`Setup: Create file under '${AUTOMATED_FEE_BANK}' and close as Redeemed`, async () => {
            await expect(filesPage.files_button).toBeVisible();
            await filesPage.files_button.click();
            await expect(filesPage.search_textbox).toBeVisible();

            const fileDetails = await apiService.createNewAutoAssetFileViaAPI(AUTOMATED_FEE_BANK);
            const ref = await openFileViaSearchbar(page, fileDetails.accountNumber);
            redeemedFile = buildClosedFile(
                ref,
                fileDetails.randomFirstName,
                fileDetails.randomLastName,
                fileDetails.accountNumber
            );

            await closeFileAsRedeemed(page);
        });

        await test.step(`Action: Generate ${REPORT_FORMAT} (asserts client dropdown is hidden)`, async () => {
            await filesPage.files_button.click();
            await expect(filesPage.reports_button).toBeVisible();
            await filesPage.reports_button.click();

            reportsPage = await ReportsPage.getInstance(page);
            await expect(reportsPage.create_report_button).toBeVisible();

            // createReportForAllClients asserts the company dropdown is hidden after
            // selecting the report type, then fills today→today and clicks Create.
            await reportsPage.createReportForAllClients(REPORT_FORMAT);
        });

        await test.step('Action: Locate generated report row and download XLSX', async () => {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const formattedDate = `${yyyy}-${mm}-${dd}`;

            const reportRow = page
                .locator(reportsPage.report_row_selector)
                .filter({ hasText: REPORT_TITLE_IN_LISTING })
                .filter({ hasText: formattedDate })
                .first();
            await expect(reportRow).toBeVisible();

            const viewLink = reportRow.locator(reportsPage.download_link_selector);
            await expect(viewLink).toBeVisible();

            await page.reload();
            await page.waitForTimeout(500);
            await expect(viewLink).toBeVisible();

            // Trigger download and stream the remote file directly into memory.
            const downloadPromise = page.waitForEvent('download');
            await viewLink.click();
            const download = await downloadPromise;

            const stream = await download.createReadStream();
            expect(stream).toBeTruthy();

            const chunks: Buffer[] = [];
            for await (const chunk of stream!) {
                chunks.push(Buffer.from(chunk));
            }
            const fileBuffer = Buffer.concat(chunks);

            // Parse the XLSX into JSON records.
            const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            
            // ⚠ Use { range: 3 } because the headers start on the 4th row (index 3). 
            // The top 3 rows contain the report title, dates, and a blank space.
            const records: any[] = xlsx.utils.sheet_to_json(worksheet, { range: 3 });

            // Updated Column-name constants matching the Internal Remittance Report format
            const FILE_REF_COLUMN = 'Reference #';
            const ACCOUNT_NUMBER_COLUMN = 'Account #';
            const CUSTOMER_NAME_COLUMN = 'Customer Name';
            const NET_SALES_COLUMN = 'Net Sales Remittance'; 
            const REDEMPTION_COLUMN = 'Redemption';          
            const TOTAL_COLUMN = 'Total';                    

            // Customer-name format used by Remittance: "LastName, FirstName".
            const soldName = `${soldNoPaymentFile.lastName}, ${soldNoPaymentFile.firstName}`;
            const redeemedName = `${redeemedFile.lastName}, ${redeemedFile.firstName}`;

            // ── A. Verify Sold-without-payment file (Bank 3) ──────────────────
            const soldRecord = records.find((r) => r[FILE_REF_COLUMN] === soldNoPaymentFile.ref);
            expect(soldRecord, `Expected a record for sold file ${soldNoPaymentFile.ref}`).toBeDefined();
            expect(String(soldRecord![ACCOUNT_NUMBER_COLUMN])).toBe(soldNoPaymentFile.accountNumber);
            expect(soldRecord![CUSTOMER_NAME_COLUMN]).toBe(soldName);
            
            // Financial Assertions for Sold File
            expect(soldRecord![NET_SALES_COLUMN]).toBeDefined();
            expect(soldRecord![NET_SALES_COLUMN]).not.toBe('-'); // Should have a dollar amount
            expect(String(soldRecord![NET_SALES_COLUMN])).toContain('$'); // Verify currency format
            expect(soldRecord![REDEMPTION_COLUMN]).toBe('-'); // Should NOT have a redemption amount
            expect(soldRecord![NET_SALES_COLUMN]).toBe('$28,500.00');

            // ── B. Verify Redeemed file (Automated Fee Bank) ──────────────────
            const redeemedRecord = records.find((r) => r[FILE_REF_COLUMN] === redeemedFile.ref);
            expect(redeemedRecord, `Expected a record for redeemed file ${redeemedFile.ref}`).toBeDefined();
            expect(String(redeemedRecord![ACCOUNT_NUMBER_COLUMN])).toBe(redeemedFile.accountNumber);
            expect(redeemedRecord![CUSTOMER_NAME_COLUMN]).toBe(redeemedName);

            // Financial Assertions for Redeemed File
            expect(redeemedRecord![REDEMPTION_COLUMN]).toBeDefined();
            expect(redeemedRecord![REDEMPTION_COLUMN]).not.toBe('-'); // Should have a dollar amount
            expect(String(redeemedRecord![REDEMPTION_COLUMN])).toContain('$'); // Verify currency format
            expect(redeemedRecord![NET_SALES_COLUMN]).toBe('-'); // Should NOT have a net sales amount
            expect(redeemedRecord![REDEMPTION_COLUMN]).toBe('$2,000.00')
        });
    });
});