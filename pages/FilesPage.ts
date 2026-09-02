import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export class FilesPage {
    private page: Page;
    search_result_selector: string = '[data-cy="search-results"]';
    file_row_selector: string = '[data-cy="data-row"]';
    file_ref_id_cell_selector: string = '[data-cy="Ref #"]';
    file_province_cell_selector: string = '[data-cy="Province"]';
    file_client_cell_selector: string = '[data-cy="Client"]';
    file_stage_cell_selector: string = '[data-cy="Stage"]';
    file_status_cell_selector: string = '[data-cy="Status"]';
    filter_dropdown_selector: string = '[data-cy="filter-children"]';

    files_button: Locator;
    notifications_button: Locator;
    reports_button: Locator;
    companies_button: Locator;
    invoices_button: Locator;
    users_button: Locator;
    remarketing_button: Locator;
    settings_button: Locator;
    my_account_button: Locator;
    logout_button: Locator;
    search_textbox: Locator;
    province_filter_option: Locator;
    client_filter_option: Locator;
    stage_filter_option: Locator;
    status_filter_option: Locator;
    file_type_filter_option: Locator;
    asset_type_filter_option: Locator;
    rush_file_filter_option: Locator;
    assigned_companies_filter_option: Locator;
    assigned_users_filter_option: Locator;
    assignment_date_range_filter_option: Locator;
    closed_date_range_filter_option: Locator;
    last_activty_date_range_filter_option: Locator;
    sale_date_range_filter_option: Locator;
    clear_all_filters_button: Locator;
    next_page_pagination_button: Locator;
    active_files_button: Locator;
    hold_files_button: Locator;
    closed_files_button: Locator;
    terms_and_condition_link: Locator;
    create_file_button: Locator;
    export_to_excel_button: Locator;
    constructor(page: Page) {
        this.page = page;
    }

    private async initialize() {
        this.files_button = this.page.getByRole('link', { name: 'Files', exact: true });
        this.notifications_button = this.page.getByRole('link', { name: 'Notifications' });
        this.reports_button = this.page.getByRole('link', { name: 'Reports' });
        this.companies_button = this.page.getByRole('link', { name: 'Companies' });
        this.invoices_button = this.page.getByRole('link', { name: 'Invoices' });
        this.users_button = this.page.getByRole('link', { name: 'Users' });
        this.remarketing_button = this.page.getByRole('link', { name: 'Remarketing' });
        this.settings_button = this.page.getByRole('link', { name: 'Settings' });
        this.my_account_button = this.page.getByRole('link', { name: 'My Account' });
        this.logout_button = this.page.getByRole('button', { name: 'Logout' });
        this.search_textbox = this.page.getByPlaceholder('Search by something');
        this.province_filter_option = this.page.getByRole('button', { name: 'Province' });
        this.client_filter_option = this.page.getByRole('button', { name: 'Client' });
        this.stage_filter_option = this.page.getByRole('button', { name: 'Stage' });
        this.status_filter_option = this.page.getByRole('button', { name: 'Status' });
        this.file_type_filter_option = this.page.getByRole('button', { name: 'File Type' });
        this.asset_type_filter_option = this.page.getByRole('button', { name: 'Asset Type' });
        this.rush_file_filter_option = this.page.getByRole('button', { name: 'Rush File' });
        this.assigned_companies_filter_option = this.page.getByRole('button', { name: 'Assigned Companies' });
        this.assigned_users_filter_option = this.page.getByRole('button', { name: 'Assigned Users' });
        this.assignment_date_range_filter_option = this.page.getByRole('button', { name: 'Assignment Date Range' });
        this.closed_date_range_filter_option = this.page.getByRole('button', { name: 'Closed Date Range' });
        this.last_activty_date_range_filter_option = this.page.getByRole('button', {
            name: 'Last Activity Date Range',
        });
        this.sale_date_range_filter_option = this.page.getByRole('button', { name: 'Sale Date Range' });
        this.clear_all_filters_button = this.page.getByRole('button', { name: 'Clear All' });
        this.next_page_pagination_button = this.page.locator('[title="next page"]');
        this.active_files_button = this.page.getByRole('button', { name: 'Active' });
        this.hold_files_button = this.page.getByRole('button', { name: 'Hold' });
        this.closed_files_button = this.page.getByRole('button', { name: 'Closed' }).nth(0);
        this.terms_and_condition_link = this.page.getByRole('link', { name: 'Terms and Conditions of Use' });
        this.create_file_button = this.page.getByRole('link', { name: 'Create File' });
        this.export_to_excel_button = this.page.getByRole('button', { name: 'Export to Excel' });
    }

    static async getInstance(page: Page) {
        const instance = new FilesPage(page);
        await instance.initialize();
        return instance;
    }

    async filterFileBySearching(fileRefId: string) {
        await expect(this.search_textbox).toBeVisible();
        await this.search_textbox.fill(fileRefId);
        let searchResultDropdown = this.page.locator(this.search_result_selector);
        await expect(searchResultDropdown).toBeVisible();
        let searchOption = searchResultDropdown
            .locator('[data-cy*="result -"]')
            .getByText(fileRefId, { exact: true })
            .first();
        await expect(searchOption).toBeVisible();
        await searchOption.click();
        await this.page.waitForTimeout(500); // wait for search results to load and filter to apply
    }

    async clickOnFileRefID(fileRefId: string) {
        let fileRef = this.page.locator(this.file_ref_id_cell_selector).filter({ hasText: fileRefId });
        await expect(fileRef).toBeVisible();
        await fileRef.click();
        await this.page.waitForTimeout(500); // wait for navigation
        if (await fileRef.isVisible()) {
            await fileRef.click();
        }
        await expect(fileRef).toBeHidden();
    }

    async openRandomFile() {
        await expect(this.page.locator(this.file_ref_id_cell_selector).first()).toBeVisible();
        await this.page.getByRole('link', { name: 'go to Page 5' }).click();
        const fileRefs = this.page.locator(this.file_ref_id_cell_selector);
        const count = await fileRefs.count();

        if (count === 0) {
            throw new Error('No file references found on the page.');
        }

        const randomIndex = Math.floor(Math.random() * count);
        const randomFileRef = fileRefs.nth(randomIndex);

        await expect(randomFileRef).toBeVisible();
        await randomFileRef.click();
        await expect(randomFileRef).toBeHidden();
    }
}
