import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';
import { getTodaysDate } from '../../helpers';

export class Accounting extends FileHomePage {
    toast_message_selector: string = '[class*="chakra-toast__inner"]';
    modified_collected_payment_row_selector: string = '.item-added-or-modified';
    fee_row_selector: string = '[class="mb-4"]'
    transfer_fee_icon_selector: string = '[class="w-4 h-4 mt-1 cursor-pointer"]'
    mark_as_paid_icon_selector: string = '[class="w-4 h-4 mt-1 text-blue-600 cursor-pointer"]'
    edit_fee_icon_selector: string = '[class="w-4 h-4 mt-1 text-green-600 cursor-pointer"]'
    delete_fee_icon_selector: string = '[class="w-4 h-4 mt-1 text-red-600 cursor-pointer"]'

    invoice_preview_container_selector: string = '[id="invoicePreviewContainer"]';

    arrears_redemption_tab: Locator;
    payout_tab: Locator;

    arrears_radio_button: Locator;
    partial_redemption_checkbox: Locator;

    current_arrears_textbox: Locator;
    redemption_fee_readonly_textbox: Locator;
    redemption_fee_toggle_button: Locator;
    upcoming_payment_textbox: Locator;
    upcoming_payment_date_textbox: Locator;
    quote_amount_textbox: Locator;
    required_date_textbox: Locator;
    received_amount_readonly_textbox: Locator;
    received_date_readonly_textbox: Locator;
    amount_to_redeem_readonly_textbox: Locator;
    remit_amount_readonly_textbox: Locator;
    redemption_checkbox: Locator;

    payout_radio_button: Locator;
    payout_amount_textbox: Locator;
    payout_effective_date_textbox: Locator;

    redemption_save_button: Locator;
    redemption_cancel_button: Locator;

    add_fee_or_credit_button: Locator;

    fee_radio_button: Locator;
    credit_radio_button: Locator;
    corporation_type_dropdown: Locator;
    corporation_dropdown: Locator;
    fee_type_dropdown: Locator;
    description_textbox: Locator;
    invoice_number_textbox: Locator;
    invoice_date_textbox: Locator;
    amount_textbox: Locator;
    gst_on__fees_textbox: Locator;
    pst_or_tvq_on_fees_textbox: Locator;
    hst_on_fees_textbox: Locator;
    fee_total_textbox: Locator;
    save_fee_button: Locator;
    cancel_fee_button: Locator;

    add_invoice_button: Locator;
    select_invoice_dropdown: Locator;
    generate_invoice_button: Locator;
    cancel_invoice_button: Locator;

    add_collected_payment: Locator;
    collected_by_company_dropdown: Locator;
    payment_method_dropdown: Locator;
    collected_payment_date: Locator;
    collected_amount: Locator;
    collected_payment_save_button: Locator;
    collected_payment_cancel_button: Locator;

    delete_invoice_icon: Locator;
    delete_invoice_confirmation_button: Locator;
    view_invoice_link: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.arrears_redemption_tab = this.page.getByRole('button', { name: 'Arrears Redemption' });
        this.arrears_radio_button = this.page.getByRole('radio', { name: 'Arrears' });
        this.partial_redemption_checkbox = this.page.locator('.chakra-checkbox__control');
        this.current_arrears_textbox = this.page.getByRole('textbox', { name: 'Current Arrears' });
        this.upcoming_payment_textbox = this.page.getByRole('textbox', { name: 'Upcoming Payment' });
        this.upcoming_payment_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Upcoming Payment Date' })
            .getByPlaceholder('Select date');

        //Common Locators for both Arrears Redemption and Payout Tabs
        this.redemption_fee_readonly_textbox = this.page.getByRole('textbox', { name: 'Redemption Fee' });
        this.redemption_fee_toggle_button = this.page.getByRole('switch', { name: 'Use setting' });
        this.quote_amount_textbox = this.page.getByRole('textbox', { name: 'Quote Amount' });
        this.required_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Required Date' })
            .getByPlaceholder('Select date');
        this.received_amount_readonly_textbox = this.page.getByRole('textbox', { name: 'Received Amount' });
        this.received_date_readonly_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Received Date' })
            .getByPlaceholder('Select date')
            .last();
        this.amount_to_redeem_readonly_textbox = this.page.getByRole('textbox', { name: 'Amount to Redeem' });
        this.remit_amount_readonly_textbox = this.page.getByRole('textbox', { name: 'Remit Amount' });
        this.redemption_checkbox = this.page.locator('.chakra-checkbox__control');

        //Locators specific to Payout Tab
        this.payout_tab = this.page.getByRole('button', { name: 'Payout' });
        this.payout_radio_button = this.page.getByRole('radio', { name: 'Payout' });
        this.payout_amount_textbox = this.page.getByRole('textbox', { name: 'Payout Amount' });
        this.payout_effective_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Payout Effective Date' })
            .getByPlaceholder('Select date');

        this.redemption_save_button = this.page.locator('[id="accounting"]').getByRole('button', { name: 'Save' }).nth(1);
        this.redemption_cancel_button = this.page.locator('[id="accounting"]').getByRole('button', { name: 'Cancel' }).nth(1);

        //Locators for Fee/Credit Entry
        this.add_fee_or_credit_button = this.page.getByRole('button', { name: 'Add Fee/Credit' });
        this.fee_radio_button = this.page.getByRole('radio', { name: 'Fee' });
        this.credit_radio_button = this.page.getByRole('radio', { name: 'Credit' });
        this.corporation_type_dropdown = this.page.locator('.select-corporationType__indicator');
        this.corporation_dropdown = this.page.locator('.select-corporationId__indicator');
        this.fee_type_dropdown = this.page.locator('.select-feeType__indicator');
        this.description_textbox = this.page.getByRole('textbox', { name: 'Description' });
        this.invoice_number_textbox = this.page.getByRole('textbox', { name: 'Invoice Number' });
        this.invoice_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Invoice Date' })
            .getByPlaceholder('Select date');
        this.amount_textbox = this.page.getByRole('textbox', { name: 'Amount', exact: true });
        this.gst_on__fees_textbox = this.page.getByRole('textbox', { name: 'GST on Fees' });
        this.pst_or_tvq_on_fees_textbox = this.page.getByRole('textbox', { name: 'PST/TVQ on Fees' });
        this.hst_on_fees_textbox = this.page.getByRole('textbox', { name: 'HST on Fees' });
        this.fee_total_textbox = this.page.getByRole('textbox', { name: 'Fee Total' });
        this.save_fee_button = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .getByRole('button', { name: 'Save' });
        this.cancel_fee_button = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .getByRole('button', { name: 'Cancel' });

        //Locators for Invoice Generation
        this.add_invoice_button = this.page.getByRole('button', { name: 'Add Invoice' });
        this.select_invoice_dropdown = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .locator('[class*="select__indicators"]');
        this.generate_invoice_button = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .getByRole('button', { name: 'Generate' });
        this.cancel_invoice_button = this.page
            .locator('[id*="headlessui-dialog-panel"]')
            .getByRole('button', { name: 'Cancel' });

        this.view_invoice_link = this.page.getByRole('button', { name: 'View' })

        //Locators for collected payments
        this.add_collected_payment = this.page.getByRole('button', { name: 'Add Collected Payment' });
        this.collected_by_company_dropdown = this.page.locator(
            '[class*="select-payments.0.payerCompanyId__indicators"]'
        );
        this.payment_method_dropdown = this.page.locator('[class*="select-payments.0.paymentMethod__indicators"]');
        this.collected_payment_date = this.page.getByPlaceholder('Payment Date');
        this.collected_amount = this.page.getByRole('textbox', { name: 'Payment Amount', exact: true });
        this.collected_payment_save_button = this.page.locator('[id="accounting"]').getByRole('button', { name: 'Save' }).nth(2);
        this.collected_payment_cancel_button = this.page.locator('[id="accounting"]').getByRole('button', { name: 'Cancel' }).nth(2);

        this.delete_invoice_icon = this.page
            .locator('[class*="rounded-lg border"]')
            .filter({ hasText: 'Invoice' })
            .locator('[class="btn-icon red"]');
        this.delete_invoice_confirmation_button = this.page.getByRole('button', { name: 'Delete', exact: true });
    }

    static async getInstance(page: Page) {
        const instance = new Accounting(page);
        await instance.initialize();
        return instance;
    }

    async addDataToArrearsRedemptionTab(currentArrears: string = '6500', upcomingPayment: string = '258') {
        await expect(this.redemption_save_button).toBeDisabled();
        await this.arrears_redemption_tab.click();
        await this.arrears_radio_button.click();
        let upcomingPaymentDate: string = await getTodaysDate();

        await this.upcoming_payment_date_textbox.fill(upcomingPaymentDate);
        await this.page.press('body', 'Tab');
        await this.arrears_radio_button.click();
        await this.current_arrears_textbox.fill(currentArrears);
        await this.required_date_textbox.fill(upcomingPaymentDate);
        await this.page.press('body', 'Tab');
        await this.arrears_radio_button.click();
        await this.upcoming_payment_textbox.fill(upcomingPayment);

        await expect(this.redemption_save_button).toBeVisible();
        await expect(this.redemption_save_button).toBeEnabled();
        await this.redemption_save_button.dblclick({ delay: 100 });
        let rawQuoteAmount = await this.quote_amount_textbox.inputValue();

        const numericQuoteAmount = parseFloat(rawQuoteAmount.replace(/[^0-9.-]+/g, ''));
        const numericCurrentArrears = parseFloat(currentArrears.replace(/[^0-9.-]+/g, ''));

        // We use expect(value).toBeGreaterThan(threshold)
        expect(numericQuoteAmount).toBeGreaterThan(numericCurrentArrears);
    }

    async addCollectedPaymentEntry({
        collectedBy = 'RecoveryHub',
        amount = '2000',
    }: {
        collectedBy?: string;
        amount?: string;
    } = {}) {
        // The = {} allows calling the method with no arguments at all
        await expect(this.add_collected_payment).toBeVisible();
        await this.add_collected_payment.click();

        // Select Company from dropdown
        await expect(this.collected_by_company_dropdown).toBeVisible();
        await this.collected_by_company_dropdown.click();
        const companyOption = this.page.getByRole('option', { name: collectedBy, exact: true });
        await expect(companyOption).toBeVisible();
        await companyOption.click();

        // Select Payment Method
        await expect(this.payment_method_dropdown).toBeVisible();
        await this.payment_method_dropdown.click();
        const paymentMethodOption = this.page.getByRole('option', { name: 'Cheque', exact: true });
        await expect(paymentMethodOption).toBeVisible();
        await paymentMethodOption.click();

        // Handle Date and Amount
        let paymentDate: string = await getTodaysDate();
        await this.collected_payment_date.fill(paymentDate);
        await this.page.press('body', 'Tab');
        await this.collected_amount.click();
        await this.collected_amount.fill(amount);

        // Save
        await expect(this.collected_payment_save_button).toBeEnabled();
        await this.collected_payment_save_button.click();

        await expect(this.page.locator(this.modified_collected_payment_row_selector)).toBeHidden();
    }

    async addFeeEntry({
        feeCategory = 'Fee',
        corporationType = 'Admin',
        corporationName = 'RecoveryHub',
        feeType = 'Sale Fee',
        description = 'Default Fee Entry',
        amount = '100',
    }: {
        feeCategory?: 'Fee' | 'Credit';
        corporationType?: string;
        corporationName?: string;
        feeType?: string;
        description?: string;
        amount?: string;
        invoiceDate?: string;
    } = {}) {
        await expect(this.add_fee_or_credit_button).toBeVisible();
        await this.add_fee_or_credit_button.click();

        let invoiceDate: string = await getTodaysDate();
        await expect(this.invoice_date_textbox).toBeVisible();
        await this.invoice_date_textbox.fill(invoiceDate);

        // Select Category
        if (feeCategory === 'Fee') {
            await this.fee_radio_button.click();
        } else {
            await this.credit_radio_button.click();
        }

        // Select Corporation Type
        await this.corporation_type_dropdown.click();
        const corpTypeOption = this.page.getByRole('option', { name: corporationType, exact: true });
        await expect(corpTypeOption).toBeVisible();
        await corpTypeOption.click();

        // Select Corporation Name
        await this.corporation_dropdown.click();
        const corpNameOption = this.page.getByRole('option', { name: corporationName, exact: true });
        await expect(corpNameOption).toBeVisible();
        await corpNameOption.click();

        // Select Fee Type
        await this.fee_type_dropdown.click();
        const feeTypeOption = this.page.getByRole('option', { name: feeType, exact: true });
        await expect(feeTypeOption).toBeVisible();
        await feeTypeOption.click();

        // Fill Text Fields
        await this.description_textbox.fill(description);
        await this.amount_textbox.fill(amount);

        // Save and Verify
        await expect(this.save_fee_button).toBeVisible();
        await this.save_fee_button.click();
        await expect(this.save_fee_button).toBeHidden();
    }

    async generateInvoice(invoiceType: string) {
        await expect(this.add_invoice_button).toBeVisible();
        await expect(this.add_invoice_button).toBeEnabled();

        await this.add_invoice_button.click();
        await expect(this.generate_invoice_button).toBeDisabled();

        await expect(this.select_invoice_dropdown).toBeVisible();
        await this.select_invoice_dropdown.click();
        await expect(this.page.getByRole('option', { name: invoiceType, exact: true })).toBeVisible();
        await this.page.getByRole('option', { name: invoiceType, exact: true }).click();

        await expect(this.generate_invoice_button).toBeEnabled();
        await this.generate_invoice_button.click();
        await expect(this.generate_invoice_button).not.toBeVisible({ timeout: 15000 });
    }
}
