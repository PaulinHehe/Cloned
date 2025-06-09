# PROJET-GIT/backend/app/utils/node_analyzer_client.py

import requests
import os
import json
from flask import current_app

NODE_SERVICE_HOST = os.getenv("NODE_SERVICE_HOST", "node")
NODE_SERVICE_PORT = os.getenv("NODE_SERVICE_PORT", "2000")

NODE_SERVICE_BASE_URL = f"http://{NODE_SERVICE_HOST}:{NODE_SERVICE_PORT}"

def analyze_repo_with_node_service(repo_url, history=False, factor=None, elastic_username=None, elastic_password=None):
    node_service_url = 'http://node:2000/analyze'
    headers = {'Content-Type': 'application/json'}
    payload = {
        'repo_url': repo_url,
        'history': history,
        'factor': factor,
        'elastic_username': elastic_username,
        'elastic_password': elastic_password
    }

    try:
        current_app.logger.info(f"Delegating repo_analyzer request for {repo_url} to Node.js service.")
        response = requests.post(node_service_url, headers=headers, data=json.dumps(payload))
        response.raise_for_status()

        try:
            return response.json()
        except json.JSONDecodeError:
            current_app.logger.error(f"Node.js service response is not valid JSON: {response.text}")
            # Re-raise as a standard HTTPError if the response isn't JSON
            # Pass only the string message, not the response object
            raise requests.exceptions.HTTPError(
                f"Node.js service returned non-JSON response: {response.text}",
                response=response # Keep response here, as it's useful for debugging the original HTTP error.
                                  # The error in AnalysisAPI is due to how it tries to serialize THIS HTTPError.
                                  # We will handle this in AnalysisAPI's exception block.
            )

    except requests.exceptions.RequestException as e:
        error_message = f"Erreur de communication avec le service d'analyse Node.js: {e}"
        node_status_code = 500 # Default to 500 for Node.js internal errors
        node_stderr = "" # To capture specific stderr from Node.js

        if e.response is not None:
            node_status_code = e.response.status_code
            try:
                node_error_details = e.response.json()
                error_message = f"Analysis service returned an error ({node_status_code}): {node_error_details.get('error', 'Unknown error')}"
                if 'details' in node_error_details:
                    error_message += f" Details: {node_error_details['details']}"
                if 'stderr' in node_error_details:
                    node_stderr = node_error_details['stderr']
                    error_message += f" Stderr: {node_stderr}"
            except json.JSONDecodeError:
                error_message = f"Analysis service returned an error ({node_status_code}): {e.response.text}"
        
        current_app.logger.error(f"Failed to analyze repo with Node.js service: {error_message}")

        raise requests.exceptions.HTTPError(error_message, response=e.response)
