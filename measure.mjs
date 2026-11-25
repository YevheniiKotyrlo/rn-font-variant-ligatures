// Reads a screenshot of ReproducerApp, finds its five lines of blue text, and compares the pixels of the lines
// that should differ once fontVariant's ligature values apply:
//   line 2 ['no-common-ligatures'] against line 1 (no fontVariant) and line 3 (the ligatures broken by hand);
//   line 5 ['discretionary-ligatures'] against line 4 (no fontVariant).
// Exit 1 while either value draws the same pixels as no fontVariant, 0 once both change the line, 2 otherwise.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/**
 * Two lines are the same at or below this many differing pixels, as a share of the first line's inked pixels, and
 * differ at or above `differ`; a line shifted by a wider glyph can differ by more than its own ink.
 */
const same = 0.01;
const differ = 0.03;

/**
 * @param {string} path
 */
function decodePng(path) {
  const bytes = readFileSync(path);
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 8;
  const data = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('latin1', offset + 4, offset + 8);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      if ((bitDepth !== 8 && bitDepth !== 16) || (colorType !== 2 && colorType !== 6) || chunk[12] !== 0) {
        throw new Error(`unsupported PNG: bit depth ${bitDepth}, colour type ${colorType}, interlace ${chunk[12]}`);
      }
    } else if (type === 'IDAT') {
      data.push(chunk);
    }
    offset += 12 + length;
  }
  const bytesPerSample = bitDepth / 8;
  const channels = (colorType === 6 ? 4 : 3) * bytesPerSample;
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  for (let row = 0; row < height; row++) {
    const filter = raw[row * (stride + 1)];
    const line = raw.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1));
    for (let index = 0; index < stride; index++) {
      const left = index >= channels ? pixels[row * stride + index - channels] : 0;
      const up = row > 0 ? pixels[(row - 1) * stride + index] : 0;
      const upLeft = row > 0 && index >= channels ? pixels[(row - 1) * stride + index - channels] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const toLeft = Math.abs(estimate - left);
        const toUp = Math.abs(estimate - up);
        const toUpLeft = Math.abs(estimate - upLeft);
        predicted = toLeft <= toUp && toLeft <= toUpLeft ? left : toUp <= toUpLeft ? up : upLeft;
      }
      pixels[row * stride + index] = (line[index] + predicted) & 0xff;
    }
  }
  /** How much of the pixel the blue text covers, 0 to 1: blue ink on white keeps blue and lowers red and green. */
  const coverage = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * stride + x * channels;
      const [red, green, blue] = [0, 1, 2].map(sample => pixels[start + sample * bytesPerSample]);
      if (blue >= 200 && Math.abs(red - green) <= 16 && blue - red >= 8) coverage[y * width + x] = 1 - red / 255;
    }
  }
  return { width, height, coverage };
}

/**
 * @param {number} code
 * @param {string} summary
 * @returns {never}
 */
function verdict(code, summary) {
  console.log(`SUMMARY: ${summary}`);
  process.exit(code);
}

const path = process.argv[2];
/** @type {ReturnType<typeof decodePng>} */
let image;
try {
  image = decodePng(path);
} catch (error) {
  verdict(2, `the screenshot could not be read: ${error instanceof Error ? error.message : String(error)}`);
}
const { width, height, coverage } = image;

// The lines: runs of pixel rows holding blue ink, a gap of a few rows still inside one line.
/** @type {{ top: number, bottom: number, left: number, right: number }[]} */
const lines = [];
let gap = Infinity;
for (let y = 0; y < height; y++) {
  let left = width;
  let right = -1;
  for (let x = 0; x < width; x++) {
    if (coverage[y * width + x] > 0.25) {
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  if (right < 0) {
    gap++;
    continue;
  }
  const last = lines[lines.length - 1];
  if (last && gap <= 4) {
    last.bottom = y;
    last.left = Math.min(last.left, left);
    last.right = Math.max(last.right, right);
  } else {
    lines.push({ top: y, bottom: y, left, right });
  }
  gap = 0;
}
console.log(`screenshot ${width}x${height}; ${lines.length} lines of blue text`);
lines.forEach((line, index) =>
  console.log(`line ${index + 1}: x ${line.left}-${line.right}, y ${line.top}-${line.bottom}`),
);
if (lines.length !== 5) verdict(2, `the screenshot holds ${lines.length} lines of blue text, not the app's 5`);

/**
 * The share of the first line's inked pixels whose coverage differs from the second's, each line taken from the
 * top-left corner of its own ink.
 * @param {number} first
 * @param {number} second
 */
function difference(first, second) {
  const a = lines[first - 1];
  const b = lines[second - 1];
  const boxWidth = Math.max(a.right - a.left, b.right - b.left) + 1;
  const boxHeight = Math.max(a.bottom - a.top, b.bottom - b.top) + 1;
  let inked = 0;
  let differing = 0;
  for (let dy = 0; dy < boxHeight; dy++) {
    for (let dx = 0; dx < boxWidth; dx++) {
      const at = (/** @type {typeof a} */ line) => {
        const x = line.left + dx;
        const y = line.top + dy;
        return x < width && y < height ? coverage[y * width + x] : 0;
      };
      const ca = at(a);
      const cb = at(b);
      if (ca > 0.5) inked++;
      if (Math.abs(ca - cb) > 0.35) differing++;
    }
  }
  return inked === 0 ? 1 : differing / inked;
}

/**
 * @param {number} share
 */
const judge = share => (share <= same ? 'same' : share >= differ ? 'differs' : 'unclear');
/**
 * @param {number} first
 * @param {number} second
 */
function compare(first, second, label = '') {
  const share = difference(first, second);
  const result = judge(share);
  console.log(
    `line ${second} against line ${first}: differing pixels ${(share * 100).toFixed(2)}% of line ${first}'s ink: ${result}${label}`,
  );
  return result;
}

const control = compare(1, 3, ' (the ligatures broken by hand against the default)');
const common = compare(1, 2, " (fontVariant ['no-common-ligatures'] against no fontVariant)");
compare(3, 2, " (fontVariant ['no-common-ligatures'] against the ligatures broken by hand)");
const discretionary = compare(4, 5, " (fontVariant ['discretionary-ligatures'] against no fontVariant)");

if (control !== 'differs') verdict(2, 'the font draws "office affluent" the same with its ligatures broken: the check cannot tell');
if (common === 'unclear' || discretionary === 'unclear') verdict(2, 'a line differs from its reference too little to tell');
/** @type {string[]} */
const dropped = [];
if (common === 'same') dropped.push("['no-common-ligatures']");
if (discretionary === 'same') dropped.push("['discretionary-ligatures']");
if (dropped.length > 0) {
  verdict(1, `fontVariant ${dropped.join(' and ')} ${dropped.length > 1 ? 'draw' : 'draws'} the same pixels as no fontVariant`);
}
verdict(0, "fontVariant ['no-common-ligatures'] and ['discretionary-ligatures'] each change the line they style");
