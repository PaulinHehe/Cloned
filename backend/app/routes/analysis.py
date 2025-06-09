# PROJET-GIT/backend/app/routes/analysis.py

from flask_restful import Resource, reqparse
from flask import current_app as app # Keep current_app for logging, remove jsonify if it's still there
import requests
from app.utils.node_analyzer_client import analyze_repo_with_node_service
import json

# Assuming these are your existing local modules/functions for other tools
from ..modules.repo_analyzer import analyze_repo
from ..modules.git_statistic import git_statistics
from ..modules.gitstats import gitstats_analysis
from ..modules.code_archeologist import code_archeologist_analysis
from ..utils.dir_manager import DirManager
from ..modules.notes_td import process_post_analysis_request




class AnalysisAPI(Resource):
    """API pour lancer les analyses de projet."""

    def post(self):
        """Lance une analyse sur un dépôt Git."""
        parser = reqparse.RequestParser()
        parser.add_argument("repo_url", type=str, required=True, help="URL du dépôt Git requise")
        parser.add_argument("tool", type=str, required=True, help="Outil d'analyse requis")
        parser.add_argument("id_repo", type=int, required=True, help="ID du dépôt pour l'analyse de repo_analyzer")
        #parser.add_argument("output_dir", type=str, default="/tmp/gitstats")
        #parser.add_argument("history", type=bool, default=False, help="Effectuer l'analyse historique pour repo_analyzer")
        #parser.add_argument("factor", type=int, help="Facteur d'échantillonnage pour l'historique de repo_analyzer")
        
        
        args = parser.parse_args()

        repo_url = args["repo_url"]
        tool = args["tool"]
        id_repo = args["id_repo"]
        '''output_dir = args["output_dir"]
        id_repo = args["id_repo"]
        history = args["history"]
        factor = args["factor"]'''
        
        result = None
        error_message = None
        status_code = 200

        clone_path = DirManager.clone_update_repo(repo_url)
        #app.logger.debug(f"Clone path: {clone_path}")

        try:           
            '''if tool == "git_statistic":
                result = git_statistics(repo_url)
            elif tool == "gitstats":
                result = gitstats_analysis(repo_url, output_dir)
            if tool == "general_stats":
                return''' 
            if tool == "code_archeologist":
                result = code_archeologist_analysis(repo_url, id_repo)              
            
            else:
                error_message = "Outil d'analyse non supporté."
                status_code = 400

            '''elif tool == "repo_analyzer":
                app.logger.info(f"Delegating repo_analyzer request for {repo_url} to Node.js service.")
                result = analyze_repo_with_node_service(
                    repo_url=repo_url,
                    history=history,
                    factor=factor
                )'''
            app.logger.info(f"Analysis result: {result['data']['id']}")
            result2 = process_post_analysis_request(result['data']['id'], clone_path)
            #app.logger.debug(f"Post-processed results: {result2}")
            

        except requests.exceptions.HTTPError as e:
            # This block handles HTTP errors originating from the Node.js service.
            status_code = e.response.status_code if e.response else 500
            
            # Extract error details from the Node.js service's response if available and JSON
            '''try:
                error_details = e.response.json() if e.response else {}
                node_error_message = error_details.get('error', str(e))
                node_details = error_details.get('details', '')
                node_stderr = error_details.get('stderr', '')

                error_message = f"Analysis service returned an error ({status_code}): {node_error_message}"
                if node_details:
                    error_message += f" Details: {node_details}"
                if node_stderr:
                    error_message += f" Stderr: {node_stderr}"
            except (json.JSONDecodeError, AttributeError):
                # If response is not JSON or e.response is None
                error_message = f"Erreur de communication avec le service d'analyse Node.js (HTTP {status_code}): {e}"
            
            current_app.logger.error(f"Failed to analyze repo with Node.js service: {error_message}", exc_info=True)
            # Return the error dictionary directly. Flask-RESTful will serialize it.
            return {"error": error_message}, status_code

        except (ConnectionError, TimeoutError) as e:
            # Handle network/connection specific errors (e.g., Node.js service not running)
            status_code = 503 # Service Unavailable
            error_message = f"Impossible de se connecter au service d'analyse Node.js: {e}"
            current_app.logger.error(f"Connection error to Node.js service: {error_message}", exc_info=True)
            return {"error": error_message}, status_code'''

        except Exception as e:
            # Catch any other unexpected errors
            error_message = f"Une erreur interne inattendue est survenue: {e}"
            status_code = 500
            app.logger.error(f"Unexpected error during analysis: {e}", exc_info=True)
            return {"error": error_message}, status_code

        # Final return for successful analysis or non-Node.js tool
        if error_message:
            return {"error": error_message}, status_code
        else:
            return {"result": result}, status_code