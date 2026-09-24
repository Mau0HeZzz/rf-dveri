import sharp from 'sharp';
const [shot, design, out, x, y, w, h, scale] = process.argv.slice(2);
const s = +scale || 1;
const crop = await sharp(shot).extract({ left: +x*s, top: +y*s, width: +w*s, height: +h*s }).png().toBuffer();
const d = await sharp(design).resize({ width: +w*s, height: +h*s, fit: 'fill' }).png().toBuffer();
const gap = 10;
await sharp({ create: { width: +w*s, height: (+h*s)*2 + gap, channels: 4, background: '#ff00ff' } })
  .composite([{ input: d, top: 0, left: 0 }, { input: crop, top: +h*s + gap, left: 0 }]).png().toFile(out);
