import path from 'path';
import fs from 'fs';
import { Page, Locator, APIRequestContext, request as playwrightRequest, Download } from '@playwright/test';
import { test, expect } from '../../../fixtures';
import { extractPdfText, openFileViaSearchbar } from '../../../helpers';
import { navigateToLoginPage } from '../../../navigation-helpers';
import { AssetDetails } from '../../../pages/FilePages/AssetDetails';
import { Assignments } from '../../../pages/FilePages/Assignments';
import { FileHomePage } from '../../../pages/FilePages/FileHomePage';
import { Forms } from '../../../pages/FilePages/Forms';
import { RepoDetails } from '../../../pages/FilePages/RepoDetails';

import { APIServices } from '../../../services/apiServices';
import { LoginPage } from '../../../pages/LoginPage';

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface FormExpectedFields {
    accountNumber?: boolean;
    firstName?: boolean;
    lastName?: boolean;
    fileRef?: boolean;
    vin?: boolean;
    year?: boolean;
    make?: boolean;
    model?: boolean;
    literals?: string[];
}

interface FormConfig {
    name: string;
    expectedFields: FormExpectedFields;
}

interface ResolvedFormData {
    accountNumber: string;
    firstName: string;
    lastName: string;
    fileRef: string;
    vin: string;
    year: string;
    make: string;
    model: string;
}

// ─── FORM DEFINITIONS ───────────────────────────────────────────────────────

const BASE_FIELDS: FormExpectedFields = {
    accountNumber: true,
    firstName: true,
    lastName: true,
    fileRef: true,
};

const BASE_WITH_ASSET: FormExpectedFields = {
    ...BASE_FIELDS,
    vin: true,
    year: true,
    make: true,
    model: true,
};

const STANDARD_FORMS: FormConfig[] = [
    { name: 'Day Notice QC (English)', expectedFields: { ...BASE_FIELDS } },
    { name: 'Voluntary Surrender QC (English)', expectedFields: { ...BASE_WITH_ASSET } },
    { name: 'Voluntary Surrender Acknowledgment Seize or Sue (English)', expectedFields: { ...BASE_WITH_ASSET } },
    {
        name: 'Voluntary Surrender Acknowledgment Seize and Sue (English)',
        expectedFields: { ...BASE_WITH_ASSET, literals: ['$37,000.00'] },
    },
    { name: 'Redemption Acknowledgment and Release', expectedFields: { ...BASE_WITH_ASSET } },
    {
        name: 'Forfeiture Notice (English)',
        expectedFields: { ...BASE_FIELDS, year: true, make: true, model: true, literals: ['$37,000.00'] },
    },
];

// ─── HELPERS ────────────────────────────────────────────────────────────────

const buildExpectedTexts = (fields: FormExpectedFields, data: ResolvedFormData): string[] => {
    const texts: string[] = [];
    if (fields.accountNumber) texts.push(data.accountNumber);
    if (fields.firstName) texts.push(data.firstName);
    if (fields.lastName) texts.push(data.lastName);
    if (fields.fileRef) texts.push(data.fileRef);
    if (fields.vin) texts.push(data.vin);
    if (fields.year) texts.push(data.year);
    if (fields.make) texts.push(data.make);
    if (fields.model) texts.push(data.model);
    if (fields.literals) texts.push(...fields.literals);
    return texts;
};

const generateDownloadAndVerifyPdf = async (page: Page, formsSection: Forms, expectedTexts: string[]) => {
    await formsSection.correct_form_checkbox.click();
    await expect(formsSection.generate_form_button).toBeEnabled();

    const context = page.context();

    // Listen at the context level — catches downloads from main page OR any popup.
    // This is essential for headless mode, where the PDF popup turns into a download.
    const contextDownloadPromise = new Promise<Download>((resolve) => {
        const onPage = (newPage: Page) => {
            newPage.once('download', resolve);
        };
        context.on('page', onPage);
        page.once('download', resolve);
    });

    const popupPromise = page.waitForEvent('popup').then((popup) => ({ type: 'popup' as const, payload: popup }));

    const downloadPromise = contextDownloadPromise.then((download) => ({
        type: 'download' as const,
        payload: download,
    }));

    await formsSection.generate_form_button.click();

    let fileBuffer: Buffer;
    const result = await Promise.any([popupPromise, downloadPromise]);

    if (result.type === 'popup') {
        console.log('Browser opened a new tab.');
        const pdftab = result.payload;

        try {
            await pdftab.waitForLoadState('domcontentloaded', { timeout: 10000 });
            await pdftab.reload(); // Ensure PDF is fully loaded, especially in headless mode where it might initially load as a blank page.
            await pdftab.waitForURL((url) => ['http:', 'https:', 'blob:'].includes(url.protocol), { timeout: 10000 });

            const pdfUrl = pdftab.url();

            if (pdfUrl.startsWith('blob:')) {
                const client = await pdftab.context().newCDPSession(pdftab);
                await client.send('Page.enable');
                const { frameTree } = await client.send('Page.getFrameTree');
                const { content, base64Encoded } = await client.send('Page.getResourceContent', {
                    frameId: frameTree.frame.id,
                    url: pdfUrl,
                });
                fileBuffer = base64Encoded ? Buffer.from(content, 'base64') : Buffer.from(content);
                await client.detach();
            } else {
                const response = await pdftab.request.get(pdfUrl);
                fileBuffer = await response.body();
            }

            await pdftab.close();
        } catch (err) {
            // Headless fallback: the popup detached because it became a download.
            console.log('Popup detached, falling back to download event.');
            const download = await Promise.race([
                contextDownloadPromise,
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Download did not arrive after popup detached')), 15000)
                ),
            ]);
            const tempPath = await download.path();
            if (!tempPath) throw new Error('Download path not found');
            fileBuffer = fs.readFileSync(tempPath);
        }
    } else {
        console.log('Browser downloaded the file directly.');
        const download = result.payload;
        const tempPath = await download.path();
        if (!tempPath) throw new Error('Download path not found');
        fileBuffer = fs.readFileSync(tempPath);
    }

    const pdfContent = await extractPdfText(fileBuffer);
    for (const expectedText of expectedTexts) {
        expect(pdfContent.fullText).toContain(expectedText);
    }
};

const selectForm = async (page: Page, formsSection: Forms, formName: string, formPreview: Locator) => {
    await formsSection.open_form_options_dropdown.click();
    await page.getByRole('option', { name: formName }).click();
    await expect(formPreview).toBeVisible();
};

/**
 * Creates a file via API, logs in, seeds all required data (assignments,
 * repo details, asset details), then navigates to the Forms section.
 * Returns everything needed to run form assertions + cleanup.
 */
const setupFileAndNavigateToForms = async (
    page: Page,
    loginAs: (role: string) => Promise<void>
): Promise<{
    formsSection: Forms;
    formPreview: Locator;
    formData: ResolvedFormData;
    apiService: APIServices;
    apiRequestContext: APIRequestContext;
}> => {
    // Create file via API
    const apiRequestContext = await playwrightRequest.newContext();
    const apiService = await APIServices.create(apiRequestContext);
    const fileDetails = await apiService.createNewAutoAssetFileViaAPI();

    const formData: ResolvedFormData = {
        accountNumber: fileDetails.accountNumber,
        firstName: fileDetails.randomFirstName,
        lastName: fileDetails.randomLastName,
        fileRef: '',
        vin: '',
        year: '',
        make: '',
        model: '',
    };

    // Log in
    await navigateToLoginPage(page);
    const loginPage = await LoginPage.getInstance(page);
    await expect(loginPage.login_button).toBeVisible();
    await loginAs('basic_admin');

    formData.fileRef = await openFileViaSearchbar(page, formData.accountNumber);
    const fileHomePage = await FileHomePage.getInstance(page);
    await expect(fileHomePage.assignmentOption).toBeVisible();

    // Assign companies and users
    await fileHomePage.assignmentOption.click();
    const assignments = await Assignments.getInstance(page);
    await assignments.assignUsersToAssignedCompany('Auto Admin-Basic', 'Admin');
    await assignments.assignCompanyToFile(
        'Bailiff',
        'ABCD | ABC Bailiff Toronto',
        ['Auto Bailiff-Toronto-Two', 'Auto Bailiff-Toronto', 'Auto Bailiff-Vancouver'],
        false
    );
    await assignments.assignCompanyToFile('Storage Facility', 'Storage Facility Testing Company');
    await assignments.assignCompanyToFile('Transport', 'Transport Testing Company');
    await assignments.assignCompanyToFile('Sales Location', 'Sales Location Testing Company');

    // Fill repo details
    await fileHomePage.repoDetailsOption.click();
    const repoDetails = await RepoDetails.getInstance(page);
    await expect(repoDetails.contract_save_button).toBeVisible();
    await repoDetails.addDataToContract('Loan');
    await repoDetails.addDataToSeizureDetails();
    await repoDetails.addDataToAssignment();
    await repoDetails.addDataToRepo();

    // Capture asset details
    await fileHomePage.assetDetailsOption.click();
    const assetDetails = await AssetDetails.getInstance(page);
    formData.vin = await assetDetails.asset_VIN_textbox.inputValue();
    formData.year = await assetDetails.asset_year_dropdown.innerText();
    formData.make = await assetDetails.asset_car_make_dropdown.innerText();
    formData.model = await assetDetails.asset_car_model_dropdown.innerText();

    // Navigate to Forms
    await fileHomePage.formsOption.click();
    const formsSection = await Forms.getInstance(page);
    const formPreview = page.locator(formsSection.form_preview_selector);

    return { formsSection, formPreview, formData, apiService, apiRequestContext };
};

/**
 * Cleans up the file and disposes the API context. Safe to call even
 * if setup partially failed. (try-catch removed as requested)
 */
const cleanupFile = async (apiService?: APIServices, fileRef?: string, apiRequestContext?: APIRequestContext) => {
    if (apiService && fileRef) {
        console.log(`Cleaning up file: ${fileRef}`);
        await apiService.deleteFile(fileRef);
    }

    if (apiRequestContext) {
        await apiRequestContext.dispose();
    }
};

// ─── TESTS ──────────────────────────────────────────────────────────────────

test.describe('Form generation for new auto-asset file', () => {
    // 1. Declare suite-level variables to track the current test's context
    let currentApiService: APIServices | undefined;
    let currentFileRef: string | undefined;
    let currentApiRequestContext: APIRequestContext | undefined;

    // 2. Use afterEach to guarantee cleanup happens globally
    test.afterEach(async () => {
        await cleanupFile(currentApiService, currentFileRef, currentApiRequestContext);

        // Reset variables so they don't leak into the next test
        currentApiService = undefined;
        currentFileRef = undefined;
        currentApiRequestContext = undefined;
    });

    // ── Standard forms (data-driven) ────────────────────────────────────
    for (const form of STANDARD_FORMS) {
        test(`Standard form: "${form.name}" — preview and PDF`, async ({ page, loginAs }) => {
            test.setTimeout(60000);

            const { formsSection, formPreview, formData, apiService, apiRequestContext } =
                await setupFileAndNavigateToForms(page, loginAs);

            // 3. Immediately assign test variables to the suite variables for afterEach to catch
            currentApiService = apiService;
            currentFileRef = formData.fileRef;
            currentApiRequestContext = apiRequestContext;

            // Rest of the clean test code
            await selectForm(page, formsSection, form.name, formPreview);

            const expectedTexts = buildExpectedTexts(form.expectedFields, formData);

            for (const text of expectedTexts) {
                await expect(formPreview).toContainText(text);
            }

            await generateDownloadAndVerifyPdf(page, formsSection, expectedTexts);
        });
    }

    // ── Editable forms ──────────────────────────────────────────────────
    test('Editable form: "ACC Reaffirmation Agreement" — fill loan balance', async ({ page, loginAs }) => {
        const { formsSection, formPreview, formData, apiService, apiRequestContext } =
            await setupFileAndNavigateToForms(page, loginAs);

        currentApiService = apiService;
        currentFileRef = formData.fileRef;
        currentApiRequestContext = apiRequestContext;

        await selectForm(page, formsSection, 'ACC Reaffirmation Agreement', formPreview);

        const loanBalanceField = formPreview.getByPlaceholder('Loan Balance');
        await expect(loanBalanceField).toBeVisible();
        await loanBalanceField.fill('30000');

        const expectedTexts = buildExpectedTexts(
            { ...BASE_WITH_ASSET, accountNumber: false, fileRef: false, literals: ['$30,000.00'] },
            formData
        );
        await generateDownloadAndVerifyPdf(page, formsSection, expectedTexts);
    });

    test('Editable form: "Letter of Authority" — fill ministry name', async ({ page, loginAs }) => {
        const { formsSection, formPreview, formData, apiService, apiRequestContext } =
            await setupFileAndNavigateToForms(page, loginAs);

        currentApiService = apiService;
        currentFileRef = formData.fileRef;
        currentApiRequestContext = apiRequestContext;

        await selectForm(page, formsSection, 'Letter of Authority', formPreview);

        const nameOfMinistryField = formPreview.getByRole('textbox', { name: 'Name of Ministry' });
        await expect(nameOfMinistryField).toBeVisible();
        await nameOfMinistryField.fill('Ministry of Magic');

        const expectedTexts = buildExpectedTexts(
            { ...BASE_WITH_ASSET, fileRef: false, literals: ['Ministry of Magic'] },
            formData
        );
        await generateDownloadAndVerifyPdf(page, formsSection, expectedTexts);
    });

    const NOI_FORMS = ['NOI (AB)', 'NOI (BC/MB/SK)', 'NOI (NB/PEI)', 'NOI (NL)', 'NOI (NS)', 'NOI (ON)'];

    for (const noiForm of NOI_FORMS) {
        test(`Editable form: "${noiForm}" — fill expense estimate and redemption amount`, async ({ page, loginAs }) => {
            const { formsSection, formPreview, formData, apiService, apiRequestContext } =
                await setupFileAndNavigateToForms(page, loginAs);

            currentApiService = apiService;
            currentFileRef = formData.fileRef;
            currentApiRequestContext = apiRequestContext;

            await selectForm(page, formsSection, noiForm, formPreview);

            const expenseEstimateField = formPreview.getByPlaceholder('Expense Estimate Amount');
            await expect(expenseEstimateField).toBeVisible();
            await expenseEstimateField.fill('30000');

            const redemptionAmountField = formPreview.getByPlaceholder('Redemption Amount');
            await expect(redemptionAmountField).toBeVisible();
            await redemptionAmountField.fill('25000');

            const expectedTexts = buildExpectedTexts(
                { ...BASE_WITH_ASSET, fileRef: false, literals: ['$30,000.00', '$25,000.00'] },
                formData
            );
            await generateDownloadAndVerifyPdf(page, formsSection, expectedTexts);
        });
    }
});
