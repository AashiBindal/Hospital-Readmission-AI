# Dataset

**Owner:** Member 4

| Folder | Committed? | Contents |
|---|---|---|
| `raw/` | ❌ git-ignored | Original downloaded files. Never commit. |
| `processed/` | ❌ git-ignored | ETL output / training CSVs. |
| `sample/` | ✅ | Tiny **synthetic** files for demos and tests. |

## Rules
- **No real or identifiable patient data in Git — ever.**
- Large files (> a few MB) must not be committed; share via Drive/OneDrive and document the link here.
- Record the source, licence and download date of any dataset you use below.

## `sample/sample_admissions.csv`
5 synthetic rows. Rows 4–5 are **intentionally dirty** for ETL testing: duplicate row, missing age, non-standard gender (`M`), discharge date before admission date, missing label.

## Dataset source (to be filled)
| Field | Value |
|---|---|
| Name | _TBD (e.g. Diabetes 130-US Hospitals, UCI)_ |
| URL | _TBD_ |
| Licence | _TBD_ |
| Downloaded | _TBD_ |
| Target column | _TBD (30-day readmission flag)_ |
