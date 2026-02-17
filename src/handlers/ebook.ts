import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

// @ts-expect-error foliate-js has no TypeScript declarations
import { makeBook } from "foliate-js/view.js";

interface EbookSection {
  createDocument(): Promise<Document>;
}

interface EbookBook {
  metadata?: {
    title?: string;
    author?: string | string[] | { name?: string }[];
  };
  sections?: EbookSection[];
}

class ebookHandler implements FormatHandler {

  public name: string = "ebook";

  public supportedFormats: FileFormat[] = [
    {
      name: "Electronic Publication",
      format: "epub",
      extension: "epub",
      mime: "application/epub+zip",
      from: true,
      to: false,
      internal: "epub"
    },
    {
      name: "Mobipocket eBook",
      format: "mobi",
      extension: "mobi",
      mime: "application/x-mobipocket-ebook",
      from: true,
      to: false,
      internal: "mobi"
    },
    {
      name: "Amazon Kindle eBook",
      format: "azw",
      extension: "azw",
      mime: "application/vnd.amazon.ebook",
      from: true,
      to: false,
      internal: "azw"
    },
    {
      name: "Amazon Kindle Format 8",
      format: "azw3",
      extension: "azw3",
      mime: "application/vnd.amazon.mobi8-ebook",
      from: true,
      to: false,
      internal: "azw3"
    },
    {
      name: "Hypertext Markup Language",
      format: "html",
      extension: "html",
      mime: "text/html",
      from: false,
      to: true,
      internal: "html"
    }
  ];

  public ready: boolean = true;

  async init () {
    this.ready = true;
  }

  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {

    if (outputFormat.internal !== "html") throw "Invalid output format.";

    const outputFiles: FileData[] = [];
    const encoder = new TextEncoder();

    for (const inputFile of inputFiles) {
      const file = new File([new Uint8Array(inputFile.bytes)], inputFile.name);
      
      const book: EbookBook = await makeBook(file);
      
      const sections: string[] = [];
      
      const metadata = book.metadata || {};
      const title = metadata.title || inputFile.name.split(".")[0];
      
      if (title) {
        sections.push(`<h1>${this.escapeHtml(title)}</h1>`);
      }
      
      if (metadata.author) {
        const author = this.formatAuthor(metadata.author);
        if (author) {
          sections.push(`<p><em>by ${this.escapeHtml(author)}</em></p>`);
        }
      }
      
      if (book.sections && book.sections.length > 0) {
        for (const section of book.sections) {
          try {
            const doc = await section.createDocument();
            if (doc?.body) {
              sections.push(doc.body.innerHTML);
            } else if (doc?.documentElement) {
              sections.push(doc.documentElement.innerHTML);
            }
          } catch (e) {
            console.warn("Failed to load section:", e);
          }
        }
      }
      
      const html = `<div style="background: #fff; padding: 20px; max-width: 800px; margin: 0 auto;">
        ${sections.join("\n")}
      </div>`;
      
      const bytes = encoder.encode(html);
      const baseName = inputFile.name.split(".")[0];
      const name = baseName + "." + outputFormat.extension;
      
      outputFiles.push({ bytes, name });
    }

    return outputFiles;

  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatAuthor(author: string | string[] | { name?: string }[]): string {
    if (typeof author === 'string') return author;
    if (Array.isArray(author)) {
      return author.map(a => typeof a === 'string' ? a : a.name || '').filter(Boolean).join(', ');
    }
    return '';
  }

}

export default ebookHandler;
