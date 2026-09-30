// Self-hosted instances: Sylo loads the instance's /.well-known/fluxer so the
// client and avatar URLs use its own media / CDN hosts, not hosted Fluxer's.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.FLUXER_API_URL = 'https://chat.example.com/api';
process.env.FLUXER_WEB_URL = 'https://chat.example.com';
const urls = await import('../src/platform/urls.js');

const DOC = {
  api_code_version: 1,
  endpoints: {
    api: 'https://chat.example.com/api',
    api_client: 'https://chat.example.com/api',
    api_public: 'https://chat.example.com/api',
    gateway: 'wss://chat.example.com/gateway',
    media: 'https://chat.example.com/media',
    static_cdn: 'https://chat.example.com',
    marketing: 'https://chat.example.com',
    admin: 'https://chat.example.com/admin',
    invite: 'https://chat.example.com/invite',
    gift: 'https://chat.example.com/gift',
    webapp: 'https://chat.example.com',
  },
};

const respond = (status, body) => async () => ({ ok: status === 200, status, json: async () => body });

test('before discovery: partial instance options, hosted CDN for avatars', () => {
  assert.deepEqual(urls.clientInstanceOptions(), {
    instance: { api_public: 'https://chat.example.com/api', webapp: 'https://chat.example.com' },
  });
  assert.doesNotMatch(urls.avatarUrl('1', 'abc'), /chat\.example\.com/);
});

test('a failed or malformed discovery throws and changes nothing', async () => {
  await assert.rejects(urls.loadInstanceDiscovery(respond(404, {})), /HTTP 404/);
  await assert.rejects(urls.loadInstanceDiscovery(respond(200, { endpoints: {} })));
  assert.equal(urls.instanceEndpoints().media, 'https://fluxerusercontent.com');
});

test('discovery is fetched from the API origin and feeds the client and avatar URLs', async () => {
  let asked;
  const fetchImpl = async (url) => {
    asked = url;
    return respond(200, DOC)();
  };
  await urls.loadInstanceDiscovery(fetchImpl);
  assert.equal(asked, 'https://chat.example.com/api/.well-known/fluxer');
  assert.equal(urls.clientInstanceOptions().instance, DOC);
  assert.equal(urls.instanceEndpoints().media, 'https://chat.example.com/media');
  assert.match(urls.avatarUrl('1', 'abc', 64), /^https:\/\/chat\.example\.com\/media\/avatars\/1\/abc/);
});
