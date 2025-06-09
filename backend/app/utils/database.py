import mysql.connector
from flask import current_app

def get_db_connection(instanciation = False):
    print("Tentative de connexion à la base de données MySQL...")
    """Créer une connexion à la base de données MySQL."""
    try:
        conn = mysql.connector.connect(
            host=current_app.config['DB_HOST'],
            user=current_app.config['DB_USER'],
            password=current_app.config['DB_PASSWORD'],
            database=current_app.config['DB_NAME'],
            port=current_app.config['DB_PORT']
        )
        
        return conn
    except mysql.connector.Error as err:
        if(instanciation == False):
            print(f"Erreur de connexion MySQL : {err}")
        return None
        
        
