import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import '../style/MainComponents.css';

import CommitActivityTimeline from '../graphs/CommitActivityTimeline.jsx';
import FileChangeFrequencyGraph from '../graphs/FileChangeFrequencyGraph.jsx';
import CodeEvolution from '../graphs/CodeEvolution.jsx';
import BlameChartEvolution from '../graphs/BlameChartEvolution.jsx';

function StudentProfile() {
  const { id } = useParams();

  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [repos, setRepos] = useState([]);
  const [chartsData, setChartsData] = useState({});
  const [repoLoading, setRepoLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [error, setError] = useState(null);

  // Charger les infos étudiant
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    fetch(`http://localhost:5000/api/students/${id}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('Étudiant non trouvé.');
          throw new Error(`Erreur HTTP: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setStudent(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
  }, [id]);

  // Charger les repos et lancer analyse si nécessaire
  useEffect(() => {
    if (!id) return;

    fetch(`http://localhost:5000/api/students/${id}/repositories`)
      .then((res) => {
        if (!res.ok) throw new Error('Erreur lors du chargement des repositories');
        return res.json();
      })
      .then(async (data) => {
        setRepos(data);

        // Pour chaque repo, lancer analyse si analysisId manquant
        for (const repo of data) {
            console.log(`Traitement du repo: ${repo.name} (Analysis ID: ${repo.analysisId})`);
          if (!repo.analysisId) {
            await launchAnalysis(repo);
          } else {
            setChartsData((prev) => ({
              ...prev,
              [repo.id]: {
                analysisId: repo.analysisId,
                message: ``,
              },
            }));
          }
        }
      })
      .catch((err) => {
        setErrors((prev) => ({ ...prev, global: err.message }));
      });
  }, [id]);

  // Fonction pour lancer une analyse sur un repo
  const launchAnalysis = async (repo) => {
    setRepoLoading((prev) => ({ ...prev, [repo.id]: true }));
    setErrors((prev) => ({ ...prev, [repo.id]: null }));

    try {
      const response = await fetch('http://127.0.0.1:5000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: repo.name.startsWith('http') ? repo.name : `https://github.com/${repo.name}`,
          tool: 'code_archeologist',
          id_repo: repo.id,
        }),
      });

      if (!response.ok) throw new Error(`Erreur serveur: ${response.status}`);

      const data = await response.json();

      if (data.result?.data?.status !== 'completed') {
        throw new Error('Aucune donnée de commits disponible.');
      }

      // Calcul du total des commits
      const commitActivity = data.result.data.commit_activity || {};
      const totalCommits = Object.values(commitActivity).reduce(
        (acc, contributors) =>
          acc +
          Object.values(contributors).reduce((sum, c) => sum + c, 0),
        0
      );

      setChartsData((prev) => ({
        ...prev,
        [repo.id]: {
          analysisId: parseInt(data.result.data.id, 10),
          message: `Nombre de commits : ${totalCommits}`,
        },
      }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, [repo.id]: err.message || 'Erreur inconnue' }));
    } finally {
      setRepoLoading((prev) => ({ ...prev, [repo.id]: false }));
    }
  };

  // Forcer renouvellement d’analyse sur un repo
  const forceRenewAnalysis = async (repo) => {
    setChartsData((prev) => {
      const copy = { ...prev };
      delete copy[repo.id];
      return copy;
    });
    await launchAnalysis(repo);
  };

  if (loading) {
    return <div className="student-profile-container">Chargement du profil étudiant...</div>;
  }

  if (error) {
    return <div className="student-profile-container error-message">Erreur : {error.message}</div>;
  }

  if (!student) {
    return <div className="student-profile-container">Aucun étudiant trouvé avec cet ID.</div>;
  }

  return (
    <div className="student-profile-container">
      <header className="student-profile-header">
        <h1>{student.surname} {student.name}</h1>
      </header>

      <section className="student-profile-section">
        <h2>Profil</h2>
        <ul className="info-list">
          <li><strong>Numéro étudiant :</strong> {student.no_etudiant}</li>
          <li><strong>Filière :</strong> {student.class}</li>
          <li><strong>GitHub :</strong> {student.gitname}</li>
        </ul>
      </section>

      {student.groups?.length > 0 && (
        <section className="student-profile-section">
          <h2>Projet</h2>
          <ul className="group-list">
            {student.groups.map((group) => (
              <li key={group.id}>
                Groupe {group.name} - {group.year}
                <ul className="repo-projet-list">
                  {student.repositories_projet?.map((repo) => (
                    <li key={repo.id}>{repo.name}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {repos.length > 0 && (
        <section className="student-profile-section">
          <h2>TDs</h2>
          {repos.map((repo) => (
            <div key={repo.id} className="repo-card" style={{ position: 'relative' }}>
              <button
                style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}
                disabled={repoLoading[repo.id]}
                onClick={() => forceRenewAnalysis(repo)}
                title="Forcer le renouvellement de l'analyse"
              >
                🔄
              </button>

              <h3>{repo.name}</h3>

              {repoLoading[repo.id] ? (
                <p className="loading-text">Analyse en cours...</p>
              ) : errors[repo.id] ? (
                <p className="error-text">Erreur : {errors[repo.id]}</p>
              ) : chartsData[repo.id] ? (
                <>
                  <h4>{chartsData[repo.id].message}</h4>
                  <div className="charts-wrapper">
                    <CommitActivityTimeline key={`timeline-${chartsData[repo.id].analysisId}`} analysisId={chartsData[repo.id].analysisId} />
                    <FileChangeFrequencyGraph key={`freqgraph-${chartsData[repo.id].analysisId}`} analysisId={chartsData[repo.id].analysisId} />
                    <CodeEvolution key={`codeevo-${chartsData[repo.id].analysisId}`} analysisId={chartsData[repo.id].analysisId} />
                    <BlameChartEvolution key={`blame-${chartsData[repo.id].analysisId}`} analysisId={chartsData[repo.id].analysisId} />
                  </div>
                </>
              ) : (
                <p className="loading-text">Préparation de l’analyse...</p>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default StudentProfile;
