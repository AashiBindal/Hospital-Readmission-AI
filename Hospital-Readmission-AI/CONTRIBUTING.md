# Contributing

Thanks for contributing to **Hospital-Readmission-AI**. This guide applies to all four team members.

## Ground rules
1. **Never commit secrets.** `.env`, `application.properties`, passwords, API keys and connection strings stay local. Only `*.example` templates are committed.
2. **Never commit real patient data.** Use synthetic or de-identified data only. Raw datasets go in `dataset/raw/` (git-ignored).
3. **Never commit large binaries** (datasets, `.joblib`/`.pkl` models, `node_modules/`, `target/`, `.venv/`).
4. **Stay in your folder.** Change files outside your owned folder only via a PR the owner reviews (see [docs/team_workflow.md](docs/team_workflow.md)).
5. **Never push directly to `main`.** All changes reach `main` through Pull Requests.

## Branches
| Branch | Owner | Folder(s) |
|---|---|---|
| `main` | everyone (protected) | integration branch |
| `frontend` | Member 1 | `frontend/` |
| `backend-java` | Member 2 | `backend-java/` |
| `ml-service` | Member 3 | `ml-service/` |
| `etl-database` | Member 4 | `etl/`, `database/`, `dataset/` |

Short-lived feature branches are welcome: `frontend/feature-login`, `ml-service/train-baseline`, then PR into your service branch or directly into `main`.

## Commit messages
Use [Conventional Commits](https://www.conventionalcommits.org/):
```
feat(frontend): add patients table
fix(backend): handle null discharge date
docs: update api documentation
chore(etl): add pyodbc to requirements
```

## Pull Requests
- Fill in the PR template checklist.
- Keep PRs small and focused on one service.
- At least **one** teammate reviews before merge.
- If you change an API contract, update `docs/api_documentation.md` in the same PR.
- If you change the schema, update `database/` and `docs/database_design.md` in the same PR.

## Code style
| Service | Style |
|---|---|
| Frontend | TypeScript strict, functional components, Tailwind utility classes, `@/` import alias |
| Backend | Standard Java conventions, constructor injection, DTOs at API boundary |
| Python | PEP 8, type hints, docstrings on public functions |
| SQL | `dbo.` schema prefix, PascalCase table/column names, named constraints |

## Reporting issues
Use the GitHub issue templates (Bug report / Feature request). Strip patient data and credentials from any logs you paste.
