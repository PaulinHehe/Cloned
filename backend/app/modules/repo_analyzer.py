import subprocess
import os

def analyze_repo(repo_path):
    """
    Analyse un dépôt Git en utilisant l'outil Repo Analyzer.
    """
    try:
        result = subprocess.run(
            ["repo-analyzer", "--path", repo_path],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        return f"Erreur lors de l'analyse : {e.stderr}"
