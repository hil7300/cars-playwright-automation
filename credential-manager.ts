import * as fs from 'fs';
import * as path from 'path';

// 1. Define Types for safety
interface UserCredentials {
    username: string;
    password: string;
}

interface EnvironmentConfig {
    [userType: string]: UserCredentials[];
}

interface CredentialsFile {
    [env: string]: EnvironmentConfig;
}

export class CredentialManager {
    // 2. Cache the config so we don't read from disk repeatedly
    private static cachedConfig: CredentialsFile | null = null;

    static getCredentials(userType: string, workerIndex: number): UserCredentials {
        const ENV = process.env.ENV || 'dev';
        let username: string;
        let password: string;

        if (process.env.CI) {
            // CI LOGIC
            const unameKey = `CARS_${ENV.toUpperCase()}_${userType.toUpperCase()}_USERNAME_${workerIndex}`;
            const pwdKey = `CARS_${ENV.toUpperCase()}_${userType.toUpperCase()}_PASSWORD_${workerIndex}`;

            username = process.env[unameKey] || '';
            password = process.env[pwdKey] || '';

            if (!username || !password) {
                throw new Error(`[CI] Missing env vars: ${unameKey} or ${pwdKey}`);
            }
        } else {
            // LOCAL LOGIC
            if (!this.cachedConfig) {
                this.loadLocalCredentials();
            }

            // Safe access because we know cachedConfig is loaded
            const envConfig = this.cachedConfig![ENV];
            if (!envConfig) {
                throw new Error(`[Local] Environment "${ENV}" not found in credentials.json`);
            }

            const userList = envConfig[userType];
            if (!userList || !Array.isArray(userList) || userList.length === 0) {
                throw new Error(`[Local] No users found for type "${userType}" in "${ENV}"`);
            }

            // Modulo operator handles cycling correctly
            const assignedUser = userList[workerIndex % userList.length];
            username = assignedUser.username;
            password = assignedUser.password;
        }

        return { username, password };
    }

    private static loadLocalCredentials() {
        // 3. Use process.cwd() to find file in root, not inside dist/ folder
        const credentialsPath = path.resolve(process.cwd(), 'credentials.json');

        if (!fs.existsSync(credentialsPath)) {
            throw new Error(`[Local] credentials.json not found at ${credentialsPath}`);
        }

        try {
            const raw = fs.readFileSync(credentialsPath, 'utf-8');
            this.cachedConfig = JSON.parse(raw) as CredentialsFile;
        } catch (error) {
            throw new Error(`[Local] Failed to parse credentials.json: ${(error as Error).message}`);
        }
    }
}
