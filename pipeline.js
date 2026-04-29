#!/usr/bin/env node
/**
 * Full pipeline: MP4 → telemetry.json → session.json → dashboard/public/session.json
 *
 * Usage:
 *   node pipeline.js                          # auto-detect all .mp4 in input/
 *   node pipeline.js -f input/video.mp4
 *   node pipeline.js -m input/GX01.mp4 input/GX02.mp4 --name session_name
 *   node pipeline.js --start-lat -30.123 --start-lng -50.456
 */

import { program } from 'commander';
import { spawnSync } from 'child_process';
import { readdirSync, copyFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { resolve, basename, extname, join } from 'path';

program
  .name('pipeline')
  .description('End-to-end pipeline: MP4 → extract → analyze → copy to dashboard')
  .option('-f, --file <path>', 'Single MP4 file (omit to auto-detect from input/)')
  .option('-m, --multi <paths...>', 'Multiple MP4 files to merge')
  .option('-o, --output <path>', 'Output directory', './output')
  .option('--name <name>', 'Output filename stem')
  .option('--start-lat <lat>', 'Start line latitude (auto-detected from first GPS point if omitted)')
  .option('--start-lng <lng>', 'Start line longitude (auto-detected from first GPS point if omitted)')
  .option('--start-radius <m>', 'Detection radius in meters', '15')
  .option('--min-lap <s>', 'Minimum lap time in seconds', '30')
  .option('--sectors <n>', 'Number of sectors per lap', '3')
  .option('--streams <list>', 'GPMF streams to extract', 'GPS5,ACCL,GYRO')
  .option('--smooth <n>', 'GPS smoothing passes', '1')
  .parse(process.argv);

const opts = program.opts();
const ROOT = new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const DASHBOARD_PUBLIC = join(ROOT, 'packages', 'dashboard', 'public');

function log(msg) {
  process.stdout.write(`[pipeline] ${msg}\n`);
}

function step(title) {
  log('');
  log(`${'─'.repeat(45)}`);
  log(`  ${title}`);
  log(`${'─'.repeat(45)}`);
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    log(`Error: command failed (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

function resolveInputFiles() {
  if (opts.multi) return opts.multi.map(f => resolve(f));
  if (opts.file) return [resolve(opts.file)];

  const inputDir = resolve('./input');
  if (!existsSync(inputDir)) {
    log('Error: no --file/--multi provided and ./input/ directory does not exist.');
    process.exit(1);
  }

  const mp4s = readdirSync(inputDir)
    .filter(f => extname(f).toLowerCase() === '.mp4')
    .map(f => join(inputDir, f))
    .sort();

  if (mp4s.length === 0) {
    log('Error: no .mp4 files found in ./input/');
    process.exit(1);
  }

  log(`Auto-detected ${mp4s.length} file(s) in ./input/:`);
  mp4s.forEach(f => log(`  ${basename(f)}`));
  return mp4s;
}

function buildExtractorArgs(files, outputName) {
  const args = [
    '--workspace=packages/extractor', 'run', 'extract', '--',
    '--output', resolve(opts.output),
    '--streams', opts.streams,
    '--smooth', opts.smooth,
  ];
  if (outputName) args.push('--name', outputName);
  if (files.length === 1) {
    args.push('--file', files[0]);
  } else {
    args.push('--multi', ...files);
  }
  return args;
}

function deriveOutputName(files) {
  if (opts.name) return opts.name;
  const first = basename(files[0], extname(files[0]));
  // GX010249 → GX000249 (matches extractor default naming)
  return first.replace(/^GX\d\d/, 'GX00');
}

function autoDetectStartCoords(telemetryFile) {
  log('Auto-detecting start line from first GPS point...');
  const raw = JSON.parse(readFileSync(telemetryFile, 'utf-8'));
  const firstPoint = raw.gps?.find(p => p.lat != null && p.lng != null);
  if (!firstPoint) {
    log('Error: no valid GPS points found in telemetry file.');
    process.exit(1);
  }
  log(`  → lat: ${firstPoint.lat.toFixed(6)}, lng: ${firstPoint.lng.toFixed(6)}`);
  return { lat: firstPoint.lat, lng: firstPoint.lng };
}

function buildAnalyzerArgs(telemetryFile, startLat, startLng) {
  return [
    '--workspace=packages/analyzer', 'run', 'analyze', '--',
    '--file', telemetryFile,
    '--output', resolve(opts.output),
    '--start-lat', String(startLat),
    '--start-lng', String(startLng),
    '--start-radius', opts.startRadius,
    '--min-lap', opts.minLap,
    '--sectors', opts.sectors,
  ];
}

async function main() {
  log('Starting full pipeline...');

  // ── Step 1: Resolve input files ──────────────────────────────────────────
  step('Step 1/3 — Extracting telemetry');
  const files = resolveInputFiles();
  const outputName = deriveOutputName(files);
  const outputDir = resolve(opts.output);
  const telemetryFile = join(outputDir, `${outputName}.telemetry.json`);

  run('npm', buildExtractorArgs(files, outputName));

  // ── Step 2: Analyze ───────────────────────────────────────────────────────
  step('Step 2/3 — Analyzing laps');

  let startLat, startLng;
  if (opts.startLat && opts.startLng) {
    startLat = parseFloat(opts.startLat);
    startLng = parseFloat(opts.startLng);
    log(`Using provided coordinates: ${startLat.toFixed(6)}, ${startLng.toFixed(6)}`);
  } else {
    ({ lat: startLat, lng: startLng } = autoDetectStartCoords(telemetryFile));
  }

  run('npm', buildAnalyzerArgs(telemetryFile, startLat, startLng));

  // ── Step 3: Copy to dashboard ─────────────────────────────────────────────
  step('Step 3/3 — Publishing to dashboard');

  const sessionFile = join(outputDir, `${outputName}.session.json`);
  const destination = join(DASHBOARD_PUBLIC, 'session.json');

  if (!existsSync(sessionFile)) {
    log(`Error: expected session file not found: ${sessionFile}`);
    process.exit(1);
  }

  mkdirSync(DASHBOARD_PUBLIC, { recursive: true });
  copyFileSync(sessionFile, destination);
  log(`Copied → ${destination}`);

  // ── Done ──────────────────────────────────────────────────────────────────
  log('');
  log('═'.repeat(45));
  log('  Pipeline complete! Run the dashboard with:');
  log('  npm run dashboard');
  log('═'.repeat(45));
  log('');
}

main().catch(err => {
  log(`Unexpected error: ${err.message}`);
  process.exit(1);
});
