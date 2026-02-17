import { readPsd } from "ag-psd";
import normalizeMimeType from "../normalizeMimeType.ts";

import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

/**
 * PSD Handler - Converts PSD files to various image formats.
 * For output to other formats, uses canvas-based conversion.
 */
class psdHandler implements FormatHandler {

  public name: string = "ag-psd";

  public supportedFormats: FileFormat[] = [];

  public ready: boolean = false;

  async init () {
    this.supportedFormats = [
      {
        name: "Photoshop Document",
        format: "psd",
        extension: "psd",
        mime: normalizeMimeType("image/vnd.adobe.photoshop"),
        from: true,
        to: false,
        internal: "psd"
      }
    ];

    this.ready = true;
  }

  async doConvert (
    inputFiles: FileData[],
    _inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {

    const outputFiles: FileData[] = [];

    for (const inputFile of inputFiles) {
      const psd = readPsd(inputFile.bytes.buffer as ArrayBuffer);

      // check for unsupported bit depths (ag-psd doesn't support 16-bit or 32-bit)
      if (psd.bitsPerChannel && psd.bitsPerChannel > 8) {
        throw new Error(
          `PSD files with ${psd.bitsPerChannel}-bit color depth are not supported. ` +
          `Please convert to 8-bit in Photoshop first (Image > Mode > 8 Bits/Channel).`
        );
      }

      if (!psd.canvas) {
        throw new Error("Failed to read PSD file - no canvas data available");
      }

      const canvas = psd.canvas;
      const outputMime = outputFormat.mime;

      const blob = await new Promise<Blob | null>((resolve) => {
        if (canvas) {
          canvas.toBlob((b) => resolve(b), outputMime);
        } else {
          resolve(null);
        }
      });

      if (!blob) {
        throw new Error(`Failed to convert PSD to ${outputFormat.format}`);
      }

      const bytes = new Uint8Array(await blob.arrayBuffer());

      const baseName = inputFile.name.split(".")[0];
      const name = baseName + "." + outputFormat.extension;
      outputFiles.push({ bytes, name });
    }

    return outputFiles;
  }

}

export default psdHandler;
