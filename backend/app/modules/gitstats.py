import subprocess

def gitstats_analysis(repo_path, output_dir):
    """
    Analyse un dépôt Git avec GitStats.
    """
    try:
        result = subprocess.run(
            ["gitstats", repo_path, output_dir],
            capture_output=True,
            text=True,
            check=True
        )
        return f"Analyse GitStats terminée. Les résultats sont dans : {output_dir}"
    except subprocess.CalledProcessError as e:
        return f"Erreur lors de l'analyse GitStats : {e.stderr}"
