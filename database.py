import sqlite3
import os

if os.environ.get('VERCEL'):
    DB_PATH = '/tmp/fiori.db'
else:
    DB_PATH = os.path.join(os.path.dirname(__file__), 'fiori.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS defunti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            cognome TEXT NOT NULL,
            data_decesso TEXT,
            luogo TEXT,
            note TEXT,
            data_inserimento TEXT,
            archiviato INTEGER DEFAULT 0
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fiori (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            defunto_id INTEGER NOT NULL,
            tipo TEXT NOT NULL,
            descrizione TEXT,
            costo REAL NOT NULL,
            pagato INTEGER DEFAULT 0,
            pagato_da TEXT,
            data_inserimento TEXT,
            FOREIGN KEY (defunto_id) REFERENCES defunti(id)
        )
    ''')

    conn.commit()
    conn.close()
