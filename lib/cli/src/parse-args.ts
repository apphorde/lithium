export function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const options: Record<string, string | boolean> = {};
  const args: string[] = [];
  let flag = '';

  for (const next of argv) {
    if (next.startsWith('--')) {
      if (flag) {
        options[flag] = true;
      }

      flag = next.slice(2);
      continue;
    }

    if (flag) {
      options[flag] = next;
      flag = '';
    } else {
      args.push(next);
    }
  }

  return { args, options };
}

export interface Args {
  options: Record<string, string | boolean>;
  args: string[];
}
