import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';

import Toolbar from './components/Toolbar'; // Import your Toolbar
import Dashboard from './components/Dashboard';
import StudentForm from './components/StudentForm'; // You might not use this directly in routes but good to keep if needed elsewhere
import GroupList from './components/GroupList';
import './style/App.css';
import StudentProfile from './components/StudentProfile'; // Import your StudentProfile component
import StudentList from './components/StudentList';
import GroupAnalysis from './components/GroupAnalysis'; 
import AuditResultsDisplay from './components/AuditDisplay';

// Define your HomePage component, as it's used in your routes
// If this is a separate file, then import it: import HomePage from './components/HomePage';
const HomePage = () => <h2>Bienvenue sur l'Accueil!</h2>;


function AuditReportPage() {
  const { state } = useLocation();
  const auditResult = state?.auditData; // This is how you access the passed data

  // --- ADD THESE CONSOLE LOGS ---
  console.log("AuditReportPage Debug: State received from navigation:", state);
  console.log("AuditReportPage Debug: Extracted auditResult:", auditResult);
  // -------------------------------

  return (
    <div className="page-content">
      <AuditResultsDisplay auditResult={auditResult} />
    </div>
  );
}

function App() {
    return (
        <div className="App">
            <header className="App-header">
                <Router>
                    <Toolbar />
                    <div className="main-content">
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/classes/groups" element={<GroupList />} />
                            <Route path="/classes/students" element={<StudentList />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/students/:id" element={<StudentProfile />} />
                            <Route path="/group-analysis/groups/:id" element={<GroupAnalysis />} />
                            <Route path="/audit-report" element={<AuditReportPage/>} />
                            <Route path="*" element={<div>404 - Page Not Found</div>} />

                        </Routes>
                    </div>
                </Router>
            </header>
            <main>
            </main>
        </div>
    );
}

export default App;