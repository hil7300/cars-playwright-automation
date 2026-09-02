import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { FileHomePage } from './FileHomePage';
import { getTodaysDate } from '../../helpers';

export class RepoDetails extends FileHomePage {
    bank_details_heading: Locator;

    csc_contract_type_radio_button: Locator;
    loan_contract_type_radio_button: Locator;
    lease_contract_type_radio_button: Locator;
    contract_date_textbox: Locator;
    contract_save_button: Locator;

    repossession_date_textbox: Locator;
    seizure_address_textbox: Locator;
    seizure_province_dropdown: Locator;
    seizure_city_textbox: Locator;
    // sales_location_delivery_checkbox: Locator
    // sales_location_dropdown: Locator
    delivered_date_textbox: Locator;
    delivered_address_textbox: Locator;
    delivered_province_dropdown: Locator;
    delivered_city_textbox: Locator;
    vehicle_condition_dropdown: Locator;
    runs_dropdown: Locator;
    vsa_signed_dropdown: Locator;
    mileage_textbox: Locator;
    number_of_keys_dropdown: Locator;
    // possible_redemption_checkbox: Locator
    // license_plate_removed_checkbox: Locator
    // property_removed_checkbox: Locator
    seizure_photos_upload_button: Locator;
    seizure_notes_textbox: Locator;
    seizure_save_button: Locator;

    inovatec_id_textbox: Locator;
    repo_type_dropdown: Locator;
    repo_reason_dropdown: Locator;
    dealer_textbox: Locator;
    corp_delivery_location_textbox: Locator;
    vsa_signed_date_textbox: Locator;
    vsa_uploaded_date_textbox: Locator;
    days_from_funding_textbox: Locator;
    days_to_recover_from_assignment_date_textbox: Locator;
    assignment_save_button: Locator;

    voluntary_surrender_toggle: Locator;
    current_principal_balance_textbox: Locator;
    bailiff_date_assigned_textbox: Locator;
    loan_charge_off_date_textbox: Locator;
    loan_funded_date_textbox: Locator;
    next_payment_date_textbox: Locator;
    last_payment_date_textbox: Locator;
    original_balance_textbox: Locator;
    original_term_textbox: Locator;
    payment_amount_textbox: Locator;
    payment_frequency_dropdown: Locator;
    arrears_amount_textbox: Locator;
    days_past_due_at_assignment_textbox: Locator;
    days_past_due_today_textbox: Locator;
    days_past_due_at_month_end_textbox: Locator;
    payout_date_textbox: Locator;
    payout_amount_textbox: Locator;
    repo_save_button: Locator;

    protected constructor(page: Page) {
        super(page);
    }

    protected async initialize() {
        this.bank_details_heading = this.page.getByRole('heading', { name: 'Bank Details' });

        this.csc_contract_type_radio_button = this.page.locator('#typeCsc');
        this.loan_contract_type_radio_button = this.page.locator('#typeLoan');
        this.lease_contract_type_radio_button = this.page.locator('#typeLease');
        this.contract_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Contract Date' })
            .getByPlaceholder('Select date');
        this.contract_save_button = this.page
            .locator('[id="repossession"] > div > div > form')
            .filter({ hasText: 'Contract' })
            .getByRole('button', { name: 'Save' });

        this.repossession_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Repossession Date' })
            .getByPlaceholder('Select date');
        this.seizure_address_textbox = this.page.getByRole('textbox', { name: 'Seizure Address' });
        this.seizure_province_dropdown = this.page
            .locator('[id="repossession"]')
            .locator('.select-province__indicator');
        this.seizure_city_textbox = this.page.getByRole('textbox', { name: 'Seizure City' });
        this.delivered_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Delivered Date' })
            .getByPlaceholder('Select date');
        this.delivered_address_textbox = this.page.getByRole('textbox', { name: 'Delivered Address' });
        this.delivered_province_dropdown = this.page
            .locator('[id="repossession"]')
            .locator('.select-deliveredProvince__indicator');
        this.delivered_city_textbox = this.page.getByRole('textbox', { name: 'Delivered City' });
        this.vehicle_condition_dropdown = this.page
            .locator('[id="repossession"]')
            .locator('.select-vehicleCondition__indicator');
        this.runs_dropdown = this.page.locator('[id="repossession"]').locator('.select-runs__indicator');
        this.vsa_signed_dropdown = this.page.locator('[id="repossession"]').locator('.select-vsaSigned__indicator');
        this.mileage_textbox = this.page.getByRole('textbox', { name: 'Mileage (KM)' });
        this.number_of_keys_dropdown = this.page
            .locator('[id="repossession"]')
            .locator('.select-numberOfKeys__indicator');
        this.seizure_photos_upload_button = this.page.getByText('Drop Images Here or Click to');
        this.seizure_notes_textbox = this.page.getByRole('textbox', { name: 'Seizure Note' });
        this.seizure_save_button = this.page
            .locator('[id="repossession"] > div > div > form')
            .filter({ hasText: 'Repossession' })
            .getByRole('button', { name: 'Save' });

        this.inovatec_id_textbox = this.page.getByRole('textbox', { name: 'Inovatec ID' });
        this.repo_type_dropdown = this.page.locator('[id="repossession"]').locator('.select-repoType__indicator');
        this.repo_reason_dropdown = this.page.locator('[id="repossession"]').locator('.select-reason__indicator');
        this.dealer_textbox = this.page.getByRole('textbox', { name: 'Dealer' });
        this.corp_delivery_location_textbox = this.page.getByRole('textbox', { name: 'Corp Delivery Location' });
        this.vsa_signed_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'VSA Signed Date' })
            .getByPlaceholder('Select date');
        this.vsa_uploaded_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'VSA Uploaded Date' })
            .getByPlaceholder('Select date');
        this.days_from_funding_textbox = this.page.getByRole('textbox', { name: 'Days from Funding' });
        this.days_to_recover_from_assignment_date_textbox = this.page.getByRole('textbox', {
            name: 'Days to Recover from Assignment Date',
        });
        this.assignment_save_button = this.page
            .locator('[id="repossession"] > div > div > form')
            .filter({ hasText: 'Assignment' })
            .getByRole('button', { name: 'Save' })
            .first();

        this.voluntary_surrender_toggle = this.page.getByRole('switch', { name: 'Use setting' });
        this.current_principal_balance_textbox = this.page.getByRole('textbox', { name: 'Current Principal Balance' });
        this.bailiff_date_assigned_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Bailiff Date Assigned' })
            .getByPlaceholder('Select date');
        this.loan_charge_off_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Loan Charge Off Date' })
            .getByPlaceholder('Select date');
        this.loan_funded_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Loan Funded Date' })
            .getByPlaceholder('Select date');
        this.next_payment_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Next Payment Date' })
            .getByPlaceholder('Select date');
        this.last_payment_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Last Payment Date' })
            .getByPlaceholder('Select date');
        this.original_balance_textbox = this.page.getByRole('textbox', { name: 'Original Balance' });
        this.original_term_textbox = this.page.getByPlaceholder('Original Term');
        this.payment_amount_textbox = this.page.getByRole('textbox', { name: 'Payment Amount' });
        this.payment_frequency_dropdown = this.page
            .locator('[id="repossession"]')
            .locator('.select-paymentFrequency__indicator');
        this.arrears_amount_textbox = this.page.getByRole('textbox', { name: 'Arrears Amount' });
        this.days_past_due_at_assignment_textbox = this.page.getByPlaceholder('Days Past Due (At assignment)');
        this.days_past_due_today_textbox = this.page.getByPlaceholder('Days Past Due Today');
        this.days_past_due_at_month_end_textbox = this.page.getByPlaceholder('Days Past Due Month End');
        this.payout_date_textbox = this.page
            .getByRole('group')
            .filter({ hasText: 'Payout Date' })
            .getByPlaceholder('Select date');
        this.payout_amount_textbox = this.page.getByRole('textbox', { name: 'Payout Amount' });
        this.repo_save_button = this.page
            .locator('[id="repossession"] > div > div > form')
            .filter({ hasText: 'Repo' })
            .getByRole('button', { name: 'Save' })
            .last();
    }

    static async getInstance(page: Page) {
        const instance = new RepoDetails(page);
        await instance.initialize();
        return instance;
    }

    async addDataToContract(type: 'CSC' | 'Loan' | 'Lease') {
        if (type === 'CSC') {
            await this.csc_contract_type_radio_button.click();
        } else if (type === 'Loan') {
            await this.loan_contract_type_radio_button.click();
        } else if (type === 'Lease') {
            await this.lease_contract_type_radio_button.click();
        }
        let date = await getTodaysDate();
        await this.contract_date_textbox.fill(date);
        await this.page.keyboard.press('Tab'); // Trigger any onBlur events for the date field

        await this.contract_save_button.click();
        await expect(this.contract_save_button).toBeDisabled();
    }

    async addDataToSeizureDetails() {
        let date = await getTodaysDate();
        await this.repossession_date_textbox.fill(date);
        await this.page.keyboard.press('Tab'); // Trigger any onBlur events for the date field

        await this.seizure_address_textbox.fill('1320 Test St');

        await this.seizure_province_dropdown.click();
        await expect(this.page.getByRole('option', { name: 'Ontario' })).toBeVisible();
        await this.page.getByRole('option', { name: 'Ontario' }).click();
        await this.seizure_city_textbox.fill('Toronto');

        await this.delivered_date_textbox.fill(date);
        await this.delivered_address_textbox.fill('1320 Test St');

        await this.delivered_province_dropdown.click();
        await expect(this.page.getByRole('option', { name: 'Ontario' })).toBeVisible();
        await this.page.getByRole('option', { name: 'Ontario' }).click();
        await this.delivered_city_textbox.fill('Toronto');

        await this.vehicle_condition_dropdown.click();
        await expect(this.page.getByRole('option', { name: 'Average' })).toBeVisible();
        await this.page.getByRole('option', { name: 'Average' }).click();

        await this.runs_dropdown.click();
        await expect(this.page.getByRole('option', { name: 'Yes' })).toBeVisible();
        await this.page.getByRole('option', { name: 'Yes' }).click();

        await this.vsa_signed_dropdown.click();
        await expect(this.page.getByRole('option', { name: 'Unknown' })).toBeVisible();
        await this.page.getByRole('option', { name: 'Unknown' }).click();

        await this.mileage_textbox.fill('150000');

        await this.number_of_keys_dropdown.click();
        await expect(this.page.getByRole('option', { name: '2' })).toBeVisible();
        await this.page.getByRole('option', { name: '2' }).click();

        await this.seizure_save_button.click();
    }

    async addDataToAssignment() {
        await this.dealer_textbox.fill('Test Dealer');
        await this.corp_delivery_location_textbox.fill('1320 Test St, Toronto, ON');
        let date = await getTodaysDate();

        await this.vsa_signed_date_textbox.fill(date);
        await this.page.keyboard.press('Tab'); // Trigger any onBlur events for the date field

        await this.vsa_uploaded_date_textbox.fill(date);
        await this.page.keyboard.press('Tab'); // Trigger any onBlur events for the date field

        await this.days_from_funding_textbox.fill('30');
        await this.days_to_recover_from_assignment_date_textbox.fill('15');
        await this.repo_type_dropdown.click();
        await expect(this.page.getByRole('option', { name: 'Involuntary' })).toBeVisible();
        await this.page.getByRole('option', { name: 'Involuntary' }).click();

        await this.repo_reason_dropdown.click();
        await expect(this.page.getByRole('option', { name: 'Non Payment' })).toBeVisible();
        await this.page.getByRole('option', { name: 'Non Payment' }).click();
        await this.assignment_save_button.click();
    }

    async addDataToRepo() {
        await this.voluntary_surrender_toggle.click();
        await this.current_principal_balance_textbox.fill('35000');
        let date = await getTodaysDate();

        await this.bailiff_date_assigned_textbox.fill(date);
        await this.page.keyboard.press('Tab'); // Trigger any onBlur events for the date field

        await this.loan_charge_off_date_textbox.fill(date);
        await this.page.keyboard.press('Tab'); // Trigger any onBlur events for the date field

        await this.loan_funded_date_textbox.fill(date);
        await this.page.keyboard.press('Tab'); // Trigger any onBlur events for the date field

        await this.next_payment_date_textbox.fill(date);
        await this.page.keyboard.press('Tab'); // Trigger any onBlur events for the date field

        await this.last_payment_date_textbox.fill(date);
        await this.page.keyboard.press('Tab'); // Trigger any onBlur events for the date field

        await this.original_balance_textbox.fill('40000');
        await this.original_term_textbox.fill('60');
        await this.payment_amount_textbox.fill('666.67');

        await this.payment_frequency_dropdown.click();
        await expect(this.page.getByRole('option', { name: 'Monthly', exact: true })).toBeVisible();
        await this.page.getByRole('option', { name: 'Monthly', exact: true }).click();

        await this.arrears_amount_textbox.fill('2000');
        await this.payout_date_textbox.fill(date);
        await this.page.keyboard.press('Tab'); // Trigger any onBlur events for the date field

        await this.payout_amount_textbox.fill('37000');
        await this.repo_save_button.click();
    }

    async uploadSeizurePhotos() {
        await expect(this.seizure_photos_upload_button).toBeVisible();

        const fileChooserPromise = this.page.waitForEvent('filechooser');
        await this.seizure_photos_upload_button.click();
        const fileChooser = await fileChooserPromise;

        // Create an array to hold all 5 file paths
        const filePaths: string[] = [];

        for (let i = 1; i <= 5; i++) {
            const filePath = path.join(__dirname, '../..', 'test-resources', `seizure-photo-${i}.jpg`);
            if (!fs.existsSync(filePath)) {
                throw new Error(`❌ Test photo not found at: ${filePath}`);
            }

            filePaths.push(filePath);
        }
        await fileChooser.setFiles(filePaths);
    }
}
