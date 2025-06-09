import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import CommitsChart from '../graphs/CommitsChart.jsx';
import '../style/MainComponents.css';
import CommitActivityTimeline from '../graphs/CommitActivityTimeline.jsx';
import FileChangeFrequencyGraph from '../graphs/FileChangeFrequencyGraph.jsx';
import CodeEvolution from '../graphs/CodeEvolution.jsx';
import BlameChartEvolution from '../graphs/BlameChartEvolution.jsx';

function GroupAnalysis() {
  const { id } = useParams();
  const [repos, setRepos] = useState([]);
  const [chartsData, setChartsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [repoLoading, setRepoLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [students, setStudents] = useState([]);
  const [groupInfo, setGroupInfo] = useState(null);
  const [globalError, setGlobalError] = useState(null);
  const [statsError, setStatsError] = useState(null);
  const [globalStats, setGlobalStats] = useState({}); // Que les données à afficher
  const [statsTracking, setStatsTracking] = useState({
    repoMap: {},       // { analysisId: [email1, email2] }
    repoCommits: {}    // { analysisId: { email: {commits, additions, deletions} } }
  });


  // Charger infos groupe + étudiants
  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setGlobalError(null);

    Promise.all([
      fetch(`http://localhost:5000/api/groups/${id}/repositories`).then(res => {
        if (!res.ok) throw new Error('Erreur lors du chargement des repositories');
        return res.json();
      }),
      fetch(`http://localhost:5000/api/groups/${id}`).then(res => {
        if (!res.ok) throw new Error('Erreur lors du chargement du groupe');
        return res.json();
      })
    ])
      .then(([reposData, groupData]) => {
        setRepos(reposData);
        setStudents(groupData.students || []);
        setGroupInfo({ name: groupData.name, year: groupData.year });
        setLoading(false);
      })
      .catch(err => {
        setGlobalError(err.message);
        setLoading(false);
      });
  }, [id]);

  // Lancer analyse pour chaque repo qui n'a pas d'analysisId
  useEffect(() => {
    if (repos.length === 0) return;

    (async () => {
      for (const repo of repos) {
        if (!repo.analysisId) {
          await launchAnalysis(repo);
        } else {
          setChartsData(prev => ({
            ...prev,
            [repo.id]: {
              analysisId: repo.analysisId,
              message: '',
            },
          }));
        }
      }
    })();
  }, [repos]);

  useEffect(() => {
    const analysisIds = Object.values(chartsData)
      .map(data => data.analysisId)
      .filter(id => typeof id === 'number');

    const fetchStats = async (analysisId) => {
      try {
        const res = await axios.get('http://localhost:3000/api/global-stats', {
          params: { analysisId },
        });
        const stats = res.data.stats;

        // Mise à jour des données de tracking
        setStatsTracking(prevTracking => {
          const newTracking = { ...prevTracking };
          
          // Initialiser les structures si elles n'existent pas
          if (!newTracking.repoMap) newTracking.repoMap = {};
          if (!newTracking.repoCommits) newTracking.repoCommits = {};

          // Supprimer les anciennes données de ce analysisId s'il existe
          if (newTracking.repoMap[analysisId]) {
            delete newTracking.repoMap[analysisId];
            delete newTracking.repoCommits[analysisId];
          }

          // Ajouter les nouvelles données de tracking
          newTracking.repoMap[analysisId] = Object.keys(stats);
          newTracking.repoCommits[analysisId] = {};

          Object.entries(stats).forEach(([email, stat]) => {
            newTracking.repoCommits[analysisId][email] = {
              commits: stat.totalCommits || 0,
              additions: stat.additions || 0,
              deletions: stat.deletions || 0
            };
          });

          return newTracking;
        });

        // Mise à jour des statistiques globales
        setGlobalStats(prevStats => {
          const newStats = { ...prevStats };
          
          // D'abord supprimer les anciennes stats de ce analysisId
          const trackingData = statsTracking.repoCommits[analysisId] || {};
          Object.keys(trackingData).forEach(email => {
            if (newStats[email]) {
              newStats[email].totalCommits -= trackingData[email].commits || 0;
              newStats[email].totalAdditions -= trackingData[email].additions || 0;
              newStats[email].totalDeletions -= trackingData[email].deletions || 0;
              
              // Supprimer l'entrée si toutes les stats sont à zéro
              if (
                newStats[email].totalCommits <= 0 &&
                newStats[email].totalAdditions <= 0 &&
                newStats[email].totalDeletions <= 0
              ) {
                delete newStats[email];
              }
            }
          });

          // Puis ajouter les nouvelles stats
          Object.entries(stats).forEach(([email, stat]) => {
            if (!newStats[email]) {
              newStats[email] = {
                name: stat.name || email, // Utiliser l'email comme fallback pour le nom
                totalCommits: stat.totalCommits || 0,
                totalAdditions: stat.additions || 0,
                totalDeletions: stat.deletions || 0
              };
            } else {
              newStats[email].totalCommits += stat.totalCommits || 0;
              newStats[email].totalAdditions += stat.additions || 0;
              newStats[email].totalDeletions += stat.deletions || 0;
            }
          });

          return newStats;
        });

      } catch (error) {
        console.error(`Erreur lors de la récupération des stats pour analysisId=${analysisId}:`, error);
        setErrors(prev => ({
          ...prev,
          [analysisId]: `Erreur: ${error.message || 'Échec de chargement des stats'}`
        }));
      }
    };
    analysisIds.forEach(fetchStats);
  }, [chartsData]);




  // Fonction pour lancer une analyse sur un repo
  const launchAnalysis = async (repo) => {
    setRepoLoading(prev => ({ ...prev, [repo.id]: true }));
    setErrors(prev => ({ ...prev, [repo.id]: null }));

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

      const commitActivity = data.result.data.commit_activity || {};
      const totalCommits = Object.values(commitActivity).reduce(
        (acc, contributors) =>
          acc + Object.values(contributors).reduce((sum, c) => sum + c, 0),
        0
      );

      setChartsData(prev => ({
        ...prev,
        [repo.id]: {
          analysisId: parseInt(data.result.data.id, 10),
          message: `Nombre de commits : ${totalCommits}`,
        },
      }));
    } catch (err) {
      setErrors(prev => ({ ...prev, [repo.id]: err.message || 'Erreur inconnue' }));
    } finally {
      setRepoLoading(prev => ({ ...prev, [repo.id]: false }));
    }
  };

  // Forcer renouvellement d’analyse sur un repo
  const forceRenewAnalysis = async (repo) => {
    setChartsData(prev => {
      const copy = { ...prev };
      delete copy[repo.id];
      return copy;
    });
    await launchAnalysis(repo);
  };

  if (loading) {
    return <div className="loading-text">Chargement des données du groupe...</div>;
  }

  if (globalError) {
    return <div className="error-text">Erreur : {globalError}</div>;
  }

  return (
    <div className="group-analysis-container">
      <h2>Projet du groupe {groupInfo?.name} ({groupInfo?.year})</h2>

      {students.length > 0 ? (
        <div className="students-list">
          <h3>Membres du groupe :</h3>
          <ul>
            {students.map(student => (
              <li key={student.id}>
                {student.name} {student.surname}
              </li>
            ))}
          </ul>
          {globalStats ? (
          <div className="global-stats">
            <h3>Statistiques globales par auteur :</h3>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Commits</th>
                  <th>Additions</th>
                  <th>Suppressions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(globalStats)
                .sort((b, a) => a[1].totalCommits - b[1].totalCommits)
                .map(([email, author]) => (
                  <tr key={email}>
                    <td>{email}</td>
                    <td>{author.totalCommits}</td>
                    <td className='addition-value'>
                      +{author.totalAdditions}     
                      <small style={{fontSize: '0.7em', opacity: 0.9}}>
                        ({Math.round((author.totalAdditions / author.totalCommits) * 100) / 100 })
                      </small>
                    </td>
                    <td className='deletion-value'>
                      -{author.totalDeletions}     
                      <small style={{fontSize: '0.7em', opacity: 0.9}}>
                        ({Math.round((author.totalAdditions / author.totalCommits) * 100) / 100 })
                      </small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : statsError ? (
          <p className="error-text">Erreur lors du chargement des stats : {statsError}</p>
        ) : (
          <p className="loading-text">Chargement des statistiques globales...</p>
        )}
          </div>
      ) : (
        <p className="loading-text">Chargement des étudiants...</p>
      )}

      

      {repos.length === 0 && <p>Aucun repository trouvé pour ce groupe.</p>}

      {repos.map(repo => (
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
                <CommitActivityTimeline
                  key={`timeline-${chartsData[repo.id].analysisId}`}
                  analysisId={chartsData[repo.id].analysisId}
                />
                <FileChangeFrequencyGraph
                  key={`freqgraph-${chartsData[repo.id].analysisId}`}
                  analysisId={chartsData[repo.id].analysisId}
                />
                <CodeEvolution
                  key={`codeevo-${chartsData[repo.id].analysisId}`}
                  analysisId={chartsData[repo.id].analysisId}
                />
                <BlameChartEvolution key={`blame-${chartsData[repo.id].analysisId}`} analysisId={chartsData[repo.id].analysisId} />
              </div>
            </>
          ) : (
            <p className="loading-text">Préparation de l’analyse...</p>
          )}
        </div>
      ))}
    </div>
  );
}

export default GroupAnalysis;
