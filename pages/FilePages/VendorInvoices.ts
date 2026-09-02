import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';
import { generateRandomAccountNumber } from '../../helpers';

export class VendorInvoices extends FileHomePage {
    status_cell_selector: string = '[data-cy="Status"]';
    review_vendor_invoice_icon_selector: string = '[class="w-4 ml-2 text-green-600 cursor-pointer"]';
    review_vendor_invoice_add_row_icon: string = '[class="w-4 text-black-600 cursor-pointer"]';

    review_invoice_header: Locator;
    upload_invoice_button: Locator;

    invoice_date_filter_option: Locator;
    upload_vendor_invoice_modal_title: Locator;
    vendor_invoice_corporation_type_dropdown: Locator;
    vendor_invoice_corporation_dropdown: Locator;
    vendor_invoice_invoice_number_textbox: Locator;
    vendor_invoice_invoice_amount_textbox: Locator;
    vendor_invoice_invoice_date_textbox: Locator;
    vendor_invoice_payment_due_dropdown: Locator;
    vendor_invoice_office_location_dropdown: Locator;
    vendor_invoice_upload_button: Locator;
    vendor_invoice_cancel_button: Locator;
    close_modal_button: Locator;

    review_invoice_approve_button: Locator;
    review_invoice_reject_button: Locator;
    post_to_sage_button: Locator;
    manually_posted_to_sage_button: Locator;
    update_to_paid_button: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.review_invoice_header = this.page.getByRole('heading', { name: 'Review Invoice', exact: true });
        this.upload_invoice_button = this.page
            .locator('[id="vendor_invoices"]')
            .getByText('Drop Here or Click to Select');
        this.invoice_date_filter_option = this.page.getByRole('button', { name: 'Invoice Date' });
        this.upload_vendor_invoice_modal_title = this.page.getByRole('heading', { name: 'Upload Vendor Invoice' });
        this.vendor_invoice_corporation_type_dropdown = this.page.locator('.select-corporationType__indicator');
        this.vendor_invoice_corporation_dropdown = this.page.locator('.select-corporationId__indicator');
        this.vendor_invoice_invoice_number_textbox = this.page.getByPlaceholder('Invoice Number');
        this.vendor_invoice_invoice_amount_textbox = this.page.getByPlaceholder('Invoice Amount');
        this.vendor_invoice_invoice_date_textbox = this.page.getByPlaceholder('Select Date');
        this.vendor_invoice_payment_due_dropdown = this.page.locator('.select-paymentDue__indicator');
        this.vendor_invoice_office_location_dropdown = this.page.locator('.select-officeId__indicator');
        this.vendor_invoice_upload_button = this.page.getByRole('button', { name: 'Upload' });
        this.vendor_invoice_cancel_button = this.page.getByRole('button', { name: 'Cancel' }).last();
        this.review_invoice_approve_button = this.page.getByRole('button', { name: 'Approve' });
        this.review_invoice_reject_button = this.page.getByRole('button', { name: 'Reject' });
        this.post_to_sage_button = this.page.getByRole('button', { name: 'Post to Sage' });
        this.manually_posted_to_sage_button = this.page.getByRole('button', { name: 'Manually Posted to Sage' });
        this.update_to_paid_button = this.page.getByRole('button', { name: 'Update to Paid' });
        this.close_modal_button = this.page
            .locator('[type="button"]')
            .locator('[clip-rule="evenodd"][fill-rule="evenodd"]');
    }

    static async getInstance(page: Page) {
        const instance = new VendorInvoices(page);
        await instance.initialize();
        return instance;
    }

    async uploadInvoiceAsAdmin(
        corptype?:
            | 'Third Party Lien'
            | 'Admin'
            | 'Bailiff'
            | 'Client'
            | 'Court'
            | 'Insurance'
            | 'Process Server'
            | 'Sales Location'
            | 'Skip Tracer'
            | 'Storage Facility'
            | 'Transport'
            | 'Warranty',
        corp?: string,
        invoiceNumber?: string
    ) {
        await expect(this.upload_invoice_button).toBeVisible();
        await expect(this.upload_invoice_button).toBeEnabled();
        const fileChooserPromise = this.page.waitForEvent('filechooser');
        await this.upload_invoice_button.click();

        const fileChooser = await fileChooserPromise;
        let filePath = path.join(__dirname, '../..', 'test-resources', 'test_invoice_1MB.pdf');
        if (!fs.existsSync(filePath)) {
            throw new Error(`Test file not found at: ${filePath}`);
        }
        await fileChooser.setFiles(filePath);

        await expect(this.upload_vendor_invoice_modal_title).toBeVisible();
        await this.vendor_invoice_corporation_type_dropdown.click();

        // Assert all corporation types exist
        const expectedCorporationTypes = [
            'Third Party Lien',
            'Admin',
            'Bailiff',
            'Client',
            'Court',
            'Insurance',
            'Process Server',
            'Sales Location',
            'Skip Tracer',
            'Storage Facility',
            'Transport',
            'Warranty',
        ];
        for (const type of expectedCorporationTypes) {
            await expect(this.page.getByRole('option', { name: type, exact: true })).toBeVisible();
        }
        const corporationTypeToSelect = corptype || 'Admin';
        await this.page.getByRole('option', { name: corporationTypeToSelect, exact: true }).click();

        await this.vendor_invoice_corporation_dropdown.click();
        if (corptype) {
            if (corp) {
                // If a specific corptype was passed, select the first option in the list
                const firstOption = this.page.getByRole('option', { name: corp, exact: true }).first();
                await expect(firstOption).toBeVisible();
                await firstOption.click();
            } else {
                // No specific corp provided; select the first available option
                const firstOption = this.page.getByRole('option').first();
                await expect(firstOption).toBeVisible();
                await firstOption.click();
            }
        } else {
            // Default logic: Select 'RecoveryHub'
            const defaultCorp = this.page.getByRole('option', { name: 'RecoveryHub' });
            await expect(defaultCorp).toBeVisible();
            await defaultCorp.click();
        }
        if (!invoiceNumber) {
            invoiceNumber = await generateRandomAccountNumber(15); // Generate a random 15-digit invoice number
            await this.vendor_invoice_invoice_number_textbox.fill(invoiceNumber);
        } else {
            await this.vendor_invoice_invoice_number_textbox.fill(invoiceNumber);
        }

        await this.vendor_invoice_invoice_amount_textbox.fill('1000');
        await this.vendor_invoice_invoice_date_textbox.fill('03-01-2026');
        await this.page.keyboard.press('Tab'); // Trigger any onBlur events after filling the date
        await this.vendor_invoice_payment_due_dropdown.click();
        await expect(this.page.getByRole('option', { name: '0 Days', exact: true })).toBeVisible();
        await this.page.getByRole('option', { name: '0 Days', exact: true }).click();
        await this.vendor_invoice_upload_button.click();

        // await expect(this.vendor_invoice_upload_button).not.toBeVisible();
        return invoiceNumber;
    }

    async uploadInvoiceAsSubcontractor() {
        await expect(this.upload_invoice_button).toBeVisible();
        await expect(this.upload_invoice_button).toBeEnabled();
        const fileChooserPromise = this.page.waitForEvent('filechooser');
        await this.upload_invoice_button.click();

        const fileChooser = await fileChooserPromise;
        let filePath = path.join(__dirname, '../..', 'test-resources', 'test_invoice_1MB.pdf');
        if (!fs.existsSync(filePath)) {
            throw new Error(`Test file not found at: ${filePath}`);
        }
        console.log(`File path resolved: ${filePath}`);
        await fileChooser.setFiles(filePath);

        await expect(this.upload_vendor_invoice_modal_title).toBeVisible();

        let invoiceNumber = await generateRandomAccountNumber(15); // Generate a random 15-digit invoice number
        await this.vendor_invoice_invoice_number_textbox.fill(invoiceNumber);
        await this.vendor_invoice_invoice_amount_textbox.fill('1000');
        await this.vendor_invoice_invoice_date_textbox.fill('03-01-2026');
        
        await this.page.keyboard.press('Tab'); // Trigger any onBlur events after filling the date
        await expect(this.vendor_invoice_office_location_dropdown).toBeVisible();
        await this.vendor_invoice_office_location_dropdown.click();
        await expect(this.page.getByRole('option', { name: 'ABC Bailiff Toronto' })).toBeVisible();
        await this.page.getByRole('option', { name: 'ABC Bailiff Toronto', exact: true }).click();

        await this.vendor_invoice_upload_button.click();
        const targetRow = this.page.getByRole('row').filter({
            has: this.page.getByRole('cell', { name: invoiceNumber, exact: true }),
        });
        const editIcon = targetRow.locator(this.review_vendor_invoice_icon_selector);
        await expect(editIcon).not.toBeVisible({ timeout: 5000 });
        return invoiceNumber;
    }

    async openEditInvoiceModal(invoiceNumber: string) {
        // 1. Define the row locator by filtering for the unique invoice text
        const targetRow = this.page.getByRole('row').filter({
            has: this.page.getByRole('cell', { name: invoiceNumber, exact: true }),
        });

        // 2. Ensure the row is visible (helps handle lazy loading or pagination)
        await expect(targetRow).toBeVisible({ timeout: 5000 });

        // 3. Find the edit icon selector INSIDE that specific row
        const editIcon = targetRow.locator(this.review_vendor_invoice_icon_selector);

        // 4. Perform the click action
        await editIcon.click();
        await expect(this.review_invoice_header).toBeVisible();
    }

    async fillInvoiceRowData(
        rowNumber: number,
        data: {
            amount: string;
            description: string;
            gst?: string;
            pst?: string;
            hst?: string;
        }
    ) {
        // Define locators dynamically using the rowNumber
        const amountInput = this.page.locator(`input[name="rows.${rowNumber}.amount"]`);
        const descInput = this.page.locator(`input[name="rows.${rowNumber}.description"]`);
        const gstInput = this.page.locator(`input[name="rows.${rowNumber}.GST"]`);
        const pstInput = this.page.locator(`input[name="rows.${rowNumber}.PSTTVQ"]`);
        const hstInput = this.page.locator(`input[name="rows.${rowNumber}.HST"]`);

        await expect(amountInput).toBeVisible({ timeout: 5000 });
        await expect(descInput).toBeVisible();
        await expect(hstInput).toBeVisible();
        // Perform actions
        await descInput.fill(data.description);
        await amountInput.fill(data.amount);

        // Fill tax fields only if data is provided (handling optional parameters)
        if (data.gst) await gstInput.fill(data.gst);
        if (data.pst) await pstInput.fill(data.pst);
        if (data.hst) await hstInput.fill('0');
        if (data.hst) await hstInput.fill(data.hst);
        await hstInput.press('Tab'); // Trigger any onBlur calculations after filling the last field
    }

    async getVendorInvoiceRowByInvoiceNumber(invoiceNumber: string) {
        return this.page.getByRole('row').filter({
            has: this.page.getByRole('cell', { name: invoiceNumber, exact: true }),
        });
    }
}
