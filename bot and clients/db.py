import sqlite3

def init_db():
    conn = sqlite3.connect("clients.db")
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT,
        date TEXT
    )
    """)
    conn.commit()
    conn.close()


def get_clients(from_date=None, to_date=None):
    conn = sqlite3.connect("clients.db")
    cursor = conn.cursor()

    if from_date and to_date:
        cursor.execute(
            "SELECT * FROM clients WHERE date BETWEEN ? AND ? ORDER BY id DESC",
            (from_date, to_date)
        )
    else:
        cursor.execute("SELECT * FROM clients ORDER BY id DESC")

    rows = cursor.fetchall()
    conn.close()
    return rows


def delete_client(client_id: int):
    conn = sqlite3.connect("clients.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM clients WHERE id = ?", (client_id,))
    conn.commit()
    conn.close()


def add_client(name, phone, date):
    conn = sqlite3.connect("clients.db")
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO clients (name, phone, date) VALUES (?, ?, ?)",
        (name, phone, date)
    )
    conn.commit()
    conn.close()


def delete_by_id(client_id):
    conn = sqlite3.connect("clients.db")
    cursor = conn.cursor()
    cursor.execute("DELETE FROM clients WHERE id=?", (client_id,))
    conn.commit()
    conn.close()
