const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

async function createVerifiedBackup() {
  const dbPath = path.join(__dirname, '..', '..', 'college_portal.sqlite');
  const backupsDir = path.join(__dirname, '..', '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `college_portal_backup_${timestamp}.sqlite`;
  const backupFilePath = path.join(backupsDir, backupFileName);

  console.log(`[BACKUP] Starting backup from ${dbPath} to ${backupFilePath}...`);

  // 1. Copy file
  fs.copyFileSync(dbPath, backupFilePath);
  const srcStat = fs.statSync(dbPath);
  const dstStat = fs.statSync(backupFilePath);

  if (srcStat.size !== dstStat.size) {
    throw new Error(`File size mismatch: source is ${srcStat.size} bytes, backup is ${dstStat.size} bytes`);
  }
  console.log(`[BACKUP] File copied successfully. Size: ${dstStat.size} bytes.`);

  // 2. Open backup in read-only mode and run integrity_check
  const backupDb = new sqlite3.Database(backupFilePath, sqlite3.OPEN_READONLY);

  const integrityCheck = await new Promise((resolve, reject) => {
    backupDb.get("PRAGMA integrity_check;", (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.integrity_check : 'unknown');
    });
  });

  if (integrityCheck !== 'ok') {
    throw new Error(`Integrity check failed on backup: ${integrityCheck}`);
  }
  console.log(`[BACKUP] SQLite PRAGMA integrity_check passed: ${integrityCheck}`);

  // 3. Verify table counts match original
  const srcDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

  const getCounts = (db) => new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;", async (err, tables) => {
      if (err) return reject(err);
      const counts = {};
      for (const t of tables) {
        await new Promise((res, rej) => {
          db.get(`SELECT COUNT(*) as cnt FROM "${t.name}"`, (err, row) => {
            if (err) return rej(err);
            counts[t.name] = row ? row.cnt : 0;
            res();
          });
        });
      }
      resolve(counts);
    });
  });

  const srcCounts = await getCounts(srcDb);
  const dstCounts = await getCounts(backupDb);

  srcDb.close();
  backupDb.close();

  // Compare
  const srcKeys = Object.keys(srcCounts).sort();
  const dstKeys = Object.keys(dstCounts).sort();

  if (srcKeys.length !== dstKeys.length) {
    throw new Error(`Table count mismatch: original has ${srcKeys.length}, backup has ${dstKeys.length}`);
  }

  for (const k of srcKeys) {
    if (srcCounts[k] !== dstCounts[k]) {
      throw new Error(`Row count mismatch in table ${k}: original=${srcCounts[k]}, backup=${dstCounts[k]}`);
    }
  }

  console.log(`[BACKUP] All ${srcKeys.length} tables verified with identical record counts!`);
  console.log(`[BACKUP] Verified backup created at: ${backupFilePath}`);
  return { backupFilePath, tableCount: srcKeys.length, counts: srcCounts };
}

if (require.main === module) {
  createVerifiedBackup()
    .then(res => {
      console.log('[BACKUP] SUCCESS!');
      process.exit(0);
    })
    .catch(err => {
      console.error('[BACKUP] FAILED:', err);
      process.exit(1);
    });
}

module.exports = { createVerifiedBackup };
