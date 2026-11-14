import * as dotenv from 'dotenv';

import * as path from 'path';

// Load .env and .env.test if present
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.test'), override: true });

export interface E2EUserCredential {
  email: string;
  password: string;
  label: string;
}

export const envConfig = {
  backendUrl: process.env.BACKEND_API_URL || 'http://localhost:3000',
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@maraekat.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'Admin@12345',
    label: 'Fixed Admin',
  },
  hoStaff: {
    email: process.env.E2E_HO_EMAIL || 'ho@maraekat.com',
    password: process.env.E2E_HO_PASSWORD || 'Ho@12345',
    label: 'Fixed HO Staff',
  },
  dynamicUsers: [
    process.env.E2E_USER_1_EMAIL
      ? {
          email: process.env.E2E_USER_1_EMAIL,
          password: process.env.E2E_USER_1_PASSWORD || '',
          label: 'Dynamic User 1',
        }
      : null,
    process.env.E2E_USER_2_EMAIL
      ? {
          email: process.env.E2E_USER_2_EMAIL,
          password: process.env.E2E_USER_2_PASSWORD || '',
          label: 'Dynamic User 2',
        }
      : null,
    process.env.E2E_USER_3_EMAIL
      ? {
          email: process.env.E2E_USER_3_EMAIL,
          password: process.env.E2E_USER_3_PASSWORD || '',
          label: 'Dynamic User 3',
        }
      : null,
    process.env.E2E_USER_4_EMAIL
      ? {
          email: process.env.E2E_USER_4_EMAIL,
          password: process.env.E2E_USER_4_PASSWORD || '',
          label: 'Dynamic User 4',
        }
      : null,
    process.env.E2E_USER_5_EMAIL
      ? {
          email: process.env.E2E_USER_5_EMAIL,
          password: process.env.E2E_USER_5_PASSWORD || '',
          label: 'Dynamic User 5',
        }
      : null,
  ].filter(Boolean) as E2EUserCredential[],
};

