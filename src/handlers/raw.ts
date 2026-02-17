import LibRaw from "libraw-wasm";
import normalizeMimeType from "../normalizeMimeType.ts";

import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

/**
 * Camera RAW Handler - Converts RAW image files to various formats.
 */
class rawHandler implements FormatHandler {

  public name: string = "libraw-wasm";

  public supportedFormats: FileFormat[] = [];

  public ready: boolean = false;

  async init () {
    const rawFormats = [
      // Canon
      { format: "cr2", name: "Canon RAW 2", mime: "image/x-canon-cr2" },
      { format: "cr3", name: "Canon RAW 3", mime: "image/x-canon-cr3" },
      { format: "crw", name: "Canon RAW", mime: "image/x-canon-crw" },
      // Nikon
      { format: "nef", name: "Nikon RAW", mime: "image/x-nikon-nef" },
      { format: "nrw", name: "Nikon RAW (NRW)", mime: "image/x-nikon-nrw" },
      // Sony
      { format: "arw", name: "Sony RAW", mime: "image/x-sony-arw" },
      { format: "sr2", name: "Sony RAW (SR2)", mime: "image/x-sony-sr2" },
      { format: "srf", name: "Sony RAW (SRF)", mime: "image/x-sony-srf" },
      // Adobe
      { format: "dng", name: "Digital Negative", mime: "image/x-adobe-dng" },
      // Fuji
      { format: "raf", name: "Fuji RAW", mime: "image/x-fuji-raf" },
      // Olympus
      { format: "orf", name: "Olympus RAW", mime: "image/x-olympus-orf" },
      // Panasonic
      { format: "rw2", name: "Panasonic RAW", mime: "image/x-panasonic-rw2" },
      { format: "raw", name: "Panasonic RAW (generic)", mime: "image/x-panasonic-raw" },
      // Pentax
      { format: "pef", name: "Pentax RAW", mime: "image/x-pentax-pef" },
      // Hasselblad
      { format: "3fr", name: "Hasselblad RAW", mime: "image/x-hasselblad-3fr" },
      { format: "fff", name: "Hasselblad RAW (FFF)", mime: "image/x-hasselblad-fff" },
      // Epson
      { format: "erf", name: "Epson RAW", mime: "image/x-epson-erf" },
      // Mamiya
      { format: "mef", name: "Mamiya RAW", mime: "image/x-mamiya-mef" },
      // Leaf
      { format: "mos", name: "Leaf RAW", mime: "image/x-leaf-mos" },
      // Kodak
      { format: "kdc", name: "Kodak RAW", mime: "image/x-kodak-kdc" },
      { format: "dcr", name: "Kodak RAW (DCR)", mime: "image/x-kodak-dcr" },
      { format: "k25", name: "Kodak K25", mime: "image/x-kodak-k25" },
      { format: "kc2", name: "Kodak KC2", mime: "image/x-kodak-kc2" },
      // Phase One
      { format: "iiq", name: "Phase One RAW", mime: "image/x-phaseone-iiq" },
      // Sigma
      { format: "x3f", name: "Sigma RAW", mime: "image/x-sigma-x3f" },
      // Minolta
      { format: "mrw", name: "Minolta RAW", mime: "image/x-minolta-mrw" },
      // Samsung
      { format: "srw", name: "Samsung RAW", mime: "image/x-samsung-srw" },
      // GoPro
      { format: "gpr", name: "GoPro RAW", mime: "image/x-gopro-gpr" },
      // Arri
      { format: "ari", name: "Arri RAW", mime: "image/x-arri-ari" },
      // Phantom
      { format: "cine", name: "Phantom CINE", mime: "image/x-phantom-cine" },
      // Sinar
      { format: "cs1", name: "Sinar RAW", mime: "image/x-sinar-cs1" },
      // Leica
      { format: "rw1", name: "Leica RAW (RW1)", mime: "image/x-leica-rw1" },
      // Ricoh
      { format: "rdc", name: "Ricoh RDC", mime: "image/x-ricoh-rdc" },
      // Apple
      { format: "qtk", name: "Apple QuickTake", mime: "image/x-apple-qtk" },
      // Other/Generic
      { format: "bay", name: "Casio RAW (BAY)", mime: "image/x-casio-bay" },
      { format: "bmq", name: "BMQ RAW", mime: "image/x-bmq" },
      { format: "cap", name: "Phase One CAP", mime: "image/x-phaseone-cap" },
      { format: "dc2", name: "Kodak DC2", mime: "image/x-kodak-dc2" },
      { format: "ia", name: "Sinar IA", mime: "image/x-sinar-ia" },
      { format: "mdc", name: "Minolta MDC", mime: "image/x-minolta-mdc" },
      { format: "pfm", name: "Portable Float Map", mime: "image/x-portable-float-map" },
      { format: "pxn", name: "Logitech PixArt", mime: "image/x-pxn" }
    ];

    for (const rawFormat of rawFormats) {
      this.supportedFormats.push({
        name: rawFormat.name,
        format: rawFormat.format,
        extension: rawFormat.format,
        mime: normalizeMimeType(rawFormat.mime),
        from: true,
        to: false,
        internal: rawFormat.format
      });
    }

    this.ready = true;
  }

  async doConvert (
    inputFiles: FileData[],
    _inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {

    const outputFiles: FileData[] = [];

    for (const inputFile of inputFiles) {
      const raw = new LibRaw();

      try {
        await raw.open(inputFile.bytes);

        const imageData = await raw.imageData();

        const meta = await raw.metadata();

        if (!imageData || !meta) {
          throw new Error("Failed to decode RAW file");
        }

        const canvas = document.createElement("canvas");
        canvas.width = meta.width;
        canvas.height = meta.height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          throw new Error("Failed to get canvas context");
        }

        const imgData = ctx.createImageData(meta.width, meta.height);

        const rgbData = imageData;
        const rgbaData = imgData.data;

        for (let i = 0, j = 0; i < rgbData.length; i += 3, j += 4) {
          rgbaData[j] = rgbData[i];           // R
          rgbaData[j + 1] = rgbData[i + 1];   // G
          rgbaData[j + 2] = rgbData[i + 2];   // B
          rgbaData[j + 3] = 255;              // A (fully opaque)
        }

        ctx.putImageData(imgData, 0, 0);

        const outputMime = outputFormat.mime;

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), outputMime);
        });

        if (!blob) {
          throw new Error(`Failed to convert RAW to ${outputFormat.format}`);
        }

        const bytes = new Uint8Array(await blob.arrayBuffer());

        const baseName = inputFile.name.split(".")[0];
        const name = baseName + "." + outputFormat.extension;
        outputFiles.push({ bytes, name });

      } finally {
        raw.recycle();
      }
    }

    return outputFiles;
  }

}

export default rawHandler;
