import os
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
import psycopg2
import psycopg2.extras
import psycopg2.pool

# Parametri query che psycopg2 riconosce
PSYCOPG2_PARAMS = {
    'sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslcrl',
    'connect_timeout', 'options', 'application_name', 'target_session_attrs',
}

# Connection pool (ricreato ad ogni cold start in ambiente serverless, va bene)
_pool = None


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


def _get_pool():
    global _pool
    if _pool is None or _pool.closed:
        _pool = psycopg2.pool.SimpleConnectionPool(
            minconn=1,
            maxconn=5,
            dsn=get_postgres_url()
        )
    return _pool


def get_db():
    """Ottieni una connessione dal pool."""
    pool = _get_pool()
    conn = pool.getconn()
    return conn


def put_db(conn):
    """Restituisci una connessione al pool."""
    try:
        pool = _get_pool()
        pool.putconn(conn)
    except Exception:
        # Se il pool non esiste piu', chiudi direttamente
        try:
            conn.close()
        except Exception:
            pass


def init_db():
    conn = get_db()
    try:
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

        # Migrazione: aggiungi colonne ordinante se non esistono
        cursor.execute('''
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'fiori' AND column_name = 'ordinante_nome'
                ) THEN
                    ALTER TABLE fiori ADD COLUMN ordinante_nome TEXT;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'fiori' AND column_name = 'ordinante_telefono'
                ) THEN
                    ALTER TABLE fiori ADD COLUMN ordinante_telefono TEXT;
                END IF;
            END
            $$;
        ''')

        # Indici per performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_fiori_defunto_id ON fiori(defunto_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_defunti_archiviato ON defunti(archiviato)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_defunti_data_ins ON defunti(data_inserimento)')

        conn.commit()
        cursor.close()
    finally:
        put_db(conn)
