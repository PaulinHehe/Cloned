import React, { useState, useEffect } from 'react';
import '../style/StudentList.css'; // Ensure this CSS file exists and is correctly styled
import { Link } from 'react-router-dom';

function StudentList() {
    const [studentsOrganized, setStudentsOrganized] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openYears, setOpenYears] = useState({});

    useEffect(() => {
        fetch('http://localhost:5000/api/students')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Erreur HTTP! statut: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const organizedData = {};

                data.forEach(studentItem => {
                    const yearsToProcess = studentItem.years_assigned && studentItem.years_assigned.length > 0
                        ? studentItem.years_assigned
                        : ['Non assigné'];

                    const studentClassType = studentItem.class === 'IM' ? 'IM' : 'MIAGE';

                    yearsToProcess.forEach(year => {
                        if (!organizedData[year]) {
                            organizedData[year] = { 'IM': [], 'MIAGE': [] };
                        }
                        
                        // Add the student to the appropriate class array for this year
                        if (studentClassType === 'IM') {
                            organizedData[year]['IM'].push(studentItem);
                        } else {
                            organizedData[year]['MIAGE'].push(studentItem);
                        }
                    });
                });

                setStudentsOrganized(organizedData);

                const currentYear = new Date().getFullYear();
                const initialOpenYears = {};
                Object.keys(organizedData).forEach(year => {
                    initialOpenYears[year] = (year === 'Non assigné' || parseInt(year) >= currentYear);
                });
                setOpenYears(initialOpenYears);

                setLoading(false);
            })
            .catch(error => {
                setError(error);
                setLoading(false);
            });
    }, []);

    const toggleYear = (year) => {
        setOpenYears(prevOpenYears => ({
            ...prevOpenYears,
            [year]: !prevOpenYears[year]
        }));
    };

    if (loading) {
        return <div>Chargement des étudiants...</div>;
    }

    if (error) {
        return <div>Erreur lors du chargement des étudiants: {error.message}</div>;
    }

    const sortedYears = Object.keys(studentsOrganized).sort((a, b) => {
        if (a === 'Non assigné') return 1;
        if (b === 'Non assigné') return -1;
        return b - a;
    });

    const renderStudentsTable = (students, title, currentYear) => (
        <div className="class-section">
            <h4>{title}</h4>
            {students.length > 0 ? (
                <table className="students-table">
                    <thead>
                        <tr>
                            <th>Nom </th>
                            <th>Groupe</th> {/* Changed to singular 'Groupe' */}
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(student => {
                            // Find the group specifically for the currentYear being rendered
                            const groupForThisYear = student.groups.find(group =>
                                // Ensure group.year is a number for comparison if currentYear is also a number
                                parseInt(group.year) === parseInt(currentYear)
                            );

                            return (
                                <tr key={student.id}>
                                    <td><Link to={`/students/${student.id}`} className="student-name-link">
                                        {student.surname} {student.name}
                                    </Link></td>
                                    <td>
                                        {groupForThisYear ? (
                                            groupForThisYear.name
                                        ) : (
                                            "" // Or an empty string if you prefer it blank
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            ) : (
                <p>Aucun étudiant {title} pour cette année.</p>
            )}
        </div>
    );

    return (
        <div className="students-container">
            <h1>Liste des Étudiants par Année et Filière</h1>
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
                            <div className="year-content-tables">
                                {/* Pass the current 'year' to the renderStudentsTable function */}
                                {renderStudentsTable(studentsOrganized[year]['IM'], 'IM', year)}
                                {renderStudentsTable(studentsOrganized[year]['MIAGE'], 'MIAGE (FI/FA)', year)}
                            </div>
                        )}
                    </div>
                ))
            ) : (
                <p>Aucun étudiant trouvé.</p>
            )}
        </div>
    );
}

export default StudentList;