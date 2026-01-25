function normalizeMimeType (mime: string) {
  switch (mime) {
    case "audio/x-wav": return "audio/wav";
    case "audio/vnd.wave": return "audio/wav";
    case "image/x-icon": return "image/vnd.microsoft.icon";
  }
  return mime;
}

export default normalizeMimeType;
