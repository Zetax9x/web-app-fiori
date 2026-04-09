import os
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import psycopg2
import psycopg2.extras

# Parametri query che psycopg2 riconosce
PSYCOPG2_PARAMS = {
    'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslcrl',
    'connect_timeout', 'options', 'application_name', 'target_session_attrs',
}

def get_postgres_url():
    url = os.environ.get('POSTGRES_URL') or os.environ.get('POSTGRES_URL_NON_POOLING', '')
    if not url:
        return ''
    # Vercel/Supabase forniscono postgres:// ma psycopg2 richiede postgresql://
    if url.startswith('postgres://'):
        url = 'postgresql://' + url[len('postgres://'):]
    # Rimuovi parametri query non riconosciuti da psycopg2
    parsed = urlparse(url)
    if parsed.query:
        params = parse_qs(parsed.query)
        clean = {k: v[0] for k, v in params.items() if k in PSYCOPG2_PARAMS}
        url = urlunparse(parsed._replace(query=urlencode(clean)))
    return url


def get_db():
    conn = psycopg2.connect(get_postgres_url())
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
