import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const switzerRegular = readFile(resolve(process.cwd(), 'public/fonts/switzer-400.ttf'));
const switzerMedium = readFile(resolve(process.cwd(), 'public/fonts/switzer-500.ttf'));

function toArrayBuffer(data: Buffer) {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

export async function getOpenGraphFonts() {
  const [regular, medium] = await Promise.all([switzerRegular, switzerMedium]);

  return [
    { data: toArrayBuffer(regular), name: 'Switzer', style: 'normal' as const, weight: 400 as const },
    { data: toArrayBuffer(medium), name: 'Switzer', style: 'normal' as const, weight: 500 as const },
  ];
}
