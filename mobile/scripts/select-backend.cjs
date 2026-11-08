const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const target = process.argv[2];
if (!['local', 'railway'].includes(target)) {
  console.error('Choose a backend: local or railway.');
  process.exit(1);
}

const root = path.resolve(__dirname, '..');
const profile = path.join(root, `.env.${target}-backend`);
if (!existsSync(profile)) {
  console.error(`Create ${profile} with EXPO_PUBLIC_API_URL set to your backend address.`);
  process.exit(1);
}

const entry = readFileSync(profile, 'utf8').match(/^EXPO_PUBLIC_API_URL=(.+)$/m);
if (!entry) {
  console.error('The backend profile is missing EXPO_PUBLIC_API_URL.');
  process.exit(1);
}

const setting = `EXPO_PUBLIC_API_URL=${entry[1].trim()}`;
const destination = path.join(root, '.env.local');
const current = existsSync(destination) ? readFileSync(destination, 'utf8') : '';
const updated = /^EXPO_PUBLIC_API_URL=.*$/m.test(current)
  ? current.replace(/^EXPO_PUBLIC_API_URL=.*$/gm, setting)
  : `${current}${current && !current.endsWith('\n') ? '\n' : ''}${setting}\n`;
writeFileSync(destination, updated);
console.log(`Selected ${target} backend. Restart Expo with: npx expo start --clear`);
