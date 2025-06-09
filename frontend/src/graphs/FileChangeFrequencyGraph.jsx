import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import axios from "axios";

const extractPseudoFromEmail = (email) => {
  if (email.includes('+')) {
    return email.split('+')[1].split('@')[0];
  }
  return email.split('@')[0];
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="p-2 bg-white border rounded shadow-md">
      <p className="font-bold">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
};

const FileChangeFrequencyGraph = ({ analysisId }) => { // <- ajout prop ici
  const [data, setData] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      setData([]);
      setContributors([]);

      try {
        const response = await axios.get("http://localhost:3000/api/file-change-frequency", {
          params: { analysisId }, // envoyer analysisId si besoin
          withCredentials: true,
        });

        if (response.data.status === "success") {
          console.log(`Files changes ${analysisId} | `, response.data.analysisId);
          const rawData = response.data.data;
          const allContributors = new Set();

          const formattedData = Object.entries(rawData).map(([filename, info]) => {
            const fileEntry = { filename };

            for (const [email, count] of Object.entries(info.contributors)) {
              const pseudo = extractPseudoFromEmail(email);
              fileEntry[pseudo] = count;
              allContributors.add(pseudo);
            }

            return fileEntry;
          });

          setData(formattedData);
          setContributors(Array.from(allContributors));
        } else {
          throw new Error(response.data.error || "Unknown error");
        }
      } catch (err) {
        console.error("Error fetching file change frequency data:", err);
        setError(err.response?.data?.error || "Failed to load data.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [analysisId]); // relance fetch à chaque changement de analysisId

  const colors = [
    "#8884d8", "#82ca9d", "#ffc658", "#d88484", "#84c5d8", "#a784d8",
    "#d8b584", "#84d8a6", "#ff9b85", "#b884d8", "#a2d884", "#d884b5"
  ];
  const getColor = (index) => colors[index % colors.length];

  return (
    <>
      <h4>Modification des fichiers par contributeur</h4>

      {error && <div className="text-center text-red-600 italic mt-4">{error}</div>}
      {isLoading && <div className="text-center text-gray-600 italic mt-4">Loading file change frequency data...</div>}

      {!isLoading && !error && data.length === 0 && (
        <div className="text-center text-gray-600 italic mt-4">No file change frequency data available.</div>
      )}

      {!isLoading && !error && data.length > 0 && (
        <ResponsiveContainer width="100%" height={500}>
          <BarChart data={data} margin={{ top: 20, right: 10, left: 0, bottom: 50 }}>
            <XAxis dataKey="filename" hide />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            {contributors.map((pseudo, index) => (
              <Bar key={pseudo} dataKey={pseudo} stackId="a" fill={getColor(index)} name={pseudo} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </>
  );
};

export default FileChangeFrequencyGraph;
