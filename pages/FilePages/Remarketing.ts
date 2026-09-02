import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';
import { getTodaysDate } from '../../helpers';

export class Remarketing extends FileHomePage {
    black_book_value_modal_selector: string = '[id*="headlessui-dialog-panel"]';
    approve_repair_selector: string = '[data-cy*="approve-icon-"]';
    decline_repair_selector: string = '[data-cy*="decline-icon-"]';
    pending_repair_selector: string = '[data-cy*="pending-icon-"]';
    deleted_repair_selector: string = '[data-cy*="deleted-icon-"]';

    valuation_heading: Locator;
    request_black_book_value_button: Locator;
    black_book_value_textbox: Locator;
    request_repair_add_item_button: Locator;
    required_repairs_and_reconditioning_textbox: Locator;
    request_repair_category_dropdown: Locator;
    request_repair_action_textbox: Locator;
    request_repair_cost_textbox: Locator;
    valuation_save_button: Locator;

    condition_report_date_textbox: Locator;
    condition_category_dropdown: Locator;
    condition_save_button: Locator;

    requested_reserve_price_textbox: Locator;
    approved_reserve_price_textbox: Locator;
    start_price_textbox: Locator;
    buy_now_price_textbox: Locator;
    reserve_saved_button: Locator;

    auction_date_textbox: Locator;
    red_light_dropdown: Locator;
    salesperson_textbox: Locator;
    date_sold_textbox: Locator;
    legal_sale_date_textbox: Locator;
    sale_attempts_dropdown: Locator;
    sale_channel_dropdown: Locator;
    sale_amount_textbox: Locator;
    sale_gst_textbox: Locator;
    sale_hst_textbox: Locator;
    sale_pst_textbox: Locator;
    sale_total_textbox: Locator;
    auction_acknowledged_yes_radio_button: Locator;
    auction_acknowledged_no_radio_button: Locator;
    repair_amount_textbox: Locator;
    approved_repair_date_textbox: Locator;
    sale_save_button: Locator;

    rough_black_book_value_textbox: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.valuation_heading = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('heading', { name: 'Valuation' });
        this.request_black_book_value_button = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('button', { name: 'Request Black Book Value' });
        this.black_book_value_textbox = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('textbox', { name: 'Black Book Value' });
        this.request_repair_add_item_button = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('button', { name: 'Add Item' });
        this.required_repairs_and_reconditioning_textbox = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('textbox', { name: 'Required Repairs and Reconditioning' });
        this.request_repair_category_dropdown = this.page
            .locator('[id="remarketing_details"]')
            .locator('[class*="indicatorContainer"]')
            .locator('..')
            .locator('..')
            .filter({ hasText: 'Category' });
        this.request_repair_action_textbox = this.page
            .locator('[id="remarketing_details"]')
            .locator('[class*="select-requestedRepairsAndReconditioning."][type="text"]');
        this.request_repair_cost_textbox = this.page.locator('[id="remarketing_details"]').getByPlaceholder('Cost');
        this.valuation_save_button = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('button', { name: 'Save' })
            .nth(0); // First save button in the section

        this.condition_report_date_textbox = this.page
            .locator('[id="remarketing_details"]')
            .locator('[role="group"]')
            .filter({ hasText: 'Condition Report' })
            .getByRole('textbox', { name: 'Select Date' });
        this.condition_category_dropdown = this.page
            .locator('[id="remarketing_details"]')
            .locator('[role="group"]')
            .filter({ hasText: 'Category' })
            .locator('[class="select-category__input"]')
            .last();
        this.condition_save_button = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('button', { name: 'Save' })
            .nth(1); // Second save button in the section

        this.requested_reserve_price_textbox = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('textbox', { name: 'Requested Reserve Price' });
        this.approved_reserve_price_textbox = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('textbox', { name: 'Approved Reserve Price' });
        this.start_price_textbox = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('textbox', { name: 'Start Price' });
        this.buy_now_price_textbox = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('textbox', { name: 'Buy Now Price' });
        this.reserve_saved_button = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('button', { name: 'Save' })
            .nth(3); // Fourth save button in the section

        this.auction_date_textbox = this.page
            .locator('[id="remarketing_details"]')
            .locator('[role="group"]')
            .filter({ hasText: 'Auction Date' })
            .getByRole('textbox', { name: 'Select Date' });
        this.red_light_dropdown = this.page
            .locator('[id="remarketing_details"]')
            .locator('[role="group"]')
            .filter({ hasText: 'Red Light' })
            .locator('[class="select-redLight__input"]');
        this.salesperson_textbox = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('textbox', { name: "Salesperson's Name" });
        this.date_sold_textbox = this.page
            .locator('[id="remarketing_details"]')
            .locator('[role="group"]')
            .filter({ hasText: 'Date Sold' })
            .getByRole('textbox', { name: 'Select Date' });
        this.legal_sale_date_textbox = this.page
            .locator('[id="remarketing_details"]')
            .locator('[role="group"]')
            .filter({ hasText: 'Legal Sale Date' })
            .getByRole('textbox', { name: 'Select Date' });
        this.sale_attempts_dropdown = this.page
            .locator('[id="remarketing_details"]')
            .locator('[role="group"]')
            .filter({ hasText: 'Sale Attempts' })
            .locator('[class="select-saleAttempts__input"]');
        this.sale_channel_dropdown = this.page
            .locator('[id="remarketing_details"]')
            .locator('[role="group"]')
            .filter({ hasText: 'Sale Channel' })
            .locator('[class="select-saleChannel__input"]');
        this.sale_amount_textbox = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('textbox', { name: 'Sale Amount' });
        this.sale_gst_textbox = this.page.locator('[id="remarketing_details"]').getByRole('textbox', { name: 'GST' });
        this.sale_hst_textbox = this.page.locator('[id="remarketing_details"]').getByRole('textbox', { name: 'HST' });
        this.sale_pst_textbox = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('textbox', { name: 'PST/TVQ' });
        this.sale_total_textbox = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('textbox', { name: 'Sale Total' });
        this.auction_acknowledged_yes_radio_button = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('radio', { name: 'Yes' });
        this.auction_acknowledged_no_radio_button = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('radio', { name: 'No' });
        this.repair_amount_textbox = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('textbox', { name: 'Repair Amount' });
        this.approved_repair_date_textbox = this.page
            .locator('[id="remarketing_details"]')
            .locator('[role="group"]')
            .filter({ hasText: 'Approved Repair Date' })
            .getByRole('textbox', { name: 'Select Date' });
        this.sale_save_button = this.page
            .locator('[id="remarketing_details"]')
            .getByRole('button', { name: 'Save' })
            .nth(4); // Fifth save button in the section

        this.rough_black_book_value_textbox = this.page.getByRole('textbox', { name: 'Rough Black Book Value' });
    }

    static async getInstance(page: Page) {
        const instance = new Remarketing(page);
        await instance.initialize();
        return instance;
    }

    async requestBlackBookValue(category: 'Rough' | 'Average' | 'Clean' | 'Extra Clean', milage?: string) {
        let blackBookValueModal = this.page.locator(this.black_book_value_modal_selector);
        await expect(blackBookValueModal).toBeVisible();

        if (milage) {
            const milageInput = blackBookValueModal.getByRole('textbox', { name: 'Mileage (km)', exact: true });
            await milageInput.fill(milage);
        }
        await expect(blackBookValueModal.getByRole('button', { name: 'Update' })).toBeVisible();
        await blackBookValueModal.getByRole('button', { name: 'Update' }).click();
        await this.page.waitForTimeout(500); // Wait for the category buttons to become enabled after updating mileage
        await expect(blackBookValueModal.getByRole('button', { name: 'Save' })).toBeDisabled();
        const categoryMap: Record<string, string> = {
            Rough: '#rough',
            Average: '#avg',
            Clean: '#clean',
            'Extra Clean': '#xclean',
        };
        const categoryId = categoryMap[category];
        await expect(this.page.locator(categoryId)).toBeVisible();
        await this.page.locator(categoryId).click();
        await this.page.waitForTimeout(500); // Wait for the Save button to become enabled after selecting a category

        await expect(blackBookValueModal.getByRole('button', { name: 'Save' })).toBeEnabled();
        await blackBookValueModal.getByRole('button', { name: 'Save' }).click();
        await expect(blackBookValueModal).toBeHidden();
    }

    async addDatatoSaleSection(
        saleData: {
            auctionDate?: string;
            dateSold?: string;
            legalSaleDate?: string;
            amount?: string;
            auctionAcknowledged?: boolean;
        } = {}
    ) {
        const date = await getTodaysDate();

        // Fill dates — fall back to today if not provided
        await this.auction_date_textbox.fill(saleData.auctionDate ?? date);
        await this.date_sold_textbox.fill(saleData.dateSold ?? date);
        await this.legal_sale_date_textbox.fill(saleData.legalSaleDate ?? date);

        await this.sale_channel_dropdown.click();
        await expect(this.page.getByRole('option', { name: 'Direct to Dealer', exact: true })).toBeVisible();
        await this.page.getByRole('option', { name: 'Direct to Dealer', exact: true }).click();
        // Fill amount — default to 25000
        await this.sale_amount_textbox.fill(saleData.amount ?? '25000');

        // Select Auction Acknowledged — default to Yes
        if (saleData.auctionAcknowledged === false) {
            await this.auction_acknowledged_no_radio_button.check();
        } else {
            await this.auction_acknowledged_yes_radio_button.check();
        }

        // Save and verify the form submitted successfully
        await expect(this.sale_save_button).toBeEnabled();
        await this.sale_save_button.click();
        await expect(this.sale_save_button).toBeDisabled();
    }
}
