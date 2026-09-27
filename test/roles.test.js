import './helpers/tmpDb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { effectivePairs } from '../src/modules/roles.js';

const R = (n) => `10000000000000000${n}`;

test('effectivePairs keeps pairs that already have an emoji', () => {
  const pairs = effectivePairs({
    pairs: [
      { key: '🎮', display: '🎮', react: '🎮', roleId: R(1) },
      {
        key: '123456789012345678',
        display: '<:x:123456789012345678>',
        react: 'x:123456789012345678',
        roleId: R(2),
      },
    ],
  });
  assert.deepEqual(
    pairs.map((p) => p.key),
    ['🎮', '123456789012345678']
  );
});

test('effectivePairs gives emoji-less pairs (old button/select styles) keycaps in order', () => {
  const pairs = effectivePairs({
    style: 'buttons',
    pairs: [
      { roleId: R(1), label: 'A' },
      { key: '1️⃣', display: '1️⃣', react: '1️⃣', roleId: R(2) },
      { roleId: R(3) },
    ],
  });
  // 1️⃣ is taken by the second pair, so the first free keycaps are 2️⃣ and 3️⃣.
  assert.deepEqual(
    pairs.map((p) => [p.roleId, p.key, p.react]),
    [
      [R(1), '2️⃣', '2️⃣'],
      [R(2), '1️⃣', '1️⃣'],
      [R(3), '3️⃣', '3️⃣'],
    ]
  );
});

test('effectivePairs drops pairs without a valid role id', () => {
  assert.deepEqual(effectivePairs({ pairs: [{ roleId: 'nope', key: '🎮' }] }), []);
});
