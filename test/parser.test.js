import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandBuilder, DURATION } from '../src/bot/framework/CommandBuilder.js';
import { parseArgs, tokenize } from '../src/bot/framework/parser.js';

const U = '123456789012345678';

const ban = new CommandBuilder()
  .setName('ban')
  .addUserOption((o) => o.setName('user').setRequired(true))
  .addStringOption((o) => o.setName('reason').setMaxLength(400))
  .addStringOption((o) => o.setName('duration').setPattern(...DURATION))
  .addIntegerOption((o) =>
    o.setName('delete_messages').addChoices({ name: 'none', value: 0 }, { name: '1d', value: 86400 })
  );

const warn = new CommandBuilder()
  .setName('warn')
  .addSubcommand((s) =>
    s
      .setName('add')
      .addUserOption((o) => o.setName('user').setRequired(true))
      .addStringOption((o) => o.setName('reason').setRequired(true))
  )
  .addSubcommand((s) =>
    s.setName('remove').addIntegerOption((o) => o.setName('id').setRequired(true).setMinValue(1))
  );

const poll = new CommandBuilder()
  .setName('poll')
  .addStringOption((o) => o.setName('question').setRequired(true))
  .addStringOption((o) => o.setName('choices').setRequired(true))
  .addStringOption((o) => o.setName('duration').setPattern(...DURATION))
  .addBooleanOption((o) => o.setName('multiple'))
  .addIntegerOption((o) => o.setName('max_votes'));

test('tokenize keeps quoted groups and spans', () => {
  const t = tokenize(`a "b c" d\\ e`);
  assert.deepEqual(
    t.map((x) => x.value),
    ['a', 'b c', 'd e']
  );
});

test('free-text reason swallows the rest verbatim', () => {
  const r = parseArgs(`add <@${U}> spammed  the   chat`, warn);
  assert.equal(r.sub, 'add');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.values.get('user'), { ref: U });
  assert.equal(r.values.get('reason'), 'spammed  the   chat');
});

test('typed options before or after free text are recognised', () => {
  const a = parseArgs(`<@${U}> 1d spamming a lot`, ban);
  assert.deepEqual(a.errors, []);
  assert.equal(a.values.get('duration'), '1d');
  assert.equal(a.values.get('reason'), 'spamming a lot');

  const b = parseArgs(`<@${U}> spamming a lot 1d`, ban);
  assert.equal(b.values.get('duration'), '1d');
  assert.equal(b.values.get('reason'), 'spamming a lot');
});

test('name:value sets an option out of order', () => {
  const r = parseArgs(`<@${U}> delete_messages:1d rude`, ban);
  assert.deepEqual(r.errors, []);
  assert.equal(r.values.get('delete_messages'), 86400);
  assert.equal(r.values.get('reason'), 'rude');
});

test('quoted free text and trailing typed options', () => {
  const r = parseArgs(`"Best game?" "Tetris | Doom" 1h yes`, poll);
  assert.deepEqual(r.errors, []);
  assert.equal(r.values.get('question'), 'Best game?');
  assert.equal(r.values.get('choices'), 'Tetris | Doom');
  assert.equal(r.values.get('duration'), '1h');
  assert.equal(r.values.get('multiple'), true);
});

test('integer range and missing/unknown subcommand errors', () => {
  assert.match(parseArgs('remove 0', warn).errors[0], /at least 1/);
  assert.match(parseArgs('remove abc', warn).errors[0], /whole number/);
  assert.match(parseArgs('', warn).errors[0], /Pick a subcommand/);
  assert.match(parseArgs('nope', warn).errors[0], /Unknown subcommand/);
  assert.match(parseArgs('add', warn).errors[0], /Missing `user`/);
});

test('optional typed option that does not fit is skipped', () => {
  const r = parseArgs(`<@${U}> hello`, ban);
  assert.equal(r.values.get('reason'), 'hello');
  assert.equal(r.values.has('duration'), false);
});
