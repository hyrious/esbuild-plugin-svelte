import { formatMessages, Location, PartialMessage } from "esbuild";
import { Warning } from "svelte/types/compiler/interfaces";

export const quote = JSON.stringify.bind(JSON);

export async function warn(
  message: string | PartialMessage | PartialMessage[]
) {
  let arg: PartialMessage[];
  if (typeof message === "string") {
    arg = [{ text: message }];
  } else if (!Array.isArray(message)) {
    arg = [message];
  } else {
    arg = message;
  }
  const result = await formatMessages(arg, {
    kind: "warning",
    color: true,
  });
  for (const string of result) {
    console.warn(string);
  }
}

export function makeArray<T>(a: T | T[]): T[] {
  return Array.isArray(a) ? a : [a];
}

export function convertMessage(
  { message, start, end }: Warning,
  filename: string,
  source: string
) {
  let location: Partial<Location> | undefined;
  if (start && end) {
    let lineText = source.split(/\r\n|\r|\n/g)[start.line - 1];
    /* c8 ignore next */
    let lineEnd = start.line === end.line ? end.column : lineText.length;
    location = {
      file: filename,
      line: start.line,
      column: start.column,
      length: lineEnd - start.column,
      lineText,
    };
  }
  return { text: message, location };
}
