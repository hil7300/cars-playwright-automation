import { APIRequestContext, expect } from '@playwright/test';
import * as links from '../links.json';
import * as path from 'path';
import * as fs from 'fs';
import { generateRandomAccountNumber } from '../helpers';

export class APIServices {
    private request: APIRequestContext;
    private baseUrl: string;
    private authUrl: string;
    private audience: string;
    private token: string | null = null; //null until initialized
    private env: 'dev' | 'stg' | 'local';
    private initPromise: Promise<void> | null = null; //prevents duplicate login calls

    constructor(request: APIRequestContext, env?: 'dev' | 'stg' | 'local') {
        this.request = request;
        this.env = env || (process.env.ENV as 'dev' | 'stg' | 'local') || 'dev';
        this.baseUrl = links.apiEndpoints[this.env];
        this.authUrl = links.authEndpoints[this.env];
        // Auth0 API identifier — equals baseUrl on dev/stg, but local hits
        // localhost while its cars-api still validates the dev identifier.
        this.audience = links.apiAudiences[this.env];
    }

    // ─── Static Factory ───────────────────────────────────────────────────────

    /**
     * Creates and fully initializes an APIServices instance.
     * Use this instead of `new APIServices(...)` + `loginAsApiServiceUser()`.
     *
     * @example
     * const api = await APIServices.create(request);
     */
    static async create(request: APIRequestContext, env?: 'dev' | 'stg' | 'local'): Promise<APIServices> {
        const instance = new APIServices(request, env);
        await instance.ensureAuthenticated();
        return instance;
    }

    // ─── Private Auth ─────────────────────────────────────────────────────────
    private async ensureAuthenticated(): Promise<void> {
        if (this.token) return; // already authenticated

        if (!this.initPromise) {
            this.initPromise = this.loginAsApiServiceUser(); // kick off once
        }

        await this.initPromise; // all callers await the same promise
        this.initPromise = null;
    }

    private async loginAsApiServiceUser(): Promise<void> {
        const userType = 'api_automation';
        let username: string;
        let password: string;
        let clientId: string;
        let clientSecret: string;

        if (process.env.CI) {
            const unameKey = `CARS_${this.env.toUpperCase()}_${userType.toUpperCase()}_USERNAME_0`;
            const pwdKey = `CARS_${this.env.toUpperCase()}_${userType.toUpperCase()}_PASSWORD_0`;
            const clientIdKey = `CARS_${this.env.toUpperCase()}_AUTH0_CLIENT_ID`;
            const clientSecretKey = `CARS_${this.env.toUpperCase()}_AUTH0_CLIENT_SECRET`;

            username = process.env[unameKey] || '';
            password = process.env[pwdKey] || '';
            clientId = process.env[clientIdKey] || '';
            clientSecret = process.env[clientSecretKey] || '';

            if (!username || !password) {
                throw new Error(`[CI] Missing env vars: ${unameKey} or ${pwdKey}`);
            }
            if (!clientId || !clientSecret) {
                throw new Error(`[CI] Missing env vars: ${clientIdKey} or ${clientSecretKey}`);
            }
        } else {
            const credentialsPath = path.resolve(__dirname, '..', 'credentials.json');
            const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
            const envCreds = creds[this.env];
            const userCredentials = envCreds?.[userType]?.[0];

            if (!userCredentials) {
                throw new Error(`No credentials found for ${userType} in ${this.env}`);
            }

            username = userCredentials.username;
            password = userCredentials.password;
            clientId = envCreds.auth0_client_id;
            clientSecret = envCreds.auth0_client_secret;

            if (!clientId || !clientSecret) {
                throw new Error(
                    `Missing auth0_client_id or auth0_client_secret in credentials.json under "${this.env}"`,
                );
            }
        }

        // Auth0 Resource Owner Password Grant (ROPG). The post-login Action's
        // `app_metadata.test_account` check skips MFA for tagged automation users,
        // so this call returns an access_token directly without an MFA round-trip.
        const response = await this.request.post(`${this.authUrl}/oauth/token`, {
            data: {
                grant_type: 'password',
                username,
                password,
                audience: this.audience,
                scope: 'openid profile email',
                client_id: clientId,
                client_secret: clientSecret,
            },
        });

        if (!response.ok()) {
            const errorText = await response.text().catch(() => '');
            throw new Error(
                `Auth0 login failed for ${userType} on ${this.env}. Status: ${response.status()}. ${errorText}`,
            );
        }

        const body = await response.json();
        this.token = body.access_token;

        if (!this.token) {
            throw new Error(`Auth0 login response did not contain an access_token for ${userType}`);
        }

        console.log(`✅ API: Successfully logged in as ${userType} on ${this.env} (via Auth0 ROPG)`);
    }

    // ─── Public Methods ───────────────────────────────────────────────────────

    async triggerPendingVendorInvoices(): Promise<void> {
        await this.ensureAuthenticated();
        const response = await this.request.get(`${this.baseUrl}/vendorInvoice/trigger-pending-invoices`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                Accept: 'application/json',
            },
        });

        if (!response.ok()) {
            throw new Error(`Failed to trigger pending vendor invoices. Status: ${response.status()}`);
        }
    }

    async triggerVinSearchForAssetViaAPI(): Promise<void> {
        await this.ensureAuthenticated();
        const response = await this.request.get(`${this.baseUrl}/vinSearch/reports`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                Accept: 'application/json',
            },
        });

        if (!response.ok()) {
            throw new Error(`Failed to trigger VIN search for asset. Status: ${response.status()}`);
        }
    }

    async triggerPpsaSearchForAsset(): Promise<void> {
        await this.ensureAuthenticated();
        const response = await this.request.get(`${this.baseUrl}/personDebtorSearch/reports`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                Accept: 'application/json',
            },
        });

        if (!response.ok()) {
            throw new Error(`Failed to trigger PPSA search for asset. Status: ${response.status()}`);
        }
    }
    async createNewAutoAssetFileViaAPI(clientName: string = 'Bank 3', debtorFirstName?: string, debtorLastName?: string,): Promise<{
        accountNumber: string;
        randomFirstName: string;
        randomLastName: string;
    }> {
        await this.ensureAuthenticated();
        const accountNumber = await generateRandomAccountNumber(10);

        // 1. Define lists of 20 realistic first and last names
        const firstNames = [
            'James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael',
            'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard',
            'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen',
        ];
        const lastNames = [
            'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller',
            'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez',
            'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
        ];

        // 2. Pick a random name from the arrays
        const randomFirstName = debtorFirstName ?? firstNames[Math.floor(Math.random() * firstNames.length)];
        const randomLastName = debtorLastName ?? lastNames[Math.floor(Math.random() * lastNames.length)];


        const url = `${this.baseUrl}/file/processor/generic/incoming/ingest`;
        const payload = {
            clientName: clientName, // Uses the passed parameter or defaults to 'Bank 3'
            assignments: [
                {
                    file: {
                        repoDetails: {
                            bank: {
                                accountNumber: accountNumber,
                                uniqueLenderId: 'ABC',
                            },
                            repo: {
                                currentBalanceOutstanding: 10500,
                                arrearsAmount: 1500,
                                daysPastDue: 60,
                                originalBalance: 25000,
                            },
                        },
                        assetDetails: {
                            assetType: 'AU',
                            serializedAssets: {
                                auVIN: '2GKFLUE31H6270714',
                                year: 2021,
                                auMake: 'GMC',
                                auModel: 'TERRAIN',
                            },
                        },
                    },
                    relatedParties: [
                        {
                            type: 'primary',
                            firstName: randomFirstName,
                            lastName: randomLastName,
                            email: `${randomFirstName.toLowerCase()}.${randomLastName.toLowerCase()}@email.com`,
                            street1: '123 Springfield Road',
                            street2: '321',
                            city: 'Kelowna',
                            state: 'BC',
                            postalCode: 'V1Y6N2',
                            mobilePhoneNumber: '5197814321',
                            homePhoneNumber: '5197811234',
                        },
                        {
                            type: 'secondary',
                            firstName: 'Glenn',
                            lastName: 'Secondary',
                            mobilePhoneNumber: '5197814343',
                            homePhoneNumber: '5197811212',
                        },
                    ],
                    noteContent: 'Extra sample note',
                },
            ],
        };

        const response = await this.request.post(url, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            data: payload,
        });

        if (!response.ok()) {
            const errorText = await response.text();
            throw new Error(`Failed to create new auto asset file. Status: ${response.status()} - ${errorText}`);
        }

        console.log(`Created file for: ${randomFirstName} ${randomLastName} (Acc: ${accountNumber}) under Client: ${clientName}. Got status response: ${response.status()}`);
        return { accountNumber, randomFirstName, randomLastName };
    }

    async deleteFile(fileRef: string | number): Promise<void> {
        await this.ensureAuthenticated(); //auto-auth if somehow not ready

        const fileId = await this.getFileIdFromRef(fileRef.toString());
        const response = await this.request.delete(`${this.baseUrl}/housekeeping/deleteFile/${fileId}`, {
            headers: {
                Authorization: `Bearer ${this.token}`,
                Accept: 'application/json',
            },
        });

        if (response.ok()) {
            console.log(`🗑️ API: Deleted file ID: ${fileId}. Got status response: ${response.status()}`);
        } else {
            console.error(`❌ API: Delete failed for ID: ${fileId}. Status: ${response.status()}`);
        }
    }

    async getFileIdFromRef(fileRef: string): Promise<string> {
        const fullRef = fileRef.trim();
        console.log(`🔍 Extracting file ID from reference: ${fullRef}`);

        if (!fullRef || fullRef.length < 5) {
            throw new Error(`Reference number "${fullRef}" is too short or invalid.`);
        }

        const fileId = fullRef.slice(-5);
        console.log(`🎯 Extracted File ID for API: ${fileId}`);
        return fileId;
    }
}
