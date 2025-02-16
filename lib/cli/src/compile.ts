import { parseSFC } from '@li3/sfc';
import type { Args } from './parse-args.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export default async function (args: Args) {
  const [inputFile = '-', outputFile = '-'] = args.args;
  const source = inputFile === '-' ? Buffer.concat(await process.stdin.toArray()) : readFile(inputFile);

  const json = JSON.stringify(parseSFC(source.toString('utf8')));

  if (outputFile === '-') {
    return console.log(json);
  }

  mkdirSync(dirname(outputFile), { recursive: true });
  writeFileSync(outputFile, json, 'utf-8');
}

function readFile(inputFile) {
  if (!existsSync(inputFile)) {
    throw new Error('File not found: ' + inputFile);
  }

  return readFileSync(inputFile);
}
