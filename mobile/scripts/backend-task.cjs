const { existsSync } = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const python = path.join(root, 'venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
if (!existsSync(python)) {
  console.error('Create the project venv and install backend/requirements.txt first. See backend/README.md.');
  process.exit(1);
}
const [script, ...args] = process.argv.slice(2);
const result = spawnSync(python, [path.join(root, 'backend/scripts', script), ...args], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
