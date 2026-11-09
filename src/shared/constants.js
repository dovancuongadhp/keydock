const KINDS = [
  { name: 'Web', kind: 'web', icon: 'globe' },
  { name: 'SSH', kind: 'ssh', icon: 'terminal' },
  { name: 'Server', kind: 'server', icon: 'server' },
  { name: 'Database', kind: 'database', icon: 'database' },
];

const DB_ENGINES = [
  'PostgreSQL',
  'MySQL',
  'MariaDB',
  'SQLite',
  'SQL Server',
  'Oracle',
  'MongoDB',
  'Redis',
  'Cassandra',
  'Elasticsearch',
];

const IDLE_LOCK_MS = 5 * 60 * 1000;
const CLIPBOARD_CLEAR_MS = 15 * 1000;

module.exports = {
  KINDS,
  DB_ENGINES,
  IDLE_LOCK_MS,
  CLIPBOARD_CLEAR_MS,
};
