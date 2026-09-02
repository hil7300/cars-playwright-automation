import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { getTodaysDate } from '../helpers';

export class RemarketingPage {
    protected page: Page;

    status_applied_selector: string = '[class="bg-gray-200 text-sm p-1 px-2 rounded-sm space-x-2 flex items-center"]';
    file_row_selector: string = '[data-cy="data-row"]';
    auction_cell_selector: string = '[data-cy="Auction"]';
    client_cell_selector: string = '[data-cy="Client"]';
    vin_cell_selector: string = '[data-cy="VIN / HIN"]';
    date_at_auction_cell_selector: string = '[data-cy="Date at Auction"]';
    legal_sale_date_cell_selector: string = '[data-cy="Legal Sale Date"]';
    date_of_last_activity_cell_selector: string = '[data-cy="Date of Last Activity"]';
    condition_report_date_cell_selector: string = '[data-cy="Condition Report Date"]';
    repairs_requested_cell_selector: string = '[data-cy="Repairs Requested"]';
    repairs_approved_cell_selector: string = '[data-cy="Repairs Approved"]';
    rough_value_cell_selector: string = '[data-cy="Rough Value"]';
    approved_date_cell_selector: string = '[data-cy="Approved Date"]';
    updated_condition_report_date_cell_selector: string = '[data-cy="Updated Condition Report Date"]';
    requested_reserve_price_cell_selector: string = '[data-cy="Requested Reserve Price"]';
    requested_reserve_price_date_cell_selector: string = '[data-cy="Requested Reserve Price Date"]';
    approved_reserve_price_cell_selector: string = '[data-cy="Approved Reserve Price"]';
    revised_approved_reserve_price_cell_selector: string = '[data-cy="Revised Approved Reserve Price"]';
    claims_history_cell_selector: string = '[data-cy="Claims History"]';
    auction_date_cell_selector: string = '[data-cy="Auction Date"]';
    sale_price_cell_selector: string = '[data-cy="Sale Price"]';
    sale_date_cell_selector: string = '[data-cy="Sale Date"]';

    status_dropdown: Locator;

    constructor(page: Page) {
        this.page = page;
    }

    protected async initialize() {
        this.status_dropdown = this.page.locator('#remarketingStatus');
    }

    static async getInstance(page: Page) {
        const instance = new RemarketingPage(page);
        await instance.initialize();
        return instance;
    }

    async changeStatusTo(status: string) {
        await expect(this.status_dropdown).toBeVisible();
        await this.status_dropdown.click();

        const option = this.page.getByRole('option', { name: status, exact: true });
        await expect(option).toBeVisible();
        await option.click();
        let filterAppliedCard = this.page.locator(this.status_applied_selector).filter({ hasText: status });
        await expect(filterAppliedCard).toBeVisible();
    }

    async getFileRowByVIN(vin: string): Promise<Locator> {
        await expect(this.page.locator(this.file_row_selector).first()).toBeVisible();
        const fileRows = this.page.locator(this.file_row_selector);
        const rowCount = await fileRows.count();

        for (let i = 0; i < rowCount; i++) {
            const row = fileRows.nth(i);
            const vinCell = row.locator(this.vin_cell_selector);
            const vinText = await vinCell.textContent();
            if (vinText?.trim() === vin) {
                return row;
            }
        }

        throw new Error(`File row with VIN ${vin} not found`);
    }
}
