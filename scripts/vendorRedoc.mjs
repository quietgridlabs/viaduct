/**
 * Copy Redoc's standalone bundle into `public/vendor/`.
 *
 * Redoc is a devDependency and never enters the application bundle: the API
 * reference is one static page, and a viewer nobody opens should not cost the
 * editor a byte. The alternative — the usual `<script src="cdn.redocly.com…">`
 * — was rejected for the reason the fonts were: a page of ours must not make a
 * reader's browser announce itself to somebody else.
 *
 * Runs from `dev` and `build`, and deliberately NOT from `postinstall`: the
 * Docker builder copies package.json and the lock and runs `npm ci` before it
 * copies the repository, so a postinstall hook pointing at a file in scripts/
 * fails the image build on a file that is not there yet. Two minutes of a
 * broken pipeline for a convenience nobody asked for.
 *
 * A missing source is a warning rather than a failure, so `npm ci --omit=dev`
 * somewhere else does not break either.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const source = path.join(ROOT, 'node_modules/redoc/bundles/redoc.standalone.js');
const targetDir = path.join(ROOT, 'public/vendor');
const target = path.join(targetDir, 'redoc.standalone.js');

if (!existsSync(source)) {
  console.warn('vendorRedoc: redoc is not installed — skipping (the API reference page will 404)');
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log(`vendorRedoc: ${path.relative(ROOT, target)}`);
