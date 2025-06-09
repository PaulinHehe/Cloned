import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// Define a consistent set of colors for the TD segments
const TD_COLORS = [
  '#6a0572', // Dark Violet
  '#00a878', // Medium Sea Green
  '#f8e1a0', // Light Gold
  '#d1495b', // Ruby Red
  '#3a86ff', // Bright Blue
  '#ffbe0b', // Amber
  '#fb5607', // Orange
  '#8338ec', // Purple
  '#3d348b', // Dark Blue-Violet
  '#c7f2a4', // Pale Green
  '#ff006e', // Rose
  '#a31a5e', // Dark Pink
  // Add more colors if you anticipate more than 12 TDs per student
];

// Custom Tooltip component for better display of TD scores
const CustomClassScoreTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length) return null;

  const studentFullName = label;

  return (
    <div className="p-2 bg-white border rounded shadow-md">
      <p className="font-bold text-md mb-1">{studentFullName}</p>
      {/* Find the actual total score from the payload to display it */}
      <p className="text-sm text-gray-700 mb-2">
        Score Global: {payload.find(entry => entry.dataKey === 'total_score_display')?.value || 'N/A'}
      </p>
      {payload.map((entry, index) => {
        // Only show actual TD scores that are not the placeholder or total display
        // Ensure the value is positive as hidden bars have 0 value
        if (entry.name && entry.name.startsWith('TD_') && entry.value > 0) {
          return (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              TD {entry.name.replace('TD_', '').replace('_score', '')}: {entry.value}
            </p>
          );
        }
        return null;
      })}
    </div>
  );
};

/**
 * ClassScore component to display a stacked bar chart of student scores.
 * Each student has a vertical bar, with segments representing individual TD scores.
 *
 * @param {object} props - The component props.
 * @param {object} props.classScores - An object containing student score data,
 * structured as { "Student Name": { TDs: { "TD Date": { score: number, ... } }, global_score: number, ... } }.
 * This should be the filtered and transformed data from Dashboard.jsx.
 */
const ClassScore = ({ classScores }) => {
  const [hiddenStudents, setHiddenStudents] = useState(new Set());

  if (!classScores || Object.keys(classScores).length === 0) {
    return <div className="no-data-text">Aucune donnée de score de classe disponible pour le graphique.</div>;
  }

  // Memoize the base chart data transformation
  const baseChartData = useMemo(() => {
    return Object.entries(classScores).map(([studentFullName, studentData]) => {
      const studentChartEntry = {
        name: studentFullName,
        total_score_display: studentData.score_global,
        // Store all TD scores
        ...Object.entries(studentData.TDs).reduce((acc, [tdDate, tdInfo]) => {
          acc[`TD_${tdDate}_score`] = tdInfo.score;
          return acc;
        }, {}),
      };
      return studentChartEntry;
    });
  }, [classScores]);

  // Determine all unique TD keys
  const allTdKeys = useMemo(() => {
    const keys = new Set();
    baseChartData.forEach(studentEntry => {
      for (const key in studentEntry) {
        if (key.startsWith('TD_') && key.endsWith('_score')) {
          keys.add(key);
        }
      }
    });
    return Array.from(keys).sort();
  }, [baseChartData]);

  // Prepare the data to be rendered by Recharts, incorporating hidden state
  const renderedChartData = useMemo(() => {
    return baseChartData.map(studentEntry => {
      const isHidden = hiddenStudents.has(studentEntry.name);
      // Create a copy to avoid mutating baseChartData
      const newEntry = { ...studentEntry, isHidden: isHidden };

      if (isHidden) {
        // If hidden, set TD scores to 0 so they don't contribute to stack height for Y-axis calculation
        allTdKeys.forEach(tdKey => {
          newEntry[tdKey] = 0;
        });
      }
      return newEntry;
    });
  }, [baseChartData, hiddenStudents, allTdKeys]);

  // Calculate max Y-axis value ONLY for visible students' total scores
  // This now explicitly applies the 110% buffer
  const maxVisibleScore = useMemo(() => {
    let max = 0;
    renderedChartData.forEach(studentEntry => {
      if (!studentEntry.isHidden) {
        max = Math.max(max, studentEntry.total_score_display || 0);
      }
    });
    // Apply the 110% buffer here
    return 100; // Default to 100 if no visible scores
  }, [renderedChartData]);


  // Function to handle bar click
  const handleBarClick = (studentPayload) => {
    const clickedStudentName = studentPayload.name;

    setHiddenStudents(prevHiddenStudents => {
      const newHiddenStudents = new Set(prevHiddenStudents);
      if (newHiddenStudents.has(clickedStudentName)) {
        newHiddenStudents.delete(clickedStudentName); // Unhide
      } else {
        newHiddenStudents.add(clickedStudentName); // Hide
      }
      return newHiddenStudents;
    });
  };

  // Custom shape for the bar segments
  const CustomBarShape = (props) => {
    const { x, y, width, height, fill, payload } = props;
    const isHidden = payload.isHidden;

    // These values should ideally come from chart/container props for robustness
    // but for a fixed height ResponsiveContainer, they work.
    const topMargin = 20; // Matches margin.top for BarChart
    const markerHeight = 5;

    // The y-coordinate where the marker should appear (relative to the chart's svg origin)
    // This places the marker at the top of the chart's plot area.
    const markerYPosition = topMargin;

    if (isHidden) {
      return (
        <g onClick={() => handleBarClick(payload)} style={{ cursor: 'pointer' }}>
          <rect
            x={x}
            y={markerYPosition} // Fixed position near the top of the chart
            width={width}
            height={markerHeight}
            rx={2}
            ry={2}
            fill="#CCCCCC" // Gray color
            opacity={1} // Fully visible
          />
        </g>
      );
    } else {
      return (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={fill}
          onClick={() => handleBarClick(payload)} // Pass the full payload here
          style={{ cursor: 'pointer' }}
        />
      );
    }
  };


  return (
    <div className="chart-container">
      <h3>Scores des étudiants par TD</h3>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={renderedChartData} // Use the data that's modified for hidden state
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <XAxis
            dataKey="name"
            interval={0}
            angle={-45}
            textAnchor="end"
            height={80}
            tickFormatter={() => ''} // Keep names hidden
          />
          <YAxis
            label={{ value: 'Score', angle: -90, position: 'insideLeft' }}
            domain={[0, maxVisibleScore]} // Dynamic domain based on visible scores
          />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<CustomClassScoreTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />

          {/* Render the actual TD score bars */}
          {allTdKeys.map((tdKey, index) => {
            const tdDate = tdKey.replace('TD_', '').replace('_score', '');
            const tdDisplayName = `TD ${tdDate}`;

            return (
              <Bar
                key={tdKey}
                dataKey={tdKey}
                stackId="a" // All bars stack on the same "a" ID
                fill={TD_COLORS[index % TD_COLORS.length]}
                name={tdDisplayName}
                shape={<CustomBarShape />} // Use custom shape for all bars
                isAnimationActive={true} // Enable animation for smooth transitions
              />
            );
          })}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ClassScore;