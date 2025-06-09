import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

// IMPORTS NÉCESSAIRES POUR QTIP2
import $ from 'jquery';
import 'qtip2/dist/jquery.qtip.css';
import 'qtip2';

import qtip from 'cytoscape-qtip';

import { truncate } from '../utils/stringUtils';

cytoscape.use(dagre);
cytoscape.use(qtip);

export default function CodeEvolution({ analysisId }) {
  const containerRef = useRef(null);
  const cyRef = useRef(null); // pour garder référence à Cytoscape
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [elements, setElements] = useState([]);

  // Nettoyage avant chaque nouveau fetch (reset des états)
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setElements([]);
  }, [analysisId]);

  // Fetch des données à chaque changement de analysisId
  useEffect(() => {
    if (!analysisId) return;

    let isCancelled = false;

    async function fetchData() {
      try {
        const response = await axios.get('http://localhost:3000/api/code-evolution', {
          withCredentials: true,
          params: { analysisId },
        });
        if (isCancelled) return;

        if (response.data.status === 'success') {
          const commits = response.data.data || [];
          const eles = buildCytoscapeElements(commits);
          setElements(eles);
          setError(null);
          console.log(`Code evolution ${analysisId} | `, response.data.analysisId);
        } else {
          throw new Error(response.data.error || 'Unknown error');
        }
      } catch (err) {
        if (isCancelled) return;
        console.error('Error fetching code evolution data:', err);
        setError(err.response?.data?.error || 'Failed to load code evolution data.');
        setElements([]);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }

    fetchData();

    return () => {
      isCancelled = true;
    };
  }, [analysisId]);

  // Initialisation du graphe Cytoscape à chaque fois que elements change OU analysisId change
  useEffect(() => {
    if (!containerRef.current) return;

    if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
    }

    if (isLoading || error || elements.length === 0) return;

    const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: [
        {
            selector: 'node',
            style: {
            'background-color': '#2196f3',
            'label': 'data(label)',
            'font-size': 10,
            'text-valign': 'center',
            'text-halign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': 80,
            'color': '#fff',
            'width': 50,
            'height': 50,
            'border-width': 1,
            'border-color': '#0b4a82',
            },
        },
        {
            selector: 'edge',
            style: {
            'width': 2,
            'line-color': '#ccc',
            'target-arrow-color': '#ccc',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            },
        },
        ],
        layout: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep: 50,
        edgeSep: 10,
        rankSep: 100,
        },
    });

    // Ajouter tooltips avec qTip
    cy.nodes().forEach((node) => {
        const fullLabel = node.data('fullLabel');
        const author = node.data('author');
        const dateStr = node.data('date');
        const date = dateStr ? new Date(dateStr).toLocaleString() : 'Unknown date';

        const qtipContent = `
        <div style="max-width: 250px;">
            <strong>Commit message:</strong><br/>
            ${fullLabel}<br/><br/>
            <strong>Author:</strong> ${author}<br/>
            <strong>Date:</strong> ${date}
        </div>
        `;

        node.qtip({
        content: { text: qtipContent },
        show: { event: 'mouseover' },
        hide: { event: 'mouseout' },
        position: { my: 'top center', at: 'bottom center' },
        style: {
            classes: 'qtip-bootstrap',
            tip: {
            width: 16,
            height: 8,
            },
        },
        });
    });

    cy.fit(undefined, 50);
    cy.center();

    cyRef.current = cy;

    return () => {
        cy.destroy();
        cyRef.current = null;
    };
    }, [analysisId, isLoading, error, elements]);


  if (isLoading) {
    return <div className="text-center text-gray-600 italic mt-4">Loading code evolution graph...</div>;
  }
  if (error) {
    return <div className="text-center text-red-600 italic mt-4">{error}</div>;
  }
  if (elements.length === 0) {
    return <div className="text-center text-gray-600 italic mt-4">No code evolution data available.</div>;
  }

  return (
    <>
      <h4>Arborescence</h4>
      <div className="code-evolution-container">
        <div
          id="code-evolution-graph"
          ref={containerRef}
          style={{ width: '100%', height: '400px', border: '1px solid #eee', borderRadius: '8px' }}
        />
      </div>
    </>
  );
}

function buildCytoscapeElements(commits) {
  const elements = [];
  const nodeAdded = new Set();

  const commitMap = new Map();
  commits.forEach(c => commitMap.set(c.sha, c));

  commits.forEach((c) => {
    if (!nodeAdded.has(c.sha)) {
      nodeAdded.add(c.sha);
      elements.push({
        data: {
          id: c.sha,
          label: truncate(c.message, 20),
          fullLabel: c.message,
          author: c.author.name,
          date: c.author.date,
        },
      });
    }
    if (Array.isArray(c.parents)) {
      c.parents.forEach((parentSha) => {
        if (commitMap.has(parentSha)) {
          elements.push({
            data: {
              id: `${parentSha}-${c.sha}`,
              source: parentSha,
              target: c.sha,
            },
          });
        }
      });
    }
  });

  return elements;
}
