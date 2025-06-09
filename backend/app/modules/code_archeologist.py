import requests
from flask import current_app as app
from ..utils.database import get_db_connection

def code_archeologist_analysis(repoUrl, id_repo):
    analyze_url = "http://archeologist:3000/api/analyze"
    full_data_url = "http://archeologist:3000/api/analysis-data"
    commit_processing_url = "http://archeologist:3000/api/process-commits"
    blame_url = "http://archeologist:3000/api/blame-evolution"
    
    # Lancer l'analyse du repo
    initial_response = requests.post(analyze_url, json={"repoUrl": repoUrl, "local": True})
  
    try:
        initial_data = initial_response.json()
        #app.logger.debug(f"Réponse analyse : {data}")
    except Exception:
        return f"Erreur JSONDecode lors de l'analyse : contenu reçu = {initial_response.text}"
    if not initial_response.ok or initial_data.get("status") != "success":
        return f"Erreur lors de l'analyse du dépôt : {initial_response.text}"
    
    analysis_id = initial_data["analysisId"]
    update_analysis_id_in_db(analysis_id, id_repo)

    # Récupérer les données de l'analyse complète
    params = {"analysisId": analysis_id}
    full_data_response = requests.get(full_data_url, params=params)
    try:
        analysis_full_data = full_data_response.json()
    except Exception:
        return f"Erreur JSONDecode lors de la récupération des données : contenu reçu = {full_data_response.text}"
    if not full_data_response.ok or analysis_full_data.get("status") != "success":
        return f"Erreur lors de la récupération des données d'analyse : {full_data_response.text}"

    # Renvoie les données complètes de l'analyse
    return analysis_full_data


def update_analysis_id_in_db(analysis_id, id_repo):
    """
    Met à jour l'ID d'analyse dans la base de données pour le dépôt spécifié.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute(
            "UPDATE `repositories` SET `analysisId` = %s WHERE `id` = %s",
            (analysis_id, id_repo)
        )
        conn.commit()
        app.logger.debug(f"Enregistrement du mapping repo-analysis | analysisId : {analysis_id}, repo: {id_repo}")

    except Exception as e:
        app.logger.error(f"Erreur lors de l'enregistrement du mapping : {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()