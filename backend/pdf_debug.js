/**
 * Debug script — shows exactly what's inside your PDF streams.
 * Run: node pdf_debug.js <path-to-pdf>
 */

const fs = require('fs');
const zlib = require('zlib');

const filePath = process.argv[2];
if (!filePath) { console.log('Usage: node pdf_debug.js <pdf-path>'); process.exit(1); }

const buffer = fs.readFileSync(filePath);
console.log(`📄 File size: ${buffer.length} bytes`);

// Find all streams
let pos = 0;
let streamCount = 0;

while (pos < buffer.length) {
  const streamMarker = buffer.indexOf('stream', pos);
  if (streamMarker === -1) break;

  let dataStart = streamMarker + 6;
  if (buffer[dataStart] === 0x0D) dataStart++;
  if (buffer[dataStart] === 0x0A) dataStart++;

  const endMarker = buffer.indexOf('endstream', dataStart);
  if (endMarker === -1) break;

  const headerSlice = buffer.slice(Math.max(0, streamMarker - 300), streamMarker).toString('ascii');
  const isCompressed = headerSlice.includes('FlateDecode');
  const rawData = buffer.slice(dataStart, endMarker);

  streamCount++;
  console.log(`\n--- Stream #${streamCount} (${rawData.length} bytes, compressed: ${isCompressed}) ---`);
  console.log('Header snippet:', headerSlice.slice(-150).replace(/\n/g, ' '));

  let content = '';
  if (isCompressed) {
    try {
      content = zlib.inflateSync(rawData).toString('utf8');
      console.log('✅ Decompressed successfully');
    } catch(e) {
      console.log('❌ Decompress failed:', e.message);
      pos = endMarker + 9;
      continue;
    }
  } else {
    content = rawData.toString('utf8');
  }

  console.log('First 300 chars of content:');
  console.log(content.substring(0, 300));
  console.log('Contains "Tj":', content.includes('Tj'));
  console.log('Contains "TJ":', content.includes('TJ'));
  console.log('Contains "BT":', content.includes('BT'));

  pos = endMarker + 9;
}

console.log(`\nTotal streams found: ${streamCount}`);