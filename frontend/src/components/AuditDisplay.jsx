// src/components/AuditResultsDisplay.jsx

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

import '../style/AuditResultsDisplay.css'; // We'll create this CSS file for styling

// Helper function to capitalize first letter (for display purposes)
const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

// Custom Tooltip for Recharts (can be reused)
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="custom-tooltip">
                <p className="label">{label}</p>
                {payload.map((entry, index) => (
                    <p key={`item-${index}`} style={{ color: entry.color }}>
                        {entry.name}: {entry.value}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

function AuditResultsDisplay({ auditResult }) {
    if (!auditResult) {
        return <div className="audit-results-container">Aucune donnée d'audit à afficher.</div>;
    }

    const {
        base_name,
        total_commits,
        commits_par_auteur,
        contributions,
        fichiers_critiques,
        complexites,
        co_modification,
        evolution_par_auteur,
        // Add other fields from your JSON if needed
    } = auditResult;

    // --- Data preparation for Charts/Tables ---

    // 1. Commits by Author (Bar Chart)
    const commitsByAuthorData = Object.entries(commits_par_auteur).map(([author, count]) => ({
        author: author,
        commits: count,
    })).sort((a, b) => b.commits - a.commits); // Sort by commits descending

    // 2. Contributions (Table and potentially a combined Bar Chart for added/deleted lines)
    const contributionsData = Object.entries(contributions).map(([author, stats]) => ({
        author: author,
        added: stats.added,
        deleted: stats.deleted,
        total: stats.total,
        percent: stats.percent,
    })).sort((a, b) => b.total - a.total);

    // 3. Critical Files (Table)
    // Already in a good format: [[filename, count], ...]

    // 4. Code Complexity (Table or simple list)
    // Already in a good format: {filename: complexity_score, ...}
    const complexityData = Object.entries(complexites).map(([file, score]) => ({
        file: file,
        complexity: score,
    })).sort((a, b) => b.complexity - a.complexity);

    // 5. Co-modification (Table)
    // Convert co_modification for easier display
    const coModificationData = Object.entries(co_modification).flatMap(([file, authors]) =>
        Object.entries(authors).map(([author, count]) => ({
            file: file,
            author: author,
            count: count,
        }))
    ).sort((a, b) => b.count - a.count); // Sort by count descending

    // 6. Evolution by Author (Line Chart)
    // Transform evolution_par_auteur into a format suitable for LineChart
    const dates = new Set();
    for (const author in evolution_par_auteur) {
        for (const date in evolution_par_auteur[author]) {
            dates.add(date);
        }
    }
    const sortedDates = Array.from(dates).sort();

    const evolutionChartData = sortedDates.map(date => {
        const entry = { date: date };
        for (const author in evolution_par_auteur) {
            entry[author] = evolution_par_auteur[author][date] || 0;
        }
        return entry;
    });

    const evolutionAuthors = Object.keys(evolution_par_auteur);


    return (

        
        <div className="audit-results-container">
            
            
            
            <h2 className="audit-title">Rapport d'Audit : {base_name}</h2>
            {auditResult.deadline && <p className="audit-deadline">Date limite : {auditResult.deadline}</p>}

            <div className="audit-section-summary">
                <h4>Résumé Global</h4>
                <p><strong>Total des Commits :</strong> {total_commits}</p>
            </div>

            <hr />

            {/* Commits by Author */}
            <div className="audit-section">
                <h4>Commits par Auteur</h4>
                {/* Wrap in a div to control width */}
                <div style={{ width: '75%', margin: '0 auto' }}> 
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={commitsByAuthorData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <XAxis dataKey="author" angle={-45} textAnchor="end" height={60} interval={0} />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="commits" fill="#8884d8" name="Nombre de Commits" />
                        </BarChart>
                    </ResponsiveContainer>
                </div> {/* End of wrapper div */}
                <div className="table-wrapper">
                    <table className="audit-table">
                        <thead>
                            <tr>
                                <th>Auteur</th>
                                <th>Commits</th>
                            </tr>
                        </thead>
                        <tbody>
                            {commitsByAuthorData.map((data, index) => (
                                <tr key={index}>
                                    <td>{data.author}</td>
                                    <td>{data.commits}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <hr />

            <hr />

            {/* Evolution par Auteur (Line Chart) */}
            <div className="audit-section">
                <h4>Évolution des Commits par Auteur au Fil du Temps</h4>
                {evolutionChartData.length > 0 && evolutionAuthors.length > 0 ? (
                    <div style={{ width: '75%', margin: '0 auto' }}>
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={evolutionChartData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                                <XAxis dataKey="none" angle={-45} textAnchor="end" height={20} interval={0} />
                                <YAxis />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                {evolutionAuthors.map((author, index) => (
                                    <Line
                                        key={author}
                                        type="monotone"
                                        dataKey={author}
                                        stroke={`hsl(${index * 60}, 70%, 50%)`} // Generates different colors
                                        name={author}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div> 
                ) : (
                    <p>Aucune donnée d'évolution par auteur disponible.</p>
                )}
            </div>

            {/* Contributions (Added/Deleted Lines) */}
            <div className="audit-section">
                <h4>Contributions des Auteurs (Lignes)</h4>
                {/* Wrap in a div to control width */}
                <div style={{ width: '75%', margin: '0 auto' }}>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={contributionsData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <XAxis dataKey="author" angle={-45} textAnchor="end" height={60} interval={0} />
                            <YAxis />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="added" stackId="lines" fill="#82ca9d" name="Lignes Ajoutées" />
                            <Bar dataKey="deleted" stackId="lines" fill="#ff7300" name="Lignes Supprimées" />
                        </BarChart>
                    </ResponsiveContainer>
                </div> {/* End of wrapper div */}
                <div className="table-wrapper">
                    <table className="audit-table">
                        <thead>
                            <tr>
                                <th>Auteur</th>
                                <th>Ajoutées</th>
                                <th>Supprimées</th>
                                <th>Total</th>
                                <th>Pourcentage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contributionsData.map((data, index) => (
                                <tr key={index}>
                                    <td>{data.author}</td>
                                    <td className="added-lines">+{data.added}</td>
                                    <td className="deleted-lines">-{data.deleted}</td>
                                    <td>{data.total}</td>
                                    <td>{data.percent}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <hr />

            {/* Critical Files (most modified) */}
            <div className="audit-section">
                <h4>Fichiers les plus Modifiés</h4>
                {fichiers_critiques.length > 0 ? (
                    <div className="table-wrapper">
                        <table className="audit-table">
                            <thead>
                                <tr>
                                    <th>Fichier</th>
                                    <th>Fréquence de Modification</th>
                                </tr>
                            </thead>
                            <tbody>
                                {fichiers_critiques.map((fileInfo, index) => (
                                    <tr key={index}>
                                        <td>{fileInfo[0]}</td>
                                        <td>{fileInfo[1]}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p>Aucun fichier critique identifié.</p>
                )}
            </div>

            <hr />

            {/* Code Complexity */}
            <div className="audit-section">
                <h4>Complexité du Code (Top 10)</h4>
                {complexityData.length > 0 ? (
                    <div className="table-wrapper">
                        <table className="audit-table">
                            <thead>
                                <tr>
                                    <th>Fichier</th>
                                    <th>Complexité Cyclomatique</th>
                                </tr>
                            </thead>
                            <tbody>
                                {complexityData.map((data, index) => (
                                    <tr key={index}>
                                        <td>{data.file}</td>
                                        <td>{data.complexity}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p>Aucune donnée de complexité disponible (probablement pas de fichiers Python ou top 10 vide).</p>
                )}
            </div>

            <hr />

            {/* Co-modification */}
            <div className="audit-section">
                <h4>Co-modifications</h4>
                {coModificationData.length > 0 ? (
                    <div className="table-wrapper">
                        <table className="audit-table">
                            <thead>
                                <tr>
                                    <th>Fichier</th>
                                    <th>Auteur</th>
                                    <th>Nombre de co-modifications</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coModificationData.map((data, index) => (
                                    <tr key={index}>
                                        <td>{data.file}</td>
                                        <td>{data.author}</td>
                                        <td>{data.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p>Aucune co-modification enregistrée.</p>
                )}
            </div>

            
        </div>
    );
}

export default AuditResultsDisplay;