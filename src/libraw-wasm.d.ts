declare module "libraw-wasm" {
  interface LibRawMetadata {
    width: number;
    height: number;
    [key: string]: any;
  }

  interface LibRawSettings {
    bright?: number;
    threshold?: number;
    halfSize?: boolean;
    useAutoWb?: boolean;
    useCameraWb?: boolean;
    outputColor?: number;
    outputBps?: number;
    [key: string]: any;
  }

  class LibRaw {
    constructor();
    open(buffer: Uint8Array, settings?: LibRawSettings): Promise<void>;
    metadata(fullOutput?: boolean): Promise<LibRawMetadata>;
    imageData(): Promise<Uint8Array>;
    recycle(): void;
  }

  export default LibRaw;
}
