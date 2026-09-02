import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';

export class Assignments extends FileHomePage {
    assigned_companies_card_selector: string = '[class="border border-slate-300 rounded p-2"]';
    assigned_user_card: string = '[class*="select__multi-value"]';
    accept_assignment_without_quote_modal_selector: string = '[id*="headlessui-dialog-panel-_"]';
    toast_selector: string = '[role="status"]';
    quote_service_textbox_selector: string = '[name*="services."]';
    quote_amount_textbox_selector: string = '[inputmode="numeric"][value*="$"]';
    approval_pending_banner_selector: string = '[role="alert"][data-status="info"]';
    assign_new_companies: Locator;
    assign_new_company_type_dropdown: Locator;
    assign_new_company_dropdown: Locator;
    assign_new_company_users_dropdown: Locator;
    quote_toggle: Locator;
    assign_button: Locator;
    save_button: Locator;
    cancel_button: Locator;
    assignment_request_banner: Locator;
    assignment_request_accept_button: Locator;
    assignment_request_decline_button: Locator;
    assignment_request_accept_with_quote_button: Locator;

    add_service_button: Locator;
    submit_quote_button: Locator;
    review_quote_button: Locator;
    approve_quote_button: Locator;
    reject_quote_dropdown: Locator;
    reject_and_close_button: Locator;
    reject_and_resubmit_button: Locator;
    rejection_reason_textbox: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.assign_new_companies = this.page.getByRole('heading', { name: 'Assign New Company' });
        this.assign_new_company_type_dropdown = this.page.locator('.select-activityType__indicator');
        this.assign_new_company_dropdown = this.page.locator('.select-companyId__indicator');
        this.assign_new_company_users_dropdown = this.page
            .locator('[role="group"]')
            .filter({ hasText: 'Assign Users' })
            .locator('.select__indicator.select__dropdown-indicator');
        this.quote_toggle = this.page.getByRole('switch', { name: 'Use setting' });
        this.assign_button = this.page.getByRole('button', { name: 'Assign', exact: true });
        this.save_button = this.page.getByRole('button', { name: 'Save', exact: true });
        this.cancel_button = this.page.getByRole('button', { name: 'Cancel', exact: true });
        this.assignment_request_banner = this.page.getByRole('alert').filter({ hasText: 'Assignment Request' });
        this.assignment_request_accept_button = this.page.getByRole('button', { name: 'Accept', exact: true });
        this.assignment_request_decline_button = this.page.getByRole('button', { name: 'Decline', exact: true });
        this.assignment_request_accept_with_quote_button = this.page.getByRole('button', { name: 'Accept with Quote' });

        this.add_service_button = this.page.getByRole('button', { name: 'Add Service' });
        this.submit_quote_button = this.page.getByRole('button', { name: 'Submit Quote' });
        this.review_quote_button = this.page.getByRole('button', { name: 'Review' });
        this.approve_quote_button = this.page.getByRole('button', { name: 'Approve Quote', exact: true });
        this.reject_quote_dropdown = this.page.getByRole('button', { name: 'Reject Quote', exact: true });
        this.reject_and_close_button = this.page.getByText('Reject & Close');
        this.reject_and_resubmit_button = this.page.getByText('Reject & Resubmit');
        this.rejection_reason_textbox = this.page.locator(
            '[name="additionalInformation"][id="additional-information"]'
        );
    }

    static async getInstance(page: Page) {
        const instance = new Assignments(page);
        await instance.initialize();
        return instance;
    }

    async assignCompanyToFile(
        activityType:
            | 'Admin'
            | 'Bailiff'
            | 'Client'
            | 'Collection Agent'
            | 'Court'
            | 'Credit Counselling Service'
            | 'Insurance'
            | 'Law Firm'
            | 'Other'
            | 'Process Server'
            | 'Sales Location'
            | 'Skip Tracer'
            | 'Storage Facility'
            | 'Third Party Lien'
            | 'Transport'
            | 'Trustee'
            | 'Warranty',
        companyName: string,
        userName?: string | string[],
        quoteRequired: boolean = false
    ) {
        await this.assign_new_company_type_dropdown.click();

        await expect(this.page.getByRole('option', { name: activityType })).toBeVisible();
        await this.page.getByRole('option', { name: activityType }).click();

        await this.assign_new_company_dropdown.click();
        await expect(this.page.getByRole('option', { name: companyName })).toBeVisible();
        await this.page.getByRole('option', { name: companyName }).click();

        if (userName) {
            // Normalize to an array so we can loop through it whether it's 1 or 5 users
            const users = Array.isArray(userName) ? userName : [userName];

            for (const user of users) {
                await this.assign_new_company_users_dropdown.click();
                const option = this.page.getByRole('option', { name: user, exact: true });
                await expect(option).toBeVisible();
                await option.click();
            }
        }

        if (quoteRequired) {
            await this.quote_toggle.click();
        }

        await this.assign_button.click();
        await expect(this.page.getByRole('heading', { name: `${activityType}` })).toBeVisible();
        await expect(this.page.getByRole('banner').filter({ hasText: `${companyName}` })).toBeVisible();
    }

    async acceptAssignmentWithoutQuote() {
        await expect(this.assignment_request_banner).toBeVisible();
        await expect(this.assignment_request_accept_button).toBeVisible();
        await this.assignment_request_accept_button.click(); // Adding a slight delay to ensure the click is registered properly

        let confirmationModal = this.page.locator(this.accept_assignment_without_quote_modal_selector);
        await expect(confirmationModal).toBeVisible();
        await confirmationModal.getByRole('button', { name: 'Accept', exact: true }).click();
        await expect(confirmationModal).toBeHidden();
        await expect(this.assignment_request_banner).toBeHidden();
        await expect(this.page.locator(this.toast_selector)).toBeVisible();
        await expect(this.page.locator(this.toast_selector)).toContainText('Response submitted successfully');
        await this.page.locator(this.toast_selector).locator('[aria-label="Close"]').click();
    }

    async assignUsersToAssignedCompany(
        userNames: string | string[],
        userCompanyName:
            | 'Admin'
            | 'Bailiff'
            | 'Client'
            | 'Collection Agent'
            | 'Court'
            | 'Credit Counselling Service'
            | 'Insurance'
            | 'Law Firm'
            | 'Other'
            | 'Process Server'
            | 'Sales Location'
            | 'Skip Tracer'
            | 'Storage Facility'
            | 'Third Party Lien'
            | 'Transport'
            | 'Trustee'
            | 'Warranty'
    ) {
        const users = Array.isArray(userNames) ? userNames : [userNames];
        let companySection = this.page
            .locator(this.assigned_companies_card_selector)
            .filter({ hasText: userCompanyName });
        await expect(companySection).toBeVisible();
        let assignUsersDropdown = companySection.locator('[class*="select__indicator select__dropdown-indicator"]');
        await expect(assignUsersDropdown).toBeVisible();

        for (const user of users) {
            await assignUsersDropdown.click();
            await expect(this.page.getByRole('option', { name: user })).toBeVisible();
            await this.page.getByRole('option', { name: user }).click();

            let userCard = companySection.locator(this.assigned_user_card).filter({ hasText: user }).last();
            await expect(userCard).toBeVisible();
        }
        await expect(companySection.locator(this.save_button)).toBeVisible();
        await companySection.locator(this.save_button).click();
    }

    async submitQuote(service: string, amount: number) {
        await expect(this.assignment_request_accept_with_quote_button).toBeVisible();
        await this.assignment_request_accept_with_quote_button.click();

        await expect(this.page.locator(this.quote_service_textbox_selector)).toBeVisible();
        await this.page.locator(this.quote_service_textbox_selector).fill(service);

        await expect(this.page.locator(this.quote_amount_textbox_selector)).toBeVisible();
        await this.page.locator(this.quote_amount_textbox_selector).fill(amount.toString());

        await this.submit_quote_button.click();
        await expect(this.add_service_button).toBeHidden();
        await expect(this.page.locator(this.toast_selector)).toBeVisible();
        await expect(this.page.locator(this.toast_selector)).toContainText('Quote submitted successfully');
        await this.page.locator(this.toast_selector).locator('[aria-label="Close"]').click();
    }
}
