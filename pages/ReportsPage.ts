import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { getTodaysDate } from '../helpers';

export class ReportsPage {
    protected page: Page;
    report_row_selector: string = '[data-cy="data-row"]'
    download_link_selector: string = '[data-cy="Report View"]'

    create_report_button: Locator
    report_format_dropdown: Locator
    report_company_dropdown: Locator
    report_date_from_input: Locator
    report_date_to_input: Locator
    report_create_button: Locator
    report_cancel_button: Locator


    constructor(page: Page) {
        this.page = page;
    }

    protected async initialize() {
        this.create_report_button = this.page.getByRole('button', { name: 'Create Report' });
        this.report_format_dropdown = this.page.locator('.select-reportFormatType__indicator')
        this.report_company_dropdown = this.page.locator('.select-companyId__indicator')
        this.report_date_from_input = this.page.locator('#ReportForm').getByRole('textbox', { name: 'Date From' })
        this.report_date_to_input = this.page.locator('#ReportForm').getByRole('textbox', { name: 'Date To' })
        this.report_create_button = this.page.locator('#ReportForm').getByRole('button', { name: 'Create' })
        this.report_cancel_button = this.page.locator('#ReportForm').getByRole('button', { name: 'Cancel' })

    }

    static async getInstance(page: Page) {
        const instance = new ReportsPage(page);
        await instance.initialize();
        return instance;
    }

    /**
     * Generates a report that aggregates across ALL clients (no client-filter
     * dropdown). Picks the report type, asserts the client dropdown is hidden,
     * fills today→today date range, and clicks Create.
     *
     * Use for report types like 'Internal Remittance Report' that don't expose
     * a client filter. Use `createReportForClient` for client-scoped reports.
     */
    async createReportForAllClients(reportType: string) {
        await expect(this.create_report_button).toBeVisible();
        await this.create_report_button.click();

        await expect(this.report_format_dropdown).toBeVisible();
        await this.report_format_dropdown.click();
        const reportOption = this.page.getByRole('option', { name: reportType });
        await expect(reportOption).toBeVisible();
        await reportOption.click();

        // Assert the client/company dropdown is hidden when this report type is selected —
        // this is what makes it an "all clients" report.
        await expect(this.report_company_dropdown).toBeHidden();

        const today = await getTodaysDate();
        await expect(this.report_date_from_input).toBeVisible();
        await this.report_date_from_input.fill(today);
        await this.page.keyboard.press('Tab');

        await expect(this.report_date_to_input).toBeVisible();
        await this.report_date_to_input.fill(today);
        await this.page.keyboard.press('Tab');

        await expect(this.report_create_button).toBeVisible();
        await expect(this.report_create_button).toBeEnabled();
        await this.report_create_button.click();
        await expect(this.page.getByText('Generating Report...')).not.toBeVisible({ timeout: 10000 });
    }

    async createReportForClient(reportType?: string, companyName?: string) {
        await expect(this.create_report_button).toBeVisible();
        await this.create_report_button.click();
        if (reportType) {
            await expect(this.report_format_dropdown).toBeVisible();
            await this.report_format_dropdown.click();
            const reportOption = this.page.getByRole('option', { name: reportType });
            await expect(reportOption).toBeVisible();
            await reportOption.click();
        }
        if (companyName) {
            await expect(this.report_company_dropdown).toBeVisible();
            await this.report_company_dropdown.click();
            const companyOption = this.page.getByRole('option', { name: companyName });
            await expect(companyOption).toBeVisible();
            await companyOption.click();
        }
        let today = await getTodaysDate();
        await expect(this.report_date_from_input).toBeVisible();
        await this.report_date_from_input.fill(today);
        await this.page.keyboard.press('Tab');

        await expect(this.report_date_to_input).toBeVisible();
        await this.report_date_to_input.fill(today);
        await this.page.keyboard.press('Tab');

        await expect(this.report_create_button).toBeVisible();
        await expect(this.report_create_button).toBeEnabled();
        await this.report_create_button.click();
        await expect(this.page.getByText('Generating Report...')).not.toBeVisible({ timeout: 10000 });
    }

}
