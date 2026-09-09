import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';

// Rasterize once at build-authoring time: WebKit treats an SVG filter drawn
// through a CanvasPattern as origin-unclean, even when the SVG is a data URL.
// Preview, frozen frames and exports all use this same lossless raster tile.
const requireFromNext = createRequire(import.meta.resolve('next/package.json'));
const sharp = requireFromNext('sharp');
const target = new URL('../public/shader-grain.png', import.meta.url);
const svg = "<svg width='160' height='160' viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(#n)' opacity='.32'/></svg>";
const png = await sharp(Buffer.from(svg)).png().toBuffer();
if (process.argv.includes('--check')) {
  if (!(await readFile(target)).equals(png)) throw new Error('Run pnpm generate:shader-grain to update the shared grain tile.');
} else {
  await writeFile(target, png);
}
console.log(`Shader grain: 160 x 160 PNG (${png.length} bytes).`);
