// CommitActivityTimeline.jsx
import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import axios from 'axios';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
} from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale);

export default function CommitActivityTimeline({ analysisId }) {
  const [commitActivity, setCommitActivity] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false,
        text: 'Nombre de commits par jour',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
  };

  // Helper pour extraire un pseudo lisible depuis une adresse email
  const extractPseudoFromEmail = (email) => {
    if (email.includes('+')) {
      return email.split('+')[1].split('@')[0];
    }
    return email.split('@')[0];
  };

  const prepareChartData = (dataObj) => {
    const dates = Object.keys(dataObj).sort();
    const contributorsSet = new Set();

    // Collecter tous les pseudos pour construire les datasets
    for (const daily of Object.values(dataObj)) {
      for (const email of Object.keys(daily)) {
        contributorsSet.add(extractPseudoFromEmail(email));
      }
    }

    const contributors = Array.from(contributorsSet);

    // Initialiser les structures de données
    const labels = dates.map(dateStr => new Date(dateStr).toLocaleDateString());
    const totalCommitsPerDay = dates.map(dateStr =>
      Object.values(dataObj[dateStr]).reduce((sum, count) => sum + count, 0)
    );

    const contributorDataMap = {};
    for (const pseudo of contributors) {
      contributorDataMap[pseudo] = dates.map(dateStr => {
        const daily = dataObj[dateStr] || {};
        let total = 0;
        for (const [email, count] of Object.entries(daily)) {
          if (extractPseudoFromEmail(email) === pseudo) {
            total += count;
          }
        }
        return total;
      });
    }

    // Couleurs générées automatiquement
    const colorPalette = ['#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336', '#3F51B5', '#795548', '#009688'];
    const datasets = [
      {
        label: 'Total Commits',
        data: totalCommitsPerDay,
        borderColor: '#000000',
        borderWidth: 2,
        tension: 0.1,
      },
      ...contributors.map((pseudo, index) => ({
        label: pseudo,
        data: contributorDataMap[pseudo],
        borderColor: colorPalette[index % colorPalette.length],
        borderWidth: 1.5,
        borderDash: [4, 2],
        tension: 0.1,
      })),
    ];

    return { labels, datasets };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:3000/api/commit-activity-timeline', {
          withCredentials: true,
          params: { analysisId },
        });

        if (response.data.status === 'success') {
          const data = response.data.data || [];
          console.log(`Commit activity ${analysisId} | `, response.data.analysisId);
          setCommitActivity(data);
          setChartData(prepareChartData(data));
        } else {
          throw new Error(response.data.error || 'Unknown error');
        }
      } catch (err) {
        console.error('Error fetching commit activity data:', err);
        setError(err.response?.data?.error || 'Failed to load commit activity data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [analysisId]);

  return (
    <>
        <h4>
            Nombre de commits par jour
        </h4>
        <div className="commit-activity-timeline max-w-3xl mx-auto">
            {error && <div className="text-center text-red-600 italic mt-4">{error}</div>}
            {isLoading && <div className="text-center text-gray-600 italic mt-4">Loading commit activity data...</div>}
            {!isLoading && !error && commitActivity.length === 0 && (
                <div className="text-center text-gray-600 italic mt-4">No commit activity data available.</div>
            )}
            {!isLoading && chartData && <Line data={chartData} options={chartOptions} />}
        </div>
    </>
  );
}
