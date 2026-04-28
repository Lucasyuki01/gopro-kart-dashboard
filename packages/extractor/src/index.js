import { program } from 'commander';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync, createReadStream, statSync } from 'fs';
import { resolve, basename, extname } from 'path';
import gpmfExtract from 'gpmf-extract';
import goproTelemetry from 'gopro-telemetry';

program
  .name('kart-extractor')
  .description('Extract GPMF telemetry from GoPro Hero 10 videos')
  .option('-f, --file <path>', 'Path to a single .mp4 file')
  .option('-m, --multi <paths...>', 'Multiple .mp4 files in order')
  .option('-o, --output <path>', 'Output directory', './output')
  .option('--name <name>', 'Output filename (without extension)')
  .option('--streams <streams>', 'Streams to extract: GPS5,ACCL,GYRO', 'GPS5,ACCL,GYRO')
  .option('--smooth <n>', 'GPS data smoothing (0 = disabled)', '1')
  .parse(process.argv);

const opts = program.opts();

function log(msg) {
  process.stdout.write(`[extractor] ${msg}\n`);
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

// Chunk size based on file size — larger files need bigger chunks
function getChunkSize(filePath) {
  const sizeBytes = statSync(filePath).size;
  const sizeGiB = sizeBytes / (1024 ** 3);
  if (sizeGiB > 3) return 30 * 1024 * 1024;  // 30MB chunks for >3GB
  if (sizeGiB > 1) return 15 * 1024 * 1024;  // 15MB chunks for >1GB
  return 5 * 1024 * 1024;                      // 5MB chunks for the rest
}

// Stream-based reading for large files — avoids the mp4box 2 GB limit
function bufferAppender(filePath, chunkSize) {
  return function (mp4boxFile) {
    const stream = createReadStream(filePath, { highWaterMark: chunkSize });
    let bytesRead = 0;

    stream.on('end', () => mp4boxFile.flush());
    stream.on('data', chunk => {
      const arrayBuffer = new Uint8Array(chunk).buffer;
      arrayBuffer.fileStart = bytesRead;
      bytesRead += chunk.length;
      mp4boxFile.appendBuffer(arrayBuffer);
    });
    stream.on('error', err => { throw err; });
  };
}

async function extractOne(filePath) {
  const sizeBytes = statSync(filePath).size;
  const chunkSize = getChunkSize(filePath);
  log(`Reading: ${basename(filePath)} (${formatBytes(sizeBytes)}) — chunks of ${formatBytes(chunkSize)}`);

  const rawData = await gpmfExtract(bufferAppender(filePath, chunkSize));

  if (!rawData || !rawData.rawData?.length) {
    throw new Error(`No GPMF data found in ${basename(filePath)}`);
  }

  log(`  GPMF extracted: ${formatBytes(rawData.rawData.length)}`);
  return rawData;
}

async function extract() {
  const outputDir = resolve(opts.output);
  const streams = opts.streams.split(',').map(s => s.trim());
  const smooth = parseInt(opts.smooth, 10);

  let files = [];
  if (opts.multi) {
    files = opts.multi.map(f => resolve(f));
  } else if (opts.file) {
    files = [resolve(opts.file)];
  } else {
    console.error('Error: provide --file or --multi');
    process.exit(1);
  }

  for (const f of files) {
    if (!existsSync(f)) {
      console.error(`Error: file not found: ${f}`);
      process.exit(1);
    }
    if (extname(f).toLowerCase() !== '.mp4') {
      console.error(`Error: ${f} is not a .mp4 file`);
      process.exit(1);
    }
  }

  log(`${files.length} file(s) to process`);
  log('Extracting GPMF tracks...');

  const extracted = [];
  for (const f of files) {
    try {
      const raw = await extractOne(f);
      extracted.push(raw);
    } catch (err) {
      console.error(`Error processing ${basename(f)}: ${err.message}`);
      process.exit(1);
    }
  }

  log(`Converting streams: ${streams.join(', ')}...`);
  const input = extracted.length === 1 ? extracted[0] : extracted;
  const telemetry = await goproTelemetry(input, {
    stream: streams,
    smooth,
    GPS5Fix: 3,
    removeGaps: true,
  });

  const deviceKey = Object.keys(telemetry)[0];
  if (!deviceKey) {
    console.error('No telemetry stream returned.');
    process.exit(1);
  }

  const device = telemetry[deviceKey];
  const availableStreams = Object.keys(device.streams || {});
  log(`Available streams: ${availableStreams.join(', ')}`);

  const gpsSamples = device.streams?.GPS5?.samples || [];
  const acclSamples = device.streams?.ACCL?.samples || [];
  const gyroSamples = device.streams?.GYRO?.samples || [];

  log(`GPS: ${gpsSamples.length} samples`);
  log(`Accelerometer: ${acclSamples.length} samples`);
  log(`Gyroscope: ${gyroSamples.length} samples`);

  const speeds = gpsSamples.map(s => s.value?.[4] ?? 0).filter(v => v > 0);
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
  const avgSpeed = speeds.length ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

  const output = {
    meta: {
      sourceFiles: files.map(f => basename(f)),
      extractedAt: new Date().toISOString(),
      camera: device.deviceName || 'GoPro Hero 10 Black',
      streamsExtracted: availableStreams,
      stats: {
        gpsSamples: gpsSamples.length,
        acclSamples: acclSamples.length,
        gyroSamples: gyroSamples.length,
        maxSpeedKmh: parseFloat((maxSpeed * 3.6).toFixed(2)),
        avgSpeedKmh: parseFloat((avgSpeed * 3.6).toFixed(2)),
      },
    },
    gps: gpsSamples.map(s => ({
      ts: s.date,
      cts: s.cts,
      lat: s.value?.[0] ?? null,
      lng: s.value?.[1] ?? null,
      alt: s.value?.[2] ?? null,
      speed: s.value?.[4] ?? null,
      speedKmh: s.value?.[4] != null
        ? parseFloat((s.value[4] * 3.6).toFixed(3))
        : null,
    })),
    accl: acclSamples.map(s => ({
      ts: s.date,
      cts: s.cts,
      x: s.value?.[0] ?? null,
      y: s.value?.[1] ?? null,
      z: s.value?.[2] ?? null,
    })),
    gyro: gyroSamples.map(s => ({
      ts: s.date,
      cts: s.cts,
      x: s.value?.[0] ?? null,
      y: s.value?.[1] ?? null,
      z: s.value?.[2] ?? null,
    })),
  };

  await mkdir(outputDir, { recursive: true });

  const outName = opts.name || basename(files[0], extname(files[0])).replace(/^GX\d\d/, 'GX00');
  const outputFile = resolve(outputDir, `${outName}.telemetry.json`);
  await writeFile(outputFile, JSON.stringify(output, null, 2), 'utf-8');

  log('');
  log('─────────────────────────────────────────');
  log('Extraction completed successfully!');
  log(`Output file: ${outputFile}`);
  log('');
  log(`  Camera:          ${output.meta.camera}`);
  log(`  Merged files:    ${files.length}`);
  log(`  GPS samples:     ${output.meta.stats.gpsSamples}`);
  log(`  Max speed:       ${output.meta.stats.maxSpeedKmh} km/h`);
  log(`  Avg speed:       ${output.meta.stats.avgSpeedKmh} km/h`);
  log('─────────────────────────────────────────');
  log('');
  log('Next step:');
  log(`  node packages/analyzer/src/index.js -f ${outputFile}`);
}

extract().catch(err => {
  console.error('[extractor] Unexpected error:', err);
  process.exit(1);
});
