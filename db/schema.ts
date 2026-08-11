import { getDatabase } from './database';

export async function initDatabase() {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT,
      is_default INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category_id INTEGER,
      date TEXT NOT NULL,
      note TEXT,
      payment_method TEXT,
      source TEXT DEFAULT 'manual',
      linked_donation_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS income (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      source TEXT,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS donations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      recipient TEXT,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      linked_income_id INTEGER,
      linked_expense_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (linked_income_id) REFERENCES income(id),
      FOREIGN KEY (linked_expense_id) REFERENCES expenses(id)
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      monthly_limit REAL NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  await seedDefaults(db);
}

async function seedDefaults(db: Awaited<ReturnType<typeof getDatabase>>) {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );

  if (existing?.count === 0) {
    const defaultCategories = [
      { name: 'Food', icon: 'fast-food', is_default: 1 },
      { name: 'Bills', icon: 'receipt', is_default: 1 },
      { name: 'Transport', icon: 'car', is_default: 1 },
      { name: 'Rent', icon: 'home', is_default: 1 },
      { name: 'Business', icon: 'briefcase', is_default: 1 },
      { name: 'Donation', icon: 'heart', is_default: 1 },
      { name: 'Other', icon: 'ellipsis-horizontal', is_default: 1 },
    ];

    for (const cat of defaultCategories) {
      await db.runAsync(
        'INSERT INTO categories (name, icon, is_default) VALUES (?, ?, ?)',
        [cat.name, cat.icon, cat.is_default]
      );
    }
  }

  const defaultSettings = [
    { key: 'default_sadqa_percent', value: '2.5' },
    { key: 'reminder_time', value: '21:00' },
    { key: 'reminder_enabled', value: 'false' },
    { key: 'sadqa_reminder_enabled', value: 'false' },
    { key: 'backup_enabled', value: 'false' },
  ];

  for (const setting of defaultSettings) {
    await db.runAsync(
      'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      [setting.key, setting.value]
    );
  }
}