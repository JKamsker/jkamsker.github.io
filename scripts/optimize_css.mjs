import fs from 'node:fs/promises';
import path from 'node:path';

import { PurgeCSS } from 'purgecss';
import * as csso from 'csso';

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function ensureTrailingSlash(url) {
  return url.endsWith('/') ? url : `${url}/`;
}

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

async function readBenchmarkUrls(benchmarkPath) {
  const raw = await fs.readFile(benchmarkPath, 'utf8');
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.urls) || data.urls.length === 0) {
    throw new Error(`Invalid benchmark file (expected {\"urls\": [...] }): ${benchmarkPath}`);
  }
  return data.urls;
}

function urlPathname(input) {
  try {
    return new URL(input).pathname;
  } catch {
    return input;
  }
}

async function resolveBenchmarkHtmlFiles({ buildDir, urls }) {
  const htmlFiles = [];
  const missing = [];

  for (const url of urls) {
    const pathname = urlPathname(url);
    const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
    const relBase = normalized.replace(/^\//, '');

    const candidates = [];
    if (normalized === '/' || normalized === '') {
      candidates.push(path.join(buildDir, 'index.html'));
    } else if (normalized.endsWith('/')) {
      candidates.push(path.join(buildDir, relBase, 'index.html'));
      candidates.push(path.join(buildDir, relBase.replace(/\/$/, '.html')));
    } else if (normalized.endsWith('.html')) {
      candidates.push(path.join(buildDir, relBase));
    } else {
      candidates.push(path.join(buildDir, `${relBase}.html`));
      candidates.push(path.join(buildDir, relBase, 'index.html'));
    }

    let found = null;
    for (const candidate of candidates) {
      if (await fileExists(candidate)) {
        found = candidate;
        break;
      }
    }

    if (found) {
      htmlFiles.push(found);
    } else {
      missing.push(url);
    }
  }

  return { htmlFiles: Array.from(new Set(htmlFiles)), missing };
}

async function listBuildJsFiles(buildDir) {
  const jsRoot = path.join(buildDir, 'assets', 'js');
  if (!(await fileExists(jsRoot))) return [];
  const all = await listFilesRecursive(jsRoot);
  return all.filter((p) => p.toLowerCase().endsWith('.js'));
}

async function listGalleryHtmlFiles(buildDir) {
  const galleryRoot = path.join(buildDir, 'gallery');
  if (!(await fileExists(galleryRoot))) return [];
  const all = await listFilesRecursive(galleryRoot);
  return all.filter((p) => p.toLowerCase().endsWith('.html'));
}

function rebaseCssUrls({ cssText, sourcePathPosix, basePrefix, mode, remoteBaseUrl }) {
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

    let finalUrl;
    if (mode === 'remote') {
      const base = ensureTrailingSlash(remoteBaseUrl);
      const rebased =
        urlPath.startsWith('/')
          ? new URL(urlPath, base).toString()
          : new URL(path.posix.normalize(path.posix.join(sourceDir, urlPath)), base).toString();
      finalUrl = `${rebased}${suffix}`;
    } else {
      const rebasedPath =
        urlPath.startsWith('/')
          ? urlPath
          : path.posix.normalize(path.posix.join('/', sourceDir, urlPath)).replace(/^\//, '/');
      const base = basePrefix ? `${basePrefix}` : '';
      finalUrl = `${base}${rebasedPath}${suffix}`.replace(/\/{2,}/g, '/');
    }

    const q = quote || '"';
    return `url(${q}${finalUrl}${q})`;
  });
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'user-agent': 'jkamsker.github.io build',
      accept: 'text/css,*/*;q=0.8',
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function purgeSafelist() {
  return {
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
  };
}

async function buildCssBundle({ basePrefix, sources }) {
  const chunks = [];
  for (const source of sources) {
    if (source.kind === 'file') {
      const relPath = source.path;
      const absPath = path.resolve(relPath);
      const raw = stripBom(await fs.readFile(absPath, 'utf8'));
      const rebased = rebaseCssUrls({
        cssText: raw,
        sourcePathPosix: relPath.replaceAll('\\', '/'),
        basePrefix,
        mode: 'site',
      });
      chunks.push(`/* ${relPath} */\n${rebased}`);
      continue;
    }

    const url = source.url;
    const raw = stripBom(await fetchText(url));
    const remoteBaseUrl = new URL('.', url).toString();
    const rebased = rebaseCssUrls({
      cssText: raw,
      sourcePathPosix: path.posix.basename(new URL(url).pathname),
      basePrefix,
      mode: 'remote',
      remoteBaseUrl,
    });
    chunks.push(`/* ${url} */\n${rebased}`);
  }

  return chunks.join('\n\n');
}

async function purgeAndMinifyCss({ cssText, buildDir, safelist }) {
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
    safelist,
    defaultExtractor: (content) => content.match(/[A-Za-z0-9_-]+/g) ?? [],
    keyframes: true,
  });

  const css = purged[0]?.css ?? cssText;
  const minified = csso.minify(css, { restructure: true }).css;
  return minified;
}

async function purgeAndMinifyCssWithContent({ cssText, content, safelist }) {
  const purger = new PurgeCSS();
  const purged = await purger.purge({
    content,
    css: [{ raw: cssText }],
    safelist,
    defaultExtractor: (content) => content.match(/[A-Za-z0-9_-]+/g) ?? [],
    keyframes: true,
  });

  const css = purged[0]?.css ?? cssText;
  return csso.minify(css, { restructure: true }).css;
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
    'assets/css/main.css.map',
  ];

  for (const rel of toRemove) {
    const abs = path.join(buildDir, rel);
    if (!(await fileExists(abs))) continue;
    await fs.rm(abs, { force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const buildDir = path.resolve(args._[0] ?? 'build');
  if (!(await fileExists(buildDir))) {
    throw new Error(`Build dir not found: ${buildDir}`);
  }

  let benchmark = null;
  if (args.benchmark) {
    const benchmarkPath = path.resolve(args.benchmark);
    const urls = await readBenchmarkUrls(benchmarkPath);
    const resolved = await resolveBenchmarkHtmlFiles({ buildDir, urls });
    const jsFiles = await listBuildJsFiles(buildDir);
    benchmark = {
      urls,
      htmlFiles: resolved.htmlFiles,
      jsFiles,
      missing: resolved.missing,
      contentFiles: [...resolved.htmlFiles, ...jsFiles],
    };
    if (benchmark.htmlFiles.length === 0) {
      throw new Error(`No benchmark HTML files resolved from ${benchmarkPath}`);
    }
  }

  const basePrefix = await detectBasePrefix(buildDir);

  const outDir = path.join(buildDir, 'assets', 'css');
  await fs.mkdir(outDir, { recursive: true });
  const baseSafelist = purgeSafelist();
  const lightgallerySafelist = {
    ...baseSafelist,
    greedy: [/^lg-/, /^lightgallery/],
  };

  const bundles = [
    {
      outFile: 'vendor.css',
      safelist: baseSafelist,
      contentFiles: benchmark?.contentFiles,
      sources: [
        {
          kind: 'file',
          id: 'bootstrap',
          path: 'assets/bower_components/bootstrap/dist/css/bootstrap.min.css',
        },
        {
          kind: 'file',
          id: 'font-awesome',
          path: 'assets/bower_components/font-awesome/web-fonts-with-css/css/fontawesome-all.min.css',
        },
        {
          kind: 'file',
          id: 'icono',
          path: 'assets/bower_components/icono/dist/icono.min.css',
        },
      ],
    },
    {
      outFile: 'vendor-devicon.css',
      contentFiles: benchmark?.contentFiles,
      sources: [
        {
          kind: 'url',
          id: 'devicon',
          url: 'https://cdn.jsdelivr.net/gh/devicons/devicon@latest/devicon.min.css',
        },
      ],
    },
    {
      outFile: 'vendor-lightgallery.css',
      safelist: lightgallerySafelist,
      contentFiles: (await listGalleryHtmlFiles(buildDir)) || [],
      sources: [
        {
          kind: 'file',
          id: 'lightgallery',
          path: 'assets/bower_components/lightgallery/dist/css/lightgallery.min.css',
        },
      ],
    },
  ];

  const writtenFiles = [];
  for (const bundle of bundles) {
    const raw = await buildCssBundle({ basePrefix, sources: bundle.sources });
    const safelist = bundle.safelist ?? baseSafelist;

    let optimized;
    if (bundle.contentFiles && bundle.contentFiles.length > 0) {
      optimized = await purgeAndMinifyCssWithContent({
        cssText: raw,
        content: bundle.contentFiles,
        safelist,
      });
    } else if (bundle.contentFiles && bundle.contentFiles.length === 0) {
      optimized = csso.minify(raw, { restructure: true }).css;
    } else {
      optimized = await purgeAndMinifyCss({
        cssText: raw,
        buildDir,
        safelist,
      });
    }

    const absOut = path.join(outDir, bundle.outFile);
    await fs.writeFile(absOut, optimized, 'utf8');
    writtenFiles.push(absOut);
  }

  const mainCssPath = path.join(outDir, 'main.css');
  if (await fileExists(mainCssPath)) {
    const mainRaw = stripBom(await fs.readFile(mainCssPath, 'utf8'));
    const safelist = purgeSafelist();
    const mainOptimized = benchmark?.contentFiles
      ? await purgeAndMinifyCssWithContent({
          cssText: mainRaw,
          content: benchmark.contentFiles,
          safelist,
        })
      : await purgeAndMinifyCss({
          cssText: mainRaw,
          buildDir,
          safelist,
        });
    await fs.writeFile(mainCssPath, mainOptimized, 'utf8');
  }

  await removeBundledFiles({ buildDir });
  process.stdout.write(`Wrote ${writtenFiles.map((p) => path.relative(process.cwd(), p)).join(', ')}\n`);

  if (benchmark?.missing?.length) {
    process.stderr.write(
      `Warning: benchmark URLs did not resolve to HTML files in ${buildDir}: ${benchmark.missing.join(', ')}\n`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
