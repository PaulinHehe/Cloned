import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../style/GroupList.css'; // You'll create this file for basic styling

function GroupList() {
    const [groupsByYear, setGroupsByYear] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openYears, setOpenYears] = useState({}); // State to manage open/closed years

    useEffect(() => {
        fetch('http://localhost:5000/api/groups')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur HTTP! statut: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const organizedData = {};
                // The backend already processes data to group students by group,
                // so the structure is an array of group objects, each with a 'students' array.
                // We just need to group these by year.

                data.forEach(groupItem => {
                    const year = groupItem.year; // <-- Use 'year' directly from the group object
                    // Ensure 'year' is a number for consistent keying if needed, though JS handles string keys fine.
                    // const year = parseInt(groupItem.year, 10);

                    if (!organizedData[year]) {
                        organizedData[year] = []; // Initialize year as an array if not present
                    }
                    organizedData[year].push(groupItem); // Add the entire group object
                });

                setGroupsByYear(organizedData);

                const currentYear = new Date().getFullYear();

                // Initialize openYears: true for current/future years, false for past years
                const initialOpenYears = {};
                Object.keys(organizedData).forEach(year => { // Use 'organizedData' here
                    initialOpenYears[year] = parseInt(year) >= currentYear;
                });
                setOpenYears(initialOpenYears);

                setLoading(false);
            })
            .catch(error => {
                setError(error);
                setLoading(false);
            });
    }, []); // Empty dependency array means this effect runs once on mount

    const toggleYear = (year) => {
        setOpenYears(prevOpenYears => ({
            ...prevOpenYears,
            [year]: !prevOpenYears[year]
        }));
    };

    if (loading) {
        return <div>Chargement des groupes...</div>;
    }

    if (error) {
        return <div>Erreur lors du chargement des groupes: {error.message}</div>;
    }

    // Get sorted years to display them in order (descending)
    const sortedYears = Object.keys(groupsByYear).sort((a, b) => b - a);

    return (
        <div className="groups-container">
            <h1>Liste des Groupes par Année</h1>
            {sortedYears.length > 0 ? (
                sortedYears.map(year => (
                    <div key={year} className="year-section">
                        <h2 onClick={() => toggleYear(year)} className="year-title">
                            Année {year}
                            <span className="toggle-icon">
                                {openYears[year] ? ' ▼' : ' ►'}
                            </span>
                        </h2>
                        {openYears[year] && (
                            <div className="year-content">
                                {groupsByYear[year].length > 0 ? (
                                    groupsByYear[year].map(group => (
                                        <div key={group.id} className="group-card">
                                            <h3><Link to={`/group-analysis/groups/${group.id}`} className="student-name-link">
                                                Groupe {group.name}
                                            </Link></h3>
                                            {group.students && group.students.length > 0 ? (
                                                <ul>
                                                    {group.students.map((student) => (
                                                        <li><Link to={`/students/${student.id}`} className="student-name-link">
                                                            {student.surname} {student.name}
                                                        </Link></li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p>Aucun membre dans ce groupe.</p>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <p>Aucun groupe pour cette année.</p>
                                )}
                            </div>
                        )}
                    </div>
                ))
            ) : (
                <p>Aucun groupe trouvé.</p>
            )}
        </div>
    );
}

export default GroupList;