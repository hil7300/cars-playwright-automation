import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export class UsersPage {
    private page: Page;
    filter_dropdown_selector: string = '[data-cy="filter-children"]';
    company_cell_selector: string = '[data-cy="Company"]';
    status_cell_selector: string = '[data-cy="Status"]';
    search_result_selector: string = '[data-cy="search-results"]';
    user_row_selector: string = '[data-cy="data-row"]';
    user_row_name_selector: string = '[data-cy="Name"]';
    companies_filter_option: Locator;
    province_filter_option: Locator;
    activity_type_filter_option: Locator;
    user_status_filter_option: Locator;
    search_textbox: Locator;
    clear_all_filter: Locator;
    edit_user_button: Locator;

    edit_email_textbox: Locator;
    save_user_button: Locator;

    constructor(page: Page) {
        this.page = page;
    }

    private async initialize() {
        this.companies_filter_option = this.page.getByRole('button', { name: 'Company' });
        this.province_filter_option = this.page.getByRole('button', { name: 'Province' });
        this.activity_type_filter_option = this.page.getByRole('button', { name: 'Activity Type' });
        this.user_status_filter_option = this.page.getByRole('button', { name: 'User Status' });
        this.search_textbox = this.page.getByPlaceholder('Search for user');
        this.clear_all_filter = this.page.getByRole('button', { name: 'Clear all' });
        this.edit_user_button = this.page.getByRole('link', { name: 'Edit' });

        this.edit_email_textbox = this.page.getByRole('textbox', { name: 'Email' });
        this.save_user_button = this.page.getByRole('button', { name: 'Save User' });
    }

    static async getInstance(page: Page) {
        const instance = new UsersPage(page);
        await instance.initialize();
        return instance;
    }

    async searchUser(userName: string) {
        await expect(this.search_textbox).toBeVisible();
        await this.search_textbox.fill(userName);

        let searchResult = this.page.locator(this.search_result_selector).getByText(userName);
        await expect(searchResult).toBeVisible();
        await searchResult.click();

        let userNameCell = this.page.locator(this.user_row_name_selector).filter({ hasText: userName });
        await expect(userNameCell).toBeVisible();
    }
}
