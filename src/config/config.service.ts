import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  get(key: string): string {
    const value = process.env[key];
    if (value === undefined) {
      throw new Error(`Environment variable ${key} is not defined`);
    }
    return value;
  }

  getOptional(key: string): string | undefined {
    return process.env[key];
  }


  getNumber(key: string): number {
    const value = this.get(key);
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Environment variable ${key} is not a valid number`);
    }
    return parsed;
  }

  getBoolean(key: string): boolean {
    const value = this.get(key);
    return value.toLowerCase() === 'true';
  }

  getOptionalBoolean(key: string): boolean | undefined {
    const value = process.env[key];
    if (value === undefined) {
      return undefined;
    }
    return value.toLowerCase() === 'true';
  }

  get port(): number {
    const p = this.getOptional('PORT');
    return p ? parseInt(p, 10) : 3000;
  }

  get database() {
    const sslEnabled = this.getOptionalBoolean('DB_SSL') === true;
    return {
      host: this.get('DB_HOST'),
      transactionHost: this.getOptional('DB2_HOST') || this.getOptional('DB_HOST2') || this.get('DB_HOST'),
      port: this.getNumber('DB_PORT'),
      username: this.get('DB_USERNAME'),
      password: this.get('DB_PASSWORD'),
      database: this.get('DB_DATABASE'),
      database2: this.getOptional('DB2_DATABASE') || this.getOptional('DB_DATABASE2') || this.get('DB_DATABASE'),
      transactionDatabase: this.getOptional('DB2_DATABASE') || this.getOptional('DB_DATABASE2') || this.get('DB_DATABASE'),
      synchronize: this.getBoolean('DB_SYNCHRONIZE') || false,
      migrationsRun: this.getBoolean('DB_MIGRATIONS_RUN') || true,
      ssl: sslEnabled
        ? { rejectUnauthorized: this.getOptionalBoolean('DB_SSL_REJECT_UNAUTHORIZED') !== false }
        : false,
    };
  }

  get database2() {
    const sslEnabled = this.getOptionalBoolean('DB2_SSL') === true || this.getOptionalBoolean('DB_SSL') === true;
    const portVal = this.getOptional('DB2_PORT') || this.getOptional('DB_PORT');
    return {
      host: this.getOptional('DB2_HOST') || this.getOptional('DB_HOST2') || this.get('DB_HOST'),
      port: portVal ? parseInt(portVal, 10) : 5432,
      username: this.getOptional('DB2_USERNAME') || this.get('DB_USERNAME'),
      password: this.getOptional('DB2_PASSWORD') || this.get('DB_PASSWORD'),
      database: this.getOptional('DB2_DATABASE') || this.getOptional('DB_DATABASE2') || this.get('DB_DATABASE'),
      ssl: sslEnabled
        ? { rejectUnauthorized: this.getOptionalBoolean('DB2_SSL_REJECT_UNAUTHORIZED') !== false }
        : false,
    };
  }
}
