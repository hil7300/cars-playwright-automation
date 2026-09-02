/**
 * End-to-end diagnostic: log in via the CARS Auth0 token endpoint (ROPG) and
 * use the resulting access_token to create a new file via the CARS API.
 *
 * This replicates what APIServices.loginAsApiServiceUser() + createNewAutoAssetFileViaAPI()
 * do in tests, but hits the Auth0 /oauth/token endpoint directly with grant_type=password
 * instead of going through the CARS backend's /auth/login (which currently 400s).
 *
 * ─── Required env vars ──────────────────────────────────────────────────────
 *   AUTH0_TOKEN_URL    Full URL to the OAuth token endpoint.
 *                      e.g. https://auth.staging.carecovery.ca/oauth/token
 *
 *   AUTH0_CLIENT_ID    Client ID of an Auth0 app that has Password grant enabled.
 *   AUTH0_CLIENT_SECRET
 *
 *   AUTH0_AUDIENCE     CARS API identifier (the API the token is for).
 *                      e.g. https://staging-api.carecovery.ca
 *
 *   AUTH0_USERNAME     Email of a tagged test_account user.
 *                      e.g. azaltsman+autosuperuser@cancapgroup.ca
 *   AUTH0_PASSWORD
 *
 *   CARS_API_BASE_URL  Base URL of the CARS API.
 *                      e.g. https://staging-api.carecovery.ca
 *
 * ─── Usage (PowerShell) ─────────────────────────────────────────────────────
 *   $env:AUTH0_TOKEN_URL="https://auth.staging.carecovery.ca/oauth/token"
 *   $env:AUTH0_CLIENT_ID="..."
 *   $env:AUTH0_CLIENT_SECRET="..."
 *   $env:AUTH0_AUDIENCE="https://staging-api.carecovery.ca"
 *   $env:AUTH0_USERNAME="azaltsman+autosuperuser@cancapgroup.ca"
 *   $env:AUTH0_PASSWORD="x4XW2MjiJC!"
 *   $env:CARS_API_BASE_URL="https://staging-api.carecovery.ca"
 *   npx ts-node scripts/login-and-create-file.ts
 */

const REQUIRED = [
    'AUTH0_TOKEN_URL',
    'AUTH0_CLIENT_ID',
    'AUTH0_CLIENT_SECRET',
    'AUTH0_AUDIENCE',
    'AUTH0_USERNAME',
    'AUTH0_PASSWORD',
    'CARS_API_BASE_URL',
] as const;

for (const key of REQUIRED) {
    if (!process.env[key]) {
        console.error(`✕ Missing env var: ${key}`);
        console.error('  See script header for details.');
        process.exit(1);
    }
}

const TOKEN_URL = process.env.AUTH0_TOKEN_URL!;
const CLIENT_ID = process.env.AUTH0_CLIENT_ID!;
const CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET!;
const AUDIENCE = process.env.AUTH0_AUDIENCE!;
const USERNAME = process.env.AUTH0_USERNAME!;
const PASSWORD = process.env.AUTH0_PASSWORD!;
const CARS_API = process.env.CARS_API_BASE_URL

function section(label: string) {
    console.log(`\n${'─'.repeat(72)}`);
    console.log(`  ${label}`);
    console.log('─'.repeat(72));
}

function randomAccountNumber(): string {
    return Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
    try {
        const parts = jwt.split('.');
        if (parts.length !== 3) return null;
        const payload = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
        return JSON.parse(payload);
    } catch {
        return null;
    }
}

async function step1_login(): Promise<string> {
    section('Step 1: Authenticate via Auth0 /oauth/token (grant_type=password)');

    const body = {
        grant_type: 'password',
        username: USERNAME,
        password: PASSWORD,
        audience: AUDIENCE,
        scope: 'openid profile email',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
    };

    console.log(`POST ${TOKEN_URL}`);
    console.log(`  username:  ${USERNAME}`);
    console.log(`  audience:  ${AUDIENCE}`);
    console.log(`  client_id: ${CLIENT_ID.slice(0, 12)}…`);

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(`\n  Status:    ${res.status}`);
    console.log(`  Response:  ${text.slice(0, 600)}`);

    if (!res.ok) {
        try {
            const err = JSON.parse(text);
            if (err.error === 'mfa_required') {
                console.log('\n  ➤ Auth0 still requires MFA for this user.');
                console.log('    Check: the post-login Action runs, and app_metadata.test_account=true on this user.');
            } else if (err.error === 'unauthorized_client') {
                console.log('\n  ➤ This client_id is not allowed to use grant_type=password.');
                console.log('    Enable: App → Settings → Advanced → Grant Types → ✓ Password.');
            } else if (err.error === 'invalid_grant') {
                console.log('\n  ➤ Wrong username/password, OR user not in Default Directory.');
            } else if (err.error === 'access_denied') {
                console.log('\n  ➤ App not authorized for this audience, OR user lacks needed permissions.');
            }
        } catch {
            /* not JSON */
        }
        throw new Error(`Token request failed (HTTP ${res.status})`);
    }

    const json = JSON.parse(text) as { access_token?: string; id_token?: string; token_type?: string; scope?: string; expires_in?: number };
    if (!json.access_token) throw new Error('No access_token in response');

    console.log(`\n  ✓ access_token: ${json.access_token.slice(0, 50)}…`);
    console.log(`  ✓ token_type:   ${json.token_type ?? 'Bearer'}`);
    if (json.expires_in) console.log(`  ✓ expires_in:   ${json.expires_in}s`);
    if (json.scope) console.log(`  ✓ scope:        ${json.scope}`);

    // Decode payload for visibility
    const decoded = decodeJwtPayload(json.access_token);
    if (decoded) {
        console.log(`\n  Token payload (decoded):`);
        console.log(`    sub:   ${decoded.sub}`);
        console.log(`    aud:   ${JSON.stringify(decoded.aud)}`);
        console.log(`    iss:   ${decoded.iss}`);
        console.log(`    scope: ${decoded.scope ?? '(none)'}`);
    }

    return json.access_token;
}

async function step2_createFile(token: string): Promise<void> {
    section('Step 2: POST file creation to CARS API using the Auth0 access_token');

    const accountNumber = randomAccountNumber();
    const url = `${CARS_API}/file/processor/generic/incoming/ingest`;
    const payload = {
        clientName: 'Bank 3',
        assignments: [
            {
                file: {
                    repoDetails: {
                        bank: { accountNumber, uniqueLenderId: 'ABC' },
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
                        firstName: 'Diagnostic',
                        lastName: 'Tester',
                        email: 'diagnostic.tester@email.com',
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
                noteContent: 'Created by scripts/login-and-create-file.ts — safe to delete',
            },
        ],
    };

    console.log(`POST ${url}`);
    console.log(`  accountNumber: ${accountNumber}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(payload),
    });
    const text = await res.text();
    console.log(`\n  Status:    ${res.status}`);
    console.log(`  Response:  ${text.slice(0, 800)}`);

    if (res.ok) {
        console.log(`\n  ✓✓ FILE CREATED. accountNumber: ${accountNumber}`);
        console.log('  ➤ The CARS API accepts the Auth0 token directly. We can rewrite');
        console.log('    APIServices.loginAsApiServiceUser() to use this exact flow,');
        console.log('    bypassing /auth/login entirely.');
    } else if (res.status === 401) {
        console.log('\n  ➤ 401 — CARS API rejected the token.');
        console.log('    Possible reasons:');
        console.log('    - Wrong audience requested (token is for a different API)');
        console.log('    - CARS API requires a backend-issued JWT, not raw Auth0 tokens');
    } else if (res.status === 403) {
        console.log('\n  ➤ 403 — token is valid but user lacks permission for this endpoint.');
    } else {
        console.log(`\n  ➤ Unexpected ${res.status}. See response body above for details.`);
    }
}

async function main() {
    try {
        const token = await step1_login();
        await step2_createFile(token);
    } catch (err) {
        console.error(`\n✕ ${(err as Error).message}`);
        process.exit(1);
    }
}

main();
