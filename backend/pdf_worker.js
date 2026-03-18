/**
 * PDF Worker — pure Node.js, zero npm dependencies.
 * Correctly handles TJ arrays: [(text)-300(more text)]TJ
 */

const fs = require('fs');
const zlib = require('zlib');

function extractStreams(buffer) {
  const streams = [];
  let pos = 0;

  while (pos < buffer.length) {
    const streamMarker = buffer.indexOf('stream', pos);
    if (streamMarker === -1) break;

    let dataStart = streamMarker + 6;
    if (buffer[dataStart] === 0x0D) dataStart++;
    if (buffer[dataStart] === 0x0A) dataStart++;

    const endMarker = buffer.indexOf('endstream', dataStart);
    if (endMarker === -1) break;

    const headerSlice = buffer.slice(Math.max(0, streamMarker - 400), streamMarker).toString('ascii');
    const isCompressed = headerSlice.includes('FlateDecode');
    // Skip font/resource streams — only keep page content streams
    const isFont = headerSlice.includes('Length1') || headerSlice.includes('PS-Adobe') || headerSlice.includes('ObjStm');

    if (!isFont) {
      const rawData = buffer.slice(dataStart, endMarker);
      streams.push({ rawData, isCompressed });
    }

    pos = endMarker + 9;
  }

  return streams;
}

function decodePDFString(str) {
  return str
    .replace(/\\n/g, ' ')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\(\d{3})/g, (_, oct) => {
      try { return String.fromCharCode(parseInt(oct, 8)); } catch { return ''; }
    })
    .replace(/\\\\/g, '\\')
    .replace(/\\([()])/g, '$1')
    .replace(/\\/g, '');
}

function extractTextFromContent(content) {
  let text = '';
  let inBT = false; // between BT and ET (text block)
  let i = 0;

  while (i < content.length) {
    // Detect BT (Begin Text) / ET (End Text)
    if (content[i] === 'B' && content[i+1] === 'T' && (content[i+2] === '\n' || content[i+2] === '\r' || content[i+2] === ' ')) {
      inBT = true;
      i += 2;
      continue;
    }
    if (content[i] === 'E' && content[i+1] === 'T' && (content[i+2] === '\n' || content[i+2] === '\r' || content[i+2] === ' ' || i+2 >= content.length)) {
      inBT = false;
      text += ' ';
      i += 2;
      continue;
    }

    // Handle TJ array: [(string)-300(string2)400(string3)]TJ
    if (content[i] === '[') {
      const closeArr = content.indexOf(']', i);
      if (closeArr !== -1) {
        const afterArr = content.slice(closeArr + 1, closeArr + 5).trim();
        if (afterArr.startsWith('TJ')) {
          const arrayContent = content.slice(i + 1, closeArr);
          // Extract all (string) parts from the array
          let j = 0;
          while (j < arrayContent.length) {
            if (arrayContent[j] === '(') {
              let str = '';
              j++;
              while (j < arrayContent.length && arrayContent[j] !== ')') {
                if (arrayContent[j] === '\\') {
                  str += arrayContent[j] + arrayContent[j+1];
                  j += 2;
                } else {
                  str += arrayContent[j];
                  j++;
                }
              }
              text += decodePDFString(str);
            } else {
              // Numbers (kerning) — large negative = word space
              const numMatch = arrayContent.slice(j).match(/^-?\d+(\.\d+)?/);
              if (numMatch) {
                const kern = parseFloat(numMatch[0]);
                if (kern < -200) text += ' '; // word space heuristic
                j += numMatch[0].length;
              } else {
                j++;
              }
            }
          }
          i = closeArr + 1;
          continue;
        }
      }
    }

    // Handle simple (string) Tj
    if (content[i] === '(') {
      let str = '';
      i++;
      while (i < content.length && content[i] !== ')') {
        if (content[i] === '\\') {
          str += content[i] + content[i+1];
          i += 2;
        } else {
          str += content[i];
          i++;
        }
      }
      // Look ahead for Tj
      const ahead = content.slice(i + 1, i + 10).trim();
      if (ahead.startsWith('Tj')) {
        text += decodePDFString(str);
      }
      i++;
      continue;
    }

    i++;
  }

  return text;
}

function extractText(buffer) {
  const streams = extractStreams(buffer);
  let fullText = '';

  for (const { rawData, isCompressed } of streams) {
    let content = '';
    if (isCompressed) {
      try { content = zlib.inflateSync(rawData).toString('latin1'); } catch { continue; }
    } else {
      content = rawData.toString('latin1');
    }

    // Only process streams that look like page content
    if (!content.includes('BT') && !content.includes('Tj') && !content.includes('TJ')) continue;

    fullText += extractTextFromContent(content) + ' ';
  }

  return fullText.replace(/\s+/g, ' ').trim();
}

function countPages(buffer) {
  const content = buffer.slice(0, 50000).toString('ascii');
  const matches = content.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 1;
}

function run() {
  const filePath = process.argv[2];
  if (!filePath) {
    process.stdout.write(JSON.stringify({ error: 'No file path provided' }));
    process.exit(1);
  }

  try {
    const buffer = fs.readFileSync(filePath);
    const text = extractText(buffer);
    const numPages = countPages(buffer);

    if (!text || text.length < 10) {
      process.stdout.write(JSON.stringify({ error: 'No readable text found in PDF' }));
      process.exit(1);
    }

    process.stdout.write(JSON.stringify({ text, numPages, charCount: text.length }));
    process.exit(0);
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: err.message }));
    process.exit(1);
  }
}

run();