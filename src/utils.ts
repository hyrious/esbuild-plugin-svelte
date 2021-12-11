import esbuild, { PartialMessage } from "esbuild";

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
  const result = await esbuild.formatMessages(arg, {
    kind: "warning",
    color: true,
  });
  for (const string of result) {
    console.warn(string);
  }
}
