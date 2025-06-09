from flask_restful import Resource
from ..utils.database import get_db_connection
from flask import current_app as app

class GroupRepositoriesAPI(Resource):
    """
    API pour récupérer les repositories associés à un groupe donné.
    """

    def get(self, group_id):
        """
        Récupère tous les repositories appartenant au groupe spécifié par group_id.
        Retourne une liste de dictionnaires {id, name, category}.
        """
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            query = """
                SELECT r.id, r.name, r.category, r.owner, r.analysisId
                FROM repositories_groups rg
                INNER JOIN repositories r ON rg.id_repo = r.id
                WHERE rg.id_group = %s
                ORDER BY r.name, r.owner
            """

            cursor.execute(query, (group_id,))
            repos = cursor.fetchall()

            # Process repos to combine owner and name
            for repo in repos:
                repo['name'] = f"{repo['owner']}/{repo['name']}"
            
            # Log the repositories.
            # It's better to log the entire 'repos' list or a representation of it,
            # rather than a single 'repo' variable which might not exist if 'repos' is empty.
            if repos:
                app.logger.debug(f"Repositories du groupe {group_id} : {len(repos)} trouvés.")
                # If you want to see the actual content, consider logging a slice or iterating.
                # app.logger.debug(f"Détails : {repos}")
            else:
                app.logger.debug(f"Aucun repository trouvé pour le groupe {group_id}.")
                
            return repos, 200

        except Exception as e:
            # Corrected the error message to reflect "group" instead of "student"
            app.logger.error(f"Erreur dans la récupération des repositories du groupe : {e}")
            return {"error": str(e)}, 500
        finally:
            if conn:
                conn.close()