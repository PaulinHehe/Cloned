from flask_restful import Resource, reqparse
from flask import request, jsonify
from ..utils.database import get_db_connection
from flask import current_app as app

class StudentRepositoriesAPI(Resource):
    """
    """

    def get(self, student_id):
        """
        """
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            query = """
                SELECT r.id, r.name, r.category, r.owner, r.analysisId
                FROM repositories_students rs
                INNER JOIN repositories r ON rs.id_repo = r.id
                WHERE rs.id_student = %s
                ORDER BY r.name, r.owner
            """

            cursor.execute(query, (student_id,))
            repos = cursor.fetchall()
            for repo in repos:
                repo['name'] = f"{repo['owner']}/{repo['name']}"
                app.logger.debug(f"Repository found: {repo['name']} | Analysis ID: {repo['analysisId']})")
                
            app.logger.debug(f"Repositories de l'étudiant {student_id} : {repo}")
            return repos, 200

        except Exception as e:
            app.logger.error(f"Erreur dans la récupération des repositories de l'étudiant : {e}")
            return {"error": str(e)}, 500
        finally:
            if conn:
                conn.close()