from flask import Blueprint, request, jsonify
from datetime import datetime
from database import get_db

api = Blueprint('api', __name__)


def row_to_dict(row):
    return dict(row) if row else None


def rows_to_list(rows):
    return [dict(row) for row in rows]


def now_iso():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


# --- Defunti ---

@api.route('/api/defunti', methods=['GET'])
def get_defunti():
    search = request.args.get('search', '').strip()
    conn = get_db()
    if search:
        rows = conn.execute(
            '''SELECT * FROM defunti
               WHERE archiviato = 0
                 AND (nome LIKE ? OR cognome LIKE ? OR luogo LIKE ?)
               ORDER BY data_inserimento DESC''',
            (f'%{search}%', f'%{search}%', f'%{search}%')
        ).fetchall()
    else:
        rows = conn.execute(
            'SELECT * FROM defunti WHERE archiviato = 0 ORDER BY data_inserimento DESC'
        ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@api.route('/api/defunti', methods=['POST'])
def create_defunto():
    data = request.get_json()
    if not data or not data.get('nome') or not data.get('cognome'):
        return jsonify({'error': 'nome e cognome sono obbligatori'}), 400

    conn = get_db()
    cursor = conn.execute(
        '''INSERT INTO defunti (nome, cognome, data_decesso, luogo, note, data_inserimento, archiviato)
           VALUES (?, ?, ?, ?, ?, ?, 0)''',
        (
            data['nome'],
            data['cognome'],
            data.get('data_decesso'),
            data.get('luogo'),
            data.get('note'),
            now_iso(),
        )
    )
    conn.commit()
    new_id = cursor.lastrowid
    row = conn.execute('SELECT * FROM defunti WHERE id = ?', (new_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


@api.route('/api/defunti/<int:defunto_id>', methods=['GET'])
def get_defunto(defunto_id):
    conn = get_db()
    defunto = conn.execute('SELECT * FROM defunti WHERE id = ?', (defunto_id,)).fetchone()
    if not defunto:
        conn.close()
        return jsonify({'error': 'Defunto non trovato'}), 404
    fiori = conn.execute(
        'SELECT * FROM fiori WHERE defunto_id = ? ORDER BY data_inserimento DESC',
        (defunto_id,)
    ).fetchall()
    conn.close()
    result = row_to_dict(defunto)
    result['fiori'] = rows_to_list(fiori)
    return jsonify(result)


@api.route('/api/defunti/<int:defunto_id>', methods=['PUT'])
def update_defunto(defunto_id):
    data = request.get_json()
    conn = get_db()
    defunto = conn.execute('SELECT * FROM defunti WHERE id = ?', (defunto_id,)).fetchone()
    if not defunto:
        conn.close()
        return jsonify({'error': 'Defunto non trovato'}), 404

    conn.execute(
        '''UPDATE defunti
           SET nome = ?, cognome = ?, data_decesso = ?, luogo = ?, note = ?
           WHERE id = ?''',
        (
            data.get('nome', defunto['nome']),
            data.get('cognome', defunto['cognome']),
            data.get('data_decesso', defunto['data_decesso']),
            data.get('luogo', defunto['luogo']),
            data.get('note', defunto['note']),
            defunto_id,
        )
    )
    conn.commit()
    updated = conn.execute('SELECT * FROM defunti WHERE id = ?', (defunto_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(updated))


@api.route('/api/defunti/<int:defunto_id>', methods=['DELETE'])
def archive_defunto(defunto_id):
    conn = get_db()
    defunto = conn.execute('SELECT * FROM defunti WHERE id = ?', (defunto_id,)).fetchone()
    if not defunto:
        conn.close()
        return jsonify({'error': 'Defunto non trovato'}), 404
    conn.execute('UPDATE defunti SET archiviato = 1 WHERE id = ?', (defunto_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Defunto archiviato'})


# --- Fiori per defunto ---

@api.route('/api/defunti/<int:defunto_id>/fiori', methods=['GET'])
def get_fiori(defunto_id):
    conn = get_db()
    defunto = conn.execute('SELECT id FROM defunti WHERE id = ?', (defunto_id,)).fetchone()
    if not defunto:
        conn.close()
        return jsonify({'error': 'Defunto non trovato'}), 404
    rows = conn.execute(
        'SELECT * FROM fiori WHERE defunto_id = ? ORDER BY data_inserimento DESC',
        (defunto_id,)
    ).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


@api.route('/api/defunti/<int:defunto_id>/fiori', methods=['POST'])
def add_fiore(defunto_id):
    data = request.get_json()
    if not data or not data.get('tipo') or data.get('costo') is None:
        return jsonify({'error': 'tipo e costo sono obbligatori'}), 400

    tipi_validi = {'Copricassa', 'Cuscino', 'Mazzo', 'Corona', 'Composizione', 'Altro'}
    if data['tipo'] not in tipi_validi:
        return jsonify({'error': f'tipo deve essere uno di: {", ".join(sorted(tipi_validi))}'}), 400

    conn = get_db()
    defunto = conn.execute('SELECT id FROM defunti WHERE id = ?', (defunto_id,)).fetchone()
    if not defunto:
        conn.close()
        return jsonify({'error': 'Defunto non trovato'}), 404

    cursor = conn.execute(
        '''INSERT INTO fiori (defunto_id, tipo, descrizione, costo, pagato, pagato_da, data_inserimento)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        (
            defunto_id,
            data['tipo'],
            data.get('descrizione'),
            float(data['costo']),
            int(data.get('pagato', 0)),
            data.get('pagato_da'),
            now_iso(),
        )
    )
    conn.commit()
    new_id = cursor.lastrowid
    row = conn.execute('SELECT * FROM fiori WHERE id = ?', (new_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


# --- Fiori singolo ---

@api.route('/api/fiori/<int:fiore_id>', methods=['PUT'])
def update_fiore(fiore_id):
    data = request.get_json()
    conn = get_db()
    fiore = conn.execute('SELECT * FROM fiori WHERE id = ?', (fiore_id,)).fetchone()
    if not fiore:
        conn.close()
        return jsonify({'error': 'Fiore non trovato'}), 404

    tipi_validi = {'Copricassa', 'Cuscino', 'Mazzo', 'Corona', 'Composizione', 'Altro'}
    tipo = data.get('tipo', fiore['tipo'])
    if tipo not in tipi_validi:
        conn.close()
        return jsonify({'error': f'tipo deve essere uno di: {", ".join(sorted(tipi_validi))}'}), 400

    conn.execute(
        '''UPDATE fiori
           SET tipo = ?, descrizione = ?, costo = ?, pagato = ?, pagato_da = ?
           WHERE id = ?''',
        (
            tipo,
            data.get('descrizione', fiore['descrizione']),
            float(data.get('costo', fiore['costo'])),
            int(data.get('pagato', fiore['pagato'])),
            data.get('pagato_da', fiore['pagato_da']),
            fiore_id,
        )
    )
    conn.commit()
    updated = conn.execute('SELECT * FROM fiori WHERE id = ?', (fiore_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(updated))


@api.route('/api/fiori/<int:fiore_id>', methods=['DELETE'])
def delete_fiore(fiore_id):
    conn = get_db()
    fiore = conn.execute('SELECT id FROM fiori WHERE id = ?', (fiore_id,)).fetchone()
    if not fiore:
        conn.close()
        return jsonify({'error': 'Fiore non trovato'}), 404
    conn.execute('DELETE FROM fiori WHERE id = ?', (fiore_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Fiore eliminato'})


# --- Riepilogo ---

@api.route('/api/defunti/<int:defunto_id>/riepilogo', methods=['GET'])
def get_riepilogo(defunto_id):
    conn = get_db()
    defunto = conn.execute('SELECT * FROM defunti WHERE id = ?', (defunto_id,)).fetchone()
    if not defunto:
        conn.close()
        return jsonify({'error': 'Defunto non trovato'}), 404

    row = conn.execute(
        '''SELECT
               COALESCE(SUM(costo), 0) AS totale_costi,
               COALESCE(SUM(CASE WHEN pagato = 1 THEN costo ELSE 0 END), 0) AS totale_pagato,
               COALESCE(SUM(CASE WHEN pagato = 0 THEN costo ELSE 0 END), 0) AS totale_da_pagare
           FROM fiori WHERE defunto_id = ?''',
        (defunto_id,)
    ).fetchone()
    conn.close()

    return jsonify({
        'defunto_id': defunto_id,
        'totale_costi': row['totale_costi'],
        'totale_pagato': row['totale_pagato'],
        'totale_da_pagare': row['totale_da_pagare'],
    })
