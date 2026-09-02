import fs from 'fs';
import ENV from './env';
import { FilesPage } from './pages/FilesPage';
import { Download, expect, Locator, Page } from '@playwright/test';
import { FileHomePage } from './pages/FilePages/FileHomePage';
import { time } from 'console';
import { VendorInvoices } from './pages/FilePages/VendorInvoices';
import { Accounting } from './pages/FilePages/Accounting';
import { Assignments } from './pages/FilePages/Assignments';
import { FileSidebar } from './pages/FilePages/FileSideBar';
import { Remarketing } from './pages/FilePages/Remarketing';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import ExcelJS from 'exceljs';
import { ParsedEmail } from './services/gmailService';

export function getResourcesPath(): string {
    return ENV.RESOURCES_PATH?.toString() || '';
}

export async function openFileViaSearchbar(page: Page, fileRef: string) {
    const ENV = process.env.ENV || 'dev'; // default to 'dev'
    // Handle environment-specific file reference ID
    if (fileRef === 'Common Automation File') {
        switch (ENV) {
            case 'stg':
                fileRef = 'BA3AT661';
                break;
            case 'dev':
            default:
                fileRef = 'BA3MR590';
                break;
        }
    }

    const filesPage = await FilesPage.getInstance(page);
    await expect(filesPage.search_textbox).toBeVisible();
    await filesPage.filterFileBySearching(fileRef);

    let fileRow = page.locator(filesPage.file_row_selector).filter({ hasText: fileRef });
    await expect(fileRow).toBeVisible({ timeout: 5000 });
    fileRef = await fileRow.locator(filesPage.file_ref_id_cell_selector).innerText();
    await filesPage.clickOnFileRefID(fileRef);
    await expect(page.locator('[id="sidebar-left-assignments-button"]')).toBeVisible();
    return fileRef;
}

export async function openRandomFile(page: Page) {
    let filesPage = await FilesPage.getInstance(page);
    await expect(filesPage.companies_button).toBeVisible();
    await filesPage.openRandomFile();

    let fileHomePage = await FileHomePage.getInstance(page);
    await expect(fileHomePage.assignmentOption).toBeVisible();
}

export async function selectRandomFilterOption(page: Page): Promise<{ filterOption: string; fileCount: number }> {
    let filter_dropdown_selector = '[data-cy="filter-children"]';
    const filterDropdown = page.locator(filter_dropdown_selector);
    await expect(filterDropdown).toBeVisible();

    const options = filterDropdown.locator('[data-value]');
    await expect(options.first()).toBeVisible();

    // Fetch all text options at once (much faster than looping over locators)
    const allTexts = await options.allTextContents();

    // Store the indices of options that are NOT "None" or "none"
    const validIndices: number[] = [];

    for (let i = 0; i < allTexts.length; i++) {
        const text = allTexts[i].trim();
        if (!text) continue;

        const parts = text.split(' ');
        parts.pop(); // Temporarily pop the count to evaluate just the name
        const filterName = parts.join(' ').toLowerCase(); // Convert to lowercase to catch "None", "none", "NONE"

        // Only add to valid pool if the exact name isn't "none"
        if (filterName !== 'none') {
            validIndices.push(i);
        }
    }

    if (validIndices.length === 0) {
        throw new Error("No valid filter options found (all were 'None' or empty)");
    }

    // Select a random index from our pre-screened valid options
    const randomIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
    const randomOption = options.nth(randomIndex);
    const fullText = allTexts[randomIndex].trim();

    // Parse the selected option as usual
    const parts = fullText.split(' ');
    const fileCountStr = parts.pop(); // last element is count
    const fileCount = parseInt(fileCountStr!, 10);
    const filterOption = parts.join(' '); // remaining = client name or province

    if (!filterOption || isNaN(fileCount)) {
        throw new Error(`Unexpected format in filter option text: "${fullText}"`);
    }

    await expect(randomOption).toBeVisible();
    await randomOption.click({ timeout: 5000 });

    await expect(page.locator('[class="pr-2"]')).toBeVisible();
    await page.locator('[class="pr-2"]').click();
    await page.waitForTimeout(250); // wait for filter to apply and results to update
    return { filterOption, fileCount };
}
export async function verifyFilterAppliedSuccessfully(
    page: Page,
    cellLocator: Locator,
    expectedValue: string,
    shouldCheckCellText: boolean,
    expectEmpty: boolean = false
) {
    // 1. Handle the empty state scenario
    if (expectEmpty) {
        const noDataMessage = page.getByText('No vendor invoices found');
        await expect(noDataMessage).toBeVisible();
        return;
    }

    // Optional: wait for at least one cell to be visible so we know the grid loaded
    await page.waitForTimeout(250); // small delay to ensure all cells are rendered after filter application
    await expect(cellLocator.first()).toBeVisible();

    // 2. Iterate through only the visible cells on the current page
    const count = await cellLocator.count();

    for (let i = 0; i < count; i++) {
        if (shouldCheckCellText) {
            const rawText = await cellLocator.nth(i).textContent();
            const cellText = rawText?.replace(/\s+/g, ' ').trim() || '';
            const normalizedExpected = expectedValue.replace(/\s+/g, ' ').trim();

            if (cellText === normalizedExpected || cellText.includes(normalizedExpected)) {
                // pass
            } else {
                // Fails the test and provides a clean diff in the Playwright report
                expect(cellText).toBe(normalizedExpected);
            }
        }
    }
}

export async function generateRandomAccountNumber(length: number = 10): Promise<string> {
    let result = '';
    const characters = '0123456789';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export async function approveVendorInvoice(page: Page, invoiceNumber: string, expectedFeeType: string) {
    expect(invoiceNumber).toBeTruthy();

    let vendorInvoiceSection = await VendorInvoices.getInstance(page);
    await vendorInvoiceSection.openEditInvoiceModal(invoiceNumber);
    await expect(vendorInvoiceSection.review_invoice_approve_button).toBeDisabled();
    await expect(vendorInvoiceSection.review_invoice_reject_button).toBeEnabled();
    const feeTypeDropdown = page.getByRole('cell', { name: 'Select...' });
    await expect(feeTypeDropdown).toBeVisible();
    await feeTypeDropdown.click();

    // Safety check: ensure dropdown list is visible before clicking option
    let isDropdownVisible = await page.getByRole('option', { name: expectedFeeType, exact: true }).isVisible();
    if (!isDropdownVisible) {
        await feeTypeDropdown.click(); // Re-click if dropdown didn't open correctly
    }
    await page.getByRole('option', { name: expectedFeeType, exact: true }).click();

    await vendorInvoiceSection.fillInvoiceRowData(0, {
        amount: '950',
        description: 'Final Admin Row',
        hst: '50',
    });
    await expect(vendorInvoiceSection.review_invoice_approve_button).toBeEnabled();
    await vendorInvoiceSection.review_invoice_approve_button.click();
    await expect(vendorInvoiceSection.review_invoice_approve_button).toBeHidden();
}

export async function getTodaysDate() {
    const date = new Date();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();

    return `${mm}-${dd}-${yyyy}`;
}

export async function getFutureDate(daysToAdd = 15) {
    const date = new Date();
    date.setDate(date.getDate() + daysToAdd); // Add the days

    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();

    return `${mm}-${dd}-${yyyy}`;
}

export async function getPastDate(daysToSubtract = 15) {
    const date = new Date();
    date.setDate(date.getDate() - daysToSubtract); // Subtract the days

    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();

    return `${mm}-${dd}-${yyyy}`;
}

export function getDaysDifference(startDateStr: string, endDateStr: string): number {
    // .map(Number) safely converts the split strings into actual numbers for TypeScript
    const [sMonth, sDay, sYear] = startDateStr.split('-').map(Number);
    const [eMonth, eDay, eYear] = endDateStr.split('-').map(Number);

    // Using Date.UTC prevents daylight saving time (DST) bugs from throwing off the day count
    const startDate = new Date(Date.UTC(sYear, sMonth - 1, sDay));
    const endDate = new Date(Date.UTC(eYear, eMonth - 1, eDay));

    const diffInMs = endDate.getTime() - startDate.getTime();
    return Math.floor(diffInMs / (1000 * 60 * 60 * 24));
}

// Gets the last day of the month for a given MM-DD-YYYY date
export function getEndOfMonthDate(dateStr: string): string {
    const [month, , year] = dateStr.split('-').map(Number);

    const endOfMonth = new Date(year, month, 0);

    const mm = String(endOfMonth.getMonth() + 1).padStart(2, '0');
    const dd = String(endOfMonth.getDate()).padStart(2, '0');
    const yyyy = endOfMonth.getFullYear();

    return `${mm}-${dd}-${yyyy}`;
}

export interface PdfContent {
    /** All pages concatenated with newlines. */
    fullText: string;
    /** Text for each page individually (1-indexed via array index + 1). */
    pages: string[];
    /** Total number of pages in the document. */
    pageCount: number;
}

export interface XlsxData {
    /** All non-empty rows joined into a single string ('\n' between rows, ' | ' between cells). */
    allText: string;
    /** Each non-empty row's cells joined with ' | '. Useful for row-scoped assertions. */
    rows: string[];
}

/**
 * Reads the first worksheet of an XLSX file into a flat array of row-strings,
 * plus a single concatenated string for full-text assertions.
 *
 * Cell values are coerced to strings:
 *   - numbers → `String(n)` (e.g. 25000 → "25000", -500 → "-500")
 *   - dates   → ISO date prefix (YYYY-MM-DD)
 *   - rich-text / formula objects → their resolved `text` / `result`
 *
 * Empty rows and empty cells are skipped so consumers don't need to filter.
 *
 * @example
 *   const { rows } = await extractXlsxData(buffer);
 *   const saleRow = rows.find((r) => r.includes(soldFile.ref) && r.includes('Sale'));
 *   expect(saleRow).toContain('25000');
 */
export const extractXlsxData = async (buffer: Buffer): Promise<XlsxData> => {
    const workbook = new ExcelJS.Workbook();
    // exceljs's `load` expects a Buffer-like — Node 22's Buffer<ArrayBufferLike>
    // mismatches the older `Buffer<ArrayBuffer>` typing exceljs ships, so cast.
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        throw new Error('XLSX file contains no worksheets');
    }

    const rows: string[] = [];
    worksheet.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: false }, (cell) => {
            const value = cell.value;
            if (value === null || value === undefined) return;
            if (value instanceof Date) {
                cells.push(value.toISOString().split('T')[0]);
                return;
            }
            if (typeof value === 'object') {
                // exceljs may return rich text { richText: [...] } or formula { result, formula }
                const obj = value as { result?: unknown; text?: string; richText?: { text: string }[] };
                if (obj.richText) {
                    cells.push(obj.richText.map((t) => t.text).join(''));
                } else if (obj.result !== undefined) {
                    cells.push(String(obj.result));
                } else if (obj.text !== undefined) {
                    cells.push(String(obj.text));
                } else {
                    cells.push(String(value));
                }
                return;
            }
            cells.push(String(value));
        });
        if (cells.length > 0) {
            rows.push(cells.join(' | '));
        }
    });

    return { allText: rows.join('\n'), rows };
};

export const extractPdfText = async (buffer: Buffer): Promise<PdfContent> => {
    const uint8Array = new Uint8Array(buffer);
    const pdfDoc = await getDocument({ data: uint8Array }).promise;

    const pages: string[] = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        pages.push(pageText);
    }

    return {
        fullText: pages.join('\n'),
        pages,
        pageCount: pdfDoc.numPages,
    };
};

/**
 * Identifier set captured for every file closed during a report-verification test.
 * Used by report assertions to confirm rows exist in expected sections / formats.
 *
 * `customerName` is the convenience "FirstName LastName" formatting used by PDF
 * reports. XLSX reports often render names as "LastName, FirstName" — derive that
 * locally via `${lastName}, ${firstName}` when needed.
 */
export interface ClosedFile {
    /** File reference / Ref # — e.g. `BA3AU20811`. Guaranteed unique. */
    ref: string;
    /** Customer full name in PDF-friendly format: `${firstName} ${lastName}`. */
    customerName: string;
    /** First name returned by the create-file API call. */
    firstName: string;
    /** Last name returned by the create-file API call. */
    lastName: string;
    /**
     * Random 10-digit account number used to create the file via API.
     * Optional because not every report verifies on this column —
     * pass it for tests that need to assert the `Account Number` column.
     */
    accountNumber?: string;
}

/**
 * Helper for building a `ClosedFile` from API response fields. Centralized so
 * both `customerName` and the raw name parts are kept in sync.
 *
 * Pass `accountNumber` for report tests that assert against the account-number
 * column (e.g. Internal Remittance Report). Omit for report tests that only
 * care about the file ref + customer name.
 */
export function buildClosedFile(
    ref: string,
    firstName: string,
    lastName: string,
    accountNumber?: string
): ClosedFile {
    return { ref, firstName, lastName, customerName: `${firstName} ${lastName}`, accountNumber };
}

/**
 * Closes the currently-open file as a "Sold - <variant>" status. Fills all
 * prerequisites (assignment, fee, optional collected payment, sale section,
 * sales taxes, generated invoice) before triggering closure.
 *
 * Caller is responsible for opening the file in the UI prior to invocation.
 *
 * @param options.closedStatus - Final status to apply (defaults to 'Sold - Deficiency Recovery')
 * @param options.collectedPaymentAmount - When provided, adds a collected payment of
 *   this amount which produces an entry in the OTHER section of the Sale & Redemption
 *   report. Omit to test the no-collected-payment scenario.
 */
export async function closeFileAsSold(
    page: Page,
    options: { closedStatus?: string; collectedPaymentAmount?: string } = {}
): Promise<void> {
    const closedStatus = options.closedStatus ?? 'Sold - Deficiency Recovery';

    const fileHomePage = await FileHomePage.getInstance(page);

    // Assignment
    await expect(fileHomePage.assignmentOption).toBeVisible();
    await fileHomePage.assignmentOption.click();
    const assignments = await Assignments.getInstance(page);
    await assignments.assignUsersToAssignedCompany('Auto Admin-Basic', 'Admin');

    // Accounting prerequisites: fee + optional collected payment
    await expect(fileHomePage.accountingOption).toBeVisible();
    await fileHomePage.accountingOption.click();
    const accounting = await Accounting.getInstance(page);
    await expect(accounting.arrears_radio_button).toBeVisible();
    await accounting.addFeeEntry();
    if (options.collectedPaymentAmount) {
        await accounting.addCollectedPaymentEntry({ amount: options.collectedPaymentAmount });
    }

    // Remarketing: sale section + sales taxes (GST/HST hard-coded at $1,750 each)
    await expect(fileHomePage.remarketingOption).toBeVisible();
    await fileHomePage.remarketingOption.click();
    const remarketing = await Remarketing.getInstance(page);
    await expect(remarketing.sale_amount_textbox).toBeVisible();
    await remarketing.addDatatoSaleSection();
    await page.waitForTimeout(250);

    await expect(remarketing.sale_gst_textbox).toBeVisible();
    await remarketing.sale_gst_textbox.fill('1750');
    await expect(remarketing.sale_hst_textbox).toBeVisible();
    await remarketing.sale_hst_textbox.fill('1750');

    await expect(remarketing.sale_save_button).toBeEnabled();
    await remarketing.sale_save_button.click();

    // Generate the Sold invoice
    await fileHomePage.accountingOption.click();
    await expect(accounting.add_invoice_button).toBeVisible();
    await accounting.generateInvoice('Sold');

    // Close
    const fileSidebar = await FileSidebar.getInstance(page);
    await fileSidebar.changeFileStageAndStatus('Closed', closedStatus);
    await expect(fileSidebar.close_file_confirmation_modal).toBeVisible();
    await expect(fileSidebar.close_file_button).toBeVisible();
    await fileSidebar.close_file_button.click();
}

/**
 * Closes the currently-open file as 'Closed' / 'Redeemed'. Fills the
 * arrears-redemption tab + standard fee + collected payment + Redemption invoice
 * before triggering closure.
 *
 * Caller is responsible for opening the file in the UI prior to invocation.
 */
export async function closeFileAsRedeemed(page: Page): Promise<void> {
    const fileHomePage = await FileHomePage.getInstance(page);

    await expect(fileHomePage.assignmentOption).toBeVisible();
    await fileHomePage.assignmentOption.click();
    const assignments = await Assignments.getInstance(page);
    await assignments.assignUsersToAssignedCompany('Auto Admin-Basic', 'Admin');

    await expect(fileHomePage.accountingOption).toBeVisible();
    await fileHomePage.accountingOption.click();
    const accounting = await Accounting.getInstance(page);
    await expect(accounting.arrears_radio_button).toBeVisible();
    await accounting.addDataToArrearsRedemptionTab();
    await accounting.addFeeEntry();
    await accounting.addCollectedPaymentEntry();
    await accounting.generateInvoice('Redemption');

    const fileSidebar = await FileSidebar.getInstance(page);
    await fileSidebar.changeFileStageAndStatus('Closed', 'Redeemed');
    await expect(fileSidebar.close_file_confirmation_modal).toBeVisible();
    await expect(fileSidebar.close_file_button).toBeVisible();
    await fileSidebar.close_file_button.click();
}

/**
 * Clicks a link that triggers a PDF — handles both behaviors the app exhibits
 * across browsers: opens the PDF as a popup tab (Chromium default) OR triggers
 * a direct download. Returns the PDF buffer.
 *
 * Use this for any "View Report" / "View Invoice" link whose download mechanism
 * is unpredictable across environments.
 */
export async function downloadPdfFromLink(page: Page, link: Locator): Promise<Buffer> {
    const context = page.context();
    const contextDownloadPromise = new Promise<Download>((resolve) => {
        const onPage = (newPage: Page) => newPage.once('download', resolve);
        context.on('page', onPage);
        page.once('download', resolve);
    });

    const popupPromise = page
        .waitForEvent('popup')
        .then((popup) => ({ type: 'popup' as const, payload: popup }));
    const downloadPromise = contextDownloadPromise.then((download) => ({
        type: 'download' as const,
        payload: download,
    }));

    await link.click();
    const result = await Promise.any([popupPromise, downloadPromise]);

    if (result.type === 'popup') {
        const pdftab = result.payload;
        try {
            await pdftab.waitForLoadState('domcontentloaded', { timeout: 10000 });
            await pdftab.waitForURL((url) => ['http:', 'https:', 'blob:'].includes(url.protocol), {
                timeout: 10000,
            });
            const pdfUrl = pdftab.url();

            let buffer: Buffer;
            if (pdfUrl.startsWith('blob:')) {
                const client = await pdftab.context().newCDPSession(pdftab);
                await client.send('Page.enable');
                const { frameTree } = await client.send('Page.getFrameTree');
                const { content, base64Encoded } = await client.send('Page.getResourceContent', {
                    frameId: frameTree.frame.id,
                    url: pdfUrl,
                });
                buffer = base64Encoded ? Buffer.from(content, 'base64') : Buffer.from(content);
                await client.detach();
            } else {
                const response = await pdftab.request.get(pdfUrl);
                buffer = await response.body();
            }
            await pdftab.close();
            return buffer;
        } catch (err) {
            const download = (await contextDownloadPromise) as Download;
            return readDownloadAsBuffer(download);
        }
    } else {
        return readDownloadAsBuffer(result.payload);
    }
}

/**
 * Reads a Playwright `Download` into a Buffer using the streaming API rather
 * than `download.path()`. The path-based approach fails with
 *   "Path is not available when connecting remotely. Use saveAs() to save a
 *    local copy."
 * whenever the test runs against a remote/connected browser. `createReadStream`
 * works in both local and remote contexts.
 */
async function readDownloadAsBuffer(download: Download): Promise<Buffer> {
    const stream = await download.createReadStream();
    if (!stream) {
        throw new Error('Could not open a read stream for the download');
    }
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
}

/**
 * Slices a section out of an extracted PDF report based on a starting marker
 * string. The slice ends at the next "DETAILS FOR" marker or "GRAND TOTALS"
 * (whichever comes first), enabling section-scoped containment / exclusion
 * assertions in report tests.
 *
 * @example
 *   const soldSection = extractReportSection(pdfText, 'DETAILS FOR TRANSACTION TYPE: SOLD');
 *   expect(soldSection).toContain(soldFile.ref);
 */
export function extractReportSection(text: string, sectionMarker: string): string {
    const startIdx = text.indexOf(sectionMarker);
    if (startIdx === -1) return '';

    const searchStart = startIdx + sectionMarker.length;
    const nextDetailsIdx = text.indexOf('DETAILS FOR', searchStart);
    const grandTotalsIdx = text.indexOf('GRAND TOTALS', searchStart);

    const candidates = [nextDetailsIdx, grandTotalsIdx].filter((i) => i !== -1);
    const endIdx = candidates.length > 0 ? Math.min(...candidates) : text.length;
    return text.substring(startIdx, endIdx);
}

export function extractGoToFileLink(email: ParsedEmail, fileRef: string): string | undefined {
    const cleanFileRef = fileRef.replace(/^#/, '');
    const fileRefNumeric = cleanFileRef.match(/\d+$/)?.[0] ?? cleanFileRef;

    const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const safeFileRef = escapeRegex(cleanFileRef);
    const safeFileRefNumeric = escapeRegex(fileRefNumeric);

    const anchorRegex = new RegExp(
        `<a[^>]+href="([^"]+)"[^>]*>\\s*Go to File\\s*#(?:${safeFileRef}|${safeFileRefNumeric})\\s*</a>`,
        'i'
    );
    let link = email.htmlBody.match(anchorRegex)?.[1];
    if (!link) {
        link = email.links.find((l) => l.includes(cleanFileRef) || l.includes(fileRefNumeric));
    }

    return link;
}
