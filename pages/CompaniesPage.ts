import { expect, Locator, Page } from '@playwright/test';

export interface CompanyDetails {
    name: string;
    activityType: string;
    code: string;
    phone: string;
    country: string;
    province: string;
    city: string;
    postalCode: string;
    street: string;
    taxationProvince: string;
    email: string;
    website: string;
}
export class CompaniesPage {
    private page: Page;
    filter_dropdown_selector: string = '[data-cy="filter-children"]';
    activity_type_cell_selector: string = '[data-cy="Activity"]';
    address_cell_selector: string = '[data-cy="Address"]';
    search_results_rows_selector: string = '[data-cy="result -companyName"]';
    company_row_selector: string = '[data-cy="data-row"]';

    //fee tab row selectors
    fee_schedule_row_selector: string = '[class="rounded-lg border border-cc-gray-75"]'
    fee_schedule_edit_button_selector: string = '[class="btn-icon green"]'
    fee_schedule_delete_button_selector: string = '[class="btn-icon red"]'

    tier_min_textbox_selector: string = '[placeholder="Min ($)"]'
    tier_max_textbox_selector: string = '[placeholder="Max ($)"]'
    tier_unlimited_max_textbox_selector: string = '[placeholder="Unlimited"]'
    tier_value_flat_fee_textbox_selector: string = '[placeholder="Enter amount"]'
    tier_value_percentage_textbox_selector: string = '[placeholder="Value (%)"]'
    selected_file_type_card_selector: string = '[class*="select__multi-value__label"]'
    getTypeDropdownSelector(index: number): string {
        return `[class*="select-tiers.${index}.type__indicators"]`;
    }

    search_textbox: Locator;
    activity_type_filter_option: Locator;
    province_filter_option: Locator;
    clear_all_filters: Locator;
    create_company_button: Locator;
    company_name_textbox: Locator;
    activity_type_dropdown: Locator;
    company_code_textbox: Locator;
    phone_number_textbox: Locator;
    country_dropdown: Locator;
    province_dropdown: Locator;
    city_textbox: Locator;
    postal_code_textbox: Locator;
    street_textbox: Locator;
    taxation_province_dropdown: Locator;
    notification_email_textbox: Locator;
    sage_vendor_id_textbox: Locator;
    website_textbox: Locator;
    save_company_button: Locator;
    delete_company_button: Locator;
    edit_company_button: Locator;
    cancel_button: Locator;
    back_to_companies_button: Locator;

    //edit company locators
    fees_tab: Locator
    reports_tab: Locator
    offices_tab: Locator

    //fees tab locators
    create_fee_schedule_button: Locator
    fee_type_dropdown: Locator
    file_type_dropdown: Locator
    fee_based_on_dropdown: Locator
    add_tier_button: Locator
    recovery_amount_textbox: Locator
    save_fee_schedule_button: Locator
    cancel_fee_schedule_button: Locator
    remove_tier_button: Locator

    constructor(page: Page) {
        this.page = page;
    }

    private async initialize() {
        this.search_textbox = this.page.getByPlaceholder('Search company name');
        this.activity_type_filter_option = this.page.getByRole('button', { name: 'Activity Type' });
        this.province_filter_option = this.page.getByRole('button', { name: 'Province' });
        this.clear_all_filters = this.page.getByRole('button', { name: 'Clear all' });
        this.create_company_button = this.page.getByRole('link', { name: 'Create Company' });
        this.company_name_textbox = this.page.getByRole('textbox', { name: 'Google, Facebook, CIBC...' });
        this.activity_type_dropdown = this.page.locator('.select-activityType__indicator');
        this.company_code_textbox = this.page.getByRole('textbox', { name: 'ACC' });
        this.phone_number_textbox = this.page.getByRole('textbox', { name: 'Phone Number' });
        this.country_dropdown = this.page.locator('.select-country__indicator');
        this.province_dropdown = this.page.locator('.select-state__indicator');
        this.city_textbox = this.page.getByRole('textbox', { name: 'City' });
        this.postal_code_textbox = this.page.getByRole('textbox', { name: 'Postal Code' });
        this.street_textbox = this.page.getByRole('textbox', { name: '11 Church St' });
        this.taxation_province_dropdown = this.page.locator('.select-taxationState__indicator');
        this.notification_email_textbox = this.page.getByRole('textbox', { name: 'Notification Email' });
        this.sage_vendor_id_textbox = this.page.getByRole('textbox', { name: 'SageVendorId (optional)' });
        this.website_textbox = this.page.getByRole('textbox', { name: 'Website' });
        this.save_company_button = this.page.getByRole('button', { name: 'Save' });
        this.delete_company_button = this.page.getByRole('button', { name: 'Delete' });
        this.edit_company_button = this.page.getByRole('button', { name: 'Edit' });
        this.cancel_button = this.page.getByRole('link', { name: 'Cancel' });
        this.back_to_companies_button = this.page.getByRole('link', { name: 'Back to Companies' });

        //edit company locators
        this.fees_tab = this.page.getByRole('button', { name: 'Fees' });
        this.reports_tab = this.page.getByRole('button', { name: 'Reports' });
        this.offices_tab = this.page.getByRole('button', { name: 'Offices' });

        //fees tab locators
        this.create_fee_schedule_button = this.page.getByRole('button', { name: 'Create Fee Schedule' });
        this.fee_type_dropdown = this.page.locator('.select-feeType__indicator');
        this.file_type_dropdown = this.page.locator('.select__indicator.select__dropdown-indicator')
        this.fee_based_on_dropdown = this.page.locator('.select-calculationBase__indicator');
        this.add_tier_button = this.page.getByRole('button', { name: 'Add Tier' });
        this.recovery_amount_textbox = this.page.getByRole('textbox', { name: 'Recovery Amount ($):' })
        this.save_fee_schedule_button = this.page.getByRole('button', { name: 'Save' });
        this.cancel_fee_schedule_button = this.page.getByRole('button', { name: 'Cancel' });
        this.remove_tier_button = this.page.getByRole('button', { name: 'Remove', exact: true })

    }

    static async getInstance(page: Page) {
        const instance = new CompaniesPage(page);
        await instance.initialize();
        return instance;
    }



    async createCompany(details: CompanyDetails) {
        await expect(this.create_company_button).toBeVisible();
        await this.create_company_button.click({delay: 250}); // Added delay to ensure the click is registered

        await expect(this.company_name_textbox).toBeVisible();
        await this.company_name_textbox.fill(details.name);

        await expect(this.activity_type_dropdown).toBeVisible();
        await this.activity_type_dropdown.click();

        await expect(this.page.getByRole('option', { name: details.activityType, exact: true })).toBeVisible();
        await this.page.getByRole('option', { name: details.activityType, exact: true }).click();

        await expect(this.company_code_textbox).toBeVisible();
        await this.company_code_textbox.fill(details.code);

        await expect(this.phone_number_textbox).toBeVisible();
        await this.phone_number_textbox.fill(details.phone);

        await this.country_dropdown.click();
        await expect(this.page.getByRole('option', { name: details.country, exact: true })).toBeVisible();
        await this.page.getByRole('option', { name: details.country, exact: true }).click();

        await this.province_dropdown.click();
        await expect(this.page.getByRole('option', { name: details.province, exact: true })).toBeVisible();
        await this.page.getByRole('option', { name: details.province, exact: true }).click();

        await this.city_textbox.fill(details.city);
        await this.postal_code_textbox.fill(details.postalCode);
        await this.street_textbox.fill(details.street);

        await this.taxation_province_dropdown.click();
        await expect(this.page.getByRole('option', { name: details.taxationProvince, exact: true })).toBeVisible();
        await this.page.getByRole('option', { name: details.taxationProvince, exact: true }).click();

        await this.notification_email_textbox.fill(details.email);
        await this.website_textbox.fill(details.website);

        await this.save_company_button.click();
    }

    async searchCompanyByName(name: string) {
        await expect(this.search_textbox).toBeVisible();
        await this.search_textbox.fill(name);

        let searchresult = this.page
            .locator(this.search_results_rows_selector)
            .filter({ hasText: name });

        await expect(searchresult).toHaveCount(1);
        await searchresult.click();

        let companyRow = this.page.locator(this.company_row_selector).filter({ hasText: name });
        await expect(companyRow).toBeVisible();
    }

    async createAutomatedFee(
        feeType: string,
        firstTierType: 'Flat Fee' | 'Percentage',
        flatFeeValue: string = '20',
        addSecondTier: boolean = false,
        feeBasedOn?: string,
    ) {
        await expect(this.create_fee_schedule_button).toBeVisible();
        await this.create_fee_schedule_button.click();

        await expect(this.fee_type_dropdown).toBeVisible();
        await this.fee_type_dropdown.click();

        await expect(this.page.getByRole('option', { name: feeType, exact: true })).toBeVisible();
        await this.page.getByRole('option', { name: feeType, exact: true }).click();

        await this.page.waitForTimeout(250);
        if (await this.file_type_dropdown.isVisible()) {
            await this.file_type_dropdown.click();

            await expect(this.page.getByRole('option', { name: 'Sold', exact: true })).toBeVisible();
            await this.page.getByRole('option', { name: 'Sold', exact: true }).click();

            await this.file_type_dropdown.click();
            await expect(this.page.getByRole('option', { name: 'Redemption', exact: true })).toBeVisible();
            await this.page.getByRole('option', { name: 'Redemption', exact: true }).click();
        }

        const firstTypeDropdown = this.page.locator(this.getTypeDropdownSelector(0));

        if (firstTierType === 'Percentage') {
            await firstTypeDropdown.click();
            await this.page.getByRole('option', { name: 'Percentage', exact: true }).click();

            const tier1PercentageTextbox = this.page.locator(this.tier_value_percentage_textbox_selector).first();
            await tier1PercentageTextbox.fill('10'); // Hardcoded 10%
        } else {
            const tier1FlatFeeTextbox = this.page.locator(this.tier_value_flat_fee_textbox_selector).first();
            await tier1FlatFeeTextbox.fill(flatFeeValue);
        }
        if (addSecondTier) {
            await expect(this.add_tier_button).toBeVisible();
            await this.add_tier_button.click();

            // Hardcode Tier 2 Minimum ($100)
            const tier2MinTextbox = this.page.locator(this.tier_min_textbox_selector).nth(1);
            await expect(tier2MinTextbox).toBeVisible();
            await tier2MinTextbox.fill('100');

            // Hardcode Tier 2 Type (Percentage)
            const secondTypeDropdown = this.page.locator(this.getTypeDropdownSelector(1));
            await expect(secondTypeDropdown).toBeVisible();
            await secondTypeDropdown.click();
            await this.page.getByRole('option', { name: 'Percentage', exact: true }).click();

            // Hardcode Tier 2 Value (10%)
            const tier2PercentageTextbox = this.page.locator(this.tier_value_percentage_textbox_selector).last();
            await expect(tier2PercentageTextbox).toBeVisible();
            await tier2PercentageTextbox.fill('10');
        }
        if (feeBasedOn) {
            await this.fee_based_on_dropdown.click();
            await this.page.getByRole('option', { name: feeBasedOn, exact: true }).click();
        }

        // 7. Save the Schedule
        await expect(this.save_fee_schedule_button).toBeVisible();
        await this.save_fee_schedule_button.click();
    }
}
