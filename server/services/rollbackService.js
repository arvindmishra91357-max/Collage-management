const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function restoreFromBackup(backupFilePath) {
  const dbPath = path.join(__dirname, '..', '..', 'college_portal.sqlite');
  if (!fs.existsSync(backupFilePath)) {
    throw new Error(`Backup file does not exist: ${backupFilePath}`);
  }

  console.log(`[ROLLBACK] Verifying backup file before restoration: ${backupFilePath}`);
  // Check backup integrity
  const backupDb = new sqlite3.Database(backupFilePath, sqlite3.OPEN_READONLY);
  const check = await new Promise((resolve, reject) => {
    backupDb.get("PRAGMA integrity_check;", (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.integrity_check : 'unknown');
    });
  });
  backupDb.close();

  if (check !== 'ok') {
    throw new Error(`Cannot restore! Backup failed integrity check: ${check}`);
  }

  console.log(`[ROLLBACK] Backup integrity verified (ok). Restoring to ${dbPath}...`);
  fs.copyFileSync(backupFilePath, dbPath);
  console.log(`[ROLLBACK] Restoration completed successfully.`);
}

if (require.main === module) {
  const backupArg = process.argv[2];
  if (!backupArg) {
    console.error('Usage: node rollbackService.js <path-to-backup-sqlite>');
    process.exit(1);
  }
  restoreFromBackup(backupArg)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[ROLLBACK] FAILED:', err.message);
      process.exit(1);
    });
}

module.exports = { restoreFromBackup };
