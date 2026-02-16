import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import { Archive } from "libarchive.js";
import { ungzip, gzip } from "pako";

Archive.init({
  workerUrl: "/node_modules/libarchive.js/dist/worker-bundle.js"
});

class archiveHandler implements FormatHandler {

  public name: string = "archive";

  public supportedFormats: FileFormat[] = [
    {
      name: "ZIP Archive",
      format: "zip",
      extension: "zip",
      mime: "application/zip",
      from: true,
      to: true,
      internal: "zip"
    },
    {
      name: "7-Zip Archive",
      format: "7z",
      extension: "7z",
      mime: "application/x-7z-compressed",
      from: true,
      to: false,
      internal: "7z"
    },
    {
      name: "TAR Archive",
      format: "tar",
      extension: "tar",
      mime: "application/x-tar",
      from: true,
      to: false,
      internal: "tar"
    },
    {
      name: "GZIP Compressed Archive",
      format: "gz",
      extension: "gz",
      mime: "application/gzip",
      from: true,
      to: true,
      internal: "gz"
    },
    {
      name: "BZIP2 Compressed Archive",
      format: "bz2",
      extension: "bz2",
      mime: "application/x-bzip2",
      from: true,
      to: false,
      internal: "bz2"
    },
    {
      name: "XZ Compressed Archive",
      format: "xz",
      extension: "xz",
      mime: "application/x-xz",
      from: true,
      to: false,
      internal: "xz"
    },
    {
      name: "LZMA Compressed Archive",
      format: "lzma",
      extension: "lzma",
      mime: "application/x-lzma",
      from: true,
      to: false,
      internal: "lzma"
    }
  ];

  public ready: boolean = true;

  async init() {
    this.ready = true;
  }

  private async extractWithLibarchive(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
    const blob = new Blob([bytes as unknown as BlobPart]);
    const file = new File([blob], "archive.bin");
    const archive = await Archive.open(file);
    const extracted = new Map<string, Uint8Array>();

    const files = await archive.getFilesArray();
    for (const fileEntry of files) {
      if (fileEntry.file.isFile) {
        const content = await fileEntry.file.arrayBuffer();
        extracted.set(fileEntry.file.name, new Uint8Array(content));
      }
    }

    await archive.close();
    return extracted;
  }

  private async createZip(files: Map<string, Uint8Array>): Promise<Uint8Array> {
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];
    let offset = 0;
    const centralDirectory: Uint8Array[] = [];
    let fileCount = 0;

    for (const [name, data] of files) {
      const nameBytes = encoder.encode(name);
      const crc = this.crc32(data);
      const compressed = data;

      // Local file header
      const localHeader = new Uint8Array(30 + nameBytes.length);
      const view = new DataView(localHeader.buffer);
      
      view.setUint32(0, 0x04034b50, true); // Local file header signature
      view.setUint16(4, 20, true); // Version needed
      view.setUint16(6, 0, true); // General purpose bit flag
      view.setUint16(8, 0, true); // Compression method (stored)
      view.setUint16(10, 0, true); // File last modification time
      view.setUint16(12, 0, true); // File last modification date
      view.setUint32(14, crc, true); // CRC-32
      view.setUint32(18, compressed.length, true); // Compressed size
      view.setUint32(22, data.length, true); // Uncompressed size
      view.setUint16(26, nameBytes.length, true); // File name length
      view.setUint16(28, 0, true); // Extra field length
      localHeader.set(nameBytes, 30); // File name

      chunks.push(localHeader);
      chunks.push(compressed);

      // Central directory header
      const cdHeader = new Uint8Array(46 + nameBytes.length);
      const cdView = new DataView(cdHeader.buffer);
      
      cdView.setUint32(0, 0x02014b50, true); // Central directory signature
      cdView.setUint16(4, 20, true); // Version made by
      cdView.setUint16(6, 20, true); // Version needed
      cdView.setUint16(8, 0, true); // General purpose bit flag
      cdView.setUint16(10, 0, true); // Compression method
      cdView.setUint16(12, 0, true); // File last modification time
      cdView.setUint16(14, 0, true); // File last modification date
      cdView.setUint32(16, crc, true); // CRC-32
      cdView.setUint32(20, compressed.length, true); // Compressed size
      cdView.setUint32(24, data.length, true); // Uncompressed size
      cdView.setUint16(28, nameBytes.length, true); // File name length
      cdView.setUint16(30, 0, true); // Extra field length
      cdView.setUint16(32, 0, true); // Comment length
      cdView.setUint16(34, 0, true); // Disk number
      cdView.setUint16(36, 0, true); // Internal file attributes
      cdView.setUint32(38, 0, true); // External file attributes
      cdView.setUint32(42, offset, true); // Relative offset
      cdHeader.set(nameBytes, 46); // File name

      centralDirectory.push(cdHeader);
      offset += localHeader.length + compressed.length;
      fileCount++;
    }

    // Combine all chunks
    const cdSize = centralDirectory.reduce((sum, cd) => sum + cd.length, 0);
    const cdOffset = offset;

    const endRecord = new Uint8Array(22);
    const erView = new DataView(endRecord.buffer);
    erView.setUint32(0, 0x06054b50, true); // End of central directory signature
    erView.setUint16(4, 0, true); // Number of this disk
    erView.setUint16(6, 0, true); // Disk with central directory
    erView.setUint16(8, fileCount, true); // Number of entries on this disk
    erView.setUint16(10, fileCount, true); // Total number of entries
    erView.setUint32(12, cdSize, true); // Size of central directory
    erView.setUint32(16, cdOffset, true); // Offset of start of central directory
    erView.setUint16(20, 0, true); // Comment length

    const totalSize = offset + cdSize + endRecord.length;
    const result = new Uint8Array(totalSize);
    let pos = 0;

    for (const chunk of chunks) {
      result.set(chunk, pos);
      pos += chunk.length;
    }

    for (const cd of centralDirectory) {
      result.set(cd, pos);
      pos += cd.length;
    }

    result.set(endRecord, pos);

    return result;
  }

  private crc32(data: Uint8Array): number {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[i] = c;
    }

    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];

    for (const inputFile of inputFiles) {
      let extractedFiles: Map<string, Uint8Array>;

      try {
        if (inputFormat.internal === "gz") {
          const decompressed = ungzip(inputFile.bytes);
          const name = inputFile.name.replace(/\.gz$/i, "");
          extractedFiles = new Map([[name, decompressed]]);
        } else if (inputFormat.internal === "zip") {
          extractedFiles = await this.extractWithLibarchive(inputFile.bytes);
        } else {
          extractedFiles = await this.extractWithLibarchive(inputFile.bytes);
        }

        if (outputFormat.internal === "zip") {
          const zipData = await this.createZip(extractedFiles);
          const outputName = inputFile.name.replace(/\.[^/.]+$/, ".zip");
          outputFiles.push({ bytes: zipData, name: outputName });
        } else if (outputFormat.internal === "gz") {
          if (extractedFiles.size !== 1) {
            throw "GZIP only supports single file compression";
          }
          const [name, data] = Array.from(extractedFiles.entries())[0];
          const compressed = gzip(data);
          const outputName = name + ".gz";
          outputFiles.push({ bytes: compressed, name: outputName });
        } else {
          for (const [name, data] of extractedFiles) {
            outputFiles.push({ bytes: data, name });
          }
        }
      } catch (e) {
        throw `Failed to process ${inputFormat.format} archive: ${e}`;
      }
    }

    return outputFiles;
  }

}

export default archiveHandler;
