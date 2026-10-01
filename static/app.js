const METRICS = {
  population:        '총 인구수',
  korean:            '한국인',
  foreign_pop:       '외국인',
  senior:            '고령자(65세+)',
  cctv:              'CCTV 총계',
  cctv_growth_rate:  '연평균 CCTV 증가율(%)',
  cctv_ratio:        '인구 100명당 CCTV 대수',
};
const state = { metric: 'population', order: 'desc', year: '2014', cctvYear: '2014', scatterYear: 'total', data: [] };
let barChart, scatterChart, growthChart, growthYearChart, yearChart;
const fmt = n => typeof n === 'number' ? n.toLocaleString('ko-KR') : n;

async function load() {
  const res = await fetch('/api/districts');
  const data = await res.json();
  state.data = data.districts.map(r => ({
    ...r,
    cctv_growth_rate: Number((r.cctv_growth_rate / 3).toFixed(1)),
    cctv_ratio: Number(((r.cctv / r.population) * 100).toFixed(2))
  }));
  render();
}

function makeButtons(id, entries, key, size = 'small') {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = '';
  entries.forEach(([value, label]) => {
    const b = document.createElement('button');
    b.innerHTML = `<strong>${label}</strong>`;
    b.classList.add('target-btn-30');
    if (size === 'medium') {
      b.style.padding = '8px 16px';
      b.style.fontSize = '14px';
      b.style.height = 'auto';
    }
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
  const avgRatio = (d.reduce((s, r) => s + r.cctv_ratio, 0) / d.length).toFixed(2);
  
  document.getElementById('kpis').innerHTML = [
    ['서울 전체 인구(25개 구)', fmt(total) + '명'],
    ['인구 최다', `${max.name} ${fmt(max.population)}`],
    ['인구 최소', `${min.name} ${fmt(min.population)}`],
    ['평균 인구 100명당 CCTV', `${avgRatio}대`],
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

function calcLinearRegression(pts) {
  const n = pts.length;
  if (n === 0) return null;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  pts.forEach(p => {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
    sumYY += p.y * p.y;
  });
  const meanX = sumX / n;
  const meanY = sumY / n;
  const denom = sumXX - (sumX * sumX) / n;
  const slope = denom !== 0 ? (sumXY - (sumX * sumY) / n) / denom : 0;
  const intercept = meanY - slope * meanX;
  
  const totalSS = pts.reduce((acc, p) => acc + Math.pow(p.y - meanY, 2), 0);
  const resSS = pts.reduce((acc, p) => acc + Math.pow(p.y - (slope * p.x + intercept), 2), 0);
  const r2 = totalSS !== 0 ? Math.max(0, 1 - (resSS / totalSS)) : 0;

  const xValues = pts.map(p => p.x);
  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);

  const residuals = pts.map(p => {
    const pred = Math.round(slope * p.x + intercept);
    const diff = p.y - pred;
    
    // Dynamic color & size based on residual
    let color = '#64748b'; // default slate
    let radius = 7;
    if (diff >= 200) {
      color = '#2563eb'; // Over CCTV (Blue)
      radius = 9;
    } else if (diff <= -200) {
      color = '#dc2626'; // Under CCTV (Red)
      radius = 9;
    }

    return {
      ...p,
      pred,
      diff,
      color,
      radius
    };
  });

  residuals.sort((a, b) => b.diff - a.diff);

  return {
    slope,
    intercept,
    r2,
    linePoints: [
      { x: minX, y: slope * minX + intercept },
      { x: maxX, y: slope * maxX + intercept }
    ],
    residuals,
    topOver3: residuals.slice(0, 3),
    topUnder3: residuals.slice(-3).reverse()
  };
}

function showDistrictDetail(p) {
  const panel = document.getElementById('districtDetailPanel');
  const title = document.getElementById('detailTitle');
  const content = document.getElementById('detailContent');
  if (!panel || !p) return;

  panel.style.display = 'block';
  const statusBadge = p.diff >= 0
    ? `<span style="color:#2563eb; font-weight:bold;">+${fmt(p.diff)}대 (과다 설치)</span>`
    : `<span style="color:#dc2626; font-weight:bold;">${fmt(p.diff)}대 (과소 설치)</span>`;

  title.innerHTML = `🔍 <strong>${p.name}</strong> 상세 회귀 오차 분석`;
  content.innerHTML = `
    • <b>인구수:</b> ${fmt(p.x)}명 &nbsp;|&nbsp; 
    • <b>실제 CCTV:</b> ${fmt(p.y)}대 &nbsp;|&nbsp; 
    • <b>추세선 예측치:</b> ${fmt(p.pred)}대 <br>
    • <b>오차 (실제 - 예측):</b> ${statusBadge}<br>
    <div style="margin-top:6px; color:#475569; font-size:13px;">
      ${p.name}의 경우 인구수(${fmt(p.x)}명) 기준 선형 회귀 기대 설치량은 <b>${fmt(p.pred)}대</b>이나, 
      실제로는 <b>${fmt(p.y)}대</b>가 설치되어 추세 대비 <b>${statusBadge}</b> 상태입니다.
    </div>
  `;
}

function renderScatter() {
  const year = state.scatterYear;
  const rawPts = state.data.map(r => {
    let yValue = r.cctv;
    if (year !== 'total') {
      yValue = r['cctv_' + year] || 0;
    }
    return { x: r.population, y: yValue, name: r.name };
  });

  const reg = calcLinearRegression(rawPts);

  if (reg) {
    const eqSign = reg.intercept >= 0 ? '+' : '-';
    document.getElementById('regEq').textContent = `y = ${reg.slope.toFixed(5)}x ${eqSign} ${Math.abs(reg.intercept).toFixed(1)}`;
    document.getElementById('regSlope').textContent = `${reg.slope.toFixed(5)} (1만명당 ${(reg.slope * 10000).toFixed(1)}대)`;
    document.getElementById('regIntercept').textContent = `${reg.intercept.toFixed(1)}대`;
    document.getElementById('regR2').textContent = `${(reg.r2 * 100).toFixed(1)}% (R²=${reg.r2.toFixed(3)})`;
    
    // Render Top Over List
    document.getElementById('topOverList').innerHTML = reg.topOver3.map(r => `
      <div style="display:flex; justify-size:space-between; justify-content:space-between; background:#fff; padding:6px 10px; border-radius:6px; cursor:pointer;" onclick='showDistrictDetail(${JSON.stringify(r)})'>
        <span><strong>${r.name}</strong> (${fmt(r.x)}명)</span>
        <span style="color:#1d4ed8; font-weight:700;">+${fmt(r.diff)}대</span>
      </div>
    `).join('');

    // Render Top Under List
    document.getElementById('topUnderList').innerHTML = reg.topUnder3.map(r => `
      <div style="display:flex; justify-content:space-between; background:#fff; padding:6px 10px; border-radius:6px; cursor:pointer;" onclick='showDistrictDetail(${JSON.stringify(r)})'>
        <span><strong>${r.name}</strong> (${fmt(r.x)}명)</span>
        <span style="color:#b91c1c; font-weight:700;">${fmt(r.diff)}대</span>
      </div>
    `).join('');

    document.getElementById('regSummary').innerHTML = `
      💡 <b>회귀 분석 요약:</b> 기울기 <b>${reg.slope.toFixed(5)}</b> (인구 1만 명당 CCTV <b>${(reg.slope * 10000).toFixed(1)}대</b> 증가 추세), y절편 <b>${reg.intercept.toFixed(1)}대</b>.<br>
      • 파란색 점: 추세 대비 CCTV 과다 설치 자치구 | 빨간색 점: 추세 대비 CCTV 과소 설치 자치구 (클릭 시 상세 조회)
    `;
  }

  const pts = reg ? reg.residuals : rawPts;

  scatterChart?.destroy();
  scatterChart = new Chart(document.getElementById('scatterChart'), {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: `회귀 추세선 (y = ${reg ? reg.slope.toFixed(5) : 0}x + ${reg ? reg.intercept.toFixed(1) : 0})`,
          type: 'line',
          data: reg ? reg.linePoints : [],
          borderColor: '#ef4444',
          borderWidth: 3,
          pointRadius: 0,
          fill: false,
          tension: 0
        },
        {
          label: '구별 데이터 (오차별 색상 시각화)',
          data: pts,
          backgroundColor: pts.map(p => p.color || '#2f6bff'),
          pointRadius: pts.map(p => p.radius || 6),
          pointHoverRadius: 11
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const el = elements[0];
          if (el.datasetIndex === 1) { // scatter dataset
            const p = pts[el.index];
            showDistrictDetail(p);
          }
        }
      },
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            title: c => c[0].raw.name || c[0].dataset.label,
            label: c => {
              if (c.dataset.type === 'line') {
                return `추세선 (y = ${reg.slope.toFixed(5)}x ${reg.intercept >= 0 ? '+' : '-'} ${Math.abs(reg.intercept).toFixed(1)})`;
              }
              const p = c.raw;
              const statusText = p.diff >= 0 ? `+${fmt(p.diff)}대 (과다)` : `${fmt(p.diff)}대 (과소)`;
              return [
                `인구수: ${fmt(p.x)}명`,
                `실제 CCTV: ${fmt(p.y)}대`,
                `예측 CCTV: ${fmt(p.pred)}대`,
                `오차(잔차): ${statusText}`
              ];
            }
          }
        }
      },
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
  growthYearChart = new Chart(document.getElementById('growthYearChart'), {
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
  const cctvData = rows.map(r => r['cctv_' + state.cctvYear] || 0);
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
          <th>인구 100명당 CCTV</th>
          <th>연평균 증가율 (%)</th>
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
        <td><strong>${r.cctv_ratio.toFixed(2)}대</strong></td>
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
  
  makeButtons('scatterYearBtns', [['total','총계'], ['2014','2014년'], ['2015','2015년'], ['2016','2016년']], 'scatterYear', 'medium');
  makeButtons('growthYearBtns', [['2014','2014년'],['2015','2015년'],['2016','2016년']], 'year', 'medium');
  makeButtons('yearBtns', [['2014','2014년'],['2015','2015년'],['2016','2016년']], 'cctvYear', 'medium');

  renderKpis(); renderBar(); renderScatter(); renderGrowthChart(); renderGrowthYearChart(); renderYearChart(); renderCctvTable();
}

// Select event bindings removed as we reverted to buttons
function bindEvents() {}

bindEvents();
load();
