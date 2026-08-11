const fs = require('fs');
const path = require('path');

async function run() {
  const { ZipArchive } = await import('archiver');

  const root = path.resolve(__dirname, '..');
  const distDir = path.join(root, 'dist');
  const pkg = require(path.join(root, 'package.json'));
  const outPath = path.join(root, `aura-prompt-${pkg.version}.zip`);

  if (!fs.existsSync(distDir)) {
    console.error('dist/ not found. Run "npm run build" first.');
    process.exit(1);
  }

  const output = fs.createWriteStream(outPath);
  const archive = new ZipArchive({ zlib: { level: 9 } });

  output.on('close', () => {
    console.log(`✓ Created ${path.relative(root, outPath)} (${archive.pointer()} bytes)`);
  });
  archive.on('warning', (err) => { if (err.code !== 'ENOENT') throw err; });
  archive.on('error', (err) => { throw err; });

  archive.pipe(output);
  archive.directory(distDir, false); // `false` => no wrapping "dist/" folder
  archive.finalize();
}

run().catch(console.error);