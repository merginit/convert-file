import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

class jsonHandler implements FormatHandler {

  public name = "json";

  public supportedFormats: FileFormat[] = [
    {
      name: "JavaScript Object Notation",
      format: "json",
      extension: "json",
      mime: "application/json",
      from: true,
      to: true,
      internal: "json"
    },
    {
      name: "Comma-Separated Values",
      format: "csv",
      extension: "csv",
      mime: "text/csv",
      from: true,
      to: true,
      internal: "csv"
    },
    {
      name: "YAML Ain't Markup Language",
      format: "yaml",
      extension: "yaml",
      mime: "application/yaml",
      from: true,
      to: true,
      internal: "yaml"
    },
    {
      name: "YAML Ain't Markup Language",
      format: "yml",
      extension: "yml",
      mime: "application/yaml",
      from: true,
      to: true,
      internal: "yaml"
    },
    {
      name: "Extensible Markup Language",
      format: "xml",
      extension: "xml",
      mime: "application/xml",
      from: true,
      to: true,
      internal: "xml"
    }
  ];

  public ready = true;

  async init() {
    this.ready = true;
  }

  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  private flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(result, this.flattenObject(value as Record<string, unknown>, newKey));
      } else {
        result[newKey] = value;
      }
    }
    return result;
  }

  private jsonToCsv(json: unknown[]): string {
    if (!Array.isArray(json) || json.length === 0) {
      throw "JSON must be a non-empty array of objects for CSV conversion";
    }

    const flatData = json.map(item => 
      typeof item === "object" && item !== null 
        ? this.flattenObject(item as Record<string, unknown>)
        : { value: item }
    );

    const allKeys = new Set<string>();
    flatData.forEach(row => Object.keys(row).forEach(key => allKeys.add(key)));
    const headers = Array.from(allKeys);

    const rows = flatData.map(row => 
      headers.map(key => this.escapeCsvValue(row[key])).join(",")
    );

    return [headers.join(","), ...rows].join("\n");
  }

  private csvToJson(csv: string): unknown[] {
    const lines = csv.split("\n").filter(line => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0].split(",").map(h => h.trim());
    const result: unknown[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const obj: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        obj[header] = values[index] ?? "";
      });
      result.push(obj);
    }

    return result;
  }

  private parseCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          current += '"';
          i++;
        } else if (char === '"') {
          inQuotes = false;
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          values.push(current);
          current = "";
        } else {
          current += char;
        }
      }
    }
    values.push(current);
    return values;
  }

  private jsonToYaml(json: unknown, indent = 0): string {
    const spaces = "  ".repeat(indent);

    if (json === null) return "null";
    if (typeof json === "boolean") return json ? "true" : "false";
    if (typeof json === "number") return String(json);
    if (typeof json === "string") {
      if (json.includes(":") || json.includes("#") || json.includes("\n") || json.startsWith(" ")) {
        return `"${json.replace(/"/g, '\\"')}"`;
      }
      return json;
    }

    if (Array.isArray(json)) {
      if (json.length === 0) return "[]";
      return json
        .map(item => `${spaces}- ${this.jsonToYaml(item, indent + 1).trimStart()}`)
        .join("\n");
    }

    if (typeof json === "object") {
      const obj = json as Record<string, unknown>;
      const entries = Object.entries(obj);
      if (entries.length === 0) return "{}";
      return entries
        .map(([key, value]) => {
          const yamlValue = this.jsonToYaml(value, indent + 1);
          if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            return `${spaces}${key}:\n${yamlValue}`;
          } else if (Array.isArray(value)) {
            return `${spaces}${key}:\n${yamlValue}`;
          } else {
            return `${spaces}${key}: ${yamlValue}`;
          }
        })
        .join("\n");
    }

    return String(json);
  }

  private yamlToJson(yaml: string): unknown {
    const lines = yaml.split("\n");
    const { result } = this.parseYamlValue(lines, 0, 0);
    return result;
  }

  private parseYamlValue(lines: string[], startIndex: number, baseIndent: number): { result: unknown; nextIndex: number } {
    if (startIndex >= lines.length) return { result: null, nextIndex: startIndex };

    const line = lines[startIndex];
    const trimmed = line.trim();

    if (trimmed === "" || trimmed.startsWith("#")) {
      return this.parseYamlValue(lines, startIndex + 1, baseIndent);
    }

    if (trimmed === "[]") return { result: [], nextIndex: startIndex + 1 };
    if (trimmed === "{}") return { result: {}, nextIndex: startIndex + 1 };
    if (trimmed === "null") return { result: null, nextIndex: startIndex + 1 };
    if (trimmed === "true") return { result: true, nextIndex: startIndex + 1 };
    if (trimmed === "false") return { result: false, nextIndex: startIndex + 1 };

    if (!isNaN(Number(trimmed)) && trimmed !== "") {
      return { result: Number(trimmed), nextIndex: startIndex + 1 };
    }

    if (trimmed.startsWith("- ")) {
      const arr: unknown[] = [];
      let i = startIndex;
      while (i < lines.length) {
        const currentLine = lines[i];
        const currentTrimmed = currentLine.trim();
        const currentIndent = currentLine.length - currentLine.trimStart().length;

        if (currentTrimmed === "" || currentTrimmed.startsWith("#")) {
          i++;
          continue;
        }

        if (currentIndent < baseIndent) break;
        if (!currentTrimmed.startsWith("- ")) break;

        const itemValue = currentTrimmed.slice(2);
        if (itemValue === "") {
          const { result, nextIndex } = this.parseYamlValue(lines, i + 1, currentIndent + 2);
          arr.push(result);
          i = nextIndex;
        } else {
          arr.push(this.parseYamlScalar(itemValue));
          i++;
        }
      }
      return { result: arr, nextIndex: i };
    }

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex > 0) {
      const obj: Record<string, unknown> = {};
      let i = startIndex;

      while (i < lines.length) {
        const currentLine = lines[i];
        const currentTrimmed = currentLine.trim();
        const currentIndent = currentLine.length - currentLine.trimStart().length;

        if (currentTrimmed === "" || currentTrimmed.startsWith("#")) {
          i++;
          continue;
        }

        if (currentIndent < baseIndent) break;

        const currentColonIndex = currentTrimmed.indexOf(":");
        if (currentColonIndex <= 0) break;

        const key = currentTrimmed.slice(0, currentColonIndex);
        const valueStr = currentTrimmed.slice(currentColonIndex + 1).trim();

        if (valueStr === "") {
          const { result, nextIndex } = this.parseYamlValue(lines, i + 1, currentIndent + 2);
          obj[key] = result;
          i = nextIndex;
        } else {
          obj[key] = this.parseYamlScalar(valueStr);
          i++;
        }
      }
      return { result: obj, nextIndex: i };
    }

    return { result: this.parseYamlScalar(trimmed), nextIndex: startIndex + 1 };
  }

  private parseYamlScalar(value: string): unknown {
    if (value === "null") return null;
    if (value === "true") return true;
    if (value === "false") return false;
    if (!isNaN(Number(value)) && value !== "") return Number(value);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    return value;
  }

  private jsonToXml(json: unknown, rootName = "root", indent = 0): string {
    const spaces = "  ".repeat(indent);

    if (json === null) return `${spaces}<${rootName} />`;

    if (typeof json === "boolean" || typeof json === "number" || typeof json === "string") {
      const escaped = String(json)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
      return `${spaces}<${rootName}>${escaped}</${rootName}>`;
    }

    if (Array.isArray(json)) {
      const itemName = rootName.endsWith("s") ? rootName.slice(0, -1) : "item";
      const items = json
        .map(item => this.jsonToXml(item, itemName, indent + 1))
        .join("\n");
      return `${spaces}<${rootName}>\n${items}\n${spaces}</${rootName}>`;
    }

    if (typeof json === "object") {
      const obj = json as Record<string, unknown>;
      const entries = Object.entries(obj);
      if (entries.length === 0) return `${spaces}<${rootName} />`;

      const children = entries
        .map(([key, value]) => this.jsonToXml(value, key, indent + 1))
        .join("\n");
      return `${spaces}<${rootName}>\n${children}\n${spaces}</${rootName}>`;
    }

    return `${spaces}<${rootName}>${String(json)}</${rootName}>`;
  }

  private xmlToJson(xml: string): unknown {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    const errorNode = doc.querySelector("parsererror");
    if (errorNode) {
      throw "Invalid XML format";
    }
    return this.domNodeToJson(doc.documentElement);
  }

  private domNodeToJson(node: Element): unknown {
    const children = Array.from(node.children);
    const textContent = node.textContent?.trim();

    if (children.length === 0) {
      if (textContent === null || textContent === undefined || textContent === "") {
        return node.getAttribute("nil") === "true" ? null : "";
      }
      if (textContent === "true") return true;
      if (textContent === "false") return false;
      if (!isNaN(Number(textContent)) && textContent !== "") return Number(textContent);
      return textContent;
    }

    const obj: Record<string, unknown> = {};

    const childGroups = new Map<string, Element[]>();
    children.forEach(child => {
      const group = childGroups.get(child.tagName) || [];
      group.push(child);
      childGroups.set(child.tagName, group);
    });

    childGroups.forEach((group, tagName) => {
      if (group.length === 1) {
        obj[tagName] = this.domNodeToJson(group[0]);
      } else {
        obj[tagName] = group.map(child => this.domNodeToJson(child));
      }
    });

    return obj;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {
    const outputFiles: FileData[] = [];

    if (inputFormat.internal === outputFormat.internal) {
      throw "Input and output formats are the same";
    }

    for (const file of inputFiles) {
      const inputText = new TextDecoder().decode(file.bytes);
      let outputText: string;
      let outputData: unknown;

      try {
        outputData = inputFormat.internal === "json" ? JSON.parse(inputText) : inputText;
      } catch (e) {
        throw `Failed to parse ${inputFormat.format.toUpperCase()}: ${e}`;
      }

      if (inputFormat.internal === "json") {
        switch (outputFormat.internal) {
          case "csv":
            outputText = this.jsonToCsv(outputData as unknown[]);
            break;
          case "yaml":
            outputText = this.jsonToYaml(outputData);
            break;
          case "xml":
            outputText = '<?xml version="1.0" encoding="UTF-8"?>\n' + this.jsonToXml(outputData);
            break;
          default:
            throw `Unsupported output format: ${outputFormat.format}`;
        }
      } else if (inputFormat.internal === "csv") {
        const json = this.csvToJson(outputData as string);
        if (outputFormat.internal === "json") {
          outputText = JSON.stringify(json, null, 2);
        } else if (outputFormat.internal === "yaml") {
          outputText = this.jsonToYaml(json);
        } else if (outputFormat.internal === "xml") {
          outputText = '<?xml version="1.0" encoding="UTF-8"?>\n' + this.jsonToXml(json);
        } else {
          throw `Unsupported output format: ${outputFormat.format}`;
        }
      } else if (inputFormat.internal === "yaml") {
        const json = this.yamlToJson(outputData as string);
        if (outputFormat.internal === "json") {
          outputText = JSON.stringify(json, null, 2);
        } else if (outputFormat.internal === "csv") {
          outputText = this.jsonToCsv(json as unknown[]);
        } else if (outputFormat.internal === "xml") {
          outputText = '<?xml version="1.0" encoding="UTF-8"?>\n' + this.jsonToXml(json);
        } else {
          throw `Unsupported output format: ${outputFormat.format}`;
        }
      } else if (inputFormat.internal === "xml") {
        const json = this.xmlToJson(outputData as string);
        if (outputFormat.internal === "json") {
          outputText = JSON.stringify(json, null, 2);
        } else if (outputFormat.internal === "csv") {
          outputText = this.jsonToCsv(json as unknown[]);
        } else if (outputFormat.internal === "yaml") {
          outputText = this.jsonToYaml(json);
        } else {
          throw `Unsupported output format: ${outputFormat.format}`;
        }
      } else {
        throw `Unsupported input format: ${inputFormat.format}`;
      }

      const outputBytes = new TextEncoder().encode(outputText);
      const outputName = file.name.replace(/\.[^/.]+$/, "." + outputFormat.extension);

      outputFiles.push({
        name: outputName,
        bytes: new Uint8Array(outputBytes)
      });
    }

    return outputFiles;
  }

}

export default jsonHandler;
