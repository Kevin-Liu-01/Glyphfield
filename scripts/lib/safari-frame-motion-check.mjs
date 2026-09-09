import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function decode(path, oneFrame = false) {
  return execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-vf', 'scale=64:36',
    ...(oneFrame ? ['-frames:v', '1'] : []), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
  { maxBuffer: 16 * 1024 * 1024 });
}

function meanError(actual, expected) {
  assert.equal(actual.length, expected.length, 'Decoded frame sizes differ');
  let total = 0;
  for (let index = 0; index < actual.length; index += 1) total += Math.abs(actual[index] - expected[index]);
  return total / actual.length;
}

// Actual Safari VideoEncoder output, not Playwright WebKit or a replacement
// encoder. The PNG oracle uses the same paused composition and ffmpeg resize.
export async function checkSafariFrameMotion({ harness, fixture, read, invoke, assertPaperClock }) {
  const { click, evaluate, evaluateAsync } = harness;
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    execFileSync('ffprobe', ['-version'], { stdio: 'ignore' });
  } catch { throw new Error('Native MP4 verification requires local ffmpeg and ffprobe; no motion assertion was run.'); }
  await click('button[aria-label="Pause shader motion"]');
  const before = await read();
  assert(before.motion.paused, 'The real Pause button must freeze the chosen MP4 start frame');
  assertPaperClock(before);
  const pixels = () => evaluate((id) => {
    const source = document.querySelector(`[data-testid="shader-lab-live-stage"] [data-shader-instance="canvas-${CSS.escape(id)}"] canvas`);
    if (!source?.width) throw new Error('No native shader pixels remain');
    const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(source, 0, 0);
    let hash = 2166136261;
    for (const byte of context.getImageData(0, 0, canvas.width, canvas.height).data) hash = Math.imul(hash ^ byte, 16777619);
    return { hash: hash >>> 0, width: canvas.width, height: canvas.height };
  }, fixture.shaderId);
  const beforePixels = await pixels();
  const still = await invoke('design.export', { format: 'png', download: false }, true);
  await click('header button[aria-label="Close export preview"]');
  assert.deepEqual((await read()).motion, before.motion, 'PNG oracle changed the selected motion anchor');
  const movie = await invoke('design.export', { format: 'mp4', download: false }, true);
  assert.equal(movie.mime, 'video/mp4');
  assert.match(movie.filename, /\.mp4$/);
  const directory = await mkdtemp(join(tmpdir(), 'glyphfield-safari-motion-'));
  const pngPath = join(directory, 'paused-anchor.png');
  const mp4Path = join(directory, 'actual-safari.mp4');
  const movieBytes = Buffer.from(movie.encodedDataUrl.split(',')[1], 'base64');
  assert.equal(movieBytes.subarray(4, 8).toString(), 'ftyp', 'Safari did not produce an MP4 container');
  await writeFile(pngPath, Buffer.from(still.encodedDataUrl.split(',')[1], 'base64'));
  await writeFile(mp4Path, movieBytes);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams',
    '-show_format', '-of', 'json', mp4Path], { encoding: 'utf8' }));
  const stream = probe.streams.find((entry) => entry.codec_type === 'video');
  assert.deepEqual([stream.width, stream.height], [640, 360]);
  const expectedFrames = Math.round(1200 * 12 / 1000);
  assert.equal(Number(stream.nb_read_frames), expectedFrames);
  assert(Math.abs(Number(probe.format.duration) - expectedFrames / 12) < 0.05, 'MP4 duration differs from the requested sampling');
  const frames = decode(mp4Path);
  const frameBytes = 64 * 36 * 3;
  const first = frames.subarray(0, frameBytes);
  const last = frames.subarray((expectedFrames - 1) * frameBytes, expectedFrames * frameBytes);
  const presentationError = meanError(first, decode(pngPath, true));
  const motionError = meanError(first, last);
  const proof = { pngPath, mp4Path, frameCount: expectedFrames, duration: probe.format.duration,
    colorRange: stream.color_range, colorSpace: stream.color_space, presentationError, motionError };
  console.log(JSON.stringify({ nativeSafariMp4: proof }));
  assert(presentationError < 8, `MP4 changed the chosen frame's colors or pose: ${JSON.stringify(proof)}`);
  assert(motionError > 1, 'MP4 repeated a still image instead of exporting actual shader motion');
  assert.deepEqual((await read()).motion, before.motion, 'MP4 changed or resumed the selected editor frame');
  assert.deepEqual(await pixels(), beforePixels, 'MP4 changed the paused native canvas pixels');
  await evaluateAsync(() => new Promise((resolve) => setTimeout(resolve, 400)));
  assert.deepEqual((await read()).motion, before.motion, 'Shader autoplay resumed behind the MP4 review');
  assert.deepEqual(await pixels(), beforePixels, 'Native pixels changed after MP4 export completed');
  return proof;
}
