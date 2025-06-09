import os
import json
import time # Import the time module for sleeping
from pathlib import Path
from typing import Dict, List, Any
import mysql.connector
from flask import current_app as app
from .database import get_db_connection

class JSONToDB:

    @staticmethod
    def get_json_path(filename: str) -> str:
        """Returns the full path to a JSON file in the 'data/' directory."""
        base_dir = Path(app.root_path).parent
        app.logger.debug(f"Import --- ", base_dir / 'data' / filename)
        return str(base_dir / 'data' / filename)

    @staticmethod
    def import_json_data():
        """Main function to import JSON data into the database."""
        conn = None
        cursor = None
        
        # Max retries and delay for database connection
        max_retries = 20
        retry_delay_seconds = 5

        try:
            # 1. Load data from JSON files
            students_data = JSONToDB._load_json('students.json')
            groups_data = JSONToDB._load_json('groups.json')
            repositories_data = JSONToDB._load_json('repositories.json')
            deadlines_data = JSONToDB._load_json('deadlines.json')

            # 2. Connect to the database with retries
            for i in range(max_retries):
                app.logger.info(f"Tentative de connexion à la base de données MySQL... (Tentative {i+1}/{max_retries})")
                conn = get_db_connection(instanciation=True)
                if conn:
                    break
                else:
                    # This warning remains useful as it indicates the retry mechanism is active
                    app.logger.warning(f"Database connection failed. Retrying in {retry_delay_seconds} seconds...")
                    time.sleep(retry_delay_seconds)
            
            if not conn:
                app.logger.error(f"Failed to connect to the database after {max_retries} attempts. Aborting data import.")
                return False
            
            app.logger.info("Connexion à la base de données MySQL réussie.")
            cursor = conn.cursor(dictionary=True)

            # 3. Import data in a logical order
            # Import years first as they are a dependency for students and groups
            JSONToDB._import_years(cursor, students_data, groups_data)
            
            # Import students and capture their generated IDs, mapped by no_etudiant
            student_no_to_db_id = JSONToDB._import_students(cursor, students_data)
            
            # Import groups and capture their generated IDs
            group_name_year_to_db_id = JSONToDB._import_groups(cursor, groups_data, student_no_to_db_id)
            
            # Import repositories, linking them to students/groups
            # Pass student_no_to_db_id directly to avoid reloading students.json in _import_groups
            JSONToDB._import_repositories(cursor, repositories_data, student_no_to_db_id, group_name_year_to_db_id)

            # Import configurable deadlines
            JSONToDB._import_deadlines(cursor, deadlines_data)
            
            conn.commit()
            app.logger.info("JSON to DB import successful.")
            return True
            
        except Exception as e:
            app.logger.error(f"Error during JSON import: {str(e)}", exc_info=True)
            if conn:
                conn.rollback()
            return False
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
    ## Internal Helper Methods

    @staticmethod
    def _load_json(filename: str) -> Any:
        """Loads a JSON file from the 'data/' folder."""
        #path = f"data/{filename}"
        path = JSONToDB.get_json_path(filename) 
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except FileNotFoundError:
            app.logger.error(f"JSON file not found: {path}, root : {app.root_path}")
            return []
        except json.JSONDecodeError as e:
            app.logger.error(f"Error decoding JSON from {filename}: {e}")
            return []
        except Exception as e:
            app.logger.error(f"Error reading {filename}: {str(e)}")
            return []

    @staticmethod
    def _import_students(cursor, data: List[Dict]) -> Dict[str, int]:
        """Imports students and their Git accounts from students.json.
        Returns a dictionary mapping student's 'no_etudiant' to their database 'id'.
        """
        student_no_to_db_id = {}
        for student in data:
            surname = student.get('surname', '')
            name = student.get('name', '')
            no_etudiant = student.get('no_etudiant', 'TBD')
            s_class = student.get('class', 'MIAGE-FI')

            # Check if student already exists by no_etudiant
            cursor.execute("SELECT id FROM students WHERE no_etudiant = %s", (no_etudiant,))
            existing_student = cursor.fetchone()

            if existing_student:
                db_id = existing_student['id']
                app.logger.debug(f"Student {name} {surname} (No: {no_etudiant}) already exists. Using existing DB ID: {db_id}")
            else:
                cursor.execute(
                    """INSERT INTO students (surname, name, no_etudiant, class) 
                    VALUES (%s, %s, %s, %s)""",
                    (surname, name, no_etudiant, s_class)
                )
                db_id = cursor.lastrowid # Get the auto-generated database ID
                app.logger.debug(f"Imported student {name} {surname} (No: {no_etudiant}, DB ID: {db_id})")
            
            # Map the no_etudiant to the database ID
            student_no_to_db_id[no_etudiant] = db_id
            
            # Import Git accounts
            if 'git_usernames' in student and db_id:
                for username in student['git_usernames']:
                    cursor.execute(
                        "INSERT IGNORE INTO student_git_accounts (id_student, git_username) VALUES (%s, %s)",
                        (db_id, username)
                    )
            
            # Link student to years (from students.json)
            if 'years' in student and db_id:
                for year_val in student['years']:
                    cursor.execute(
                        "INSERT IGNORE INTO years_students (id_annee, id_student) VALUES (%s, %s)",
                        (year_val, db_id)
                    )
        app.logger.debug(f"Student ID : {student_no_to_db_id}") # Corrected debug print for dictionary
        return student_no_to_db_id

    @staticmethod
    def _import_years(cursor, students_data: List[Dict], groups_data: List[Dict]):
        """Imports academic years from both students and groups data."""
        years_to_insert = set()
        
        # Years from students.json
        for student in students_data:
            if 'years' in student:
                years_to_insert.update(student['years'])
        
        # Years from groups.json
        for group in groups_data:
            if 'year' in group:
                years_to_insert.add(group['year'])
        
        for year in sorted(list(years_to_insert)):
            cursor.execute("INSERT IGNORE INTO years (id) VALUES (%s)", (year,))
            app.logger.debug(f"Ensured year {year} exists in DB.")
            

    @staticmethod
    def _import_groups(cursor, data: List[Dict], student_no_to_db_id: Dict[str, int]) -> Dict[tuple, int]:
        """Imports groups and their members.
        Returns a dictionary mapping (group_name, group_year) tuple to their database 'id'.
        """
        group_name_year_to_db_id = {}
        
        for group in data:
            group_name = group.get('name', '')
            group_year = group.get('year', 2025)
            group_key = (group_name, group_year)

            # Check if group already exists
            cursor.execute("SELECT id FROM `groups` WHERE name = %s AND year = %s", (group_name, group_year))
            existing_group = cursor.fetchone()

            if existing_group:
                db_id = existing_group['id']
                app.logger.debug(f"Group '{group_name}' ({group_year}) already exists. Using existing DB ID: {db_id}")
            else:
                cursor.execute(
                    "INSERT INTO `groups` (name, year) VALUES (%s, %s)",
                    (group_name, group_year)
                )
                db_id = cursor.lastrowid # Get the auto-generated database ID
                app.logger.debug(f"Imported group '{group_name}' ({group_year}) (DB ID: {db_id})")
            
            group_name_year_to_db_id[group_key] = db_id
            
            # Add members to the group
            for member in group.get('members', []):
                # We need to find the student's no_etudiant from the JSON.
                # Use the student_no_to_db_id map for efficient lookup
                member_nom = member.get('nom', '')
                member_prenom = member.get('prenom', '')

                # Find the student's no_etudiant by matching name and surname
                # This assumes unique (name, surname) for mapping.
                # A more robust solution might store no_etudiant directly in group members.
                student_found_no_etudiant = None
                for no_etudiant, s_db_id in student_no_to_db_id.items():
                    # Fetch student details to get name/surname for comparison
                    cursor.execute("SELECT name, surname FROM students WHERE id = %s", (s_db_id,))
                    student_data = cursor.fetchone()
                    if student_data and student_data['surname'] == member_nom and student_data['name'] == member_prenom:
                        student_found_no_etudiant = no_etudiant
                        break
                
                if student_found_no_etudiant and student_found_no_etudiant in student_no_to_db_id:
                    student_db_id = student_no_to_db_id[student_found_no_etudiant]
                    cursor.execute(
                        "INSERT IGNORE INTO groups_students (id_group, id_student) VALUES (%s, %s)",
                        (db_id, student_db_id)
                    )
                    app.logger.debug(f"Linked student {member_prenom} {member_nom} to group '{group_name}' ({group_year})")
                else:
                    app.logger.warning(f"Student '{member_prenom} {member_nom}' not found in students_data or no_etudiant missing for group '{group_name}'. Skipping.")
        
        app.logger.debug(f"Groups ID : {group_name_year_to_db_id}") # Corrected debug print for dictionary
        return group_name_year_to_db_id

    @staticmethod
    def _import_repositories(cursor, data: List[Dict], student_no_to_db_id: Dict[str, int], group_name_year_to_db_id: Dict[tuple, int]):
        """Imports repositories and their relationships, prioritizing explicit links from JSON."""
        
        # Pre-fetch all student Git accounts and map them to their DB IDs for efficient lookup
        git_username_to_student_db_id = {}
        cursor.execute("SELECT sga.git_username, s.id FROM student_git_accounts sga JOIN students s ON sga.id_student = s.id")
        for row in cursor.fetchall():
            git_username_to_student_db_id[row['git_username'].lower()] = row['id']

        for repo in data:
            name = repo.get('name', '')
            owner = repo.get('owner', '')
            repo_url = repo.get('repo_url', '')

            # Check if repository already exists by name
            cursor.execute("SELECT id FROM repositories WHERE name = %s", (name,))
            existing_repo = cursor.fetchone()

            if existing_repo:
                db_id = existing_repo['id']
                app.logger.debug(f"Repository '{name}' already exists. Using existing DB ID: {db_id}")
            else:
                cursor.execute(
                    """INSERT INTO repositories (name, owner, repo_url) 
                    VALUES (%s, %s, %s)""", # Category is set by triggers
                    (name, owner, repo_url)
                )
                db_id = cursor.lastrowid # Get the auto-generated database ID
                app.logger.debug(f"Imported repository '{name}' (DB ID: {db_id})")

            # --- NEW LOGIC: Prioritize explicit links from JSON ---
            is_linked = False

            # 1. Try linking to a student using 'linked_student' field
            linked_student_data = repo.get('linked_student')
            if linked_student_data:
                student_name = linked_student_data.get('name', '')
                student_surname = linked_student_data.get('surname', '')
                
                # Find the student's DB ID based on name and surname
                # This assumes (name, surname) is unique enough for lookup
                student_db_id = None
                for no_etudiant, s_id in student_no_to_db_id.items():
                    # We need to fetch the student's name and surname from the DB based on s_id
                    cursor.execute("SELECT name, surname FROM students WHERE id = %s", (s_id,))
                    db_student_data = cursor.fetchone()
                    if db_student_data and db_student_data['name'] == student_name and db_student_data['surname'] == student_surname:
                        student_db_id = s_id
                        break

                if student_db_id:
                    cursor.execute(
                        "INSERT IGNORE INTO repositories_students (id_repo, id_student) VALUES (%s, %s)",
                        (db_id, student_db_id)
                    )
                    is_linked = True
                    app.logger.debug(f"Linked repo '{name}' to student '{student_name} {student_surname}' via explicit JSON.")
                else:
                    app.logger.warning(f"Explicitly linked student '{student_name} {student_surname}' for repo '{name}' not found in DB. Skipping explicit student link.")

            # 2. Try linking to a group using 'linked_group' field (if not already linked to a student)
            if not is_linked:
                linked_group_data = repo.get('linked_group')
                if linked_group_data:
                    group_name = linked_group_data.get('name', '')
                    group_year = linked_group_data.get('year', 0) # Use 0 or appropriate default if year can be missing
                    group_key = (group_name, group_year)
                    
                    group_db_id = group_name_year_to_db_id.get(group_key)

                    if group_db_id:
                        cursor.execute(
                            "INSERT IGNORE INTO repositories_groups (id_repo, id_group) VALUES (%s, %s)",
                            (db_id, group_db_id)
                        )
                        is_linked = True
                        app.logger.debug(f"Linked repo '{name}' to group '{group_name}' ({group_year}) via explicit JSON.")
                    else:
                        app.logger.warning(f"Explicitly linked group '{group_name}' ({group_year}) for repo '{name}' not found in DB. Skipping explicit group link.")

            # --- FALLBACK LOGIC (Existing inference, if no explicit link found) ---
            if not is_linked:
                # Fallback: Try linking to a student via owner (Git username)
                if owner and owner.lower() in git_username_to_student_db_id:
                    student_db_id = git_username_to_student_db_id[owner.lower()]
                    cursor.execute(
                        "INSERT IGNORE INTO repositories_students (id_repo, id_student) VALUES (%s, %s)",
                        (db_id, student_db_id)
                    )
                    is_linked = True
                    app.logger.debug(f"Linked repo '{name}' to student via owner '{owner}' (fallback)")

            if not is_linked:
                # Fallback: Try to infer group link from repo name
                for (group_name, group_year), group_db_id in group_name_year_to_db_id.items():
                    # More robust matching: check for "grX" or explicit group name
                    if f"gr{group_name}".lower() in name.lower() or group_name.lower() in name.lower():
                        cursor.execute(
                            "INSERT IGNORE INTO repositories_groups (id_repo, id_group) VALUES (%s, %s)",
                            (db_id, group_db_id)
                        )
                        is_linked = True
                        app.logger.debug(f"Linked repo '{name}' to group '{group_name}' ({group_year}) via name inference (fallback)")
                        break # Link to the first matching group found

            if not is_linked:
                # Fallback: If still not linked, try linking to a student by matching git usernames in repo name
                for git_user, student_db_id in git_username_to_student_db_id.items():
                    if git_user.lower() in name.lower():
                        cursor.execute(
                            "INSERT IGNORE INTO repositories_students (id_repo, id_student) VALUES (%s, %s)",
                            (db_id, student_db_id)
                        )
                        is_linked = True
                        app.logger.debug(f"Linked repo '{name}' to student via name match '{git_user}' (fallback)")
                        break

            if not is_linked:
                app.logger.warning(f"Repository '{name}' not linked to any student or group (no explicit or inferred link found).")

        app.logger.info(f"Import completed for {len(data)} repositories.")

    @staticmethod
    def _import_deadlines(cursor, data: Dict[str, List[Dict]]):
        """Imports configurable deadlines."""
        for deadline_type, deadlines_list in data.items():
            # Convert JSON key names to match ENUM in DB
            if deadline_type == 'IM_deadlines':
                db_type = 'IM'
            elif deadline_type == 'MIAGE_deadlines':
                db_type = 'MIAGE'
            elif deadline_type == 'project_deadlines':
                db_type = 'PROJECT'
            else:
                app.logger.warning(f"Unknown deadline type: {deadline_type}. Skipping.")
                continue

            for dl in deadlines_list:
                event_date = dl.get('event_date')
                event_time = dl.get('event_time')
                description = dl.get('description', '')

                if event_date and event_time:
                    cursor.execute(
                        """INSERT IGNORE INTO configurable_deadlines (type, event_date, event_time, description)
                        VALUES (%s, %s, %s, %s)""",
                        (db_type, event_date, event_time, description)
                    )
                    app.logger.debug(f"Imported deadline for {db_type}: {description}")
                else:
                    app.logger.warning(f"Skipping malformed deadline: {dl}")

        app.logger.info("Configurable deadlines import complete.")