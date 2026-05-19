# NestJS TypeORM PostgreSQL Backend

A modern NestJS backend application with TypeORM and PostgreSQL, configured with migration-based database management.

## Prerequisites

- Node.js (v18 or higher)
- pnpm package manager
- PostgreSQL database

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd maraekat
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure your `.env` file with your PostgreSQL credentials:
```env
# Application
PORT=3000

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=your_username
DB_PASSWORD=your_password
DB_DATABASE=your_database
DB_SYNCHRONIZE=false
DB_MIGRATIONS_RUN=true
```

## Database Setup

### Create Database
Create a PostgreSQL database with the name you specified in the `.env` file.

### Migration Management
This project uses TypeORM migrations for database schema management. **Auto-sync is disabled** by default to ensure database changes are tracked through migrations.

### Available Migration Scripts

- **Create a new migration:**
```bash
pnpm run migration:create -- --name MigrationName
```

- **Generate migration from entity changes:**
```bash
pnpm run migration:generate -- --name MigrationName
```

- **Run pending migrations:**
```bash
pnpm run migration:run
```

- **Revert last migration:**
```bash
pnpm run migration:revert
```

### Database Schema Commands

- **Sync schema (use with caution):**
```bash
pnpm run schema:sync
```

- **Drop all tables:**
```bash
pnpm run schema:drop
```

## Running the Application

### Development Mode
```bash
pnpm run start:dev
```

### Production Mode
```bash
pnpm run build
pnpm run start:prod
```

### Debug Mode
```bash
pnpm run start:debug
```

## API Documentation

This application includes **Swagger API documentation** for easy testing and exploration of endpoints.

### Accessing Swagger UI

Once the application is running, you can access the interactive API documentation at:

```
http://localhost:3000/api
```

### Features

- **Interactive API Testing**: Test all endpoints directly from your browser
- **Authentication Support**: Session-based authentication with cookie handling
- **Request/Response Examples**: Clear examples for all request bodies and responses
- **Schema Documentation**: Detailed data models and validation rules

### Authentication in Swagger

For protected endpoints (those requiring authentication):

1. First, use the `/auth/login` endpoint to authenticate
2. The session cookie will be automatically stored and used for subsequent requests
3. Protected endpoints are marked with a padlock icon 🔒

### Available Endpoints

#### Authentication (`/auth`)
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login and create session
- `POST /auth/logout` - Logout and destroy session
- `GET /auth/me` - Get current authenticated user 🔒
- `GET /auth/check` - Check authentication status

#### Users (`/users`)
- `POST /users/register` - Register a new user (alternative endpoint)
- `GET /users/profile` - Get user profile 🔒
- `GET /users/me` - Get current user information 🔒

🔒 = Requires authentication

## Project Structure

```
src/
├── config/
│   ├── config.module.ts      # Global configuration module
│   └── config.service.ts     # Environment variables handler
├── database/
│   ├── data-source.ts        # TypeORM data source for migrations
│   └── database.module.ts    # Database module configuration
├── migrations/               # Database migration files
├── users/
│   └── user.entity.ts       # Example entity
├── app.module.ts            # Main application module
└── main.ts                  # Application entry point
```

## Configuration Service

The `ConfigService` provides a centralized way to access environment variables:

```typescript
import { ConfigService } from './config/config.service';

// In your constructor
constructor(private configService: ConfigService) {}

// Usage
const dbHost = this.configService.database.host;
const port = this.configService.port;
```

## Available Scripts

- `pnpm run build` - Build the application
- `pnpm run start` - Start the application
- `pnpm run start:dev` - Start in development mode with hot reload
- `pnpm run start:debug` - Start in debug mode
- `pnpm run start:prod` - Start production build
- `pnpm run lint` - Run ESLint
- `pnpm run test` - Run unit tests
- `pnpm run test:watch` - Run tests in watch mode
- `pnpm run test:cov` - Run tests with coverage

## Database Migration Workflow

1. **Create/Update Entities** - Modify your entity files in `src/`
2. **Generate Migration** - Run `pnpm run migration:generate -- --name DescribeYourChanges`
3. **Review Migration** - Check the generated migration file in `src/migrations/`
4. **Run Migration** - Execute `pnpm run migration:run`
5. **Commit Changes** - Commit both entity and migration files

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Application port | 3000 |
| DB_HOST | PostgreSQL host | localhost |
| DB_PORT | PostgreSQL port | 5432 |
| DB_USERNAME | PostgreSQL username | - |
| DB_PASSWORD | PostgreSQL password | - |
| DB_DATABASE | PostgreSQL database name | - |
| DB_SYNCHRONIZE | Auto-sync database schema | false |
| DB_MIGRATIONS_RUN | Automatically run migrations on startup | true |

## Best Practices

- Always use migrations for database schema changes
- Keep `DB_SYNCHRONIZE=false` in production
- Review generated migrations before running them
- Use descriptive migration names
- Test migrations in development before applying to production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add migrations if database schema is modified
5. Test your changes
6. Submit a pull request

## License

This project is licensed under the ISC License.
# maraekat-backend
