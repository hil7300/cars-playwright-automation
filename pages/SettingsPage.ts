import { expect, Locator, Page } from '@playwright/test';

export type RoleName = 'Super Admin' | 'Subcontractor' | 'Client' | 'Basic Admin';

export class SettingsPage {
    private page: Page;

    //note templates
    delete_note_modal_selector: string = '[role="dialog"]';
    template_row_selector: string = '[data-cy="data-row"]';
    edit_template_icon_selector: string = '[class="btn-icon green"]';
    delete_template_icon_selector: string = '[class="btn-icon red"]';
    activity_type_selector: string = '[class*="chakra-wrap__listitem"]';

    general_tab: Locator;
    user_roles_tab: Locator;
    company_roles_tab: Locator;
    note_templates_tab: Locator;

    // user roles
    create_role_button: Locator;
    export_to_excel_button: Locator;
    super_admin_role_setting_dropdown: Locator;
    subcontractor_role_setting_dropdown: Locator;
    client_role_setting_dropdown: Locator;
    basic_admin_role_setting_dropdown: Locator;

    //note templates
    create_note_template_button: Locator;
    note_template_create_button: Locator;
    note_template_save_button: Locator;
    note_template_name_textbox: Locator;
    note_template_content_textbox: Locator;
    note_template_cancel_button: Locator;
    note_template_delete_confirmation_button: Locator;

    constructor(page: Page) {
        this.page = page;
    }

    private async initialize() {
        this.general_tab = this.page.getByRole('button', { name: 'General' });
        this.user_roles_tab = this.page.getByRole('button', { name: 'User Roles' });
        this.company_roles_tab = this.page.getByRole('button', { name: 'Company Roles' });
        this.note_templates_tab = this.page.getByRole('button', { name: 'Note Templates' });

        this.create_role_button = this.page.getByRole('button', { name: 'Create Role' });
        this.export_to_excel_button = this.page.getByRole('button', { name: 'Export to Excel' });

        this.super_admin_role_setting_dropdown = this.page.getByRole('button', {
            name: 'Super Admin - Unlimited access and permissions',
        });
        this.subcontractor_role_setting_dropdown = this.page.getByRole('button', {
            name: 'Subcontractor - Subcontractor Users',
        });
        this.client_role_setting_dropdown = this.page.getByRole('button', { name: 'Client - Basic User' });
        this.basic_admin_role_setting_dropdown = this.page.getByRole('button', {
            name: 'Admin - Basic User - Internal User',
        });

        this.create_note_template_button = this.page.getByRole('button', { name: 'Create Note Template' });
        this.note_template_create_button = this.page.getByRole('button', { name: 'Create', exact: true });
        this.note_template_save_button = this.page.getByRole('button', { name: 'Save' });
        this.note_template_name_textbox = this.page.getByLabel('Template Name');
        this.note_template_content_textbox = this.page.getByLabel('Content');
        this.note_template_cancel_button = this.page.getByRole('button', { name: 'Cancel' });
        this.note_template_delete_confirmation_button = this.page.getByRole('button', { name: 'Delete' });
    }

    static async getInstance(page: Page) {
        const instance = new SettingsPage(page);
        await instance.initialize();
        return instance;
    }

    /**
     * Helper to map the string role name to your actual class locator property
     */
    private getRoleDropdownLocator(roleName: RoleName): Locator {
        switch (roleName) {
            case 'Super Admin':
                return this.super_admin_role_setting_dropdown;
            case 'Subcontractor':
                return this.subcontractor_role_setting_dropdown;
            case 'Client':
                return this.client_role_setting_dropdown;
            case 'Basic Admin':
                return this.basic_admin_role_setting_dropdown;
            default:
                throw new Error(`Dropdown locator for role "${roleName}" is not defined.`);
        }
    }
    async setSettingToggleStateForRole(
        roleName: RoleName,
        permissionSection: string,
        settingName: string,
        toggleType: 'read' | 'write' | 'both',
        targetState: 'on' | 'off'
    ) {
        // 1. Get the correct dropdown locator and click it to expand the accordion/menu
        const roleDropdown = this.getRoleDropdownLocator(roleName);
        await expect(roleDropdown).toBeVisible();
        await roleDropdown.click();

        // 2. Now that it is expanded, get the read and write locators using your helper method
        const { readToggle, writeToggle } = await this.getSettingToggleLocator(permissionSection, settingName);

        // 3. Helper function to check state and toggle a specific locator
        const applyToggle = async (toggleLocator: Locator) => {
            const isCurrentlyOn = (await toggleLocator.getAttribute('aria-checked')) === 'true';

            if ((targetState === 'on' && !isCurrentlyOn) || (targetState === 'off' && isCurrentlyOn)) {
                await toggleLocator.click();

                // Wait for the UI to reflect the change
                const expectedState = targetState === 'on' ? 'true' : 'false';
                await expect(toggleLocator).toHaveAttribute('aria-checked', expectedState);
            }
        };

        // 4. Apply the toggle logic based on the requested toggleType
        if (toggleType === 'read' || toggleType === 'both') {
            await applyToggle(readToggle);
        }

        if (toggleType === 'write' || toggleType === 'both') {
            await applyToggle(writeToggle);
        }

        // 5. Click the dropdown again to close it (keeps the UI clean)
        await roleDropdown.click();
    }

    async getSettingToggleLocator(
        permissionSection: string,
        settingName: string
    ): Promise<{ readToggle: Locator; writeToggle: Locator }> {
        let permessionSection = this.page.locator(`[data-cy="${permissionSection.toUpperCase()}-subPermissions"]`).first();
        await expect(permessionSection).toBeVisible();
        let settingToggleSection = permessionSection.locator(`[data-cy="${settingName}"]`).locator('..'); // Assuming the toggle is a sibling of the element with data-cy equal to the setting name
        await expect(settingToggleSection).toBeVisible();
        let readSettingToggle = settingToggleSection
            .getByRole('switch')
            .locator('..')
            .filter({ hasText: 'Read' })
            .locator('[type="button"]');
        let writeSettingToggle = settingToggleSection
            .getByRole('switch')
            .locator('..')
            .filter({ hasText: 'Write' })
            .locator('[type="button"]');
        await expect(readSettingToggle).toBeVisible();
        await expect(writeSettingToggle).toBeVisible();
        return {
            readToggle: readSettingToggle,
            writeToggle: writeSettingToggle,
        };
    }

    async createNoteTemplate(name: string, content: string, activityTypes: string | string[]) {
        await expect(this.create_note_template_button).toBeVisible();
        await this.create_note_template_button.click();

        await expect(this.note_template_create_button).toBeDisabled();
        await expect(this.note_template_name_textbox).toBeVisible();

        await this.note_template_name_textbox.fill(name);
        await this.note_template_content_textbox.fill(content);

        const typesToSelect = Array.isArray(activityTypes) ? activityTypes : [activityTypes];

        for (const type of typesToSelect) {
            const activityTypeLocator = this.page.locator(this.activity_type_selector).getByText(type, { exact: true });
            await expect(activityTypeLocator).toBeVisible();
            await activityTypeLocator.click();
        }
        await expect(this.note_template_create_button).toBeVisible();
        await expect(this.note_template_create_button).toBeEnabled();
        await this.note_template_create_button.click();

        await expect(this.note_template_create_button).toBeHidden();
    }

    async openEditNoteTemplate(templateName: string) {
        await expect(this.create_note_template_button).toBeVisible();

        const templateRow = this.page
            .locator(this.template_row_selector)
            .filter({ has: this.page.getByText(templateName, { exact: true }) });
        await expect(templateRow).toBeVisible();

        const editIcon = templateRow.locator(this.edit_template_icon_selector);
        await expect(editIcon).toBeVisible();
        await editIcon.click();
        await expect(this.note_template_save_button).toBeVisible();
    }

    async deleteTemplate(templateName: string) {
        await expect(this.create_note_template_button).toBeVisible();
        const templateRow = this.page
            .locator(this.template_row_selector)
            .filter({ has: this.page.getByText(templateName, { exact: true }) });

        await expect(templateRow).toBeVisible();

        const deleteIcon = templateRow.locator(this.delete_template_icon_selector);
        await expect(deleteIcon).toBeVisible();
        await deleteIcon.click();

        const deleteModal = this.page.locator(this.delete_note_modal_selector);
        await expect(deleteModal).toBeVisible();

        await expect(deleteModal.locator(this.note_template_delete_confirmation_button)).toBeVisible();
        await deleteModal.locator(this.note_template_delete_confirmation_button).click();

        while (await deleteModal.isVisible()) {
            await deleteModal.locator(this.note_template_delete_confirmation_button).click();
            await this.page.waitForTimeout(500); // wait for the UI to process the click and potentially close the modal
        }
        await expect(deleteModal).toBeHidden();
        await expect(
            this.page
                .locator(this.template_row_selector)
                .filter({ has: this.page.getByText(templateName, { exact: true }) })
        ).toBeHidden();
    }
}
