import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_SOURCE_URL =
  'https://trace.kamsker.at/js/script.outbound-links.pageview-props.tagged-events.js';
const DEFAULT_OUTPUT_PATH = 'assets/js/site-events.js';
const DEFAULT_FALLBACK_PATH =
  'scripts/fallback/plausible.outbound-links.pageview-props.tagged-events.js';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

async function fetchPlausibleScript(sourceUrl) {
  const res = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'jkamsker.github.io build',
      accept: 'application/javascript,text/javascript,*/*;q=0.8',
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${sourceUrl}: ${res.status} ${res.statusText}`);
  }

  const script = await res.text();
  return normalizePlausibleScript(script, sourceUrl);
}

function normalizePlausibleScript(script, sourceLabel) {
  if (!script.includes('window.plausible')) {
    throw new Error(`Script does not look like Plausible Analytics: ${sourceLabel}`);
  }

  return script.endsWith('\n') ? script : `${script}\n`;
}

async function readFallbackScript(fallbackPath) {
  const script = await fs.readFile(fallbackPath, 'utf8');
  return normalizePlausibleScript(script, fallbackPath);
}

function resolveFallbackPath(fallbackPath) {
  return path.isAbsolute(fallbackPath)
    ? fallbackPath
    : path.resolve(REPO_ROOT, fallbackPath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const buildDir = path.resolve(args._[0] ?? 'build');
  const sourceUrl = args.source ?? DEFAULT_SOURCE_URL;
  const outputPath = args.out ?? DEFAULT_OUTPUT_PATH;
  const fallbackPath = resolveFallbackPath(args.fallback ?? DEFAULT_FALLBACK_PATH);
  const absoluteOutputPath = path.join(buildDir, outputPath);

  let script;
  let sourceDescription;
  try {
    script = await fetchPlausibleScript(sourceUrl);
    sourceDescription = sourceUrl;
  } catch (err) {
    process.stderr.write(
      `Warning: ${err.message}\nUsing fallback Plausible script from ${path.relative(
        process.cwd(),
        fallbackPath
      )}\n`
    );
    script = await readFallbackScript(fallbackPath);
    sourceDescription = path.relative(process.cwd(), fallbackPath);
  }

  await fs.mkdir(path.dirname(absoluteOutputPath), { recursive: true });
  await fs.writeFile(absoluteOutputPath, script, 'utf8');

  process.stdout.write(
    `Copied Plausible script from ${sourceDescription} to ${path.relative(
      process.cwd(),
      absoluteOutputPath
    )}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
