from flask import Blueprint, request, jsonify
from datetime import datetime
from database import get_db
import psycopg2.extras

api = Blueprint('api', __name__)

TIPI_VALIDI = {'Cuscino', 'Cuscino Grande', 'Cuore', 'Cuore Grande', 'Copricassa', 'Mazzo di fiori', 'Altro'}


def now_iso():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def query(sql, params=(), fetchone=False, fetchall=False, returning=False):
    conn = get_db()
    cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cursor.execute(sql, params)
    result = None
    if fetchone or returning:
        result = cursor.fetchone()
    elif fetchall:
        result = cursor.fetchall()
    conn.commit()
    cursor.close()
    conn.close()
    if result is None:
        return None
    # Convert RealDictRow to plain dict
    if isinstance(result, list):
        return [dict(r) for r in result]
    return dict(result)


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
    if search:
        pattern = f'%{search}%'
        rows = query(
            base + ''' WHERE d.archiviato = 0
                 AND (d.nome ILIKE %s OR d.cognome ILIKE %s OR d.luogo ILIKE %s)
               ORDER BY d.data_inserimento DESC''',
            (pattern, pattern, pattern), fetchall=True
        )
    else:
        rows = query(
            base + ' WHERE d.archiviato = 0 ORDER BY d.data_inserimento DESC',
            fetchall=True
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
    query('DELETE FROM fiori WHERE defunto_id = %s', (defunto_id,))
    query('DELETE FROM defunti WHERE id = %s', (defunto_id,))
    return jsonify({'message': 'Defunto e composizioni eliminati'})


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

    defunto = query('SELECT id FROM defunti WHERE id = %s', (defunto_id,), fetchone=True)
    if not defunto:
        return jsonify({'error': 'Defunto non trovato'}), 404

    row = query(
        '''INSERT INTO fiori (defunto_id, tipo, descrizione, scritta_fascia, costo, pagato, pagato_da, data_inserimento)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING *''',
        (defunto_id, data['tipo'], data.get('descrizione'), data.get('scritta_fascia'),
         float(data.get('costo', 0)), int(data.get('pagato', 0)),
         data.get('pagato_da'), now_iso()),
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

    updated = query(
        '''UPDATE fiori
           SET tipo = %s, descrizione = %s, scritta_fascia = %s, costo = %s, pagato = %s, pagato_da = %s
           WHERE id = %s RETURNING *''',
        (tipo,
         data.get('descrizione', fiore['descrizione']),
         data.get('scritta_fascia', fiore.get('scritta_fascia')),
         float(data.get('costo', fiore['costo'])),
         int(data.get('pagato', fiore['pagato'])),
         data.get('pagato_da', fiore['pagato_da']),
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
