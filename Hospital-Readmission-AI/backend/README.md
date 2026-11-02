# MediSight backend (Spring Boot 3.3.5, Java 17)

REST API on `http://localhost:8080/api` for the React frontend. Data lives in the existing SQL Server
database `HospitalReadmissionDB`; this service never creates, drops or alters tables.

## Requirements
* JDK 17+ and Maven 3.9+
* SQL Server with `database/schema.sql` installed **and** `database/migrations/002_backend_integration.sql` applied
* For predictions: the FastAPI `ml-service` with a trained model (without it, `POST /predictions` returns 503)
* For automatic dataset loading: the project's Python `etl/` (optional)

## Configure
```powershell
cd backend
copy .env.example .env      # then edit .env
```
Required: `DB_URL` (+ `DB_USERNAME`/`DB_PASSWORD`, or Windows authentication) and `JWT_SECRET` (≥ 32 chars).
The application refuses to start without `JWT_SECRET`, without a database connection, or when the columns of
migration 002 are missing (the log names the script to run).

### Connecting to SQL Server Express
JDBC connects over TCP, so on a default SQL Express install:
1. *SQL Server Configuration Manager* → *SQL Server Network Configuration* → *Protocols for SQLEXPRESS* → enable **TCP/IP**, restart the service.
2. Either start the **SQL Server Browser** service (for `instanceName=SQLEXPRESS` in `DB_URL`), or set a fixed port under TCP/IP → IP Addresses → IPAll and use `jdbc:sqlserver://localhost:<port>;...`.
3. Authentication, choose one:
   * **SQL login (simplest for Java)**: enable *SQL Server and Windows Authentication mode* (server properties → Security), restart, then as an administrator run (choose your own password):
     ```sql
     CREATE LOGIN medisight_app WITH PASSWORD = '<strong password>';
     USE HospitalReadmissionDB;
     CREATE USER medisight_app FOR LOGIN medisight_app;
     ALTER ROLE db_datareader ADD MEMBER medisight_app;
     ALTER ROLE db_datawriter ADD MEMBER medisight_app;
     ```
     and put `DB_USERNAME=medisight_app`, `DB_PASSWORD=...` in `.env`.
   * **Windows authentication**: append `;integratedSecurity=true` to `DB_URL`, leave user/password empty and put
     `mssql-jdbc_auth-<version>.x64.dll` (from the Microsoft JDBC driver download matching the `mssql-jdbc`
     version Maven resolves) on `java.library.path`.

### First account
Register a Doctor or Nurse on the `/register` page, or create the first **Admin** once by setting
`ADMIN_EMAIL` / `ADMIN_PASSWORD` (≥ 12 chars) before starting; remove the password afterwards.

## Run / build / test
```powershell
mvn spring-boot:run          # http://localhost:8080/api/health
mvn test                     # unit tests (no database needed)
mvn clean package            # target/hospital-readmission-backend-0.2.0-SNAPSHOT.jar
```

## Packages (`com.hospital`)
| Package | Contents |
|---|---|
| `config` | `AppProperties` (app.*), `SecurityConfig` (JWT, CORS, roles), `StartupChecks` (schema check, admin bootstrap), `RestClientConfig`, `AsyncConfig` (ETL worker), `JacksonConfig` (UTC timestamps) |
| `security` | `JwtService` (HS256, JDK crypto), `JwtAuthenticationFilter`, `Role`, `CurrentUser`, JSON 401/403 handlers |
| `controller` | auth, patients, predictions, follow-ups, notifications, uploads, dashboard, analytics, reference, users, health |
| `service` | business rules; `MlServiceClient` (FastAPI), `EtlRunner` (Python ETL) |
| `repository` | `NamedParameterJdbcTemplate` repositories, one per table group; all SQL is parameterised |
| `dto` | request/response records with Bean Validation |
| `exception` | `ApiException`, `ApiError`, `GlobalExceptionHandler` |
| `util` | ICD-9 categories, risk-level conversion, SQL helpers |

Endpoint reference: `../docs/API_INTEGRATION.md`.
