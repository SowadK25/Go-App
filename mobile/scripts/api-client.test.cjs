const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the real TypeScript client with injected network and timer boundaries.
function client({ url = 'http://10.0.0.16:8000/', fetch, setTimeout: schedule = setTimeout, clearTimeout: cancel = clearTimeout } = {}) {
  const source = readFileSync(path.join(__dirname, '../src/api/client.ts'), 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, process: { env: { EXPO_PUBLIC_API_URL: url } }, URL, AbortController, setTimeout: schedule, clearTimeout: cancel, fetch });
  return exports;
}

test('uses configured API root and returns JSON', async () => {
  const api = client({ fetch: async (url, options) => {
    assert.equal(url, 'http://10.0.0.16:8000/health');
    assert.equal(options.headers.Accept, 'application/json');
    return new Response(JSON.stringify({ status: 'ok' }));
  } });
  assert.equal((await api.request('/health')).status, 'ok');
});

test('missing and invalid configuration fail before a network call', async () => {
  for (const url of ['', 'ftp://host', 'https://user:pass@host', 'https://host?key=secret']) {
    const api = client({ url, fetch: () => assert.fail('must not fetch') });
    await assert.rejects(api.request('/health'), error => error.name === 'ApiError');
  }
});

test('preserves rate-limit status and Retry-After', async () => {
  const api = client({ fetch: async () => new Response(JSON.stringify({ detail: 'Rate limit exceeded' }), { status: 429, headers: { 'Retry-After': '45' } }) });
  await assert.rejects(api.request('/api/stops'), error => error.status === 429 && error.retryAfter === 45 && error.message === 'Rate limit exceeded');
});

test('handles non-JSON errors and malformed success bodies', async () => {
  for (const status of [502, 200]) {
    const api = client({ fetch: async () => new Response('<html>failure</html>', { status }) });
    await assert.rejects(api.request('/api/stops'), error => error.name === 'ApiError' && error.status === status);
  }
});

test('network failures receive a useful connection message', async () => {
  const api = client({ fetch: async () => { throw new TypeError('Network request failed'); } });
  await assert.rejects(api.request('/api/stops'), error => error.message.includes('Cannot reach the API'));
});

test('cancels timed-out requests and clears the timer', async () => {
  let expire;
  let cleared = false;
  const api = client({
    setTimeout: callback => { expire = callback; return 123; },
    clearTimeout: id => { assert.equal(id, 123); cleared = true; },
    fetch: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
  });
  const request = api.request('/api/stops');
  expire();
  await assert.rejects(request, error => error.message.includes('timed out'));
  assert.equal(cleared, true);
});

test('forwards caller cancellation without reporting a connection failure', async () => {
  const controller = new AbortController();
  const api = client({ fetch: (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))) });
  const request = api.request('/api/stops', controller.signal);
  controller.abort();
  await assert.rejects(request, error => error.name === 'AbortError');
});
