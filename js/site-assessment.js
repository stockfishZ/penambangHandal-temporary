// ponytail: ultra mode. straightforward dom manipulation using shared-sites.js
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const selectedId = urlParams.get('id') || 'sorowako';
  
  const siteSelect = document.getElementById('siteSelect');
  const sites = window.NICKEL_SITES.features;
  
  sites.forEach(site => {
    const opt = document.createElement('option');
    opt.value = site.properties.id;
    opt.textContent = site.properties.name;
    if (site.properties.id === selectedId) opt.selected = true;
    siteSelect.appendChild(opt);
  });

  siteSelect.addEventListener('change', (e) => {
    window.location.href = `site-assessment.html?id=${e.target.value}`;
  });

  const site = sites.find(s => s.properties.id === selectedId);
  if (!site) return;

  const props = site.properties;

  document.getElementById('siteTitle').textContent = `${props.name}, ${props.province}`;

  // Helper to color circles
  const setCircle = (id, score) => {
    const el = document.getElementById(id);
    el.textContent = score;
    el.className = 'score-circle'; // reset
    if (score >= 80) el.classList.add('green');
    else if (score >= 60) el.classList.add('yellow');
    else el.classList.add('red');
  };

  setCircle('scoreSafety', props.safety_score);
  setCircle('scoreProb', props.prob_score);
  setCircle('scoreWorth', props.worth_score);

  // Banner logic
  const banner = document.getElementById('overallBanner');
  banner.className = 'sa-banner'; // reset
  if (props.recommendation === 'GO') {
    banner.classList.add('banner-go');
    banner.textContent = 'REKOMENDASI: DEPLOY DRONE TEAM (GO)';
  } else if (props.recommendation === 'CONDITIONAL') {
    banner.classList.add('banner-cond');
    banner.textContent = 'REKOMENDASI: BERSYARAT (CONDITIONAL)';
  } else {
    banner.classList.add('banner-nogo');
    banner.textContent = 'REKOMENDASI: BATALKAN (NO-GO)';
  }

  // Populate details
  document.getElementById('detSlope').textContent = `${props.slope_mean}° (${props.terrain_class})`;
  document.getElementById('detRisk').textContent = props.safety_risks;
  document.getElementById('detGeol').textContent = props.context;
  document.getElementById('detConf').textContent = props.prob_conf;
  document.getElementById('detCapex').textContent = props.worth_est;
});
