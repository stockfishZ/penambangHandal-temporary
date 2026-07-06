// ponytail: ultra mode. direct DOM insertion, no framework.
document.addEventListener('DOMContentLoaded', () => {
  const map = L.map('rsMap').setView([-2.0, 118.0], 5);
  
  // Dark mode map tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    maxZoom: 18
  }).addTo(map);

  const siteList = document.getElementById('siteList');
  const sites = window.NICKEL_SITES.features;

  const getTierColor = (tier) => {
    if (tier === 'HIGH') return '#9FD8BD';
    if (tier === 'MEDIUM') return '#E2A356';
    return '#ef4444';
  };

  sites.forEach((site) => {
    const props = site.properties;
    const coords = site.geometry.coordinates; // [lng, lat]
    
    // 1. Add marker to map
    const marker = L.circleMarker([coords[1], coords[0]], {
      radius: 8,
      fillColor: getTierColor(props.tier),
      color: '#fff',
      weight: 1,
      opacity: 0.8,
      fillOpacity: 0.8
    }).addTo(map);

    // Bind popup
    const popupContent = `
      <div style="font-family: 'Instrument Sans', sans-serif;">
        <h4 style="margin: 0 0 5px; color: #fff;">${props.name}</h4>
        <p style="margin: 0 0 10px; color: #aaa; font-size: 12px;">${props.province}</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; font-size: 12px;">
          <span style="color: #888;">Type:</span> <b style="color:#fff;">${props.type}</b>
          <span style="color: #888;">Tier:</span> <b style="color:${getTierColor(props.tier)};">${props.tier}</b>
        </div>
        <a href="terrain-analysis.html?id=${props.id}" class="btn btn-primary small" style="margin-top: 10px; display: block; text-align: center; text-decoration: none; font-size: 11px; padding: 6px;">Analisis Terrain &rarr;</a>
      </div>
    `;
    marker.bindPopup(popupContent);

    // 2. Add card to sidebar
    const card = document.createElement('div');
    card.className = 'rs-site-card';
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: start;">
        <h4 style="margin: 0; color: #fff;">${props.name}</h4>
        <span class="badge ${props.tier.toLowerCase()}">${props.tier}</span>
      </div>
      <p style="margin: 5px 0 0; color: #888; font-size: 12px;">${props.province}</p>
      <p style="margin: 5px 0 0; color: #aaa; font-size: 12px;">${props.context}</p>
    `;
    
    card.addEventListener('click', () => {
      map.setView([coords[1], coords[0]], 8);
      marker.openPopup();
    });

    siteList.appendChild(card);
  });
});
