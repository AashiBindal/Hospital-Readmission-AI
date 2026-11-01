# Backend — Spring Boot

**Owner:** Member 2 · **Branch:** `backend-java` · **Port:** 8080 · **Context path:** `/api`

## Stack
Java 17, Spring Boot 3.3, Maven, Spring Web, Spring Data JPA, Spring Security, Bean Validation, Microsoft SQL Server JDBC driver.

## Setup
```bash
cd backend-java
cp src/main/resources/application.properties.example src/main/resources/application.properties
# Provide credentials as environment variables (recommended):
export DB_USERNAME=your_username DB_PASSWORD=your_password   # Windows: set DB_USERNAME=...
mvn spring-boot:run
```
Check: `curl http://localhost:8080/api/health`

### Run without SQL Server (health check only)
```bash
mvn spring-boot:run -Dspring-boot.run.profiles=nodb
```
The `nodb` profile disables DataSource/JPA auto-configuration so you can work on controllers before the DB is ready.

### Tests
```bash
mvn test        # HealthControllerTest — no DB needed
```

## Configuration
`application.properties` (git-ignored) reads everything from environment variables:

| Env var | Default | Purpose |
|---|---|---|
| `DB_HOST` | localhost | SQL Server host |
| `DB_PORT` | 1433 | SQL Server port |
| `DB_NAME` | HospitalReadmissionDB | Database |
| `DB_USERNAME` | — | **required** |
| `DB_PASSWORD` | — | **required** |
| `ML_SERVICE_URL` | http://localhost:8000 | FastAPI base URL |
| `FRONTEND_URL` | http://localhost:5173 | Allowed CORS origin |
| `BACKEND_PORT` | 8080 | Server port |

`spring.jpa.hibernate.ddl-auto=none` — the schema is owned by `database/schema.sql`.

## Packages (`com.hospital`)
| Package | Contents |
|---|---|
| `config` | `AppProperties`, `CorsConfig`, `SecurityConfig` (permit-all placeholder), `RestClientConfig` (ML client) |
| `controller` | `HealthController` (`/health`, `/health/ml`) |
| `service` | `MlServiceClient` |
| `repository` | `PatientRepository` (example) |
| `entity` | `Patient` (example mapping) |
| `dto` | `HealthResponse` |
| `exception` | `GlobalExceptionHandler`, `ResourceNotFoundException` |

## Endpoints (scaffold)
| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Backend liveness |
| GET | `/api/health/ml` | Backend → ML service connectivity (`UP`/`DOWN`) |

## TODO (Member 2)
- Remaining entities/repositories matching `database/schema.sql`
- CRUD controllers per `docs/api_documentation.md`
- JWT authentication and role-based authorisation (**SecurityConfig currently permits all requests**)
- Call `/ml/predict` and persist `Predictions`
