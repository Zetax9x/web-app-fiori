import os
import psycopg2
import psycopg2.extras

POSTGRES_URL = os.environ.get('POSTGRES_URL', '')


def get_db():
    conn = psycopg2.connect(POSTGRES_URL)
    return conn


def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS defunti (
            id SERIAL PRIMARY KEY,
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
            id SERIAL PRIMARY KEY,
            defunto_id INTEGER NOT NULL REFERENCES defunti(id),
            tipo TEXT NOT NULL,
            descrizione TEXT,
            scritta_fascia TEXT,
            costo REAL NOT NULL DEFAULT 0,
            pagato INTEGER DEFAULT 0,
            pagato_da TEXT,
            data_inserimento TEXT
        )
    ''')

    conn.commit()
    cursor.close()
    conn.close()
