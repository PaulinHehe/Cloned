from flask_restful import Resource
from typing import Optional, Dict, Any
from flask import current_app as app
from urllib.parse import urlparse
from datetime import datetime, timedelta 
from pydriller import Repository
from ..utils.dir_manager import DirManager
from ..utils.database import get_db_connection

class StatsAPI(Resource):
    def post(self):
        # The request body will contain the data needed for analysis
        # For simplicity, let's assume it might contain student_id or class_name
        # based on what the frontend sends.
        # For now, we'll assume it's a request to analyze a class.
        class_name_to_analyze = None # You might get this from the request body
        results_class = self.analyze_class(class_name_to_analyze)

        status_code = 200
        return {"status": "success", "resultsClass": results_class}, status_code


    def analyze_student(
        self,
        student_id: int,
        student_name: str,
        student_surname: str,
        repo_url: str,
        token: Optional[str],
        deadlines_student: Dict[str, str],
        weights: Optional[Dict[str, float]]
    ) -> Dict[str, Any]:
        
        repo_path = DirManager.clone_update_repo(repo_url)

        # 2) Initialisation des compteurs
        TDs: Dict[str, Dict[str, Any]] = {}
        total_commits = 0
        total_additions = 0
        total_deletions = 0
        total_files = 0
        global_score = 0.0

        # 3) Pondérations par défaut si non fournies
        if weights is None:
            w_c = 1.0  # poids sur nombre de commits
            w_l = 0.5  # poids sur lignes (additions + deletions)
            w_f = 0.2  # poids sur fichiers touchés
        else:
            w_c = weights.get("commits", 1.0)
            w_l = weights.get("ligne", 0.5)
            w_f = weights.get("fichier", 0.2)

        # 4) Itérer sur tous les commits avec PyDriller
        try:
            for commit in Repository(repo_path).traverse_commits():
                dt = commit.author_date
                # Ne retenir que les samedis (weekday()==5)
                if dt.weekday() != 5:
                    continue

                week_date = dt.strftime("%Y-%m-%d")
                if week_date not in TDs:
                    TDs[week_date] = {
                        "commit_date": dt.strftime("%Y-%m-%d %H:%M"),
                        "commits": 0,
                        "additions": 0,
                        "deletions": 0,
                        "files": 0,
                        "score": 0.0,
                        "percentage": 0.0,
                        "on_time": True
                    }

                # Incrémenter le nombre de commits
                TDs[week_date]["commits"] += 1

                # Parcourir les modifications de fichiers
                additions = 0
                deletions = 0
                touched_files = 0
                for mod in commit.modified_files:
                    a = getattr(mod, "added_lines", 0)
                    d = getattr(mod, "deleted_lines", 0)
                    additions += a
                    deletions += d
                    touched_files += 1

                TDs[week_date]["additions"] += additions
                TDs[week_date]["deletions"] += deletions
                TDs[week_date]["files"] += touched_files

                # 5) Vérifier la deadline pour ce samedi
                #    deadlines_student : { "YYYY-MM-DD": "HH:MM", … } ou {"global": "HH:MM"}
                if week_date in deadlines_student:
                    limit_str = f"{week_date} {deadlines_student[week_date]}"
                    try:
                        dt_limit = datetime.strptime(limit_str, "%Y-%m-%d %H:%M")
                        if dt > dt_limit:
                            TDs[week_date]["on_time"] = False
                    except Exception:
                        pass
                elif "global" in deadlines_student:
                    limit_str = f"{week_date} {deadlines_student['global']}"
                    try:
                        dt_limit = datetime.strptime(limit_str, "%Y-%m-%d %H:%M")
                        if dt > dt_limit:
                            TDs[week_date]["on_time"] = False
                    except Exception:
                        pass

                # 6) Calcul du score pour ce TD
                score_TD = (
                    TDs[week_date]["commits"] * w_c
                    + (TDs[week_date]["additions"] + TDs[week_date]["deletions"]) * w_l
                    + TDs[week_date]["files"] * w_f
                )
                TDs[week_date]["score"] = round(score_TD, 2)

                # Maj totaux
                total_commits += TDs[week_date]["commits"]
                total_additions += TDs[week_date]["additions"]
                total_deletions += TDs[week_date]["deletions"]
                total_files += TDs[week_date]["files"]
                global_score += score_TD

            # 7) Calculer les pourcentages par TD (par rapport au total de lignes modifiées)
            total_lines = total_additions + total_deletions
            if total_lines > 0:
                for info in TDs.values():
                    lines_td = info["additions"] + info["deletions"]
                    info["percentage"] = round(100.0 * lines_td / total_lines, 2)
            else:
                for info in TDs.values():
                    info["percentage"] = 0.0

        except Exception as e:
            return {"error": f"Erreur pendant l’analyse des TDs de {student_name} {student_surname}: {e}"}

            # 8) Récupérer quelques indicateurs GitHub (branches, PR, issues, reviews, CI/CD)
        nb_branches = nb_pr_total = nb_pr_open = nb_pr_closed = nb_pr_merged = 0
        nb_reviews = 0
        nb_ci_total = nb_ci_success = nb_ci_failure = 0

        try:
            from requests import get as _get
            parsed = urlparse(repo_url)
            owner, repo = parsed.path.strip("/").replace(".git", "").split("/", 1)
            headers = {"Accept": "application/vnd.github.v3+json"}
            if token:
                headers["Authorization"] = f"token {token}"

            # -- Branches
            bres = _get(f"https://api.github.com/repos/{owner}/{repo}/branches", headers=headers)
            if bres.ok:
                nb_branches = len(bres.json())

            # -- Pull‐requests (toutes)
            prs = []
            page = 1
            while True:
                r = _get(
                    f"https://api.github.com/repos/{owner}/{repo}/pulls?state=all&per_page=100&page={page}",
                    headers=headers
                )
                if not r.ok:
                    break
                batch = r.json()
                if not batch:
                    break
                prs.extend(batch)
                page += 1
            nb_pr_total = len(prs)
            nb_pr_open = sum(1 for pr in prs if pr.get("state") == "open")
            nb_pr_closed = sum(1 for pr in prs if pr.get("state") == "closed")
            nb_pr_merged = sum(1 for pr in prs if pr.get("merged_at") is not None)

            # -- Code reviews
            for pr in prs:
                num = pr.get("number")
                rr = _get(f"https://api.github.com/repos/{owner}/{repo}/pulls/{num}/reviews", headers=headers)
                if rr.ok:
                    nb_reviews += len(rr.json())

            # -- CI/CD via GitHub Actions
            runs = []
            page = 1
            while True:
                cr = _get(
                    f"https://api.github.com/repos/{owner}/{repo}/actions/runs?per_page=100&page={page}",
                    headers=headers
                )
                if not cr.ok:
                    break
                data = cr.json().get("workflow_runs", [])
                if not data:
                    break
                runs.extend(data)
                page += 1
            nb_ci_total = len(runs)
            nb_ci_success = sum(1 for run in runs if run.get("conclusion") == "success")
            nb_ci_failure = sum(1 for run in runs if run.get("conclusion") not in (None, "success"))

        except Exception as e:
            # en cas d’erreur, on laisse tout à 0
            print(f"❌ Erreur GitHub API pour {owner}/{repo} : {e}")

        # 9) Nettoyage du clone (Ne pas nettoyer le clone car cela
        # permet de ne pas le retélécharger à chaque fois)
        # '''try:
        #         Utils.fermer_processus_git(repo_path)
        #         shutil.rmtree(repo_path, onerror=Utils.on_rm_error)
        # except Exception as e:
        #         print(f"❌ Erreur nettoyage pour {student_name} : {e}")'''


        # 10) Retour avec les nouveaux champs
        return {
            "student_id": student_id,
            "student_name": student_name,
            "student_surname": student_surname,
            "TDs": TDs,
            "total_commits": total_commits,
            "total_additions": total_additions,
            "total_deletions": total_deletions,
            "total_files": total_files,
            "global_score": round(global_score, 2),
            "nb_branches": nb_branches,
            "nb_pr_total": nb_pr_total,
            "nb_pr_open": nb_pr_open,
            "nb_pr_closed": nb_pr_closed,
            "nb_pr_merged": nb_pr_merged,
            "nb_reviews": nb_reviews,
            "nb_ci_total": nb_ci_total,
            "nb_ci_success": nb_ci_success,
            "nb_ci_failure": nb_ci_failure
        }


    def analyze_class(self, class_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Iterates over all students, fetches their TD repositories and deadlines
        from the database, calls analyze_student, and returns the results.
        Project repositories (assigned to groups) are no longer processed.
        """
        conn = None
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)

            # Étape 1: Récupérer les étudiants et leurs repos TD
            query_students = """
            SELECT
                s.id AS student_id,
                s.surname AS student_surname,
                s.name AS student_name,
                s.class AS student_class,
                r.repo_url,
                sga.git_username AS token # Assuming git_username can be used as a token, or fetch actual tokens if available
            FROM
                students s
            JOIN
                repositories_students rs ON s.id = rs.id_student
            JOIN
                repositories r ON rs.id_repo = r.id
            LEFT JOIN
                student_git_accounts sga ON s.id = sga.id_student
            WHERE
                r.category = 'TD'
            """
            params_students = ()
            if class_name:
                query_students += " AND s.class = %s"
                params_students = (class_name,)

            cursor.execute(query_students, params_students)
            students_repos = cursor.fetchall()

            # Étape 2: Récupérer les deadlines configurables
            query_deadlines = """
            SELECT
                type, event_date, event_time, description
            FROM
                configurable_deadlines
            """
            cursor.execute(query_deadlines)
            deadlines_data = cursor.fetchall()

            deadlines_map = {}
            for dl in deadlines_data:
                deadline_type = dl['type'].lower()
                event_date = dl['event_date'].strftime('%Y-%m-%d')
                
                # Handle timedelta for event_time
                event_time_obj = dl['event_time']
                if isinstance(event_time_obj, timedelta):
                    total_seconds = int(event_time_obj.total_seconds())
                    hours, remainder = divmod(total_seconds, 3600)
                    minutes, seconds = divmod(remainder, 60)
                    event_time = f"{hours:02d}:{minutes:02d}"
                else: # Assuming it's already a datetime.time object
                    event_time = event_time_obj.strftime('%H:%M')
                
                description = dl['description']

                if deadline_type not in deadlines_map:
                    deadlines_map[deadline_type] = []
                deadlines_map[deadline_type].append({
                    "event_date": event_date,
                    "event_time": event_time,
                    "description": description
                })


            results_total: Dict[str, Any] = {}
            weights = None # You might want to get weights from another source or make them configurable

            # Analyse des étudiants et de leurs TDs
            for student_repo_info in students_repos:
                student_id = student_repo_info['student_id']
                student_name = student_repo_info['student_name']
                student_surname = student_repo_info['student_surname']
                repo_url = student_repo_info['repo_url']
                token = student_repo_info['token'] # This assumes git_username can serve as a token, which is unlikely. You'll need a proper token management.
                student_class = student_repo_info['student_class']

                # Determine deadlines for the student based on their class
                student_deadlines = {}
                if 'IM' in student_class and 'im' in deadlines_map:
                    for dl_entry in deadlines_map['im']:
                        student_deadlines[dl_entry['event_date']] = dl_entry['event_time']
                elif 'MIAGE' in student_class and 'miage' in deadlines_map:
                    for dl_entry in deadlines_map['miage']:
                        student_deadlines[dl_entry['event_date']] = dl_entry['event_time']

                try:
                    print(f"▶️ Analyse du TD de {student_name} {student_surname} ({repo_url}) …")
                    res = self.analyze_student(
                        student_id,
                        student_name,
                        student_surname,
                        repo_url,
                        token,
                        student_deadlines,
                        weights
                    )
                    results_total[f"student_{student_id}"] = res
                except Exception as e:
                    results_total[f"student_{student_id}"] = {"error": f"Exception inattendue pour {student_name} {student_surname} : {e}"}

            # The section for 'Analyse des groupes et de leurs projets' has been removed.
            # This ensures only TD repositories are processed.

            if not results_total:
                error_message = f"No TD analysis results found for the specified criteria."
                status_code = 404
                app.logger.warning(error_message)
                return {"error": error_message}, status_code

            return results_total

        except Exception as e:
            error_message = f"Failed to retrieve data from database or during analysis: {e}"
            status_code = 500
            app.logger.error(error_message, exc_info=True)
            return {"error": error_message}, status_code
        finally:
            if conn:
                conn.close()

    # You might want to add a similar analyze_group method here
    # def analyze_group(self, group_id: int, group_name: str, repo_url: str, token: Optional[str], deadlines_group: Dict[str, str], weights: Optional[Dict[str, float]]) -> Dict[str, Any]:
    #     # This method would be similar to analyze_student but tailored for group project analysis
    #     pass