// Builds the extension for each browser into dist/<browser>/.
//   node scripts/build.mjs           one-off build
//   node scripts/build.mjs --watch   rebuild scripts on change (static files are copied once)
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const BROWSERS = ['chrome', 'firefox'];

const ENTRY_POINTS = {
  content: 'src/content/index.js',
  background: 'src/background/index.js',
  popup: 'src/ui/popup/popup.js',
  outline: 'src/ui/outline/outline.js',
  data: 'src/ui/data/data.js',
};

// dist path → source path
const STATIC_FILES = {
  'styles.css': 'src/content/styles.css',
  'popup.html': 'src/ui/popup/popup.html',
  'outline.html': 'src/ui/outline/outline.html',
  'data.html': 'src/ui/data/data.html',
  'icon-16.png': 'src/icon-16.png',
  'icon-48.png': 'src/icon-48.png',
  'icon-128.png': 'src/icon-128.png',
  LICENSE: 'LICENSE',
};

async function readJson(file) {
  return JSON.parse(await readFile(path.join(root, file), 'utf8'));
}

async function writeManifest(browser, outdir) {
  const pkg = await readJson('package.json');
  const manifest = {
    ...(await readJson('manifest.base.json')),
    ...(await readJson(`manifest.${browser}.json`)),
    version: pkg.version,
  };
  await writeFile(path.join(outdir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

async function copyStatic(outdir) {
  await Promise.all(
    Object.entries(STATIC_FILES).map(([dest, src]) => copyFile(path.join(root, src), path.join(outdir, dest))),
  );
}

function esbuildOptions(outdir) {
  return {
    absWorkingDir: root,
    entryPoints: ENTRY_POINTS,
    outdir,
    bundle: true,
    // Content scripts can't be ES modules, and one format keeps every entry point the same.
    format: 'iife',
    // Shadow-root stylesheets are imported as strings.
    loader: { '.css': 'text' },
    target: ['chrome102', 'firefox121'],
    // Readable output: store reviewers read the submitted code.
    minify: false,
    legalComments: 'none',
    logLevel: 'info',
  };
}

for (const browser of BROWSERS) {
  const outdir = path.join(root, 'dist', browser);
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });
  await Promise.all([writeManifest(browser, outdir), copyStatic(outdir)]);
  if (watch) {
    const ctx = await esbuild.context(esbuildOptions(outdir));
    await ctx.watch();
  } else {
    await esbuild.build(esbuildOptions(outdir));
  }
}
