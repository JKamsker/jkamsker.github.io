import fs from 'node:fs/promises';
import path from 'node:path';

import { PurgeCSS } from 'purgecss';
import * as csso from 'csso';

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listFilesRecursive(rootDir) {
  const result = [];
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      result.push(...(await listFilesRecursive(full)));
    } else if (entry.isFile()) {
      result.push(full);
    }
  }
  return result;
}

async function detectBasePrefix(buildDir) {
  const allFiles = await listFilesRecursive(buildDir);
  const htmlFiles = allFiles.filter((p) => p.toLowerCase().endsWith('.html'));

  const re = /href="([^"]*?)\/assets\/css\/main\.css"/i;
  for (const htmlPath of htmlFiles) {
    const html = await fs.readFile(htmlPath, 'utf8');
    const match = html.match(re);
    if (!match) continue;

    const prefix = match[1] ?? '';
    return prefix === '/' ? '' : prefix.replace(/\/$/, '');
  }

  return '';
}

function rebaseCssUrls({ cssText, sourcePathPosix, basePrefix }) {
  const sourceDir = path.posix.dirname(sourcePathPosix);
  return cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (full, quote, rawUrl) => {
    const url = rawUrl.trim();
    if (
      url.startsWith('data:') ||
      url.startsWith('http:') ||
      url.startsWith('https:') ||
      url.startsWith('//') ||
      url.startsWith('#')
    ) {
      return full;
    }

    const suffixIndex = url.search(/[?#]/);
    const urlPath = suffixIndex === -1 ? url : url.slice(0, suffixIndex);
    const suffix = suffixIndex === -1 ? '' : url.slice(suffixIndex);
    if (!urlPath) return full;

    const rebasedPath =
      urlPath.startsWith('/')
        ? urlPath
        : path.posix.normalize(path.posix.join('/', sourceDir, urlPath)).replace(/^\//, '/');

    const base = basePrefix ? `${basePrefix}` : '';
    const finalUrl = `${base}${rebasedPath}${suffix}`.replace(/\/{2,}/g, '/');
    const q = quote || '"';
    return `url(${q}${finalUrl}${q})`;
  });
}

async function buildVendorCss({ basePrefix }) {
  const sources = [
    'assets/bower_components/lightgallery/dist/css/lightgallery.min.css',
    'assets/bower_components/bootstrap/dist/css/bootstrap.min.css',
    'assets/bower_components/font-awesome/web-fonts-with-css/css/fontawesome-all.min.css',
    'assets/bower_components/icono/dist/icono.min.css',
  ];

  const chunks = [];
  for (const relPath of sources) {
    const absPath = path.resolve(relPath);
    const raw = stripBom(await fs.readFile(absPath, 'utf8'));
    const rebased = rebaseCssUrls({
      cssText: raw,
      sourcePathPosix: relPath.replaceAll('\\', '/'),
      basePrefix,
    });
    chunks.push(`/* ${relPath} */\n${rebased}`);
  }

  return chunks.join('\n\n');
}

async function purgeAndMinifyCss({ cssText, buildDir }) {
  const allFiles = await listFilesRecursive(buildDir);
  const content = allFiles.filter((p) => {
    const lower = p.toLowerCase();
    return (
      lower.endsWith('.html') ||
      lower.endsWith('.js') ||
      lower.endsWith('.xml') ||
      lower.endsWith('.json')
    );
  });

  const purger = new PurgeCSS();
  const purged = await purger.purge({
    content,
    css: [{ raw: cssText }],
    safelist: {
      standard: [
        'active',
        'fade',
        'show',
        'collapse',
        'collapsing',
        'collapsed',
        'modal',
        'modal-open',
        'dropdown',
        'dropdown-menu',
        'dropdown-toggle',
        'dropup',
        'tooltip',
        'popover',
      ],
      greedy: [/^lg-/, /^lightgallery/, /^navbar/, /^modal/, /^tooltip/, /^popover/, /^dropdown/],
    },
    defaultExtractor: (content) => content.match(/[A-Za-z0-9_-]+/g) ?? [],
    keyframes: true,
  });

  const css = purged[0]?.css ?? cssText;
  const minified = csso.minify(css, { restructure: true }).css;
  return minified;
}

async function removeBundledFiles({ buildDir }) {
  const toRemove = [
    'assets/bower_components/lightgallery/dist/css/lightgallery.min.css',
    'assets/bower_components/lightgallery/dist/css/lightgallery.min.css.map',
    'assets/bower_components/bootstrap/dist/css/bootstrap.min.css',
    'assets/bower_components/bootstrap/dist/css/bootstrap.min.css.map',
    'assets/bower_components/font-awesome/web-fonts-with-css/css/fontawesome-all.min.css',
    'assets/bower_components/font-awesome/web-fonts-with-css/css/fontawesome-all.min.css.map',
    'assets/bower_components/icono/dist/icono.min.css',
    'assets/bower_components/icono/dist/icono.min.css.map',
  ];

  for (const rel of toRemove) {
    const abs = path.join(buildDir, rel);
    if (!(await fileExists(abs))) continue;
    await fs.rm(abs, { force: true });
  }
}

async function main() {
  const buildDir = path.resolve(process.argv[2] ?? 'build');
  if (!(await fileExists(buildDir))) {
    throw new Error(`Build dir not found: ${buildDir}`);
  }

  const basePrefix = await detectBasePrefix(buildDir);
  const vendorRaw = await buildVendorCss({ basePrefix });
  const vendorOptimized = await purgeAndMinifyCss({ cssText: vendorRaw, buildDir });

  const outDir = path.join(buildDir, 'assets', 'css');
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, 'vendor.css'), vendorOptimized, 'utf8');

  await removeBundledFiles({ buildDir });
  process.stdout.write(`Wrote ${path.join(buildDir, 'assets', 'css', 'vendor.css')}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
