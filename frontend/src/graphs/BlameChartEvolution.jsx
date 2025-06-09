import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

function processBlameData(rawData) {
  const dates = Object.keys(rawData).sort();
  const authorsSet = new Set();

  dates.forEach((date) => {
    const dailyData = rawData[date];
    Object.keys(dailyData).forEach((author) => authorsSet.add(author));
  });

  const authors = Array.from(authorsSet);

  return dates.map((date) => {
    const entry = { date };
    let total = 0;
    authors.forEach((author) => {
      const value = rawData[date]?.[author] || 0;
      entry[author] = value;
      total += value;
    });
    entry.total = total;
    return entry;
  });
}

export default function BlameChartEvolution({ analysisId }) {
  const [data, setData] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!analysisId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get('http://localhost:3000/api/blame-evolution', {
          params: { analysisId },
        });

        if (res.data.status === 'success') {
          const processed = processBlameData(res.data.data);
          setData(processed);
          setError(null);
        } else {
          throw new Error(res.data.error || 'Unknown error');
        }
      } catch (err) {
        console.error('Failed to fetch blame data:', err);
        setError('Failed to load blame chart evolution.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [analysisId]);

  if (loading) return <div className="italic text-gray-600 mt-4">Loading blame evolution...</div>;
  if (error) return <div className="text-red-600 italic mt-4">{error}</div>;
  if (data.length === 0) return <div className="italic text-gray-600 mt-4">No blame data available.</div>;

  const authors = Object.keys(data[0]).filter((k) => k !== 'date' && k !== 'total');

  const COLORS = [
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff8042',
    '#8dd1e1',
    '#a4de6c',
    '#d0ed57',
    '#d88484',
    '#9c87ff',
    '#84d8c4',
  ];

  return (
    <div>
      <h4 className="mb-2">Répartition du code par auteur dans le temps</h4>
      <ResponsiveContainer width="100%" height={400}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis tickFormatter={(v) => v} />
          <Tooltip formatter={(value, name) => [value, name]} />
          {authors.map((author, idx) => (
            <Area
              key={author}
              type="monotone"
              dataKey={author}
              stackId="1"
              stroke={COLORS[idx % COLORS.length]}
              fill={COLORS[idx % COLORS.length]}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
