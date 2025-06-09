import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

export default function HeatMapFileChanges({ analysisId }) {
  const svgRef = useRef(null);

  // Nettoie le pseudo à partir de l'email
  const extractPseudoFromEmail = (email) => {
    if (!email) return 'unknown';
    if (email.includes('+')) {
      return email.split('+')[1].split('@')[0];
    }
    return email.split('@')[0];
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await axios.get('http://localhost:3000/api/codebase-heatmap', {
          withCredentials: true,
          headers: { 'X-Analysis-ID': analysisId },
        });
        if (response.data.status === 'success' && response.data.data) {
          const fileChanges = response.data.data;
          if (typeof fileChanges === 'object' && Object.keys(fileChanges).length > 0) {
            const data = buildHierarchy(fileChanges);
            renderHeatmap(data);
          }
        }
      } catch (error) {
        console.error('Error fetching codebase heatmap data:', error);
      }
    }

    // Construire une hiérarchie à partir des données, on suppose fileChanges[file] = { totalChanges, contributors: {email: count, ...} }
    function buildHierarchy(fileChanges) {
      const root = { name: 'root', children: [] };

      Object.entries(fileChanges).forEach(([path, info]) => {
        const count = info.totalChanges || 0;
        const contributors = info.contributors || {};
        const parts = path.split('/');
        let current = root;

        parts.forEach((part, i) => {
          let child = current.children.find(c => c.name === part);
          if (!child) {
            child = {
              name: part,
              children: [],
              value: i === parts.length - 1 ? count : undefined,
              contributors: i === parts.length - 1 ? contributors : undefined,
            };
            current.children.push(child);
          }
          current = child;
        });
      });

      return root;
    }

    function renderHeatmap(data) {
      const width = 800;
      const height = 600;
      const svg = d3.select(svgRef.current);
      svg.selectAll('*').remove();

      svg.attr('width', width).attr('height', height);

      const root = d3.hierarchy(data)
        .sum(d => d.value || 0)
        .sort((a, b) => b.value - a.value);

      d3.treemap()
        .size([width, height])
        .padding(1)(root);

      const maxValue = d3.max(root.leaves(), d => d.value);
      const color = d3.scaleSequential()
        .domain([0, maxValue])
        .interpolator(d3.interpolate('#fff9c4', '#ff8a65'));

      // Tooltip div
      const tooltip = d3.select('body').append('div')
        .attr('class', 'tooltip-heatmap')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('opacity', 0)
        .style('background', 'rgba(0,0,0,0.7)')
        .style('color', '#fff')
        .style('padding', '6px 10px')
        .style('border-radius', '5px')
        .style('font-size', '12px')
        .style('max-width', '250px')
        .style('white-space', 'normal');

      svg.selectAll('rect')
        .data(root.leaves())
        .enter()
        .append('rect')
        .attr('x', d => d.x0)
        .attr('y', d => d.y0)
        .attr('width', d => d.x1 - d.x0)
        .attr('height', d => d.y1 - d.y0)
        .attr('fill', d => color(d.value))
        .on('mousemove', (event, d) => {
          const contributors = d.data.contributors || {};
          let contributorsList = '';
          // Trier par nombre de modifs décroissant
          const sortedContribs = Object.entries(contributors).sort((a, b) => b[1] - a[1]);
          sortedContribs.forEach(([email, count]) => {
            const pseudo = extractPseudoFromEmail(email);
            contributorsList += `<div>${pseudo}: ${count} changes</div>`;
          });

          tooltip
            .style('opacity', 1)
            .html(`
              <strong>${d.data.name}</strong><br/>
              Total Changes: ${d.value}<br/>
              <hr style="margin:4px 0; border-color: #fff3;" />
              <div>${contributorsList || 'No contributor data'}</div>
            `)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY + 10) + 'px');
        })
        .on('mouseout', () => {
          tooltip.style('opacity', 0);
        });

      svg.selectAll('text')
        .data(root.leaves())
        .enter()
        .append('text')
        .attr('x', d => d.x0 + 5)
        .attr('y', d => d.y0 + 15)
        .text(d => d.data.name)
        .attr('font-size', '10px')
        .attr('fill', '#090900')
        .attr('pointer-events', 'none')
        .style('user-select', 'none');
    }

    fetchData();

    return () => {
      d3.select('.tooltip-heatmap').remove();
    };
  }, [analysisId]);

  return (
    <div className="codebase-heatmap container">
      <h2>Codebase Heatmap</h2>
      <svg ref={svgRef} />
      <div className="legend">
        <span><span className="color-box low"></span> Low Changes</span>
        <span><span className="color-box medium"></span> Medium Changes</span>
        <span><span className="color-box high"></span> High Changes</span>
      </div>
      <i>Hover over the heatmap for more details</i>

    </div>
  );
}
