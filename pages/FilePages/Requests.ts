import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';

export class Requests extends FileHomePage {
    create_request_button: Locator;
    send_to_ops_button: Locator;
    send_to_company_dropdown: Locator;
    request_type_dropdown: Locator;
    notify_by_email_checkbox: Locator;
    select_users_to_send_dropdown: Locator;

    ops_request_select_user_dropdown: Locator;
    ops_request_file_type_dropdown: Locator;
    ops_request_closed_status_dropdown: Locator;

    save_request: Locator;
    cancel_request: Locator;
    reason_for_request_textbox: Locator;

    respond_to_request_button: Locator;
    cancel_request_button: Locator;

    reject_request_button: Locator;
    approve_request_button: Locator;
    reason_for_response_textbox: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.create_request_button = this.page.getByRole('button', { name: 'Create request' });
        this.send_to_ops_button = this.page.getByRole('button', { name: 'Send to OPS' });
        this.send_to_company_dropdown = this.page.locator('.select-approvalFromCompanyId__indicator');
        this.request_type_dropdown = this.page.locator('.select-type__indicator');
        this.notify_by_email_checkbox = this.page.locator('.chakra-checkbox__control')
        this.select_users_to_send_dropdown = this.page.getByRole('button', { name: 'Select users to send the' });

        this.ops_request_select_user_dropdown = this.page.getByRole('button', { name: 'Select users to send the' });
        this.ops_request_file_type_dropdown = this.page.locator('.select-fileType__indicators');
        this.ops_request_closed_status_dropdown = this.page.locator('.select-closedStatus__indicators');

        this.save_request = this.page.locator('[id*="headlessui-dialog-panel"]').getByRole('button', { name: 'Save' });
        this.cancel_request = this.page.getByRole('button', { name: 'Cancel' });
        this.reason_for_request_textbox = this.page.getByRole('textbox', { name: 'Reason for Request' });

        this.respond_to_request_button = this.page.getByRole('button', { name: 'Respond' });
        this.cancel_request_button = this.page.locator('[id="requests"]').getByRole('button', { name: 'Cancel' });
        this.reject_request_button = this.page.getByRole('button', { name: 'Reject' });
        this.approve_request_button = this.page.getByRole('button', { name: 'Approve' });
        this.reason_for_response_textbox = this.page.getByRole('textbox', { name: 'Reason for Response' });
    }

    static async getInstance(page: Page) {
        const instance = new Requests(page);
        await instance.initialize();
        return instance;
    }

    async createRequest({
        requestType = 'Request to Close',
        reason = 'Standard request for processing',
        notifyByEmail = false,
        sendToUsers,
    }: {
        requestType?: 'Request to Close' | 'Request to Proceed' | 'Request to Repair';
        reason?: string;
        notifyByEmail?: boolean;
        sendToUsers?: string | string[];
    } = {}) {
        await expect(this.create_request_button).toBeVisible();
        await this.create_request_button.click();

        await expect(this.request_type_dropdown).toBeVisible();
        await this.request_type_dropdown.click();

        const typeOption = this.page.getByRole('option', { name: requestType, exact: true });
        await expect(typeOption).toBeVisible();
        await typeOption.click();

        if (sendToUsers) {
            // Normalize to an array so we can safely loop through it
            const usersList = Array.isArray(sendToUsers) ? sendToUsers : [sendToUsers];

            for (const user of usersList) {
                await expect(this.select_users_to_send_dropdown).toBeVisible();
                await this.select_users_to_send_dropdown.click();

                const userOption = this.page.getByRole('menuitemcheckbox', { name: user });
                await expect(userOption).toBeVisible();
                await userOption.click();
            }
        }

        if (notifyByEmail) {
            await expect(this.notify_by_email_checkbox).toBeVisible();
            await this.notify_by_email_checkbox.click();
        }
        await expect(this.reason_for_request_textbox).toBeVisible();
        await this.reason_for_request_textbox.fill(reason);

        await expect(this.save_request).toBeEnabled();
        await this.save_request.click();

        await expect(this.save_request).toBeHidden();
    }

    async createSendToOpsRequest({
        fileType = 'Sold',
        closedStatus = 'Sold - Deficiency Recovery',
        sendToUsers,
    }: {
        fileType?: 'Sold' | 'Redemption' | 'No Repo & AR' | 'Redemption QC/Fees Not Paid' | 'Sold Negative Remit';
        closedStatus?: string;
        sendToUsers?: string | string[];
    } = {}) {
        await expect(this.send_to_ops_button).toBeVisible();
        await this.send_to_ops_button.click();

        await expect(this.ops_request_file_type_dropdown).toBeVisible();
        await this.ops_request_file_type_dropdown.click();

        const typeOption = this.page.getByRole('option', { name: fileType, exact: true });
        await expect(typeOption).toBeVisible();
        await typeOption.click();

        await expect(this.ops_request_closed_status_dropdown).toBeVisible();
        await this.ops_request_closed_status_dropdown.click();

        const closedStatusOption = this.page.getByRole('option', { name: closedStatus, exact: true });
        await expect(closedStatusOption).toBeVisible();
        await closedStatusOption.click();

        if (sendToUsers) {
            // Normalize to an array so we can safely loop through it
            const usersList = Array.isArray(sendToUsers) ? sendToUsers : [sendToUsers];

            for (const user of usersList) {
                await expect(this.select_users_to_send_dropdown).toBeVisible();
                await this.select_users_to_send_dropdown.click();

                const userOption = this.page.getByRole('menuitemcheckbox', { name: user });
                await expect(userOption).toBeVisible();
                await userOption.click();
            }
        }

        await expect(this.reason_for_request_textbox).toBeVisible();
        await this.reason_for_request_textbox.click();
        await this.reason_for_request_textbox.fill(`Requesting OPS involvement for file with status: ${closedStatus}`);

        await expect(this.save_request).toBeEnabled();
        await this.save_request.click();

        await expect(this.save_request).toBeHidden();
    }
}