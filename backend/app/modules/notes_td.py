import os
import json
from collections import Counter
from datetime import datetime
import subprocess
from typing import Dict, Any, Optional, List
import requests
from flask import current_app as app 

# For cyclomatic complexity (Radon)
try:
    from radon.complexity import cc_visit
except ImportError:
    # If Radon is not installed, inform the user and disable complexity calculation
    print("Radon not found. Please install it with 'pip install radon'. Cyclomatic complexity will be skipped.")
    cc_visit = None


# --- Analysis Functions (Post-processing) ---

def perform_post_processing_analysis(analysis_data: Dict[str, Any], clone_path: str) -> Dict[str, Any]:
    """
    Performs post-processing analysis on data retrieved from Node.js /api/analysis-data.
    Calculates:
      - Most modified files
      - Cyclomatic complexity per .py file
    Does NOT recalculate: commits per author, temporal evolution, co-modifications.
    """
    post_processed_metrics: Dict[str, Any] = {}

    # 1. Get raw commit data for file modifications from Node.js analysis_data
    # The 'codeEvolution' key in analysis_data contains the full commit objects (sha, commit, parents)
    all_commits_from_api = analysis_data.get("codeEvolution", [])
    
    complexites = {}

    # Iterate through the commits from the API response
    # We still need to use local git commands to get the *modified files per commit*
    # because the API provides commit metadata but not the file changes within each commit.
    # However, if the API *were* to provide `file_changes` directly in the `codeEvolution` object,
    # we wouldn't need to run `git diff-tree` again for that purpose.
    # Given your `fetchFileChangesAllBranches` in Node.js already calculates this,
    # we should ideally use that pre-calculated `file_changes` data.
    
    # Use the pre-calculated `file_changes` from the Node.js API
    pre_calculated_file_changes = analysis_data.get("file_changes", {})


    # 2. Calculate Cyclomatic Complexity for Python files
    # This requires access to the local clone
    if cc_visit and clone_path:
        for file_path in pre_calculated_file_changes.keys(): # Iterate through all files that were modified
            if file_path.endswith(".py"):
                full_path = os.path.join(clone_path, file_path)
                if os.path.exists(full_path):
                    try:
                        with open(full_path, 'r', encoding='utf-8') as f_code:
                            code = f_code.read()
                            if code.strip():
                                res = cc_visit(code)
                                score = sum(c.complexity for c in res)
                                complexites[file_path] = score
                            else:
                                complexites[file_path] = 0 # Empty file, complexity 0
                    except Exception as e:
                        complexites[file_path] = -1 # Indicate error
                        print(f"Error calculating complexity for {file_path}: {e}")
                else:
                    complexites[file_path] = -2 # File not found (e.g., deleted or not present in latest checkout)

    post_processed_metrics["complexites"] = complexites

    return post_processed_metrics

# --- Main function to orchestrate the post-processing ---
def process_post_analysis_request(analysis_id: int, clone_path: str) -> str:
    """
    Fetches analysis data from the Node.js API and performs post-processing.
    """
    full_data_url = "http://archeologist:3000/api/analysis-data"
    app.logger.info(f"Fetching analysis data for ID {analysis_id} from Node.js API at {full_data_url}")
    try:
        
        params = {"analysisId": analysis_id}
        full_data_response = requests.get(full_data_url, params=params)
        full_data_response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
        full_analysis_data = full_data_response.json()

        if full_analysis_data.get("status") != "success":
            return json.dumps({"error": f"Error fetching analysis data from Node.js: {full_analysis_data.get('message', 'Unknown error')}"})

        # The actual data is under 'data' key in the response
        repo_analysis_data = full_analysis_data.get("data", {})

        # Perform the post-processing
        post_processed_results = perform_post_processing_analysis(repo_analysis_data, clone_path)
        
        return json.dumps({
            "status": "success",
            "analysisId": analysis_id,
            "post_processed_metrics": post_processed_results
        }, indent=2)

    except requests.exceptions.RequestException as e:
        return json.dumps({"error": f"Network or API error when fetching analysis data: {e}"})
    except json.JSONDecodeError:
        return json.dumps({"error": f"Invalid JSON response from Node.js API: {full_data_response.text}"})
    except Exception as e:
        return json.dumps({"error": f"An unexpected error occurred during post-processing: {e}"})
