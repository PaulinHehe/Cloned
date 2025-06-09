import os
import time
from flask_restful import Resource, reqparse
from typing import Optional, Dict, Any
from collections import defaultdict, Counter
from pydriller import Repository
from radon.complexity import cc_visit
from flask import current_app as app # Keep current_app for logging, remove jsonify if it's still there
from ..utils.dir_manager import DirManager

class AuditAPI(Resource):
    def post(self):
        parser = reqparse.RequestParser()
        parser.add_argument("repo_url", type=str, required=True)
        parser.add_argument("deadline")
        args = parser.parse_args()

        repo_url = args["repo_url"]
        deadline = args["deadline"]

        result = self.lancer_audit(repo_url, deadline)

        status_code = 200
        return {"status": "success", "result": result}, status_code
    
    def lancer_audit( self,
        repo_url: str,
        token: Optional[str] = None,
        deadline: Optional[str] = None
    ) -> Dict[str, Any]:
        timestamp = int(time.time())
        base_name = DirManager.name_from_url(repo_url)     
        repo_path = DirManager.clone_update_repo(repo_url)

        # Comptages
        commits_par_auteur         = Counter()
        fichiers_modifies          = Counter()
        complexites                = {}
        evolution_par_auteur       = defaultdict(lambda: defaultdict(int))
        co_modification            = defaultdict(lambda: defaultdict(int))
        auteur_fichiers            = defaultdict(set)
        lignes_ajoutees_par_auteur = Counter()
        lignes_supprimees_par_auteur = Counter()

        try:
            for commit in Repository(repo_path).traverse_commits():
                au = commit.author.name or "Inconnu"
                dstr = commit.author_date.strftime("%Y-%m-%d")

                commits_par_auteur[au] += 1
                evolution_par_auteur[au][dstr] += 1

                for mod in commit.modified_files:
                    # fichiers
                    f = mod.new_path or mod.old_path
                    if not f:
                        continue
                    fichiers_modifies[f] += 1
                    auteur_fichiers[au].add(f)

                    # co-modifs
                    for autre, s in auteur_fichiers.items():
                        if autre != au and f in s:
                            co_modification[f][au]    += 1
                            co_modification[f][autre] += 1

                        # … à l’intérieur du for commit … for mod in commit.modified_files: …
                        # Complexité cyclomatique : on tente systématiquement (radon ne lira
                        # que le Python, et lèvera une exception sinon)
                        full_path = os.path.join(repo_path, f)
                        if os.path.exists(full_path):
                            try:
                                with open(full_path, 'r', encoding='utf-8') as f_code:
                                    code = f_code.read()
                                    res = cc_visit(code)
                                    complexites[f] = sum(c.complexity for c in res)
                            except Exception:
                                # pas un fichier Python ou parse error → on ignore
                                pass

                    # … fin de la boucle Repository(traverse_commits()) …

                    # Après avoir collecté TOUTES les complexités, on ne conserve QUE le Top 10
                    if complexites:
                        top10 = sorted(complexites.items(), key=lambda x: x[1], reverse=True)[:10]
                        complexites = dict(top10)


                    # lignes ajoutées/supprimées
                    a = getattr(mod, "added_lines", 0)
                    d = getattr(mod, "deleted_lines", 0)
                    if a:
                        lignes_ajoutees_par_auteur[au] += a
                    if d:
                        lignes_supprimees_par_auteur[au] += d

        except Exception as e:
            return {"error": f"Erreur pendant l'analyse des commits : {e}"}

        # GARDER TOP 10 des fichiers Python les plus complexes
        if complexites:
            top10 = sorted(complexites.items(), key=lambda x: x[1], reverse=True)[:10]
            complexites = dict(top10)

        # Contributions par auteur
        contributions = {}
        total_changed = 0
        for au in set(lignes_ajoutees_par_auteur) | set(lignes_supprimees_par_auteur):
            A = lignes_ajoutees_par_auteur.get(au, 0)
            D = lignes_supprimees_par_auteur.get(au, 0)
            T = A + D
            total_changed += T
            contributions[au] = {"added": A, "deleted": D, "total": T}

        # pourcentages
        for au, info in contributions.items():
            pct = round(100 * info["total"] / total_changed, 2) if total_changed > 0 else 0.0
            info["percent"] = pct        

        fichiers_critiques = fichiers_modifies.most_common(5)

        return {
            "base_name":                base_name,
            "deadline":                 deadline,
            "total_commits":            sum(commits_par_auteur.values()),
            "commits_par_auteur":       dict(commits_par_auteur),
            "contributions":            contributions,
            "fichiers_critiques":       fichiers_critiques,
            "complexites":              complexites,
            "co_modification":          {f: dict(a) for f,a in co_modification.items()},
            "evolution_par_auteur":     evolution_par_auteur
            #"gitstats_url":            gitstats_url
        }