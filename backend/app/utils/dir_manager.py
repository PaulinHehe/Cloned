import os
import subprocess
from urllib.parse import urlparse
from pathlib import Path
from git import Repo, GitCommandError, InvalidGitRepositoryError  # nécessite 'pip install gitpython'

import logging
from flask import current_app as app
import shutil
from flask_restful import Resource, reqparse


class DirManager(Resource):
    @staticmethod
    def name_from_url(repo_url):
        """Extrait le nom du repo depuis l'URL Git (gère .git proprement et nettoie un '-' initial)"""
        path = urlparse(repo_url).path
        repo = os.path.basename(path)
        if repo.endswith(".git"):
            repo = repo[:-4]
        #app.logger.debug(f"Nom du dépôt extrait : {repo}")
        return repo

    @staticmethod
    def is_valid_git_repo(path):
        try:
            _ = Repo(path)
            return True
        except InvalidGitRepositoryError:
            return False
        except Exception:
            return False

    @staticmethod
    def ensure_full_clone(repo_path):
        try:
            repo = Repo(repo_path)
            git = repo.git
            is_shallow = (git.rev_parse('--is-shallow-repository') == 'true')
            if is_shallow:
                app.logger.debug("Shallow repository detected, fetching full history...")
                git.fetch('--unshallow')
                app.logger.debug("Full history fetched.")

            # Fetch all branches
            git.fetch('--all')
            for remote_branch in repo.remotes.origin.refs:
                branch_name = remote_branch.remote_head
                if branch_name == 'HEAD':
                    continue
                if branch_name not in repo.heads:
                    try:
                        git.checkout('-b', branch_name, f'origin/{branch_name}')
                    except Exception as e:
                        app.logger.warning(f"Impossible de créer la branche locale '{branch_name}': {e}")

        except GitCommandError as e:
            raise Exception(f"Erreur Git : {e}")
        except Exception as e:
            raise Exception(f"Erreur inattendue : {e}")

    @staticmethod
    def clone_update_repo(repo_url, base_dir="/app/clones"):
        repo_name = DirManager.name_from_url(repo_url)
        clone_path = Path(base_dir) / repo_name
        clone_path.parent.mkdir(parents=True, exist_ok=True)

        # Authentification
        token = os.environ.get("GITHUB_TOKEN")
        if not token:
            raise EnvironmentError("GITHUB_TOKEN manquant dans les variables d'environnement")
        
        repo_url_with_token = repo_url.replace(
            "https://github.com/",
            f"https://{token}@github.com/"
        ) if repo_url.startswith("https://github.com/") else repo_url

        clone_path_str = str(clone_path)
        
        try:
            if clone_path.exists() and DirManager.is_valid_git_repo(clone_path_str):
                # 1. Vérifier et corriger l'état du dépôt
                try:
                    # Obtenir la branche actuelle
                    current_branch = subprocess.check_output(
                        ["git", "-C", clone_path_str, "rev-parse", "--abbrev-ref", "HEAD"],
                        stderr=subprocess.PIPE,
                        universal_newlines=True
                    ).strip()
                    
                    # Si en detached HEAD, on se remet sur la branche par défaut
                    if current_branch == "HEAD":
                        # Trouver la branche par défaut
                        default_branch = subprocess.check_output(
                            ["git", "-C", clone_path_str, "symbolic-ref", "refs/remotes/origin/HEAD"],
                            stderr=subprocess.PIPE,
                            universal_newlines=True
                        ).strip().split("/")[-1]
                        
                        # Checkout de la branche par défaut
                        subprocess.check_call(
                            ["git", "-C", clone_path_str, "checkout", default_branch],
                            stderr=subprocess.PIPE
                        )
                        current_branch = default_branch
                    
                    # 2. Mise à jour propre
                    subprocess.check_call(
                        ["git", "-C", clone_path_str, "pull", "origin", current_branch],
                        stderr=subprocess.PIPE
                    )
                    
                except subprocess.CalledProcessError as e:
                    # Fallback: reclone si le dépôt est corrompu
                    app.logger.warning(f"Réinitialisation du dépôt ({e.stderr})")
                    shutil.rmtree(clone_path)
                    subprocess.check_call(
                        ["git", "clone", "--no-single-branch", repo_url_with_token, clone_path_str],
                        stderr=subprocess.PIPE
                    )
            else:
                # Clone initial
                if clone_path.exists():
                    shutil.rmtree(clone_path)
                subprocess.check_call(
                    ["git", "clone", "--no-single-branch", repo_url_with_token, clone_path_str],
                    stderr=subprocess.PIPE
                )
            
            # Post-traitement garantissant qu'on est sur la bonne branche
            default_branch = subprocess.check_output(
                ["git", "-C", clone_path_str, "symbolic-ref", "refs/remotes/origin/HEAD"],
                stderr=subprocess.PIPE,
                universal_newlines=True
            ).strip().split("/")[-1]
            
            subprocess.check_call(
                ["git", "-C", clone_path_str, "checkout", default_branch],
                stderr=subprocess.PIPE
            )
            
            # Mise à jour complète du dépôt
            subprocess.check_call(
                ["git", "-C", clone_path_str, "pull", "--all"],
                stderr=subprocess.PIPE
            )
            
            return clone_path_str
            
        except subprocess.CalledProcessError as e:
            error_msg = f"Erreur Git: {e.stderr.strip() if e.stderr else str(e)}"
            app.logger.error(error_msg)
            raise Exception(f"Échec de la gestion du dépôt: {error_msg}")

    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument('repo_url', required=True, help="Le paramètre 'repo_url' est obligatoire.")
        args = parser.parse_args()

        repo_url = args['repo_url']

        try:
            path = self.clone_update_repo(repo_url)
            return {"clone_path": path, "message": "Clone ou mise à jour réussie."}, 200
        except Exception as e:
            return {"error": str(e)}, 500
