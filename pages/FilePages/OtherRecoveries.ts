import { expect, Locator, Page } from '@playwright/test';
import { FileHomePage } from './FileHomePage';
import { getTodaysDate } from '../../helpers';

export class OtherRecoveries extends FileHomePage {
    status_update_button_selector: string = '[type="button"]';
    toast_message_selector: string = '[class="chakra-toast"]';
    fee_row_selector: string = '[class="mb-4"]'
     mark_as_paid_icon_selector: string = '[class="w-4 h-4 mt-1 text-blue-600 cursor-pointer"]'
    edit_fee_icon_selector: string = '[class="w-4 h-4 mt-1 text-green-600 cursor-pointer"]'
    delete_fee_icon_selector: string = '[class="w-4 h-4 mt-1 text-red-600 cursor-pointer"]'

    warranty_heading: Locator;
    insurance_heading: Locator;
    dealer_heading: Locator;

    status_dropdown: Locator;
    issued_to_dropdown: Locator;
    additional_notes_textbox: Locator;
    company_dropdown: Locator;
    policy_number_textbox: Locator;
    warranty_amount_textbox: Locator;
    insurance_amount_textbox: Locator;
    refund_amount_textbox: Locator;

    refund_requested_date: Locator;
    warranty_request_tracking_dropdown: Locator;
    insurance_request_tracking_dropdown: Locator;
    dealer_request_tracking_dropdown: Locator;

    dealer_company_textbox: Locator;
    dealer_amount_textbox: Locator;

    save_button: Locator;
    cancel_button: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.warranty_heading = this.page.getByRole('heading', { name: 'Warranty' });
        this.insurance_heading = this.page.getByRole('heading', { name: 'Insurance' });
        this.dealer_heading = this.page.getByRole('heading', { name: 'Dealer', exact: true });

        this.status_dropdown = this.page.locator('.select-status__indicator');
        this.issued_to_dropdown = this.page.locator('[data-headlessui-state="open"]').locator('.select-issuedTo__indicators')
        this.additional_notes_textbox = this.page.getByPlaceholder('Additional Note');
        this.company_dropdown = this.page.locator('.select-company__indicator');
        this.policy_number_textbox = this.page.getByPlaceholder('Policy Number');
        this.warranty_amount_textbox = this.page.getByPlaceholder('Warranty Amount');
        this.insurance_amount_textbox = this.page.getByPlaceholder('Insurance Amount');
        this.refund_amount_textbox = this.page.getByPlaceholder('Refund Amount Received');

        this.refund_requested_date = this.page.getByPlaceholder('Refund Request Date');
        this.warranty_request_tracking_dropdown = this.page.getByRole('button', { name: 'Warranty Request Tracking' });
        this.insurance_request_tracking_dropdown = this.page.getByRole('button', {
            name: 'Insurance Request Tracking',
        });
        this.dealer_request_tracking_dropdown = this.page.getByRole('button', { name: 'Dealer Request Tracking' });

        this.dealer_company_textbox = this.page.getByPlaceholder('Dealer Company');
        this.dealer_amount_textbox = this.page.getByPlaceholder('Dealer Amount');

        this.save_button = this.page.locator('[id*="headlessui-dialog-panel"]').getByRole('button', { name: 'Save' });
        this.cancel_button = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .getByRole('button', { name: 'Cancel' });
    }

    static async getInstance(page: Page) {
        const instance = new OtherRecoveries(page);
        await instance.initialize();
        return instance;
    }

    async clickStatusButton(buttonText: string) {
        const button = this.page.getByRole('button', { name: buttonText, exact: true });
        await expect(button).toBeVisible();
        await button.click();
    }

    async applyStatusUpdate(
        currentButtonText: string,
        targetStatus: string,
        refundOpts?: { amount: string; formattedAmount: string },
        issuedTo?: string,
    ) {
        const modalAdditionalNotes = this.additional_notes_textbox.last();

        await this.clickStatusButton(currentButtonText);
        await expect(this.status_dropdown).toBeVisible();
        await expect(modalAdditionalNotes).toBeVisible();

        await this.status_dropdown.click();
        const statusOption = this.page.getByRole('option', { name: targetStatus, exact: true });
        await expect(statusOption).toBeVisible();
        await statusOption.click();

        if (refundOpts) {
            await expect(this.refund_amount_textbox.last()).toBeVisible();
            await this.refund_amount_textbox.last().fill(refundOpts.amount);
        }

        const noteText = `Applying status: ${targetStatus}`;
        await modalAdditionalNotes.fill(noteText);

        if (issuedTo) {
            await expect(this.issued_to_dropdown).toBeVisible();
            await this.issued_to_dropdown.click();
            const issuedToOption = this.page.getByRole('option', { name: issuedTo, exact: true });
            await expect(issuedToOption).toBeVisible();
            await issuedToOption.click();
        }

        await expect(this.save_button).toBeVisible();
        await expect(this.save_button).toBeEnabled();
        await this.save_button.click();
        await expect(this.save_button).toBeHidden();
        await expect(this.additional_notes_textbox.first()).toHaveValue(noteText);

        const today = await getTodaysDate();
        await expect(this.refund_requested_date).toHaveValue(today);

        if (refundOpts) {
            await expect(this.refund_amount_textbox.first()).toHaveValue(refundOpts.formattedAmount);
        }
    }
}
