import React, { useState } from 'react';

function StudentForm() {
    const [name, setName] = useState('');
    const [groupId, setGroupId] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        await fetch('http://localhost:5000/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students: [{ name, group_id: groupId }] })
        });
        alert("Élève ajouté !");
    };

    return (
        <div>
            <h3>Ajouter un Élève</h3>
            <form onSubmit={handleSubmit}>
                <input 
                    type="text" 
                    placeholder="Nom de l'élève" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    required 
                />
                <input 
                    type="number" 
                    placeholder="ID du Groupe" 
                    value={groupId} 
                    onChange={(e) => setGroupId(e.target.value)} 
                    required 
                />
                <button type="submit">Ajouter</button>
            </form>
        </div>
    );
}

export default StudentForm;
