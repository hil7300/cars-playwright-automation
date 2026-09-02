import { expect, Locator, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { generateRandomAccountNumber } from '../helpers';

export class CreateFilePage {
    protected page: Page;
    client_dropdown: Locator;
    client_option: Locator;
    assignment_reason_dropdown: Locator;
    account_number_textbox: Locator;
    current_principle_balance_outstanding_textbox: Locator;
    original_balance_textbox: Locator;
    amount_past_due_textbox: Locator;

    debtor_first_name_textbox: Locator;
    debtor_last_name_textbox: Locator;

    asset_type_dropdown: Locator;
    asset_type_option: Locator;

    vin_number_textbox: Locator;
    year_textbox: Locator;

    //All Terrain
    atv_make_textbox: Locator;
    atv_model_textbox: Locator;

    //Auto
    year_dropdown: Locator;
    auto_make_dropdown: Locator;
    auto_model_dropdown: Locator;

    //Marine
    marine_boat_make_textbox: Locator;
    marine_boat_model_textbox: Locator;
    marine_trailer_make_textbox: Locator;
    marine_trailer_model_textbox: Locator;
    marine_hin_number_textbox: Locator;

    //Motorcycle
    motorcycle_make_textbox: Locator;
    motorcycle_model_textbox: Locator;

    //Recreational Vehicle
    rv_make_textbox: Locator;
    rv_model_textbox: Locator;

    //Trailer
    trailer_make_textbox: Locator;
    trailer_model_textbox: Locator;

    //E-Bike/Equipment/Snowmobile/Other
    make_textbox: Locator;
    model_textbox: Locator;
    category_textbox: Locator;

    cancel_button: Locator;
    save_file_button: Locator;
    edit_reference_header: Locator;

    constructor(page: Page) {
        this.page = page;
    }

    protected async initialize() {
        this.client_dropdown = this.page.locator('.select-clientId__indicator');
        this.assignment_reason_dropdown = this.page.locator('.select-assignmentReason__indicator');
        this.account_number_textbox = this.page.getByRole('textbox', { name: 'Account Number' });
        this.current_principle_balance_outstanding_textbox = this.page.getByRole('textbox', {
            name: 'Current Principal Balance Outstanding',
        });
        this.original_balance_textbox = this.page.getByRole('textbox', { name: 'Original Balance' });
        this.amount_past_due_textbox = this.page.getByRole('textbox', { name: 'Amount Past Due' });
        this.debtor_first_name_textbox = this.page.getByRole('textbox', { name: 'Debtor First Name' });
        this.debtor_last_name_textbox = this.page.getByRole('textbox', { name: 'Debtor Last Name' });
        this.asset_type_dropdown = this.page.locator('.select-assetType__indicator');
        this.edit_reference_header = this.page.getByRole('heading', { name: /Edit Reference #/ });

        this.vin_number_textbox = this.page.getByRole('textbox', { name: 'VIN' });
        this.year_textbox = this.page.getByRole('textbox', { name: 'Year' });

        this.atv_make_textbox = this.page.getByRole('textbox', { name: 'ATV Make' });
        this.atv_model_textbox = this.page.getByRole('textbox', { name: 'ATV Model' });

        this.year_dropdown = this.page.locator('.select-year__indicator');
        this.auto_make_dropdown = this.page.locator('.select-auMake__indicator');
        this.auto_model_dropdown = this.page.locator('.select-auModel__indicator');

        this.marine_boat_make_textbox = this.page.getByRole('textbox', { name: 'Boat Make' });
        this.marine_boat_model_textbox = this.page.getByRole('textbox', { name: 'Boat Model' });
        this.marine_trailer_make_textbox = this.page.getByRole('textbox', { name: 'Trailer Make' });
        this.marine_trailer_model_textbox = this.page.getByRole('textbox', { name: 'Trailer Model' });
        this.marine_hin_number_textbox = this.page.getByRole('textbox', { name: 'HIN' });

        this.motorcycle_make_textbox = this.page.getByRole('textbox', { name: 'Motorcycle Make' });
        this.motorcycle_model_textbox = this.page.getByRole('textbox', { name: 'Motorcycle Model' });

        this.rv_make_textbox = this.page.getByRole('textbox', { name: 'RV Make' });
        this.rv_model_textbox = this.page.getByRole('textbox', { name: 'RV Model' });

        this.trailer_make_textbox = this.page.getByRole('textbox', { name: 'Trailer Make' });
        this.trailer_model_textbox = this.page.getByRole('textbox', { name: 'Trailer Model' });

        this.make_textbox = this.page.getByRole('textbox', { name: 'Make' });
        this.model_textbox = this.page.getByRole('textbox', { name: 'Model' });
        this.category_textbox = this.page.getByRole('textbox', { name: 'Category' });

        this.cancel_button = this.page.getByRole('link', { name: 'Cancel' });
        this.save_file_button = this.page.getByRole('button', { name: 'Save File' });
    }

    static async getInstance(page: Page) {
        const instance = new CreateFilePage(page);
        await instance.initialize();
        return instance;
    }

    async createNewFile(clientName: string, assetType: string) {
        const randomAccount = await generateRandomAccountNumber(12); // Generates 12 digits
        // 1. Fill shared information across all file types
        await this.fillCommonFields(clientName, assetType, randomAccount);

        // 2. Conditional logic to fill asset-specific details
        switch (assetType.toLowerCase()) {
            case 'auto':
                await this.fillAutoDetails();
                break;
            case 'all-terrain vehicle':
                await this.fillATVDetails();
                break;
            case 'marine':
                await this.fillMarineDetails();
                break;
            case 'motorcycle':
                await this.fillMotorcycleDetails();
                break;
            case 'recreational vehicle':
                await this.fillRVDetails();
                break;
            case 'trailer':
                await this.fillTrailerDetails();
                break;
            case 'e-bike':
            case 'equipment':
            case 'snowmobile':
            case 'other':
                await this.fillGeneralAssetDetails();
                break;
            default:
                throw new Error(`Asset type "${assetType}" is not supported.`);
        }

        // 3. Save the file
        await this.save_file_button.click();
        await expect(this.page.getByRole('button', { name: '+ Create Reminder' })).toBeVisible(); // Wait for save action to complete and button to be disabled

        //4. Store the File Reference ID for future use
        await expect(this.edit_reference_header).toBeVisible();
        const headerText = await this.edit_reference_header.innerText();

        // This splits the string at '#' and takes the second part
        const refNumber = headerText.split('#')[1]?.trim();

        return { refNumber, randomAccount };
    }

    // --- Private Helper Methods (Encapsulation) ---

    private async fillCommonFields(clientName: string, assetType: string, randomAccount: string) {
        // Select client
        await expect(this.client_dropdown).toBeVisible();
        await this.client_dropdown.click();
        await this.page.getByRole('option', { name: clientName }).click();

        // Select Assignment reason
        await this.assignment_reason_dropdown.click();
        await this.page.getByRole('option', { name: 'Fraud' }).click();

        // Fill Financial and Debtor Info

        await this.account_number_textbox.fill(randomAccount);
        await this.current_principle_balance_outstanding_textbox.fill('35000');
        await this.original_balance_textbox.fill('43000');
        await this.amount_past_due_textbox.fill('1200');
        await this.debtor_first_name_textbox.fill('John');
        await this.debtor_last_name_textbox.fill('Doe');

        // Select Asset Type
        await this.asset_type_dropdown.click();
        await this.page.getByRole('option', { name: assetType }).click();
    }

    private async fillAutoDetails() {
        await this.vin_number_textbox.fill('2GKFLUE31H6270714');
        await this.year_dropdown.click();
        await this.page.getByRole('option', { name: '2024' }).click();
        await this.auto_make_dropdown.click();
        await this.page.getByRole('option', { name: 'Toyota' }).click();
        await this.auto_model_dropdown.click();
        await this.page.getByRole('option', { name: 'Camry' }).click();
    }

    private async fillATVDetails() {
        await this.vin_number_textbox.fill('2GKFLUE31H6270714');
        await this.year_textbox.fill('2023');
        await this.atv_make_textbox.fill('Polaris');
        await this.atv_model_textbox.fill('Sportsman');
    }

    private async fillMarineDetails() {
        await this.marine_hin_number_textbox.fill('BOAT123456');
        await this.year_textbox.fill('2022');
        await this.marine_boat_make_textbox.fill('Sea Ray');
        await this.marine_boat_model_textbox.fill('Sundancer');
        await this.marine_trailer_make_textbox.fill('EZ Loader');
        await this.marine_trailer_model_textbox.fill('Bunk Trailer');
    }

    private async fillMotorcycleDetails() {
        await this.vin_number_textbox.fill('MOTO123456');
        await this.year_textbox.fill('2022');
        await this.motorcycle_make_textbox.fill('Harley Davidson');
        await this.motorcycle_model_textbox.fill('Iron 883');
    }

    private async fillRVDetails() {
        await this.vin_number_textbox.fill('5SFPB3729ME440368');
        await this.year_textbox.fill('2021');
        await this.rv_make_textbox.fill('HEARTLAND RV');
        await this.rv_model_textbox.fill('PIONEER DS320');
    }

    private async fillTrailerDetails() {
        await this.vin_number_textbox.fill('TRL123456');
        await this.year_textbox.fill('2022');
        await this.trailer_make_textbox.fill('Big Tex');
        await this.trailer_model_textbox.fill('Utility');
    }

    private async fillGeneralAssetDetails() {
        await this.vin_number_textbox.fill('GEN123456');
        await this.year_textbox.fill('2022');
        await this.make_textbox.fill('Generic Make');
        await this.model_textbox.fill('Generic Model');
    }
}
