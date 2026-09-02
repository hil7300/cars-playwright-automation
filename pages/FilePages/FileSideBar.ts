import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';
import { AssetDetails } from './AssetDetails';

export class FileSidebar extends FileHomePage {
    audit_log_entries_selector: string = '[class="text-xs py-4 border-b border-gray-400 min-w-full max-w-full"]';
    current_file_stage_container_selector: string =
        '[class*="select-stageId__value-container select-stageId__value-container--has-value"]';
    current_file_status_container_selector: string =
        '[class*="select-statusId__value-container select-statusId__value-container--has-value"]';
    summary_tab: Locator;
    notes_tab: Locator;
    audit_log_tab: Locator;
    file_stage_dropdown: Locator;
    file_status_dropdown: Locator;
    update_button: Locator;
    cancel_button: Locator;
    create_reminder_button: Locator;
    close_file_alert_modal: Locator;
    close_file_alert_ok_button: Locator;
    close_file_confirmation_modal: Locator;
    close_file_button: Locator;
    close_file_cancel_button: Locator;

    re_open_file_button: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.summary_tab = this.page.getByRole('button', { name: 'Summary' });
        this.notes_tab = this.page.getByRole('button', { name: 'Notes' }).nth(2);
        this.audit_log_tab = this.page.getByRole('button', { name: 'Audit Log' });
        this.file_stage_dropdown = this.page.locator('.select-stageId__indicator');
        this.file_status_dropdown = this.page.locator('.select-statusId__indicator');
        this.update_button = this.page.getByRole('button', { name: 'Update' });
        this.cancel_button = this.page.getByRole('button', { name: 'Cancel' });
        this.create_reminder_button = this.page.getByRole('button', { name: 'Create Reminder' });
        this.close_file_alert_modal = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .filter({ hasText: 'Close File' });
        this.close_file_alert_ok_button = this.page.getByRole('button', { name: 'OK', exact: true });
        this.close_file_confirmation_modal = this.page.getByRole('heading', { name: 'Close File' });
        this.close_file_button = this.page.getByRole('button', { name: 'Close File' });
        this.close_file_cancel_button = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .filter({ hasText: 'Close File' })
            .getByRole('button', { name: 'Cancel' });

        this.re_open_file_button = this.page.getByRole('button', { name: 'Re-Open File' });
    }

    static async getInstance(page: Page) {
        const instance = new FileSidebar(page);
        await instance.initialize();
        return instance;
    }

    async changeFileStage(stageName: string | string[]) {
        // 1. Normalize input to an array
        const stages = Array.isArray(stageName) ? stageName : [stageName];

        // 2. Loop through and open the dropdown for each stage change
        for (const stage of stages) {
            await expect(this.file_stage_dropdown).toBeVisible();
            await this.file_stage_dropdown.click();

            const option = this.page.getByRole('option', { name: stage, exact: true });
            await expect(option).toBeVisible();
            await option.click();
        }
    }

    async changeFileStatus(statusName: string | string[]) {
        // 1. Normalize the input to an array
        const statuses = Array.isArray(statusName) ? statusName : [statusName];

        // 2. Loop through and open the dropdown for each stage change
        for (const status of statuses) {
            await expect(this.file_status_dropdown).toBeVisible();
            await this.file_status_dropdown.click();
            const option = this.page.getByRole('option', { name: status, exact: true });
            await expect(option).toBeVisible();
            await option.click();
        }
    }

    async changeFileStageAndStatus(stageName: string | string[], statusName: string | string[]) {
        await this.summary_tab.click();
        await this.changeFileStage(stageName);
        await this.changeFileStatus(statusName);
        await this.update_button.click();
    }
}
