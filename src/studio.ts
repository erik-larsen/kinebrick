// BrickLink Studio's .io files: a ZIP archive, encrypted with a password Studio uses for all of
// them (as the LDraw wiki documents, wiki.ldraw.org/wiki/IO), holding the model as an LDraw file,
// model.ldr, beside a thumbnail and Studio's own files. KineBrick reads only model.ldr.

const PASSWORD = 'soho0909';

// The model in a .io file, as LDraw text.
export async function studioModel(bytes: ArrayBuffer): Promise<string> {
  const entry = zipEntries(bytes).find((e) => e.name.toLowerCase() === 'model.ldr');
  if (!entry) throw new Error('no model.ldr in it: is it a BrickLink Studio file?');
  let data = entry.data;
  if (entry.encrypted) data = zipDecrypt(data, PASSWORD);
  if (entry.method === 8) data = await inflate(data);
  else if (entry.method !== 0) throw new Error(`its model.ldr is packed in a way KineBrick can't read (ZIP method ${entry.method})`);
  return new TextDecoder().decode(data);
}

type ZipEntry = { name: string; method: number; encrypted: boolean; data: Uint8Array };

// The files in a ZIP archive, from its central directory (at the end of the archive), each with
// its data as stored: compressed, and encrypted if it says so.
function zipEntries(bytes: ArrayBuffer): ZipEntry[] {
  const view = new DataView(bytes);
  // The end of central directory record: 22 bytes, then a comment of up to 65535 bytes.
  let end = -1;
  for (let i = bytes.byteLength - 22; i >= Math.max(0, bytes.byteLength - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("it isn't a ZIP archive, as a BrickLink Studio file is");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error('its ZIP directory is damaged');
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(bytes, at + 46, nameLength));
    // The data follows the file's local header, whose name and extra field may differ in length
    // from the directory's.
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    entries.push({ name, method, encrypted: (flags & 1) !== 0, data: new Uint8Array(bytes, start, size) });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return entries;
}

// ZIP's original ("traditional") encryption, which Studio uses: three keys, stirred by the
// password and then by each byte decrypted. The first 12 bytes are a random header.
function zipDecrypt(data: Uint8Array, password: string): Uint8Array {
  const keys = [0x12345678, 0x23456789, 0x34567890];
  const update = (byte: number) => {
    keys[0] = crc32Byte(keys[0], byte);
    keys[1] = (Math.imul((keys[1] + (keys[0] & 0xff)) >>> 0, 134775813) + 1) >>> 0;
    keys[2] = crc32Byte(keys[2], keys[1] >>> 24);
  };
  for (const c of new TextEncoder().encode(password)) update(c);
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const temp = (keys[2] | 2) & 0xffff;
    out[i] = data[i] ^ ((Math.imul(temp, temp ^ 1) >>> 8) & 0xff);
    update(out[i]);
  }
  return out.subarray(12);
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32Byte = (crc: number, byte: number) => (CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)) >>> 0;

// Deflate-compressed data, unpacked by the browser's own decompressor.
async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  try {
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch {
    throw new Error("its model.ldr can't be unpacked: it may use a password other than Studio's");
  }
}
