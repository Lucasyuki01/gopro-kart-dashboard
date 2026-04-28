import { program } from 'commander';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync, createReadStream, statSync } from 'fs';
import { resolve, basename, extname } from 'path';
import gpmfExtract from 'gpmf-extract';
import goproTelemetry from 'gopro-telemetry';

program
  .name('kart-extractor')
  .description('Extrai telemetria GPMF de vídeos GoPro Hero 10')
  .option('-f, --file <path>', 'Caminho para um único arquivo .mp4')
  .option('-m, --multi <paths...>', 'Múltiplos arquivos .mp4 em ordem')
  .option('-o, --output <path>', 'Pasta de saída', './output')
  .option('--name <name>', 'Nome do arquivo de saída (sem extensão)')
  .option('--streams <streams>', 'Streams a extrair: GPS5,ACCL,GYRO', 'GPS5,ACCL,GYRO')
  .option('--smooth <n>', 'Suavização de dados GPS (0 = desligado)', '1')
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

// Chunk size baseado no tamanho do arquivo — arquivos maiores precisam de chunks maiores
function getChunkSize(filePath) {
  const sizeBytes = statSync(filePath).size;
  const sizeGiB = sizeBytes / (1024 ** 3);
  if (sizeGiB > 3) return 30 * 1024 * 1024;  // 30MB chunks para >3GB
  if (sizeGiB > 1) return 15 * 1024 * 1024;  // 15MB chunks para >1GB
  return 5 * 1024 * 1024;                      // 5MB chunks para o resto
}

// Leitura por stream para arquivos grandes — evita o limite de 2GB do mp4box
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
  log(`Lendo: ${basename(filePath)} (${formatBytes(sizeBytes)}) — chunks de ${formatBytes(chunkSize)}`);

  const rawData = await gpmfExtract(bufferAppender(filePath, chunkSize));

  if (!rawData || !rawData.rawData?.length) {
    throw new Error(`Nenhum dado GPMF encontrado em ${basename(filePath)}`);
  }

  log(`  GPMF extraído: ${formatBytes(rawData.rawData.length)}`);
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
    console.error('Erro: informe --file ou --multi');
    process.exit(1);
  }

  for (const f of files) {
    if (!existsSync(f)) {
      console.error(`Erro: arquivo não encontrado: ${f}`);
      process.exit(1);
    }
    if (extname(f).toLowerCase() !== '.mp4') {
      console.error(`Erro: ${f} não é um .mp4`);
      process.exit(1);
    }
  }

  log(`${files.length} arquivo(s) para processar`);
  log('Extraindo faixas GPMF...');

  const extracted = [];
  for (const f of files) {
    try {
      const raw = await extractOne(f);
      extracted.push(raw);
    } catch (err) {
      console.error(`Erro ao processar ${basename(f)}: ${err.message}`);
      process.exit(1);
    }
  }

  log(`Convertendo streams: ${streams.join(', ')}...`);
  const input = extracted.length === 1 ? extracted[0] : extracted;
  const telemetry = await goproTelemetry(input, {
    stream: streams,
    smooth,
    GPS5Fix: 3,
    removeGaps: true,
  });

  const deviceKey = Object.keys(telemetry)[0];
  if (!deviceKey) {
    console.error('Nenhum stream de telemetria retornado.');
    process.exit(1);
  }

  const device = telemetry[deviceKey];
  const availableStreams = Object.keys(device.streams || {});
  log(`Streams disponíveis: ${availableStreams.join(', ')}`);

  const gpsSamples = device.streams?.GPS5?.samples || [];
  const acclSamples = device.streams?.ACCL?.samples || [];
  const gyroSamples = device.streams?.GYRO?.samples || [];

  log(`GPS: ${gpsSamples.length} amostras`);
  log(`Acelerômetro: ${acclSamples.length} amostras`);
  log(`Giroscópio: ${gyroSamples.length} amostras`);

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
  log('Extração concluída com sucesso!');
  log(`Arquivo gerado: ${outputFile}`);
  log('');
  log(`  Câmera:          ${output.meta.camera}`);
  log(`  Arquivos merged: ${files.length}`);
  log(`  Amostras GPS:    ${output.meta.stats.gpsSamples}`);
  log(`  Velocidade máx:  ${output.meta.stats.maxSpeedKmh} km/h`);
  log(`  Velocidade méd:  ${output.meta.stats.avgSpeedKmh} km/h`);
  log('─────────────────────────────────────────');
  log('');
  log('Próximo passo:');
  log(`  node packages/analyzer/src/index.js -f ${outputFile}`);
}

extract().catch(err => {
  console.error('[extractor] Erro inesperado:', err);
  process.exit(1);
});