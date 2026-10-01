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

// !stats-shaped: a required choice, a free-text name, an optional choice —
// with choice names that contain spaces.
const stats = new CommandBuilder()
  .setName('stats')
  .setDescription('s')
  .addStringOption((o) =>
    o
      .setName('game')
      .setDescription('g')
      .setRequired(true)
      .addChoices(
        { name: 'Battlefield 6', value: 'battlefield:bf6' },
        { name: 'Battlefield V', value: 'battlefield:bfv' },
        { name: 'Old School RuneScape', value: 'runescape:osrs' },
        { name: 'RuneScape 3', value: 'runescape:rs3' }
      )
  )
  .addStringOption((o) => o.setName('username').setDescription('u').setRequired(true))
  .addStringOption((o) =>
    o
      .setName('platform')
      .setDescription('p')
      .addChoices({ name: 'PC', value: 'pc' }, { name: 'PlayStation 5', value: 'ps5' })
  );

test('multi-word choices: names with spaces span several tokens', () => {
  const r = parseArgs('Battlefield 6 PC IWGamin', stats);
  assert.deepEqual(r.errors, []);
  assert.equal(r.values.get('game'), 'battlefield:bf6');
  assert.equal(r.values.get('platform'), 'pc');
  assert.equal(r.values.get('username'), 'IWGamin');
});

test('multi-word choices: longest match, case-insensitive, any position', () => {
  const a = parseArgs('old school runescape Zezima', stats);
  assert.deepEqual(a.errors, []);
  assert.equal(a.values.get('game'), 'runescape:osrs');
  assert.equal(a.values.get('username'), 'Zezima');

  const b = parseArgs('Battlefield 6 PlayStation 5 IWGamin', stats);
  assert.deepEqual(b.errors, []);
  assert.equal(b.values.get('platform'), 'ps5', 'multi-word choice ahead of the free text');
  assert.equal(b.values.get('username'), 'IWGamin');

  const c = parseArgs('Battlefield 6 Some Name PlayStation 5', stats);
  assert.deepEqual(c.errors, []);
  assert.equal(c.values.get('platform'), 'ps5', 'multi-word choice peeled off the end');
  assert.equal(c.values.get('username'), 'Some Name');
});

test('choices: quoted names and the short value still work', () => {
  const q = parseArgs('"Battlefield V" PC name', stats);
  assert.deepEqual(q.errors, []);
  assert.equal(q.values.get('game'), 'battlefield:bfv');
  const s = parseArgs('bf6 pc name', stats);
  assert.deepEqual(s.errors, []);
  assert.equal(s.values.get('game'), 'battlefield:bf6', 'bf6 matches battlefield:bf6');
  const bad = parseArgs('Battlefield PC name', stats);
  assert.match(bad.errors[0], /`game` must be one of/);
});

test('a boolean option name is a yes flag, also peeled off the end of free text', () => {
  const r = parseArgs('"Dette er en test poll" A|B|C|D  2m multiple', poll);
  assert.deepEqual(r.errors, []);
  assert.equal(r.values.get('choices'), 'A|B|C|D');
  assert.equal(r.values.get('duration'), '2m');
  assert.equal(r.values.get('multiple'), true);

  const anyOrder = parseArgs('"Q" multiple 1h A | B', poll);
  assert.deepEqual(anyOrder.errors, []);
  assert.equal(anyOrder.values.get('multiple'), true);
  assert.equal(anyOrder.values.get('duration'), '1h');
  assert.equal(anyOrder.values.get('choices'), 'A | B');

  assert.equal(
    parseArgs('"Q" A|B multiple:no', poll).values.get('multiple'),
    false,
    'name:value still works'
  );
});
