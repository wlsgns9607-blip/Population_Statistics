const METRICS = {
  population:  '총 인구수',
  korean:      '한국인',
  foreign_pop: '외국인',
  senior:      '고령자(65세+)',
  cctv:        'CCTV 수',
};
const state = { metric: 'population', order: 'desc', data: [] };
let barChart, scatterChart;
const fmt = n => n.toLocaleString('ko-KR');

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
  document.getElementById('kpis').innerHTML = [
    ['서울 전체 인구(25개 구)', fmt(total) + '명'],
    ['인구 최다', `${max.name} ${fmt(max.population)}`],
    ['인구 최소', `${min.name} ${fmt(min.population)}`],
    ['구 평균 인구', fmt(Math.round(total / d.length))],
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
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${METRICS[k]}: ${fmt(c.raw)}` } } },
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

function render() {
  makeButtons('metricBtns', Object.entries(METRICS), 'metric');
  makeButtons('orderBtns', [['desc', '많은 순'], ['asc', '적은 순']], 'order');
  renderKpis(); renderBar(); renderScatter();
}

load();
