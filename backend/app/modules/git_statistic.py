import subprocess

def git_statistics(repo_path):
    """
    Récupère les statistiques d'un dépôt Git avec Git Statistic.
    """
    try:
        result = subprocess.run(
            ["git-statistic", repo_path],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        return f"Erreur lors de l'analyse : {e.stderr}"
