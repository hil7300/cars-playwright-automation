import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export class InvoicePage {
    protected page: Page;
    card_selector: string = '[class*="rounded-md px-4 py-2 cursor-pointer"]';
    status_cell_selector: string = '[data-cy="Status"]';
    vendor_cell_selector: string = '[data-cy="Vendor"]';
    invoice_cell_selector: string = '[data-cy="Invoice Number"]';

    vendor_filter_option: Locator;
    file_reference_number_textbox: Locator;
    invoice_number_textbox: Locator;
    new_card: Locator;
    escalated_card: Locator;
    approved_card: Locator;
    pending_payment_card: Locator;
    paid_card: Locator;
    exception_card: Locator;
    manually_posted_card: Locator;
    rejected_card: Locator;
    clear_all_filters: Locator;

    constructor(page: Page) {
        this.page = page;
    }

    protected async initialize() {
        this.file_reference_number_textbox = this.page.getByPlaceholder('File Reference Number');
        this.invoice_number_textbox = this.page.getByPlaceholder('Invoice Number');
        this.new_card = this.page.locator(this.card_selector).filter({ hasText: 'New' });
        this.escalated_card = this.page.locator(this.card_selector).filter({ hasText: 'Escalated' });
        this.approved_card = this.page.locator(this.card_selector).filter({ hasText: 'Approved' });
        this.pending_payment_card = this.page.locator(this.card_selector).filter({ hasText: 'Pending Payment' });
        this.paid_card = this.page.locator(this.card_selector).filter({ hasText: 'Paid' });
        this.exception_card = this.page.locator(this.card_selector).filter({ hasText: 'Exception' });
        this.manually_posted_card = this.page.locator(this.card_selector).filter({ hasText: 'Manually Posted' });
        this.rejected_card = this.page.locator(this.card_selector).filter({ hasText: 'Rejected' });
        this.clear_all_filters = this.page.getByRole('button', { name: 'Clear all' });
        this.vendor_filter_option = this.page.getByRole('button', { name: 'vendor', exact: true });
    }

    static async getInstance(page: Page) {
        const instance = new InvoicePage(page);
        await instance.initialize();
        return instance;
    }
}
