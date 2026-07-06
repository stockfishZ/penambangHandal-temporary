// ponytail: ultra mode. pre-cached data, basic Plotly synth generation for 3D terrain to match parameters.
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const selectedId = urlParams.get('id') || 'sorowako';
  
  const siteSelect = document.getElementById('siteSelect');
  const sites = window.NICKEL_SITES.features;
  
  sites.forEach(site => {
    const opt = document.createElement('option');
    opt.value = site.properties.id;
    opt.textContent = site.properties.name + ' (' + site.properties.province + ')';
    if (site.properties.id === selectedId) opt.selected = true;
    siteSelect.appendChild(opt);
  });

  siteSelect.addEventListener('change', (e) => {
    window.location.href = `terrain-analysis.html?id=${e.target.value}`;
  });

  const site = sites.find(s => s.properties.id === selectedId);
  if (!site) return;

  const props = site.properties;
  const coords = site.geometry.coordinates; // [lng, lat]

  // Update UI Stats
  document.getElementById('elMean').textContent = `${props.elevation_mean} mdpl`;
  document.getElementById('elMax').textContent = `${props.elevation_max} mdpl`;
  document.getElementById('elMin').textContent = `${props.elevation_min} mdpl`;
  document.getElementById('slopeMean').textContent = `${props.slope_mean}°`;
  document.getElementById('roughness').textContent = props.roughness;
  document.getElementById('terrainClass').textContent = props.terrain_class;
  document.getElementById('assessBtn').href = `site-assessment.html?id=${props.id}`;

  // Map
  const map = L.map('demMap').setView([coords[1], coords[0]], 13);
  L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map style: &copy; OpenTopoMap'
  }).addTo(map);

  L.marker([coords[1], coords[0]]).addTo(map)
    .bindPopup(`<b>${props.name}</b><br>Pusat Prospek`)
    .openPopup();

  // Procedural Remote Sensing Polygons
  // 1. Batas Ultramafik (Host rock)
  const ultramaficBounds = [
    [coords[1] + 0.02, coords[0] - 0.02],
    [coords[1] + 0.03, coords[0] + 0.01],
    [coords[1] + 0.01, coords[0] + 0.03],
    [coords[1] - 0.02, coords[0] + 0.02],
    [coords[1] - 0.03, coords[0] - 0.01],
    [coords[1] - 0.01, coords[0] - 0.03]
  ];
  const ultraLayer = L.polygon(ultramaficBounds, {color: '#8b5cf6', fillColor: '#8b5cf6', fillOpacity: 0.1, weight: 2}).addTo(map);
  ultraLayer.bindTooltip("Batas Formasi Ultramafik", {permanent: true, direction: "center", className: "transparent-tooltip"});

  // 2. Zona Anomali (Vegetation Stress / Fe Oxide proxy)
  const anomalyBounds = [
    [coords[1] + 0.01, coords[0] - 0.01],
    [coords[1] + 0.015, coords[0] + 0.005],
    [coords[1] + 0.005, coords[0] + 0.015],
    [coords[1] - 0.01, coords[0] + 0.01],
    [coords[1] - 0.015, coords[0] - 0.005]
  ];
  const anomalyLayer = L.polygon(anomalyBounds, {color: '#f43f5e', fillColor: '#f43f5e', fillOpacity: 0.3, weight: 1, dashArray: "4 4"}).addTo(map);
  anomalyLayer.bindTooltip("Anomali Penginderaan Jauh (Laterit Expose)", {sticky: true});

  // Layer control
  L.control.layers(null, {
    "<span style='color:#8b5cf6;font-weight:bold;'>Batas Ultramafik (Geologi)</span>": ultraLayer,
    "<span style='color:#f43f5e;font-weight:bold;'>Anomali Laterit (Remote Sensing)</span>": anomalyLayer
  }, {collapsed: false}).addTo(map);

  // Plotly 3D Terrain (Synthesize realistic terrain and compute slopes)
  const size = 40; // higher res grid
  const zData = [];
  const slopeColorData = [];
  let optimalAreaCount = 0;
  const totalArea = size * size;

  for (let i = 0; i < size; i++) {
    const zRow = [];
    for (let j = 0; j < size; j++) {
      // Perlin-style noise combination
      const dx = (i - size/2) / (size/4);
      const dy = (j - size/2) / (size/4);
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      const wave1 = Math.sin(dx * 1.5) * Math.cos(dy * 1.5) * 15;
      const wave2 = Math.sin(dx * 3 + 2) * Math.cos(dy * 3 + 1) * 5;
      const mountain = (props.elevation_max - props.elevation_mean) * Math.max(0, 1 - dist*0.4);
      
      let baseHeight = props.elevation_mean + mountain + wave1 + wave2;
      zRow.push(Math.max(props.elevation_min, baseHeight));
    }
    zData.push(zRow);
  }

  // Compute slopes for predictive color mapping
  for (let i = 0; i < size; i++) {
    const cRow = [];
    for (let j = 0; j < size; j++) {
      let dzdx = 0;
      let dzdy = 0;
      if (i > 0 && i < size - 1) dzdx = (zData[i+1][j] - zData[i-1][j]) / 2;
      if (j > 0 && j < size - 1) dzdy = (zData[i][j+1] - zData[i][j-1]) / 2;
      
      // Compute slope angle in degrees
      const slope = Math.atan(Math.sqrt(dzdx*dzdx + dzdy*dzdy)) * (180 / Math.PI);
      
      // Optimal laterite formation is 5 - 15 degrees
      let prospectivity = 0; 
      if (slope > 5 && slope < 15) {
        prospectivity = 1; // High potential (Red)
        optimalAreaCount++;
      } else if (slope >= 15 && slope < 25) {
        prospectivity = 0.5; // Marginal (Yellow)
      } else {
        prospectivity = 0; // Poor (Blue/Flat or Cliff)
      }
      
      cRow.push(prospectivity);
    }
    slopeColorData.push(cRow);
  }

  // Add optimal area insight to UI sidebar
  const pctOptimal = Math.round((optimalAreaCount / totalArea) * 100);
  const insightDiv = document.createElement('div');
  insightDiv.className = 'stat-row';
  insightDiv.style.marginTop = '15px';
  insightDiv.style.borderTop = '2px dashed var(--accent-emerald)';
  insightDiv.style.paddingTop = '15px';
  insightDiv.innerHTML = `<span style="color:#9FD8BD">Target Ideal (Slope 5°-15°)</span><b style="color:#9FD8BD; font-size:16px;">${pctOptimal}% Area</b>`;
  document.getElementById('terrainClass').parentElement.after(insightDiv);

  const data = [{
    z: zData,
    surfacecolor: slopeColorData, // Map the color to the computed slope prospectivity
    type: 'surface',
    colorscale: [
      [0, '#0e1525'],    // 0 = Blue/Dark (Poor - too flat or too steep)
      [0.5, '#E2A356'],  // 0.5 = Yellow/Gold (Marginal)
      [1, '#f43f5e']     // 1 = Red (Optimal slope for Laterite)
    ],
    showscale: true,
    colorbar: {
      title: 'Potensi Laterit (Kemiringan)',
      titleside: 'right',
      tickvals: [0, 0.5, 1],
      ticktext: ['Rendah (<5° atau >25°)', 'Sedang (15°-25°)', 'Tinggi (5°-15°)'],
      tickfont: {color: '#EEEAE0', size: 10},
      titlefont: {color: '#EEEAE0', size: 12}
    },
    hovertemplate: 'Elevasi: %{z:.1f} m<br>Potensi: %{surfacecolor:.1f}<extra></extra>'
  }];

  const layout = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { l: 0, r: 0, b: 0, t: 0 },
    scene: {
      xaxis: { showgrid: false, zeroline: false, visible: false },
      yaxis: { showgrid: false, zeroline: false, visible: false },
      zaxis: { showgrid: true, gridcolor: 'rgba(255,255,255,0.1)' },
      camera: { eye: {x: 1.5, y: 1.5, z: 1.2} }
    }
  };

  Plotly.newPlot('plotly3d', data, layout, {responsive: true, displayModeBar: false});
});
