#!/usr/bin/env node
/**
 * OTA release script — publishes a new JS bundle so it reaches users without a
 * Play Store build.
 *
 * What it does:
 *   1. Works out the next OTA version (current published version + 1).
 *   2. Builds a production Android JS bundle (`react-native bundle --dev false`).
 *   3. Compiles it to Hermes bytecode (the app ships with Hermes enabled).
 *   4. Zips it in the parent-folder layout the native module expects.
 *   5. Uploads the zip + an updated `update.json` manifest to S3.
 *   6. Invalidates the manifest on CloudFront so devices see it immediately.
 *
 * Usage:  yarn ota:release            (auto-bumps version)
 *         yarn ota:release --mandatory  (forces an immediate restart on devices)
 *
 * Prereqs: AWS CLI configured with write access to the bucket below, and the
 * project already built once with react-native-ota-hot-update wired in.
 *
 * IMPORTANT: this only ships JS/asset changes. Anything touching native code
 * (new native modules, permissions, app icon/name) needs a real Play Store
 * build — bump versionCode/versionName and constant.OTA_BASELINE_VERSION too.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

// ---- Config (matches the existing superlms AWS setup) -----------------------
const S3_BUCKET = 'superlms-media-540361297670';
const S3_REGION = 'ap-south-1';
const S3_PREFIX = 'ota/android';
const CDN_BASE = 'https://cdn.superlms.in/ota/android';
const CLOUDFRONT_DISTRIBUTION_ID = 'E39TLU8ROCRGZ6';
const MANIFEST_URL = `${CDN_BASE}/update.json`;
// Must match `constant.OTA_BASELINE_VERSION` in the app. When nothing is
// published yet, the first release becomes baseline+1 so it actually reaches
// devices already running the baseline JS baked into the installed build.
const OTA_BASELINE_VERSION = 1;
// -----------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist-ota');
const BUNDLE_DIR = join(DIST, 'bundle'); // becomes the parent folder inside the zip
const BUNDLE_FILE = join(BUNDLE_DIR, 'index.android.bundle');

const MANDATORY = process.argv.includes('--mandatory');

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...opts });
}

function hermescPath() {
  const platform = os.platform();
  const dir =
    platform === 'win32'
      ? 'win64-bin'
      : platform === 'darwin'
        ? 'osx-bin'
        : 'linux64-bin';
  const exe = platform === 'win32' ? 'hermesc.exe' : 'hermesc';
  const p = join(ROOT, 'node_modules', 'hermes-compiler', 'hermesc', dir, exe);
  if (!existsSync(p)) {
    throw new Error(`hermesc not found at ${p} — check the hermes-compiler package layout for this OS.`);
  }
  return p;
}

async function getPublishedVersion() {
  try {
    const res = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data?.version) || 0;
  } catch {
    return 0; // no manifest yet → this is the first release
  }
}

async function main() {
  // Fall back to the baseline so the very first release lands as baseline+1
  // (reaching devices already running the baked-in baseline bundle).
  const published = (await getPublishedVersion()) || OTA_BASELINE_VERSION;
  const nextVersion = published + 1;
  const zipName = `bundle-v${nextVersion}.zip`;
  const zipPath = join(DIST, zipName);

  console.log(`\n=== OTA release ===`);
  console.log(`Currently published : v${published || '(none)'}`);
  console.log(`Publishing          : v${nextVersion}${MANDATORY ? ' (mandatory)' : ''}`);

  // Clean workspace
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(BUNDLE_DIR, { recursive: true });

  // 1) Build the production JS bundle + assets
  run(
    `npx react-native bundle --platform android --dev false ` +
      `--entry-file index.js ` +
      `--bundle-output "${BUNDLE_FILE}" ` +
      `--assets-dest "${BUNDLE_DIR}"`,
  );

  // 2) Compile to Hermes bytecode, then swap it in under the same filename so
  //    the native loader (getJSBundleFile) picks it up transparently.
  const hbc = `${BUNDLE_FILE}.hbc`;
  run(`"${hermescPath()}" -emit-binary -w -O -out "${hbc}" "${BUNDLE_FILE}"`);
  rmSync(BUNDLE_FILE, { force: true });
  renameSync(hbc, BUNDLE_FILE);

  // 3) Zip with the required parent-folder layout: bundle/index.android.bundle + bundle/assets
  //    PowerShell Compress-Archive keeps the top-level folder inside the archive.
  rmSync(zipPath, { force: true });
  run(
    `powershell -NoProfile -Command "Compress-Archive -Path '${BUNDLE_DIR}' -DestinationPath '${zipPath}' -Force"`,
  );

  // 4) Write the manifest
  const manifest = {
    version: nextVersion,
    downloadAndroidUrl: `${CDN_BASE}/${zipName}`,
    mandatory: MANDATORY,
    releasedAt: new Date().toISOString(),
  };
  const manifestPath = join(DIST, 'update.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // 5) Upload bundle (immutable, long cache) then manifest (no cache)
  run(
    `aws s3 cp "${zipPath}" "s3://${S3_BUCKET}/${S3_PREFIX}/${zipName}" ` +
      `--region ${S3_REGION} --content-type application/zip ` +
      `--cache-control "public, max-age=31536000, immutable"`,
  );
  run(
    `aws s3 cp "${manifestPath}" "s3://${S3_BUCKET}/${S3_PREFIX}/update.json" ` +
      `--region ${S3_REGION} --content-type application/json ` +
      `--cache-control "no-cache, max-age=0"`,
  );

  // 6) Invalidate the manifest on CloudFront so devices see it right away
  run(
    `aws cloudfront create-invalidation ` +
      `--distribution-id ${CLOUDFRONT_DISTRIBUTION_ID} ` +
      `--paths "/${S3_PREFIX}/update.json"`,
  );

  console.log(`\n✅ Published OTA v${nextVersion}`);
  console.log(`   Manifest: ${MANIFEST_URL}`);
  console.log(`   Bundle  : ${CDN_BASE}/${zipName}`);
  console.log(`   Devices on an older version will pick it up on next app open.`);
}

main().catch((err) => {
  console.error('\n❌ OTA release failed:', err.message);
  process.exit(1);
});
