/**
 * One-time local smoke check: proves the "API approach" for ENV=local works
 * end to end before wiring it into links.json / apiServices.ts.
 *
 *   Step 1 — mint an Auth0 access_token from the DEV tenant (the local
 *            cars-api dev_local Doppler config trusts the same tenant and
 *            audience, so dev credentials work unchanged).
 *   Step 2 — POST a new auto-asset file to the LOCAL cars-api.
 *
 * Reads credentials.json (dev block) — no env vars needed.
 *
 * ─── Prereqs ────────────────────────────────────────────────────────────────
 *   - cars-api running locally with the dev_local Doppler config (port 8080)
 *   - local MongoDB seeded with the client company (default 'Bank 3') and the
 *     api_automation user
 *
 * ─── Usage (PowerShell) ─────────────────────────────────────────────────────
 *   npx ts-node scripts/local-create-file.ts
 *
 *   Optional overrides:
 *     $env:LOCAL_API_URL="http://localhost:8080"   # target API
 *     $env:LOCAL_CLIENT_NAME="Bank 3"              # client company in local DB
 */

import * as fs from 'fs';
import * as path from 'path';

const LOCAL_API = process.env.LOCAL_API_URL || 'http://localhost:8080';
const CLIENT_NAME = process.env.LOCAL_CLIENT_NAME || 'Bank 3';
const TOKEN_URL = 'https://auth.dev.carecovery.ca/oauth/token';
// Local cars-api (dev_local Doppler) validates aud against the DEV identifier,
// not localhost — so the token must be minted for dev-api even though requests
// go to LOCAL_API. This is the audience/baseUrl decoupling the real fix needs.
const AUDIENCE = 'https://dev-api.carecovery.ca';

function section(label: string) {
    console.log(`\n${'─'.repeat(72)}`);
    console.log(`  ${label}`);
    console.log('─'.repeat(72));
}

function loadDevCredentials(): { username: string; password: string; clientId: string; clientSecret: string } {
    const credentialsPath = path.resolve(__dirname, '..', 'credentials.json');
    if (!fs.existsSync(credentialsPath)) {
        throw new Error(`credentials.json not found at ${credentialsPath}`);
    }
    const creds = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    const dev = creds.dev;
    const user = dev?.api_automation?.[0];
    if (!user?.username || !user?.password) {
        throw new Error('No dev.api_automation[0] credentials in credentials.json');
    }
    if (!dev.auth0_client_id || !dev.auth0_client_secret) {
        throw new Error('Missing dev.auth0_client_id / dev.auth0_client_secret in credentials.json');
    }
    return {
        username: user.username,
        password: user.password,
        clientId: dev.auth0_client_id,
        clientSecret: dev.auth0_client_secret,
    };
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

function randomAccountNumber(): string {
    return Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
}

async function step1_login(): Promise<string> {
    section('Step 1: Auth0 ROPG token from DEV tenant');
    const { username, password, clientId, clientSecret } = loadDevCredentials();

    console.log(`POST ${TOKEN_URL}`);
    console.log(`  username: ${username}`);
    console.log(`  audience: ${AUDIENCE}`);

    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            grant_type: 'password',
            username,
            password,
            audience: AUDIENCE,
            scope: 'openid profile email',
            client_id: clientId,
            client_secret: clientSecret,
        }),
    });
    const text = await res.text();
    console.log(`  Status:   ${res.status}`);

    if (!res.ok) {
        console.log(`  Response: ${text.slice(0, 600)}`);
        throw new Error(`Token request failed (HTTP ${res.status}) — see scripts/login-and-create-file.ts header for common causes`);
    }

    const json = JSON.parse(text) as { access_token?: string };
    if (!json.access_token) {
        throw new Error('No access_token in Auth0 response');
    }

    const decoded = decodeJwtPayload(json.access_token);
    console.log(`  ✓ access_token acquired (sub: ${decoded?.sub}, aud: ${JSON.stringify(decoded?.aud)})`);
    return json.access_token;
}

async function step2_createFile(token: string): Promise<void> {
    section(`Step 2: Create file on LOCAL cars-api (${LOCAL_API})`);

    const accountNumber = randomAccountNumber();
    const url = `${LOCAL_API}/file/processor/generic/incoming/ingest`;
    const payload = {
        clientName: CLIENT_NAME,
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
                        firstName: 'Local',
                        lastName: 'Smoketest',
                        email: 'local.smoketest@email.com',
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
                noteContent: 'Created by scripts/local-create-file.ts — safe to delete',
            },
        ],
    };

    console.log(`POST ${url}`);
    console.log(`  clientName:    ${CLIENT_NAME}`);
    console.log(`  accountNumber: ${accountNumber}`);

    let res: Response;
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify(payload),
        });
    } catch (err) {
        throw new Error(`Could not reach ${LOCAL_API} — is cars-api running locally? (${(err as Error).message})`);
    }

    const text = await res.text();
    console.log(`  Status:   ${res.status}`);
    console.log(`  Response: ${text.slice(0, 800)}`);

    if (res.ok) {
        console.log(`\n  ✓✓ FILE CREATED on local. accountNumber: ${accountNumber}`);
        console.log('  ➤ Verify in the UI: http://localhost:3000 → search "Local Smoketest"');
        console.log('  ➤ The API approach works — safe to wire local into links.json + apiServices.ts.');
    } else if (res.status === 401) {
        console.log('\n  ➤ 401 — local cars-api rejected the token.');
        console.log('    Check local Doppler: AUTH0_DOMAIN=auth.dev.carecovery.ca, AUTH0_AUDIENCE=https://dev-api.carecovery.ca.');
    } else if (res.status === 403) {
        console.log('\n  ➤ 403 — token valid, but the api_automation user lacks permission in the LOCAL DB.');
        console.log('    The user must exist in local Mongo with the right role (seed from a dev dump).');
    } else {
        console.log(`\n  ➤ Unexpected ${res.status} — likely missing seed data (e.g. client "${CLIENT_NAME}" not in local DB).`);
    }

    if (!res.ok) {
        throw new Error(`File creation failed (HTTP ${res.status})`);
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
