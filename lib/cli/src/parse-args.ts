export function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const options: Record<string, string | boolean> = {};
  const args: string[] = [];
  let flag = "";

  for (const next of argv) {
    if (next.startsWith("--")) {
      if (flag) {
        options[flag] = true;
      }

      const [name, value] = next.slice(2).split("=", 2);
      if (value !== undefined) {
        options[name] = value === "" ? true : value;
        flag = "";
        continue;
      }

      flag = name;
      continue;
    }

    if (flag) {
      options[flag] = next;
      flag = "";
    } else {
      args.push(next);
    }
  }

  if (flag) {
    options[flag] = true;
  }

  return { args, options };
}

export interface Args {
  options: Record<string, string | boolean>;
  args: string[];
}
