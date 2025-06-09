// src/components/Toolbar.jsx

import React, { useState } from 'react';
import '../style/Toolbar.css';
import logo from '../assets/logo_gitA.png';
// FIX THIS LINE:
import { Link, useNavigate } from 'react-router-dom'; // Import useNavigate directly

function Toolbar() {
    const [isClassesDropdownOpen, setIsClassesDropdownOpen] = useState(false);
    const [isDashboardDropdownOpen, setIsDashboardDropdownOpen] = useState(false);
    const [auditUrl, setAuditUrl] = useState(''); // State for the audit URL input
    const [auditMessage, setAuditMessage] = useState(''); // State for feedback messages
    const navigate = useNavigate(); // Now this correctly calls the useNavigate hook

    const toggleClassesDropdown = () => {
        setIsClassesDropdownOpen(!isClassesDropdownOpen);
        setIsDashboardDropdownOpen(false);
    };

    const toggleDashboardDropdown = () => {
        setIsDashboardDropdownOpen(!isDashboardDropdownOpen);
        setIsClassesDropdownOpen(false);
    };

    const closeAllDropdowns = () => {
        setIsClassesDropdownOpen(false);
        setIsDashboardDropdownOpen(false);
    };

    const handleLaunchAudit = async () => {
        if (!auditUrl) {
            setAuditMessage('Veuillez entrer une URL valide.');
            return;
        }

        setAuditMessage('Lancement de l\'audit en cours...');

        try {
            const response = await fetch('http://127.0.0.1:5000/api/audit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ repo_url: auditUrl }),
            });

            if (response.ok) {
                const data = await response.json();
                console.log("Toolbar Debug: Full API Response Data:", data);
                console.log("Toolbar Debug: data.result before navigation:", data.result);

                navigate('/audit-report', { state: { auditData: data.result } });
                setAuditUrl('');
                setAuditMessage('');
            } else {
                const errorData = await response.json();
                setAuditMessage(`Erreur lors de l'audit: ${errorData.message?.repo_url || errorData.error || response.statusText}`);
            }
        } catch (error) {
            console.error('Erreur réseau ou du serveur:', error);
            setAuditMessage(`Erreur de connexion: ${error.message}`);
        }
    };

    return (
        <nav className="toolbar">
            <div className="toolbar-left">
                <Link to="/" className="toolbar-logo" onClick={closeAllDropdowns}>
                    <img src={logo} alt="Mon Application Logo" className="toolbar-logo-img" />
                </Link>
                <ul className="toolbar-nav-left-items">
                    <li className="audit-section">
                        <input
                            type="text"
                            placeholder="Lien du dépôt Git (ex: github.com/user/repo)"
                            value={auditUrl}
                            onChange={(e) => setAuditUrl(e.target.value)}
                            className="audit-input"
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleLaunchAudit();
                                }
                            }}
                        />
                        <button onClick={handleLaunchAudit} className="audit-button">
                            Analyse
                        </button>
                        {auditMessage && <span className="audit-message">{auditMessage}</span>}
                    </li>
                </ul>
            </div>
            <ul className="toolbar-nav">
                <li className="dropdown">
                    <span onClick={toggleClassesDropdown} className="dropdown-toggle">
                        Mes classes
                    </span>
                    {isClassesDropdownOpen && (
                        <ul className="dropdown-menu">
                            <li>
                                <Link to="/classes/groups" onClick={closeAllDropdowns}>Groupes - Projet</Link>
                            </li>
                            <li>
                                <Link to="/classes/students" onClick={closeAllDropdowns}>Classes - TDs</Link>
                            </li>
                        </ul>
                    )}
                </li>

                <li className="dropdown">
                    <span onClick={toggleDashboardDropdown} className="dropdown-toggle">
                        Tableau de bord
                    </span>
                    {isDashboardDropdownOpen && (
                        <ul className="dropdown-menu">
                            <li>
                                <Link to="/dashboard" onClick={closeAllDropdowns}>Vue Générale</Link>
                            </li>
                        </ul>
                    )}
                </li>
            </ul>
        </nav>
    );
}

export default Toolbar;
