#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';

dotenv.config({
  path: path.join(process.cwd(), '.env.local'),
});

async function loadCircleSdk() {
  try {
    return await import('@circle-fin/developer-controlled-wallets');
  } catch (error) {
    console.error(
      '[circle:register-secret] Missing dependency "@circle-fin/developer-controlled-wallets". Install it with:\n  npm install @circle-fin/developer-controlled-wallets'
    );
    throw error;
  }
}

async function ensureDirExists(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

async function main() {
  const circleApiKey = process.env.CIRCLE_API_KEY;
  if (!circleApiKey) {
    console.error('[circle:register-secret] Set CIRCLE_API_KEY in your environment first.');
    process.exit(1);
  }

  const recoveryDir =
    process.env.CIRCLE_ENTITY_SECRET_RECOVERY_DIR ||
    path.join(process.cwd(), 'circle-entity-secret-backups');
  await ensureDirExists(recoveryDir);

  const { registerEntitySecretCiphertext } = await loadCircleSdk();
  const entitySecret = randomBytes(32).toString('hex');
  console.log('[circle:register-secret] Generated entity secret (copy this somewhere safe):');
  console.log(entitySecret);

  console.log('[circle:register-secret] Registering secret with Circle…');
  const response = await registerEntitySecretCiphertext({
    apiKey: circleApiKey,
    entitySecret,
    recoveryFileDownloadPath: recoveryDir,
  });

  if (!response?.data?.recoveryFile) {
    console.warn('[circle:register-secret] Circle did not return a recovery file. Check the console for details.');
  } else {
    const recoveryFilePath = path.join(
      recoveryDir,
      `circle-entity-secret-${Date.now()}.json`
    );
    await fs.writeFile(recoveryFilePath, response.data.recoveryFile, 'utf8');
    console.log('[circle:register-secret] ✅ Registered! Recovery file saved to:');
    console.log(`  ${recoveryFilePath}`);
  }

  console.log(
    '[circle:register-secret] Add this to your .env.local (do NOT commit it):\n' +
      `  CIRCLE_ENTITY_SECRET=${entitySecret}\n`
  );
}

main().catch((error) => {
  console.error('[circle:register-secret] Failed:', error?.message || error);
  process.exit(1);
});
