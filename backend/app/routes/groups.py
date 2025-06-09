# groups.py

from flask_restful import Resource
from flask import request
from ..utils.database import get_db_connection

class GroupsAPI(Resource):
    """API pour gérer les groupes."""

    def post(self):
        """Ajoute un nouveau groupe."""
        data = request.get_json() if request.is_json else request.form

        group_name = data.get("name")
        group_year = data.get("year")  # Optionnel

        if not group_name:
            return {"error": "Nom du groupe manquant"}, 400

        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            if group_year:
                cursor.execute("INSERT INTO `groups` (`name`, `year`) VALUES (%s, %s)", (group_name, group_year))
            else:
                cursor.execute("INSERT INTO `groups` (`name`) VALUES (%s)", (group_name,))

            conn.commit()
            return {"message": "Groupe ajouté avec succès", "id": cursor.lastrowid}, 201
        except Exception as e:
            if conn:
                conn.rollback()
            return {"error": str(e)}, 500
        finally:
            if conn:
                conn.close()

    def get(self, gr_id=None):
        """Récupère un ou plusieurs groupes avec leurs étudiants associés."""
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            query = """
            SELECT
                g.id AS group_id,
                g.name AS group_name,
                g.year AS group_year,
                s.id AS student_id,
                s.name AS student_name,
                s.surname AS student_surname,
                s.no_etudiant AS student_no_etudiant
            FROM
                `groups` g
            LEFT JOIN
                `groups_students` gs ON g.id = gs.id_group
            LEFT JOIN
                `students` s ON gs.id_student = s.id
            """
            params = ()
            if gr_id:
                query += " WHERE g.id = %s"
                params = (gr_id,)
            query += " ORDER BY g.year, g.name, s.surname, s.name;"

            cursor.execute(query, params)

            groups_data = {}
            for row in cursor.fetchall():
                gid = row['group_id']
                if gid not in groups_data:
                    groups_data[gid] = {
                        "id": gid,
                        "name": row['group_name'],
                        "year": row['group_year'],
                        "students": []
                    }
                if row['student_id'] is not None:
                    groups_data[gid]["students"].append({
                        "id": row['student_id'],
                        "surname": row['student_surname'],
                        "name": row['student_name'],
                        "no_etudiant": row['student_no_etudiant']
                    })

            if gr_id:
                if groups_data:
                    return list(groups_data.values())[0], 200
                else:
                    return {"message": "Groupe non trouvé"}, 404
            else:
                return list(groups_data.values()), 200
        except Exception as e:
            return {"error": str(e)}, 500
        finally:
            if conn:
                conn.close()
