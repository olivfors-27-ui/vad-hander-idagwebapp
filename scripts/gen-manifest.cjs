const fs = require('fs');
const path = require('path');
const base = 'dist/server';
const files = [];
function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) {
      if (f.name === '.vite') continue;
      walk(p);
    } else if (f.name.endsWith('.js')) {
      files.push(p);
    }
  }
}
walk(base);
const mods = files.map((p) => {
  const rel = path.relative(base, p).split(path.sep).join('/');
  return { name: rel, type: 'esm', path: `./${base}/${rel}` };
});
const cacheBuster = fs.readFileSync('wrangler.jsonc', 'utf8');
const compatDate = cacheBuster.match(/"compatibility_date"\s*:\s*"([^"]+)"/)[1];
const cfg = {
  entrypoint: 'entry.js',
  compatibilityDate: compatDate,
  compatibilityFlags: ['nodejs_compat'],
  modules: mods,
  assetsDirectory: './deploy-assets',
  spa: true,
};
fs.writeFileSync('deploy.manifest.json', JSON.stringify(cfg, null, 2));
console.log('modules:', mods.length, mods.slice(0, 2).map((m) => m.name));
