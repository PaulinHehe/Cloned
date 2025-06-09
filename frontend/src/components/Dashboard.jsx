import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ClassScore from '../graphs/ClassScore.jsx';
import '../style/App.css'; // Using the combined CSS file you created
import '../style/MainComponents.css'

function Dashboard() {
  const [classStats, setClassStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchClassStats = async () => {
      try {
        // Changed to axios.get based on common API practice for fetching data.
        // If your backend specifically requires a POST for /api/stats with no body, keep axios.post.
        // However, GET is semantically more appropriate for data retrieval.
        const response = await axios.post('http://127.0.0.1:5000/api/stats');
        
        if (response.data.status === 'success') {
          // --- FIX 1: Access the correct key 'resultsClass' ---
          const rawData = response.data.resultsClass;
          
          // --- FIX 2: Filter for student entries and transform if necessary ---
          const studentsOnly = {};
          for (const key in rawData) {
            // Identify student entries (e.g., check for 'student_id' or 'student_name')
            if (key.startsWith('student_') && rawData[key].student_id) {
              const studentData = rawData[key];
              // Transform the student data keys to match what your component expects
              // Or update your component to use the new keys directly
              studentsOnly[studentData.student_name + ' ' + studentData.student_surname] = {
                etudiant: studentData.student_name + ' ' + studentData.student_surname, // Combine name for display
                TDs: Object.entries(studentData.TDs).reduce((acc, [tdDate, tdInfo]) => {
                  acc[tdDate] = {
                    date_commit: tdInfo.commit_date,
                    commits: tdInfo.commits,
                    ajouts: tdInfo.additions,
                    suppressions: tdInfo.deletions,
                    fichiers: tdInfo.files,
                    score: tdInfo.score,
                    pourcentage: tdInfo.percentage,
                    a_heure: tdInfo.on_time
                  };
                  return acc;
                }, {}),
                total_commits: studentData.total_commits,
                total_ajouts: studentData.total_additions,
                total_suppressions: studentData.total_deletions,
                total_fichiers: studentData.total_files,
                score_global: studentData.global_score,
                nb_branches: studentData.nb_branches,
                nb_pr_total: studentData.nb_pr_total,
                nb_pr_open: studentData.nb_pr_open,
                nb_pr_closed: studentData.nb_pr_closed,
                nb_pr_merged: studentData.nb_pr_merged,
                nb_reviews: studentData.nb_reviews,
                nb_ci_total: studentData.nb_ci_total,
                nb_ci_success: studentData.nb_ci_success,
                nb_ci_failure: studentData.nb_ci_failure,
              };
            }
          }
          setClassStats(studentsOnly);
        } else {
          setError('Failed to fetch class statistics. Status not "success".');
        }
      } catch (err) {
        console.error('Error fetching class stats:', err);
        setError('An error occurred while fetching data. Please ensure the backend is running and accessible.');
      } finally {
        setLoading(false);
      }
    };

    fetchClassStats();
  }, []); // Empty dependency array means this runs once on mount

  if (loading) {
    return <div className="loading-text">Chargement des scores de la classe...</div>;
  }

  if (error) {
    return <div className="error-text">Erreur : {error}</div>;
  }

  // Check if classStats is null, or if it's an empty object after filtering
  if (!classStats || Object.keys(classStats).length === 0) {
    return <div className="no-data-text">Aucune donnée de score disponible pour la classe.</div>;
  }

  return (
    <div className="dashboard-container">
      <h2>Récapitulatif des scores de la classe</h2>
        <ClassScore classScores={classStats} />
        <hr className="my-8" />     
      <div className="class-stats-table-container">
        <table className="class-stats-table">
          <thead>
            <tr>
              <th>Étudiant</th>
              <th>TD (Date)</th>
              <th>Commits</th>
              <th>Ajouts</th>
              <th>Suppressions</th>
              <th>Fichiers touchés</th>
              <th>Score TD</th>
              <th>À l’heure ?</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(classStats)
            .sort(([, studentA], [, studentB]) => studentB.score_global - studentA.score_global)
            .map(([studentFullName, studentData]) => (
              <React.Fragment key={studentFullName}>
                {Object.entries(studentData.TDs).map(([tdDate, tdInfo], index) => (
                  <tr key={`${studentFullName}-${tdDate}`}>
                    {index === 0 && (
                      <td rowSpan={Object.keys(studentData.TDs).length + 1}>
                        {studentFullName}
                      </td>
                    )}
                    <td>
                      {tdDate}
                      <br />
                      <small>({tdInfo.date_commit})</small>
                    </td>
                    <td>{tdInfo.commits}</td>
                    <td>{tdInfo.ajouts}</td>
                    <td>{tdInfo.suppressions}</td>
                    <td>{tdInfo.fichiers}</td>
                    <td>{tdInfo.score}</td>
                    <td>{tdInfo.a_heure ? '✅' : '❌'}</td>
                  </tr>
                ))}
                <tr className="total-row">

                  <td>TOTAL</td>
                  <td>{studentData.total_commits}</td>
                  <td className='addition-value'>+{studentData.total_ajouts}  ({Math.round((studentData.total_ajouts / studentData.total_commits) * 100) / 100 })</td>
                  <td className='deletion-value'>-{studentData.total_suppressions}  ({Math.round((studentData.total_suppressions / studentData.total_commits) * 100) / 100 })</td>
                  <td>{studentData.total_fichiers}</td>
                  <td colSpan="2">
                    Score : {studentData.score_global}
                  </td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;