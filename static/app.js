const METRICS = {
  population:        '총 인구수',
  korean:            '한국인',
  foreign_pop:       '외국인',
  senior:            '고령자(65세+)',
  cctv:              'CCTV 총계',
  cctv_growth_rate:  '최근 CCTV 증가율(%)',
};
const state = { metric: 'population', order: 'desc', year: '2014', data: [] };
let barChart, scatterChart, growthChart, growthYearChart, yearChart;
const fmt = n => typeof n === 'number' ? n.toLocaleString('ko-KR') : n;

async function load() {
  const res = await fetch('/api/districts');
  state.data = (await res.json()).districts;
  render();
}

function makeButtons(id, entries, key) {
  const el = document.getElementById(id);
  el.innerHTML = '';
  entries.forEach(([value, label]) => {
    const b = document.createElement('button');
    b.innerHTML = `<strong>${label}</strong>`;
    b.classList.add('target-btn-30');
    if (state[key] === value) {
      b.classList.add('on');
    }
    b.onclick = () => { state[key] = value; render(); };
    el.append(b);
  });
}

function renderKpis() {
  const d = state.data, total = d.reduce((s, r) => s + r.population, 0);
  const max = d.reduce((a, b) => (a.population > b.population ? a : b));
  const min = d.reduce((a, b) => (a.population < b.population ? a : b));
  const avgGrowth = (d.reduce((s, r) => s + r.cctv_growth_rate, 0) / d.length).toFixed(1);
  
  document.getElementById('kpis').innerHTML = [
    ['서울 전체 인구(25개 구)', fmt(total) + '명'],
    ['인구 최다', `${max.name} ${fmt(max.population)}`],
    ['인구 최소', `${min.name} ${fmt(min.population)}`],
    ['평균 최근 CCTV 증가율', `${avgGrowth}%`],
  ].map(([a, b]) => `<div class="kpi"><span>${a}</span><b>${b}</b></div>`).join('');
}

function renderBar() {
  const k = state.metric;
  const rows = [...state.data].sort((a, b) => state.order === 'desc' ? b[k] - a[k] : a[k] - b[k]);
  document.getElementById('barTitle').textContent = `구별 ${METRICS[k]}`;
  barChart?.destroy();
  barChart = new Chart(document.getElementById('barChart'), {
    type: 'bar',
    data: { labels: rows.map(r => r.name), datasets: [{ data: rows.map(r => r[k]), backgroundColor: '#2f6bff', borderRadius: 4 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${METRICS[k]}: ${fmt(c.raw)}${k === 'cctv_growth_rate' ? '%' : ''}` } } },
      scales: {
        x: {
          ticks: {
            color: '#010736',
            font: { size: 16, weight: 'bold' }
          }
        },
        y: {
          ticks: {
            color: '#010736',
            font: { size: 18, weight: 'bold' }
          }
        }
      }
    },
  });
}

function renderScatter() {
  const pts = state.data.map(r => ({ x: r.population, y: r.cctv, name: r.name }));
  scatterChart?.destroy();
  scatterChart = new Chart(document.getElementById('scatterChart'), {
    type: 'scatter',
    data: { datasets: [{ data: pts, backgroundColor: '#2f6bff', pointRadius: 6, pointHoverRadius: 9 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: {
        title: c => c[0].raw.name,
        label: c => [`인구 ${fmt(c.raw.x)}명`, `CCTV ${fmt(c.raw.y)}대`],
      } } },
      scales: {
        x: {
          ticks: { color: '#010736', font: { size: 14, weight: 'bold' } },
          title: { display: true, text: '인구수', color: '#010736', font: { size: 16, weight: 'bold' } }
        },
        y: {
          ticks: { color: '#010736', font: { size: 14, weight: 'bold' } },
          title: { display: true, text: 'CCTV 수', color: '#010736', font: { size: 16, weight: 'bold' } }
        }
      },
    },
  });
}

function renderGrowthChart() {
  const rows = [...state.data].sort((a, b) => b.cctv_growth_rate - a.cctv_growth_rate);
  const labels = rows.map(r => r.name);
  const data = rows.map(r => r.cctv_growth_rate);
  growthChart?.destroy();
  growthChart = new Chart(document.getElementById('growthChart'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: '#ff7f0e', borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw}%` } } },
      scales: {
        x: { ticks: { color: '#010736', font: { size: 16, weight: 'bold' } } },
        y: { ticks: { color: '#010736', font: { size: 14, weight: 'bold' } } }
      }
    }
  });
}

function renderGrowthYearChart() {
  const year = state.year;
  const rows = [...state.data].map(r => {
    const cur = r['cctv_' + year] || 0;
    let prev;
    if (year === '2014') prev = r.cctv_pre2013;
    else if (year === '2015') prev = r.cctv_2014;
    else if (year === '2016') prev = r.cctv_2015;
    else prev = 0;
    const growth = prev > 0 ? Math.round((cur / prev) * 100) : 0;
    return { name: r.name, growth };
  }).sort((a, b) => b.growth - a.growth);
  const labels = rows.map(r => r.name);
  const data = rows.map(r => r.growth);
  growthYearChart?.destroy();
  growthYearChart = new Chart(document.getElementById('growthChart'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ data: data, backgroundColor: '#ff7f0e', borderRadius: 4 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw}%` } } },
      scales: {
        x: { ticks: { color: '#010736', font: { size: 16, weight: 'bold' } } },
        y: { ticks: { color: '#010736', font: { size: 14, weight: 'bold' } } }
      }
    }
  });
}

function renderYearChart() {
  const rows = [...state.data];
  const labels = rows.map(r => r.name);
  const popData = rows.map(r => r.population);
  const cctvData = rows.map(r => r['cctv_' + state.year] || 0);
  yearChart?.destroy();
  yearChart = new Chart(document.getElementById('cctvYearChart'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: METRICS.population, data: popData, backgroundColor: '#2f6bff' },
        { label: METRICS.cctv, data: cctvData, backgroundColor: '#ff7f0e' }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { stacked: true, ticks: { color: '#010736', font: { size: 16, weight: 'bold' } } },
        y: { stacked: true, ticks: { color: '#010736', font: { size: 14, weight: 'bold' } } }
      }
    }
  });
}

function renderCctvTable() {
  const container = document.getElementById('cctvTableWrap');
  if (!container) return;
  
  const rows = [...state.data].sort((a, b) => b.cctv_growth_rate - a.cctv_growth_rate);
  let html = `
    <table class="cctv-table">
      <thead>
        <tr>
          <th>구 이름</th>
          <th>2013년 이전</th>
          <th>2014년</th>
          <th>2015년</th>
          <th>2016년</th>
          <th>CCTV 총계</th>
          <th>최근 3년 증가율 (%)</th>
        </tr>
      </thead>
      <tbody>
  `;
  rows.forEach(r => {
    html += `
      <tr>
        <td><strong>${r.name}</strong></td>
        <td>${fmt(r.cctv_pre2013)}대</td>
        <td>${fmt(r.cctv_2014)}대</td>
        <td>${fmt(r.cctv_2015)}대</td>
        <td>${fmt(r.cctv_2016)}대</td>
        <td><strong>${fmt(r.cctv)}대</strong></td>
        <td><span class="growth-badge">${r.cctv_growth_rate}%</span></td>
      </tr>
    `;
  });
  html += `</tbody></table>`;
  container.innerHTML = html;
}

function render() {
  makeButtons('metricBtns', Object.entries(METRICS), 'metric');
  makeButtons('orderBtns', [['desc', '많은 순'], ['asc', '적은 순']], 'order');
  makeButtons('yearBtns', [['2014','2014'],['2015','2015'],['2016','2016']], 'year');
  renderKpis(); renderBar(); renderScatter(); renderGrowthChart(); renderGrowthYearChart(); renderYearChart(); renderCctvTable();
}

load();
