import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {workspaceSchema} from '../../src/ui/workspace/SqliteWorkspace';
import {cardIndexes, chatIndex, metadata} from '../../src/ui/workspace/types';
import {fixtureCard, fixtureChat, fixtureId, fixtureMessage, fixtureSize, messageShapes} from './fixture';

const destination = process.argv[2];
const matrix = process.argv.includes('--matrix');
const caseCount = matrix ? messageShapes.length : 1;
if (!destination) throw new Error('Pass a new, isolated output SQLite path');
mkdirSync(dirname(destination), {recursive: true});
const db = new DatabaseSync(destination);
for (const sql of workspaceSchema) db.exec(sql);
if (Number((db.prepare('SELECT COUNT(*) AS n FROM pl_cards').get() as {n: number}).n)) throw new Error('Refusing to replace an existing dataset');
db.exec('PRAGMA journal_mode=WAL; BEGIN IMMEDIATE');
const cardInsert = db.prepare('INSERT INTO pl_cards VALUES(?,?,?)');
const chatInsert = db.prepare('INSERT INTO pl_chats VALUES(?,?,?)');
const messageInsert = db.prepare('INSERT INTO pl_messages VALUES(?,?,?,?,?,?,?,?)');
const indexInsert = db.prepare('INSERT INTO pl_index VALUES(?,?,?,?,?,?,?)');
const addIndex = (row: ReturnType<typeof chatIndex>) => indexInsert.run(row.key, row.scope, row.filter, row.id, row.sort, row.search, JSON.stringify(row.value));
const start = performance.now();
for (let index = 0; index < fixtureSize.cards; index++) {
  const card = fixtureCard(index); cardInsert.run(card.id, 1, JSON.stringify(card)); cardIndexes(card).forEach(addIndex);
  const chat = fixtureChat(index);
  if (matrix && index < caseCount) chat.title = `1만 턴 · ${messageShapes[index]}`;
  const value = {...metadata(chat), lastSequence: index < caseCount ? fixtureSize.turns * 2 : 2};
  chatInsert.run(chat.id, 1, JSON.stringify(value)); addIndex(chatIndex(value));
  if (index >= caseCount) for (const sequence of [1, 2]) {
    const message = fixtureMessage(sequence, index, matrix ? 'short' : 'long');
    messageInsert.run(chat.id, sequence, message.id, message.role, message.text, message.sentAt, null, message.text.length);
  }
}
for (let index = 0; index < caseCount; index++) for (let sequence = 1; sequence <= fixtureSize.turns * 2; sequence++) {
  const message = fixtureMessage(sequence, index, messageShapes[index]);
  messageInsert.run(fixtureId(index), sequence, message.id, message.role, message.text, message.sentAt, null, message.text.length);
}
db.prepare('INSERT INTO pl_meta VALUES(?,?)').run('version', '2');
db.exec('COMMIT; PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE; ANALYZE');
const report = {
  ...fixtureSize, mainConversation: db.prepare('SELECT COUNT(*) AS messages,MIN(characters) AS minChars,MAX(characters) AS maxChars,SUM(characters) AS totalChars FROM pl_messages WHERE chat_id=?').get(fixtureId(0)),
  allMessages: db.prepare('SELECT COUNT(*) AS count,SUM(characters) AS characters FROM pl_messages').get(),
  totalCards: db.prepare('SELECT COUNT(*) AS count FROM pl_cards').get(), totalChats: db.prepare('SELECT COUNT(*) AS count FROM pl_chats').get(),
  generationMs: Math.round(performance.now() - start), source: 'deterministic local code; no AI requests',
  cases: Array.from({length: caseCount}, (_, index) => ({shape: messageShapes[index], id: fixtureId(index),
    ...db.prepare('SELECT COUNT(*) AS messages, MIN(characters) AS minChars, MAX(characters) AS maxChars, SUM(characters) AS totalChars FROM pl_messages WHERE chat_id=?').get(fixtureId(index))})),
};
db.close();
writeFileSync(destination + '.json', JSON.stringify(report, null, 2));
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
