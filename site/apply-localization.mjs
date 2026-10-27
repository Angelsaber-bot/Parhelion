/** Apply to a REVIEW COPY of an existing unified static site. Never fetches, deploys, or builds game assets. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const flags = new Set(process.argv.slice(2).filter(x => x.startsWith('--')));
const destination = process.argv.slice(2).find(x => !x.startsWith('--'));
if (!destination || [...flags].some(x => x !== '--dry-run')) throw new Error('Usage: node site/apply-localization.mjs <existing-static-site-root> [--dry-run]');
const root = path.resolve(destination), index = path.join(root, 'index.html');
if ((await fs.lstat(root)).isSymbolicLink() || (await fs.lstat(index)).isSymbolicLink()) throw new Error('Use a normal review-copy directory, not symlinks.');
const original = await fs.readFile(index, 'utf8');
if (!/parhelion/i.test(original) || !/href=["'][^"']*\/arena\//.test(original) || !/href=["'][^"']*\/world\//.test(original)) throw new Error('Target is not a recognized Parhelion homepage. No files changed.');
const sources = path.join(path.dirname(fileURLToPath(import.meta.url)), 'generated');
const script = await fs.readFile(path.join(sources, 'home-language.js'));
const css = await fs.readFile(path.join(sources, 'language.css'));
const scriptTag = '<script type="module" src="/site/home-language.js" data-parhelion-language></script>';
const styleTag = '<link rel="stylesheet" href="/site/language.css" data-parhelion-language>';
let next = original;
if (!next.includes('data-parhelion-language')) {
  if (!/<\/head>/i.test(next) || !/<\/body>/i.test(next)) throw new Error('Homepage lacks head/body closing tags. No files changed.');
  next = next.replace(/<\/head>/i, `  ${styleTag}\n</head>`).replace(/<\/body>/i, `  ${scriptTag}\n</body>`);
} else if (!next.includes(scriptTag) || !next.includes(styleTag)) throw new Error('An unknown language customization is present. Review it manually; no files changed.');
const site = path.join(root, 'site');
try { if ((await fs.lstat(site)).isSymbolicLink()) throw new Error('The site folder must not be a symlink.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const writes = [[path.join(site, 'home-language.js'), script], [path.join(site, 'language.css'), css]];
for (const [file, contents] of writes) {
  try {
    if ((await fs.lstat(file)).isSymbolicLink()) throw new Error(`Refusing symlink: ${file}`);
    const current = await fs.readFile(file);
    if (!current.equals(contents)) throw new Error(`Existing locale file differs: ${file}. Review before replacing; no files changed.`);
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (flags.has('--dry-run')) { console.log('Verified: only locale JS/CSS and two HTML tags would be added. Existing images, CSS, and game builds are untouched.'); process.exit(0); }
// Preserve the exact pre-patch homepage once. Refuse a backup conflict rather than replace it.
if (next !== original) {
  const backup = index + '.before-language';
  try { await fs.writeFile(backup, original, { flag: 'wx' }); } catch (error) { if (error.code !== 'EEXIST' || await fs.readFile(backup, 'utf8') !== original) throw error; }
}
await fs.mkdir(site, { recursive: true });
for (const [file, contents] of writes) await fs.writeFile(file, contents, { flag: 'w' });
if (next !== original) { await fs.writeFile(index + '.language-tmp', next, { flag: 'wx' }); await fs.rename(index + '.language-tmp', index); }
console.log('Localized review copy prepared. No deployment or publishing was performed.');
