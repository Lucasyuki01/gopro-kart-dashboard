import { program } from 'commander';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, basename } from 'path';

program
  .name('kart-analyzer')
  .description('Analisa telemetria extraída e calcula voltas, setores e estatísticas')
  .requiredOption('-f, --file <path>', 'Arquivo .telemetry.json gerado pelo extractor')
  .option('-o, --output <path>', 'Pasta de saída', './output')
  .option('--start-lat <lat>', 'Latitude da linha de largada')
  .option('--start-lng <lng>', 'Longitude da linha de largada')
  .option('--start-radius <m>', 'Raio em metros para detectar cruzamento da linha', '15')
  .option('--min-lap <s>', 'Tempo mínimo de volta em segundos', '30')
  .option('--sectors <n>', 'Número de setores por volta', '3')
  .parse(process.argv);

const opts = program.opts();

function log(msg) {
  process.stdout.write(`[analyzer] ${msg}\n`);
}

function msToLapTime(ms) {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(3).padStart(6, '0');
  return `${minutes}:${seconds}`;
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toG(ms2) {
  return parseFloat((ms2 / 9.81).toFixed(3));
}

// Suavização por média móvel — remove picos de vibração
function smoothArray(arr, window = 5) {
  return arr.map((_, i) => {
    const start = Math.max(0, i - Math.floor(window / 2));
    const end = Math.min(arr.length, start + window);
    const slice = arr.slice(start, end);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

function detectLaps(gpsSamples, startLat, startLng, radiusM, minLapMs) {
  const laps = [];
  let insideZone = true;
  let lapStartIdx = 0;
  let lapStartCts = gpsSamples[0]?.cts ?? 0;
  let lastCrossingCts = lapStartCts;

  for (let i = 1; i < gpsSamples.length; i++) {
    const { lat, lng, cts } = gpsSamples[i];
    if (lat == null || lng == null) continue;

    const dist = haversineDistance(lat, lng, startLat, startLng);
    const inZone = dist <= radiusM;

    if (!insideZone && inZone) {
      const lapDuration = cts - lastCrossingCts;
      if (lapDuration >= minLapMs) {
        laps.push({
          lapNumber: laps.length + 1,
          startIdx: lapStartIdx,
          endIdx: i,
          startCts: lapStartCts,
          endCts: cts,
          durationMs: lapDuration,
          lapTime: msToLapTime(lapDuration),
        });
        lapStartIdx = i;
        lapStartCts = cts;
        lastCrossingCts = cts;
      }
    }

    insideZone = inZone;
  }

  return laps;
}

function lapStats(lap, gpsSamples, acclSamples, numSectors) {
  const lapGps = gpsSamples.slice(lap.startIdx, lap.endIdx + 1);

  // Busca binária para encontrar amostras do acelerômetro dentro do intervalo
  const lapAccl = acclSamples.filter(
    a => a.cts >= lap.startCts && a.cts <= lap.endCts
  );

  const speeds = lapGps.map(s => s.speedKmh).filter(v => v != null && v > 0);
  const maxSpeed = speeds.length ? Math.max(...speeds) : 0;
  const avgSpeed = speeds.length
    ? speeds.reduce((a, b) => a + b, 0) / speeds.length
    : 0;

  const rawGLat = lapAccl.map(a => Math.abs(toG(a.x ?? 0)));
  const rawGLon = lapAccl.map(a => Math.abs(toG(a.y ?? 0)));
  const smoothGLat = smoothArray(rawGLat, 15);
  const smoothGLon = smoothArray(rawGLon, 15);
  const maxGLateral = smoothGLat.length ? Math.max(...smoothGLat) : 0;
  const maxGLongitudinal = smoothGLon.length ? Math.max(...smoothGLon) : 0;

  let distanceM = 0;
  for (let i = 1; i < lapGps.length; i++) {
    const a = lapGps[i - 1];
    const b = lapGps[i];
    if (a.lat != null && b.lat != null) {
      distanceM += haversineDistance(a.lat, a.lng, b.lat, b.lng);
    }
  }

  const sectorSize = Math.floor(lapGps.length / numSectors);
  const sectors = [];
  for (let s = 0; s < numSectors; s++) {
    const sStart = s * sectorSize;
    const sEnd = s === numSectors - 1 ? lapGps.length - 1 : (s + 1) * sectorSize;
    const sGps = lapGps.slice(sStart, sEnd + 1);
    const sSpeeds = sGps.map(g => g.speedKmh).filter(v => v != null && v > 0);
    const sStartCts = sGps[0]?.cts ?? 0;
    const sEndCts = sGps[sGps.length - 1]?.cts ?? 0;

    sectors.push({
      sector: s + 1,
      durationMs: sEndCts - sStartCts,
      sectorTime: msToLapTime(sEndCts - sStartCts),
      maxSpeedKmh: sSpeeds.length ? parseFloat(Math.max(...sSpeeds).toFixed(1)) : 0,
      avgSpeedKmh: sSpeeds.length
        ? parseFloat((sSpeeds.reduce((a, b) => a + b, 0) / sSpeeds.length).toFixed(1))
        : 0,
    });
  }

  return {
    ...lap,
    maxSpeedKmh: parseFloat(maxSpeed.toFixed(1)),
    avgSpeedKmh: parseFloat(avgSpeed.toFixed(1)),
    distanceM: parseFloat(distanceM.toFixed(1)),
    maxGLateral: parseFloat(maxGLateral.toFixed(3)),
    maxGLongitudinal: parseFloat(maxGLongitudinal.toFixed(3)),
    sectors,
    trackPoints: lapGps.map(p => ({
      lat: p.lat,
      lng: p.lng,
      speedKmh: p.speedKmh,
      cts: p.cts,
    })),
  };
}

// Serializa o JSON em chunks para evitar stack overflow em objetos grandes
async function writeJsonSafe(filePath, data) {
  const stream = (await import('fs')).createWriteStream(filePath);
  await new Promise((resolve, reject) => {
    stream.on('error', reject);
    stream.on('finish', resolve);

    // Serializa manualmente campo a campo para não explodir a call stack
    stream.write('{\n');
    const keys = Object.keys(data);
    keys.forEach((key, ki) => {
      const isLast = ki === keys.length - 1;
      if (key === 'laps' || key === 'fullTrack') {
        stream.write(`  "${key}": [\n`);
        const arr = data[key];
        arr.forEach((item, i) => {
          stream.write('    ' + JSON.stringify(item));
          if (i < arr.length - 1) stream.write(',');
          stream.write('\n');
        });
        stream.write(`  ]${isLast ? '' : ','}\n`);
      } else {
        stream.write(`  ${JSON.stringify(key)}: ${JSON.stringify(data[key])}${isLast ? '' : ','}\n`);
      }
    });
    stream.write('}\n');
    stream.end();
  });
}

async function analyze() {
  const filePath = resolve(opts.file);
  const outputDir = resolve(opts.output);
  const radiusM = parseFloat(opts.startRadius);
  const minLapMs = parseFloat(opts.minLap) * 1000;
  const numSectors = parseInt(opts.sectors, 10);

  if (!existsSync(filePath)) {
    console.error(`Erro: arquivo não encontrado: ${filePath}`);
    process.exit(1);
  }

  log(`Carregando: ${filePath}`);
  const raw = JSON.parse(await readFile(filePath, 'utf-8'));

  const { gps: gpsSamples, accl: acclSamples, meta } = raw;
  log(`GPS samples: ${gpsSamples.length}`);
  log(`ACCL samples: ${acclSamples.length}`);

  const startLat = opts.startLat ? parseFloat(opts.startLat) : gpsSamples[0]?.lat;
  const startLng = opts.startLng ? parseFloat(opts.startLng) : gpsSamples[0]?.lng;

  if (!startLat || !startLng) {
    console.error('Erro: sem coordenadas GPS válidas no arquivo.');
    process.exit(1);
  }

  log(`Linha de largada: ${startLat.toFixed(6)}, ${startLng.toFixed(6)}`);
  log(`Raio de detecção: ${radiusM}m | Volta mínima: ${minLapMs / 1000}s`);

  log('Detectando voltas...');
  const laps = detectLaps(gpsSamples, startLat, startLng, radiusM, minLapMs);
  log(`${laps.length} voltas detectadas`);

  if (laps.length === 0) {
    log('Nenhuma volta detectada. Dicas:');
    log('  • Aumente --start-radius (padrão 15m)');
    log('  • Reduza --min-lap se as voltas forem curtas');
    log('  • Informe --start-lat e --start-lng com coordenadas exatas da largada');
    process.exit(1);
  }

  log('Calculando estatísticas por volta...');
  const lapsWithStats = laps.map((lap, i) => {
    if ((i + 1) % 5 === 0 || i === laps.length - 1) {
      log(`  ${i + 1}/${laps.length} voltas processadas`);
    }
    return lapStats(lap, gpsSamples, acclSamples, numSectors);
  });

  const bestLap = lapsWithStats.reduce((best, lap) =>
    lap.durationMs < best.durationMs ? lap : best
  );

  const bestSectors = Array.from({ length: numSectors }, (_, si) => {
    const candidates = lapsWithStats
      .map(l => l.sectors[si])
      .filter(Boolean)
      .sort((a, b) => a.durationMs - b.durationMs);
    return candidates[0] ?? null;
  });

  // Usa apenas amostras dentro do intervalo de corrida real (V1 → última volta)
  const racingStartCts = lapsWithStats[0].startCts;
  const racingEndCts = lapsWithStats[lapsWithStats.length - 1].endCts;

  const racingGps = gpsSamples.filter(
    s => s.cts >= racingStartCts && s.cts <= racingEndCts
  );
  const racingAccl = acclSamples.filter(
    a => a.cts >= racingStartCts && a.cts <= racingEndCts
  );

  const allSpeeds = racingGps.map(s => s.speedKmh).filter(v => v != null && v > 0);
  const sessionMaxSpeed = allSpeeds.length ? Math.max(...allSpeeds) : 0;
  const sessionAvgSpeed = allSpeeds.length
    ? allSpeeds.reduce((a, b) => a + b, 0) / allSpeeds.length
    : 0;

  const allGLat = racingAccl.map(a => Math.abs(toG(a.x ?? 0)));
  const smoothedSessionGLat = smoothArray(allGLat, 15);
  let sessionMaxGLat = 0;
  for (const v of smoothedSessionGLat) {
    if (v > sessionMaxGLat) sessionMaxGLat = v;
  }

  const session = {
    meta: {
      ...meta,
      analyzedAt: new Date().toISOString(),
      startLine: { lat: startLat, lng: startLng, radiusM },
      numSectors,
    },
    summary: {
      totalLaps: laps.length,
      bestLapNumber: bestLap.lapNumber,
      bestLapTime: bestLap.lapTime,
      bestLapDurationMs: bestLap.durationMs,
      sessionMaxSpeedKmh: parseFloat(sessionMaxSpeed.toFixed(1)),
      sessionAvgSpeedKmh: parseFloat(sessionAvgSpeed.toFixed(1)),
      sessionMaxGLateral: parseFloat(sessionMaxGLat.toFixed(3)),
      trackLengthM: (() => {
        const distances = lapsWithStats
          .map(l => l.distanceM)
          .filter(d => d > 0)
          .sort((a, b) => a - b)
        const mid = Math.floor(distances.length / 2)
        return parseFloat(distances[mid]?.toFixed(1) ?? 0)
      })(),
      bestSectors: bestSectors.map((s, i) => ({
        sector: i + 1,
        sectorTime: s?.sectorTime ?? null,
        durationMs: s?.durationMs ?? null,
        fromLap: lapsWithStats.find(l => l.sectors[i]?.durationMs === s?.durationMs)
          ?.lapNumber ?? null,
      })),
    },
    laps: lapsWithStats,
    fullTrack: racingGps
      .filter(p => p.lat != null && p.lng != null)
      .map(p => ({ lat: p.lat, lng: p.lng, speedKmh: p.speedKmh, cts: p.cts })),
  };

  await mkdir(outputDir, { recursive: true });
  const videoName = basename(filePath, '.telemetry.json');
  const outFile = resolve(outputDir, `${videoName}.session.json`);

  log('Salvando session.json...');
  await writeJsonSafe(outFile, session);

  log('');
  log('─────────────────────────────────────────');
  log('Análise concluída!');
  log(`Arquivo gerado: ${outFile}`);
  log('');
  log(`Total de voltas:     ${session.summary.totalLaps}`);
  log(`Melhor volta:        ${session.summary.bestLapTime} (V${session.summary.bestLapNumber})`);
  log(`Velocidade máxima:   ${session.summary.sessionMaxSpeedKmh} km/h`);
  log(`Velocidade média:    ${session.summary.sessionAvgSpeedKmh} km/h`);
  log(`Força G máx lateral: ${session.summary.sessionMaxGLateral} G`);
  log('');
  log('Voltas:');
  lapsWithStats.forEach(lap => {
    const marker = lap.lapNumber === bestLap.lapNumber ? ' ← MELHOR' : '';
    log(`  V${lap.lapNumber}: ${lap.lapTime}  |  máx ${lap.maxSpeedKmh} km/h  |  G ${lap.maxGLateral}${marker}`);
  });
  log('─────────────────────────────────────────');
  log('');
  log('Próximo passo:');
  log(`  npm run dashboard`);
}

analyze().catch(err => {
  console.error('[analyzer] Erro inesperado:', err);
  process.exit(1);
});