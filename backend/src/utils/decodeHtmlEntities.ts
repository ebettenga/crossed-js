const htmlEntityMap: Record<string, string> = {
  "&amp;": "&",
  "&quot;": "\"",
  "&apos;": "'",
  "&#39;": "'",
  "&lsquo;": "'",
  "&rsquo;": "'",
  "&ldquo;": "\"",
  "&rdquo;": "\"",
  "&nbsp;": " ",
  "&ndash;": "-",
  "&mdash;": "--",
  "&hellip;": "...",
};

const numericEntityRegex = /^#(\d+)$/;

export const decodeHtmlEntities = (input: string | undefined | null): string => {
  if (!input) {
    return "";
  }

  return input.replace(/&(#\d+|[a-zA-Z]+);/g, (entity, value) => {
    if (htmlEntityMap[entity]) {
      return htmlEntityMap[entity];
    }

    const numericMatch = numericEntityRegex.exec(value);
    if (numericMatch) {
      const codePoint = parseInt(numericMatch[1], 10);
      if (!Number.isNaN(codePoint)) {
        const char = String.fromCharCode(codePoint);
        return char.charCodeAt(0) < 32 ? "" : char;
      }
    }

    return entity;
  });
};
