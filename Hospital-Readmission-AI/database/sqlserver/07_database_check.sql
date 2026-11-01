/* SQL Server Express copy for .\SQLEXPRESS, generated from database/database_check.sql.
   Run with: sqlcmd -S .\SQLEXPRESS -d HospitalReadmissionDB -E -C -I -b -i 07_database_check.sql
   Changes from the original: none. Read only. */

USE HospitalReadmissionDB;
GO

-- Check existing tables
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Check Patients columns
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Patients'
ORDER BY ORDINAL_POSITION;

-- Check Users columns
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Users'
ORDER BY ORDINAL_POSITION;
GO
