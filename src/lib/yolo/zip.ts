/**
 * Minimal streaming ZIP writer (STORE method, no compression; JPEGs are already compressed).
 * Entries are produced lazily so only one file is held in memory at a time.
 * Limits: no zip64, so each file and the total archive must stay under 4 GiB.
 */

export interface ZipEntry {
  /** Forward-slash path inside the archive, no leading slash. */
  path: string;
  data: Uint8Array | (() => Promise<Uint8Array>);
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const enc = new TextEncoder();

interface CentralRecord {
  name: Uint8Array;
  crc: number;
  size: number;
  offset: number;
}

function localHeader(name: Uint8Array, crc: number, size: number, dt: { time: number; date: number }) {
  const h = new Uint8Array(30 + name.length);
  const v = new DataView(h.buffer);
  v.setUint32(0, 0x04034b50, true);
  v.setUint16(4, 20, true); // version needed
  v.setUint16(6, 0x0800, true); // UTF-8 names
  v.setUint16(8, 0, true); // STORE
  v.setUint16(10, dt.time, true);
  v.setUint16(12, dt.date, true);
  v.setUint32(14, crc, true);
  v.setUint32(18, size, true);
  v.setUint32(22, size, true);
  v.setUint16(26, name.length, true);
  v.setUint16(28, 0, true);
  h.set(name, 30);
  return h;
}

function centralHeader(r: CentralRecord, dt: { time: number; date: number }) {
  const h = new Uint8Array(46 + r.name.length);
  const v = new DataView(h.buffer);
  v.setUint32(0, 0x02014b50, true);
  v.setUint16(4, 20, true);
  v.setUint16(6, 20, true);
  v.setUint16(8, 0x0800, true);
  v.setUint16(10, 0, true);
  v.setUint16(12, dt.time, true);
  v.setUint16(14, dt.date, true);
  v.setUint32(16, r.crc, true);
  v.setUint32(20, r.size, true);
  v.setUint32(24, r.size, true);
  v.setUint16(28, r.name.length, true);
  v.setUint32(42, r.offset, true);
  h.set(r.name, 46);
  return h;
}

function endRecord(count: number, cdSize: number, cdOffset: number) {
  const e = new Uint8Array(22);
  const v = new DataView(e.buffer);
  v.setUint32(0, 0x06054b50, true);
  v.setUint16(8, count, true);
  v.setUint16(10, count, true);
  v.setUint32(12, cdSize, true);
  v.setUint32(16, cdOffset, true);
  return e;
}

/** Async generator yielding the ZIP bytes in chunks. */
export async function* zipChunks(
  entries: Iterable<ZipEntry> | AsyncIterable<ZipEntry>,
  now: Date = new Date(),
): AsyncGenerator<Uint8Array> {
  const dt = dosDateTime(now);
  const records: CentralRecord[] = [];
  let offset = 0;
  for await (const entry of entries) {
    if (entry.path.startsWith("/") || entry.path.includes("..")) {
      throw new Error(`Invalid zip path: ${entry.path}`);
    }
    const data = typeof entry.data === "function" ? await entry.data() : entry.data;
    const name = enc.encode(entry.path);
    const rec: CentralRecord = { name, crc: crc32(data), size: data.length, offset };
    const header = localHeader(name, rec.crc, rec.size, dt);
    records.push(rec);
    offset += header.length + data.length;
    yield header;
    if (data.length) yield data;
  }
  const cdOffset = offset;
  let cdSize = 0;
  for (const r of records) {
    const c = centralHeader(r, dt);
    cdSize += c.length;
    yield c;
  }
  yield endRecord(records.length, cdSize, cdOffset);
}

/** Wrap zipChunks in a web ReadableStream (pull-based, honors backpressure). */
export function zipStream(
  entries: Iterable<ZipEntry> | AsyncIterable<ZipEntry>,
  now?: Date,
): ReadableStream<Uint8Array> {
  const it = zipChunks(entries, now);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await it.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      await it.return(undefined);
    },
  });
}
