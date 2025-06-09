from flask_restful import Resource, reqparse
from flask import request, jsonify
from ..utils.database import get_db_connection
from ..utils.json_to_db import JSONToDB
from flask import current_app as app

class StudentsAPI(Resource):
    """API pour gérer les étudiants."""

    def post(self):
        """Ajoute un nouvel étudiant."""
        parser = reqparse.RequestParser()
        parser.add_argument('surname', type=str, required=True, help="Nom de famille est obligatoire")
        parser.add_argument('name', type=str, required=True, help="Prénom est obligatoire")
        parser.add_argument('no_etudiant', type=str, required=True, help="Numéro d'étudiant est obligatoire")
        parser.add_argument('class', type=str, required=True, help="Classe est obligatoire")
        args = parser.parse_args()

        student_surname = args['surname']
        student_name = args['name']
        no_etudiant = args['no_etudiant']
        student_class = args['class']

        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute(
                "INSERT INTO `students` (`surname`, `name`, `no_etudiant`, `class`) VALUES (%s, %s, %s, %s)",
                (student_surname, student_name, no_etudiant, student_class)
            )
            conn.commit()
            return {"message": "Étudiant ajouté avec succès", "id": cursor.lastrowid}, 201
        except Exception as e:
            if conn:
                conn.rollback()
            if "Duplicate entry" in str(e) and "for key 'no_etudiant'" in str(e):
                return {"error": "Un étudiant avec ce numéro existe déjà."}, 409
            return {"error": str(e)}, 500
        finally:
            if conn:
                conn.close()

    def get(self, st_id=None):
        # This block should ideally be run once on application startup, not every time a GET request is made.
        # For development/testing, keeping it here helps ensure data is always loaded.
        # For production, consider moving json_to_db.import_json_data() to an app startup event.
        '''with app.app_context():
            if JSONToDB.import_json_data():
                app.logger.info("Data imported successfully!") # Use app.logger for Flask context
            else:
                app.logger.error("Data import failed.") # Use app.logger for Flask context'''

        """
        Récupère tous les étudiants avec leurs groupes, années associées,
        et tous les repositories relatifs à l'étudiant (directs et indirects via groupes).
        """
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            # Étape 1: Récupérer infos étudiants, groupes et années
            query = """
            SELECT
                s.id AS student_id,
                s.surname AS student_surname,
                s.name AS student_name,
                s.no_etudiant AS student_no_etudiant,
                s.class AS student_class,
                g.id AS group_id,
                g.name AS group_name,
                g.year AS group_year,
                ys.id_annee AS assigned_year
            FROM
                `students` s
            LEFT JOIN
                `groups_students` gs ON s.id = gs.id_student
            LEFT JOIN
                `groups` g ON gs.id_group = g.id
            LEFT JOIN
                `years_students` ys ON s.id = ys.id_student
            """
            params = ()

            if st_id:
                query += " WHERE s.id = %s"
                params = (st_id,)
            query += " ORDER BY s.surname, s.name, s.class, g.name, g.year, ys.id_annee;"

            cursor.execute(query, params)
            students_data = {}
            for row in cursor.fetchall():
                student_id = row['student_id']
                if student_id not in students_data:
                    students_data[student_id] = {
                        "id": row['student_id'],
                        "surname": row['student_surname'],
                        "name": row['student_name'],
                        "no_etudiant": row['student_no_etudiant'],
                        "class": row['student_class'],
                        "git_usernames": [], # Initialize an empty list for git usernames
                        "groups": [],
                        "years_assigned": [],
                        "repositories_projet": [],
                        "repositories_td": []
                    }

                # Add group if not already present
                if row['group_id'] is not None:
                    group_info = {
                        "id": row['group_id'],
                        "name": row['group_name'],
                        "year": row['group_year']
                    }
                    if group_info not in students_data[student_id]["groups"]:
                        students_data[student_id]["groups"].append(group_info)

                # Add year if not already present
                if row['assigned_year'] is not None:
                    if row['assigned_year'] not in students_data[student_id]["years_assigned"]:
                        students_data[student_id]["years_assigned"].append(row['assigned_year'])

            # ===============================
            # Étape 2: Récupérer les comptes Git pour chaque étudiant
            # ===============================
            for student_id, student in students_data.items():
                cursor.execute("""
                    SELECT git_username
                    FROM student_git_accounts
                    WHERE id_student = %s
                """, (student_id,))
                git_accounts = cursor.fetchall()
                student['git_usernames'] = [account['git_username'] for account in git_accounts]

            # ===============================
            # Étape 3: Récupérer les repositories pour chaque étudiant
            # ===============================
            for student_id, student in students_data.items(): # Loop again for repositories
                # Repositories linked directly to the student (category 'TD')
                cursor.execute("""
                    SELECT r.id, r.name, r.category, r.owner, r.repo_url
                    FROM repositories_students rs
                    INNER JOIN repositories r ON rs.id_repo = r.id
                    WHERE rs.id_student = %s
                    AND r.category = 'TD'
                """, (student_id,))
                repos_directs = cursor.fetchall()
                student['repositories_td'] = repos_directs # Directly assign list of dicts

                # Repositories linked to the student's groups (category 'projet')
                group_ids = [g['id'] for g in student['groups']]
                if group_ids:
                    format_strings = ','.join(['%s'] * len(group_ids))
                    cursor.execute(f"""
                        SELECT DISTINCT r.id, r.name, r.category, r.owner, r.repo_url, rg.id_group
                        FROM repositories_groups rg
                        INNER JOIN repositories r ON rg.id_repo = r.id
                        WHERE rg.id_group IN ({format_strings})
                        AND r.category = 'projet'
                    """, tuple(group_ids))
                    repos_groupes = cursor.fetchall()
                    student['repositories_projet'] = repos_groupes # Directly assign list of dicts

            if st_id:
                if students_data:
                    return list(students_data.values())[0], 200
                else:
                    return {"message": "Étudiant non trouvé"}, 404
            else:
                return list(students_data.values()), 200
        except Exception as e:
            app.logger.error(f"Error fetching student data: {e}", exc_info=True) # Log full traceback
            return {"error": str(e)}, 500
        finally:
            if conn:
                conn.close()