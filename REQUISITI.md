# REQUISITI - Web App Fiori per Onoranze Funebri

## Visione del Prodotto

Un'applicazione web locale, mobile-friendly, dedicata alle onoranze funebri per gestire in modo semplice e rapido i fiori preparati per ogni defunto. L'app consente di registrare ogni composizione floreale, tracciare i costi, monitorare i pagamenti e produrre un riepilogo completo per ogni pratica funebre. Il tutto in modo rispettoso, sobrio e professionale.

**Obiettivo principale:** eliminare fogli cartacei e foglio Excel, centralizzare le informazioni e avere sempre sotto controllo cosa e' stato pagato e cosa no.

---

## Casi d'Uso Principali

### CU-01: Gestione Defunti

**Attori:** Operatore funebre

| Operazione | Descrizione |
|---|---|
| Aggiungere un defunto | Inserire nome, cognome, data di decesso, note opzionali |
| Modificare un defunto | Aggiornare qualsiasi campo del defunto |
| Archiviare un defunto | Marcare la pratica come chiusa/archiviata (non eliminata) |
| Visualizzare lista defunti | Elenco con ricerca e filtri, separando pratiche attive da archiviate |
| Cercare un defunto | Ricerca per nome, cognome o data |

**Pre-condizioni:** nessuna  
**Post-condizioni:** il defunto e' registrato nel sistema e puo' ricevere composizioni floreali

---

### CU-02: Gestione Fiori per Defunto

**Attori:** Operatore funebre

| Operazione | Descrizione |
|---|---|
| Aggiungere un fiore | Associare una composizione a un defunto con tipo, descrizione, costo |
| Modificare un fiore | Aggiornare tipo, descrizione, costo o stato pagamento |
| Eliminare un fiore | Rimuovere una composizione dalla pratica |
| Visualizzare fiori di un defunto | Lista completa delle composizioni con totali |

**Tipi di fiori predefiniti:**
- Copricassa
- Cuscino
- Mazzo
- Corona
- Composizione
- Altro

**Campi per ogni composizione:**
- Tipo (da lista predefinita)
- Descrizione libera (es. "cuscino bianco con rose rosse")
- Costo (importo in euro)
- Stato pagamento: Pagato / Non pagato
- Chi ha pagato (nome del pagante, opzionale)
- Data pagamento (opzionale)
- Note aggiuntive (opzionale)

---

### CU-03: Riepilogo Costi per Defunto

**Attori:** Operatore funebre

| Dato mostrato | Descrizione |
|---|---|
| Totale complessivo | Somma di tutti i costi per il defunto |
| Totale pagato | Somma dei soli articoli con stato "Pagato" |
| Totale non pagato | Somma dei soli articoli con stato "Non pagato" |
| Riepilogo per tipo | Subtotale raggruppato per tipo di fiore |

---

### CU-04: Filtro per Stato Pagamento

**Attori:** Operatore funebre

L'operatore puo' filtrare le composizioni di un defunto per:
- Tutti
- Solo pagati
- Solo non pagati

Il filtro e' applicabile anche nella vista globale per trovare rapidamente tutte le composizioni non pagate su tutte le pratiche.

---

### CU-05: Ricerca Defunti

**Attori:** Operatore funebre

- Ricerca testuale per nome e/o cognome
- Filtro per stato pratica (attiva / archiviata / tutte)
- Filtro per data decesso (intervallo date)
- Risultati ordinabili per: nome, data decesso, totale costi, totale non pagato

---

## Regole di Business

| ID | Regola |
|---|---|
| RB-01 | Un defunto puo' avere zero o piu' composizioni floreali (0..N) |
| RB-02 | Una composizione appartiene a un solo defunto |
| RB-03 | Il costo di una composizione deve essere >= 0 |
| RB-04 | Una composizione archiviata con il defunto non puo' essere modificata (solo lettura) |
| RB-05 | Lo stato pagamento e' binario: "Pagato" o "Non pagato" |
| RB-06 | Se lo stato e' "Pagato", il campo "chi ha pagato" e' raccomandato ma non obbligatorio |
| RB-07 | Archiviare un defunto non cancella i suoi dati - rimangono consultabili |
| RB-08 | Un defunto archiviato non puo' ricevere nuove composizioni |
| RB-09 | I tipi di fiore predefiniti sono fissi; il tipo "Altro" permette descrizione libera |
| RB-10 | La eliminazione di un defunto e' disabilitata (solo archiviazione) per preservare la storia |

---

## Flussi Utente Principali

### Flusso 1: Nuova Pratica

```
1. Operatore apre l'app
2. Clicca "Nuovo Defunto"
3. Inserisce: nome, cognome, data decesso
4. Salva
5. Si apre la scheda del defunto (vuota)
6. Clicca "Aggiungi Fiore"
7. Seleziona tipo, inserisce descrizione e costo
8. Salva il fiore
9. Ripete per ogni composizione
10. Vede il riepilogo costi in tempo reale
```

### Flusso 2: Registrazione Pagamento

```
1. Operatore apre la scheda di un defunto
2. Vede la lista dei fiori con stato "Non pagato"
3. Clicca su un fiore per modificarlo
4. Cambia stato in "Pagato", inserisce chi ha pagato
5. Salva
6. Il totale pagato/non pagato si aggiorna automaticamente
```

### Flusso 3: Consultazione e Ricerca

```
1. Operatore cerca un defunto per nome
2. Vede la lista filtrata in tempo reale
3. Apre la scheda del defunto
4. Applica filtro "Solo non pagati"
5. Vede solo le composizioni in sospeso
```

### Flusso 4: Archiviazione Pratica

```
1. Operatore apre la scheda di un defunto
2. Verifica che tutti i pagamenti siano ok
3. Clicca "Archivia Pratica"
4. Conferma l'operazione
5. Il defunto passa in stato "Archiviato"
6. La scheda diventa di sola lettura
```

---

## Requisiti Non Funzionali

### Performance
- Caricamento pagina iniziale: < 1 secondo
- Risposta a ogni azione utente: < 300ms
- Ricerca in tempo reale: risultati entro 200ms dalla digitazione

### Usabilita' e UX
- Mobile-first: ottimizzato per smartphone (touch, font grandi, pulsanti ampi)
- Responsive: funziona correttamente su tablet e desktop
- Interfaccia sobria e rispettosa del contesto (onoranze funebri)
- Nessun account / login necessario (uso locale aziendale)

### Tecnologia e Architettura
- Database locale: SQLite (nessun server remoto richiesto)
- Applicazione web: HTML + CSS + JavaScript (vanilla o framework leggero)
- Funzionamento offline: non dipende da connessione internet
- Installazione zero: aprire index.html nel browser o via server locale minimale

### Dati e Sicurezza
- Tutti i dati restano sul dispositivo locale
- Nessun dato sensibile inviato a server esterni
- Backup manuale: possibilita' di esportare il database SQLite
- (Opzionale futuro) Export PDF del riepilogo per defunto

### Compatibilita'
- Browser moderni: Chrome, Firefox, Edge (ultimi 2 major)
- Sistema operativo: Windows (primario), macOS, Linux

---

## Schema Dati (Riferimento)

### Tabella: defunti
| Campo | Tipo | Note |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| nome | TEXT | Obbligatorio |
| cognome | TEXT | Obbligatorio |
| data_decesso | DATE | Obbligatorio |
| note | TEXT | Opzionale |
| archiviato | BOOLEAN | Default: false |
| created_at | DATETIME | Auto |
| updated_at | DATETIME | Auto |

### Tabella: composizioni
| Campo | Tipo | Note |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| defunto_id | INTEGER FK | Riferimento a defunti.id |
| tipo | TEXT | Enum: Copricassa, Cuscino, Mazzo, Corona, Composizione, Altro |
| descrizione | TEXT | Opzionale |
| costo | DECIMAL(10,2) | >= 0 |
| pagato | BOOLEAN | Default: false |
| pagato_da | TEXT | Opzionale |
| data_pagamento | DATE | Opzionale |
| note | TEXT | Opzionale |
| created_at | DATETIME | Auto |
| updated_at | DATETIME | Auto |

---

## Priorita' Features (MoSCoW)

### Must Have (MVP)
- Aggiungere/modificare/archiviare defunti
- Aggiungere/modificare/eliminare composizioni
- Riepilogo costi pagati/non pagati per defunto
- Ricerca defunti
- Filtro per stato pagamento

### Should Have
- Filtro per data decesso
- Totali raggruppati per tipo di fiore
- Ordinamento lista defunti

### Could Have
- Export PDF riepilogo
- Statistiche mensili/annuali
- Backup/restore database

### Won't Have (per ora)
- Multi-utente / autenticazione
- Sincronizzazione cloud
- Gestione listino prezzi fornitori
