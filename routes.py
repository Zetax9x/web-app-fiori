from flask import Blueprint, request, jsonify
from datetime import datetime
from database import get_db, put_db
import psycopg2.extras

api = Blueprint('api', __name__)

TIPI_VALIDI = {'Cuscino', 'Cuscino Grande', 'Cuore', 'Cuore Grande', 'Copricassa', 'Mazzo di fiori', 'Altro'}


def now_iso():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def query(sql, params=(), fetchone=False, fetchall=False, returning=False):
    """Esegui una singola query con gestione sicura della connessione."""
    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(sql, params)
        result = None
        if fetchone or returning:
            result = cursor.fetchone()
        elif fetchall:
            result = cursor.fetchall()
        conn.commit()
        cursor.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        put_db(conn)
    if result is None:
        return None
    # Convert RealDictRow to plain dict
    if isinstance(result, list):
        return [dict(r) for r in result]
    return dict(result)


def query_transactional(statements):
    """Esegui piu' statement nella stessa transazione.
    statements: lista di tuple (sql, params)
    Ritorna None. Usato per operazioni batch/transazionali.
    """
    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        for sql, params in statements:
            cursor.execute(sql, params)
        conn.commit()
        cursor.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        put_db(conn)


def _parse_float(value, default=0.0, field_name='valore'):
    """Converte in float con validazione."""
    try:
        result = float(value if value is not None else default)
    except (ValueError, TypeError):
        raise ValueError(f'{field_name} deve essere un numero valido')
    if result < 0:
        raise ValueError(f'{field_name} non puo\' essere negativo')
    return result


def _parse_int(value, default=0, field_name='valore'):
    """Converte in int con validazione."""
    try:
        return int(value if value is not None else default)
    except (ValueError, TypeError):
        raise ValueError(f'{field_name} deve essere un intero valido')


# --- Defunti ---

@api.route('/api/defunti', methods=['GET'])
def get_defunti():
    search = request.args.get('search', '').strip()
    base = '''SELECT d.*,
                 COALESCE(f.num_fiori, 0) AS num_fiori,
                 COALESCE(f.totale_costi, 0) AS totale_costi,
                 COALESCE(f.non_pagati, 0) AS non_pagati
              FROM defunti d
              LEFT JOIN (
                  SELECT defunto_id,
                         COUNT(*) AS num_fiori,
                         SUM(costo) AS totale_costi,
                         SUM(CASE WHEN pagato = 0 AND tipo != 'Copricassa' THEN 1 ELSE 0 END) AS non_pagati
                  FROM fiori GROUP BY defunto_id
              ) f ON f.defunto_id = d.id'''
    archived = request.args.get('archived', '0') == '1'
    filtro_archiviato = 1 if archived else 0

    if search:
        pattern = f'%{search}%'
        rows = query(
            base + ''' WHERE d.archiviato = %s
                 AND (d.nome ILIKE %s OR d.cognome ILIKE %s OR d.luogo ILIKE %s)
               ORDER BY d.data_inserimento DESC''',
            (filtro_archiviato, pattern, pattern, pattern), fetchall=True
        )
    else:
        rows = query(
            base + ' WHERE d.archiviato = %s ORDER BY d.data_inserimento DESC',
            (filtro_archiviato,), fetchall=True
        )
    return jsonify(rows)


@api.route('/api/defunti', methods=['POST'])
def create_defunto():
    data = request.get_json()
    if not data or not data.get('nome') or not data.get('cognome'):
        return jsonify({'error': 'nome e cognome sono obbligatori'}), 400

    row = query(
        '''INSERT INTO defunti (nome, cognome, data_decesso, luogo, note, data_inserimento, archiviato)
           VALUES (%s, %s, %s, %s, %s, %s, 0) RETURNING *''',
        (data['nome'], data['cognome'], data.get('data_decesso'),
         data.get('luogo'), data.get('note'), now_iso()),
        returning=True
    )
    return jsonify(row), 201


@api.route('/api/defunti/<int:defunto_id>', methods=['GET'])
def get_defunto(defunto_id):
    defunto = query('SELECT * FROM defunti WHERE id = %s', (defunto_id,), fetchone=True)
    if not defunto:
        return jsonify({'error': 'Defunto non trovato'}), 404
    fiori = query(
        'SELECT * FROM fiori WHERE defunto_id = %s ORDER BY data_inserimento DESC',
        (defunto_id,), fetchall=True
    )
    defunto['fiori'] = fiori
    return jsonify(defunto)


@api.route('/api/defunti/<int:defunto_id>', methods=['PUT'])
def update_defunto(defunto_id):
    data = request.get_json()
    defunto = query('SELECT * FROM defunti WHERE id = %s', (defunto_id,), fetchone=True)
    if not defunto:
        return jsonify({'error': 'Defunto non trovato'}), 404

    updated = query(
        '''UPDATE defunti
           SET nome = %s, cognome = %s, data_decesso = %s, luogo = %s, note = %s
           WHERE id = %s RETURNING *''',
        (data.get('nome', defunto['nome']),
         data.get('cognome', defunto['cognome']),
         data.get('data_decesso', defunto['data_decesso']),
         data.get('luogo', defunto['luogo']),
         data.get('note', defunto['note']),
         defunto_id),
        returning=True
    )
    return jsonify(updated)


@api.route('/api/defunti/<int:defunto_id>', methods=['DELETE'])
def archive_defunto(defunto_id):
    defunto = query('SELECT * FROM defunti WHERE id = %s', (defunto_id,), fetchone=True)
    if not defunto:
        return jsonify({'error': 'Defunto non trovato'}), 404
    query('UPDATE defunti SET archiviato = 1 WHERE id = %s', (defunto_id,))
    return jsonify({'message': 'Defunto archiviato'})


@api.route('/api/defunti/<int:defunto_id>/elimina', methods=['DELETE'])
def delete_defunto(defunto_id):
    defunto = query('SELECT * FROM defunti WHERE id = %s', (defunto_id,), fetchone=True)
    if not defunto:
        return jsonify({'error': 'Defunto non trovato'}), 404
    # DELETE transazionale: fiori + defunto nella stessa connessione
    query_transactional([
        ('DELETE FROM fiori WHERE defunto_id = %s', (defunto_id,)),
        ('DELETE FROM defunti WHERE id = %s', (defunto_id,)),
    ])
    return jsonify({'message': 'Defunto e composizioni eliminati'})


# --- De-archiviazione ---

@api.route('/api/defunti/<int:defunto_id>/ripristina', methods=['PATCH'])
def ripristina_defunto(defunto_id):
    defunto = query('SELECT * FROM defunti WHERE id = %s', (defunto_id,), fetchone=True)
    if not defunto:
        return jsonify({'error': 'Defunto non trovato'}), 404
    updated = query(
        'UPDATE defunti SET archiviato = 0 WHERE id = %s RETURNING *',
        (defunto_id,), returning=True
    )
    return jsonify(updated)


# --- Fiori per defunto ---

@api.route('/api/defunti/<int:defunto_id>/fiori', methods=['GET'])
def get_fiori(defunto_id):
    defunto = query('SELECT id FROM defunti WHERE id = %s', (defunto_id,), fetchone=True)
    if not defunto:
        return jsonify({'error': 'Defunto non trovato'}), 404
    rows = query(
        'SELECT * FROM fiori WHERE defunto_id = %s ORDER BY data_inserimento DESC',
        (defunto_id,), fetchall=True
    )
    return jsonify(rows)


@api.route('/api/defunti/<int:defunto_id>/fiori', methods=['POST'])
def add_fiore(defunto_id):
    data = request.get_json()
    if not data or not data.get('tipo'):
        return jsonify({'error': 'tipo e\' obbligatorio'}), 400

    if data['tipo'] not in TIPI_VALIDI:
        return jsonify({'error': f'tipo deve essere uno di: {", ".join(sorted(TIPI_VALIDI))}'}), 400

    # Validazione input numerici
    try:
        costo = _parse_float(data.get('costo', 0), field_name='costo')
        pagato = _parse_int(data.get('pagato', 0), field_name='pagato')
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    defunto = query('SELECT id FROM defunti WHERE id = %s', (defunto_id,), fetchone=True)
    if not defunto:
        return jsonify({'error': 'Defunto non trovato'}), 404

    row = query(
        '''INSERT INTO fiori (defunto_id, tipo, descrizione, scritta_fascia, costo, pagato, pagato_da,
                              ordinante_nome, ordinante_telefono, data_inserimento)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *''',
        (defunto_id, data['tipo'], data.get('descrizione'), data.get('scritta_fascia'),
         costo, pagato,
         data.get('pagato_da'),
         data.get('ordinante_nome'), data.get('ordinante_telefono'),
         now_iso()),
        returning=True
    )
    return jsonify(row), 201


# --- Fiori singolo ---

@api.route('/api/fiori/<int:fiore_id>', methods=['PUT'])
def update_fiore(fiore_id):
    data = request.get_json()
    fiore = query('SELECT * FROM fiori WHERE id = %s', (fiore_id,), fetchone=True)
    if not fiore:
        return jsonify({'error': 'Fiore non trovato'}), 404

    tipo = data.get('tipo', fiore['tipo'])
    if tipo not in TIPI_VALIDI:
        return jsonify({'error': f'tipo deve essere uno di: {", ".join(sorted(TIPI_VALIDI))}'}), 400

    # Validazione input numerici
    try:
        costo = _parse_float(data.get('costo', fiore['costo']), field_name='costo')
        pagato = _parse_int(data.get('pagato', fiore['pagato']), field_name='pagato')
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    updated = query(
        '''UPDATE fiori
           SET tipo = %s, descrizione = %s, scritta_fascia = %s, costo = %s, pagato = %s, pagato_da = %s,
               ordinante_nome = %s, ordinante_telefono = %s
           WHERE id = %s RETURNING *''',
        (tipo,
         data.get('descrizione', fiore['descrizione']),
         data.get('scritta_fascia', fiore.get('scritta_fascia')),
         costo, pagato,
         data.get('pagato_da', fiore['pagato_da']),
         data.get('ordinante_nome', fiore.get('ordinante_nome')),
         data.get('ordinante_telefono', fiore.get('ordinante_telefono')),
         fiore_id),
        returning=True
    )
    return jsonify(updated)


@api.route('/api/fiori/<int:fiore_id>', methods=['DELETE'])
def delete_fiore(fiore_id):
    fiore = query('SELECT id FROM fiori WHERE id = %s', (fiore_id,), fetchone=True)
    if not fiore:
        return jsonify({'error': 'Fiore non trovato'}), 404
    query('DELETE FROM fiori WHERE id = %s', (fiore_id,))
    return jsonify({'message': 'Fiore eliminato'})


# --- Batch update pagamento ---

@api.route('/api/fiori/batch-pagamento', methods=['PATCH'])
def batch_update_pagamento():
    data = request.get_json()
    if not data or not isinstance(data.get('ids'), list) or len(data['ids']) == 0:
        return jsonify({'error': 'ids deve essere una lista non vuota'}), 400

    try:
        pagato = _parse_int(data.get('pagato', 1), field_name='pagato')
    except ValueError as e:
        return jsonify({'error': str(e)}), 400

    pagato_da = data.get('pagato_da')
    ids = data['ids']

    # Validazione: tutti gli id devono essere interi
    try:
        ids = [int(i) for i in ids]
    except (ValueError, TypeError):
        return jsonify({'error': 'Tutti gli id devono essere numeri interi'}), 400

    # Singola transazione per tutti gli update
    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(
            'UPDATE fiori SET pagato = %s, pagato_da = %s WHERE id = ANY(%s) RETURNING *',
            (pagato, pagato_da, ids)
        )
        updated = cursor.fetchall()
        conn.commit()
        cursor.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        put_db(conn)

    return jsonify([dict(r) for r in updated])


# --- Riepilogo ---

@api.route('/api/defunti/<int:defunto_id>/riepilogo', methods=['GET'])
def get_riepilogo(defunto_id):
    defunto = query('SELECT * FROM defunti WHERE id = %s', (defunto_id,), fetchone=True)
    if not defunto:
        return jsonify({'error': 'Defunto non trovato'}), 404

    row = query(
        '''SELECT
               COALESCE(SUM(costo), 0) AS totale_costi,
               COALESCE(SUM(CASE WHEN pagato = 1 THEN costo ELSE 0 END), 0) AS totale_pagato,
               COALESCE(SUM(CASE WHEN pagato = 0 THEN costo ELSE 0 END), 0) AS totale_da_pagare
           FROM fiori WHERE defunto_id = %s''',
        (defunto_id,), fetchone=True
    )

    return jsonify({
        'defunto_id': defunto_id,
        'totale_costi': float(row['totale_costi']),
        'totale_pagato': float(row['totale_pagato']),
        'totale_da_pagare': float(row['totale_da_pagare']),
    })


# --- Statistiche (singola connessione per tutte le query) ---

@api.route('/api/statistiche', methods=['GET'])
def get_statistiche():
    anno = request.args.get('anno', '')
    filtro_anno = ''
    params_d = ()
    params_f = ()

    if anno:
        filtro_anno = " AND d.data_inserimento LIKE %s"
        params_d = (f'{anno}%',)
        params_f = (f'{anno}%',)

    conn = get_db()
    try:
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Anni disponibili
        cursor.execute(
            "SELECT DISTINCT SUBSTRING(data_inserimento FROM 1 FOR 4) AS anno FROM defunti WHERE data_inserimento IS NOT NULL ORDER BY anno DESC"
        )
        anni = [dict(r) for r in cursor.fetchall()] or []

        # Panoramica pratiche
        cursor.execute(
            f'''SELECT
                COUNT(*) AS totali,
                SUM(CASE WHEN archiviato = 0 THEN 1 ELSE 0 END) AS attive,
                SUM(CASE WHEN archiviato = 1 THEN 1 ELSE 0 END) AS archiviate
            FROM defunti d WHERE 1=1{filtro_anno}''',
            params_d
        )
        panoramica = dict(cursor.fetchone())

        # Composizioni totali
        cursor.execute(
            f'''SELECT COUNT(*) AS totali FROM fiori f
                JOIN defunti d ON d.id = f.defunto_id
                WHERE 1=1{filtro_anno}''',
            params_d
        )
        comp_totali = dict(cursor.fetchone())

        # Riepilogo economico (escludi Copricassa)
        cursor.execute(
            f'''SELECT
                COALESCE(SUM(f.costo), 0) AS fatturato,
                COALESCE(SUM(CASE WHEN f.pagato = 1 THEN f.costo ELSE 0 END), 0) AS incassato,
                COALESCE(SUM(CASE WHEN f.pagato = 0 THEN f.costo ELSE 0 END), 0) AS da_incassare,
                COALESCE(AVG(f.costo), 0) AS costo_medio_comp
            FROM fiori f
            JOIN defunti d ON d.id = f.defunto_id
            WHERE f.tipo != 'Copricassa'{filtro_anno}''',
            params_d
        )
        economico = dict(cursor.fetchone())

        # Costo medio per pratica e composizioni medie per pratica
        cursor.execute(
            f'''SELECT
                COALESCE(AVG(sub.totale), 0) AS costo_medio_pratica,
                COALESCE(AVG(sub.num), 0) AS comp_media
            FROM (
                SELECT d.id, SUM(f.costo) AS totale, COUNT(f.id) AS num
                FROM defunti d
                JOIN fiori f ON f.defunto_id = d.id
                WHERE f.tipo != 'Copricassa'{filtro_anno}
                GROUP BY d.id
            ) sub''',
            params_d
        )
        per_pratica = dict(cursor.fetchone())

        # Per tipo composizione
        cursor.execute(
            f'''SELECT f.tipo,
                COUNT(*) AS quantita,
                COALESCE(SUM(f.costo), 0) AS totale,
                COALESCE(AVG(f.costo), 0) AS media
            FROM fiori f
            JOIN defunti d ON d.id = f.defunto_id
            WHERE 1=1{filtro_anno}
            GROUP BY f.tipo ORDER BY quantita DESC''',
            params_d
        )
        per_tipo = [dict(r) for r in cursor.fetchall()] or []

        # Per metodo pagamento
        cursor.execute(
            f'''SELECT
                COALESCE(f.pagato_da, 'Non specificato') AS metodo,
                COUNT(*) AS quantita,
                COALESCE(SUM(f.costo), 0) AS totale
            FROM fiori f
            JOIN defunti d ON d.id = f.defunto_id
            WHERE f.pagato = 1 AND f.tipo != 'Copricassa'{filtro_anno}
            GROUP BY f.pagato_da ORDER BY totale DESC''',
            params_d
        )
        per_metodo = [dict(r) for r in cursor.fetchall()] or []

        # Andamento mensile
        cursor.execute(
            f'''SELECT
                SUBSTRING(d.data_inserimento FROM 1 FOR 7) AS mese,
                COUNT(DISTINCT d.id) AS pratiche,
                COUNT(f.id) AS composizioni,
                COALESCE(SUM(f.costo), 0) AS totale
            FROM defunti d
            LEFT JOIN fiori f ON f.defunto_id = d.id
            WHERE d.data_inserimento IS NOT NULL{filtro_anno}
            GROUP BY mese ORDER BY mese DESC''',
            params_d
        )
        per_mese = [dict(r) for r in cursor.fetchall()] or []

        # Top 10 pratiche per importo
        cursor.execute(
            f'''SELECT d.id, d.nome, d.cognome,
                COUNT(f.id) AS num_composizioni,
                COALESCE(SUM(f.costo), 0) AS totale
            FROM defunti d
            LEFT JOIN fiori f ON f.defunto_id = d.id
            WHERE 1=1{filtro_anno}
            GROUP BY d.id, d.nome, d.cognome
            ORDER BY totale DESC LIMIT 10''',
            params_d
        )
        top_pratiche = [dict(r) for r in cursor.fetchall()] or []

        conn.commit()
        cursor.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        put_db(conn)

    return jsonify({
        'anni': [a['anno'] for a in anni if a['anno']],
        'pratiche_totali': panoramica['totali'] or 0,
        'pratiche_attive': panoramica['attive'] or 0,
        'pratiche_archiviate': panoramica['archiviate'] or 0,
        'composizioni_totali': comp_totali['totali'] or 0,
        'fatturato': float(economico['fatturato'] or 0),
        'incassato': float(economico['incassato'] or 0),
        'da_incassare': float(economico['da_incassare'] or 0),
        'costo_medio_pratica': float(per_pratica['costo_medio_pratica'] or 0),
        'costo_medio_comp': float(economico['costo_medio_comp'] or 0),
        'comp_media_pratica': round(float(per_pratica['comp_media'] or 0), 1),
        'per_tipo': [{'tipo': r['tipo'], 'quantita': r['quantita'], 'totale': float(r['totale']), 'media': float(r['media'])} for r in per_tipo],
        'per_metodo': [{'metodo': r['metodo'], 'quantita': r['quantita'], 'totale': float(r['totale'])} for r in per_metodo],
        'per_mese': [{'mese': r['mese'], 'pratiche': r['pratiche'], 'composizioni': r['composizioni'], 'totale': float(r['totale'])} for r in per_mese],
        'top_pratiche': [{'nome': f"{r['cognome']} {r['nome']}", 'num_composizioni': r['num_composizioni'], 'totale': float(r['totale'])} for r in top_pratiche],
    })
