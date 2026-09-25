/* 一次性数据生成脚本：产出自制原创示例 CSV + 内联 samples.js
   运行：node scripts/gen-samples.js  （构建辅助，不参与线上运行） */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const samplesDir = path.join(root, 'samples');
const dataDir = path.join(root, 'assets', 'js', 'data');
fs.mkdirSync(samplesDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

// 确定性伪随机（保证每次生成一致）
let seed = 20260923;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function range(a, b) { return a + rnd() * (b - a); }
function round(v, d) { const p = Math.pow(10, d); return Math.round(v * p) / p; }

function toCSV(header, rows) {
  return [header.join(',')].concat(rows.map(r => r.join(','))).join('\n') + '\n';
}

const datasets = {};

// 1) 散点 / 直方 / 箱线：材料试样 应力-应变
(() => {
  const header = ['sample_id', 'stress_MPa', 'strain_pct', 'temperature_C'];
  const groups = ['A', 'B', 'C'];
  const rows = [];
  for (let i = 1; i <= 120; i++) {
    const g = groups[i % 3];
    const strain = round(range(0.2, 5.0), 3);
    const base = g === 'A' ? 210 : g === 'B' ? 260 : 170;
    const stress = round(base * strain * range(0.85, 1.12), 2);
    const temp = round(range(20, 300), 1);
    rows.push(['S' + String(i).padStart(3, '0'), stress, strain, temp]);
  }
  datasets.scatter_demo = { header, rows, label: '材料试样（散点/直方/箱线）' };
})();

// 2) 时间序列：迭代残差与能量（折线/面积）
(() => {
  const header = ['step', 'residual', 'kinetic_energy', 'temperature'];
  const rows = [];
  for (let s = 0; s <= 100; s++) {
    const residual = round(2.5 * Math.exp(-s / 22) + range(0, 0.06), 5);
    const ke = round(120 * Math.exp(-Math.pow(s - 30, 2) / 900) + range(0, 4), 3);
    const temp = round(300 - 120 * (1 - Math.exp(-s / 40)) + range(-2, 2), 2);
    rows.push([s, residual, ke, temp]);
  }
  datasets.timeseries_demo = { header, rows, label: '迭代时间序列（折线/面积）' };
})();

// 3) 2D 网格热力：节点温度场
(() => {
  const header = ['grid_x', 'grid_y', 'temperature'];
  const rows = [];
  for (let x = 0; x < 24; x++) {
    for (let y = 0; y < 18; y++) {
      const cx = 12, cy = 9;
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      const t = round(90 * Math.exp(-d2 / 70) + 20 + range(-3, 3), 2);
      rows.push([x, y, t]);
    }
  }
  datasets.heatmap_grid = { header, rows, label: '2D 温度场网格（热力图）' };
})();

// 4) 桑基流量：能量流转
(() => {
  const header = ['source', 'target', 'value'];
  const rows = [
    ['输入功率', '机械能', 620], ['输入功率', '热损耗', 240], ['输入功率', '电损耗', 140],
    ['机械能', '有效输出', 470], ['机械能', '摩擦损耗', 150],
    ['热损耗', '冷却系统', 160], ['热损耗', '环境散失', 80],
    ['电损耗', '电阻发热', 90], ['电损耗', '辐射损耗', 50],
    ['有效输出', '负载A', 280], ['有效输出', '负载B', 190],
  ];
  datasets.sankey_flow = { header, rows, label: '能量流转（桑基图）' };
})();

// 5) 拓扑网络：节点连接边表
(() => {
  const header = ['source', 'target', 'weight'];
  const nodes = ['N1','N2','N3','N4','N5','N6','N7','N8','N9','N10','N11','N12'];
  const edges = [
    ['N1','N2',3],['N1','N3',2],['N2','N3',4],['N2','N4',1],['N3','N5',2],
    ['N4','N5',3],['N4','N6',2],['N5','N7',4],['N6','N7',1],['N6','N8',3],
    ['N7','N9',2],['N8','N9',3],['N8','N10',2],['N9','N11',4],['N10','N11',1],
    ['N11','N12',3],['N9','N12',2],['N1','N12',1],['N3','N7',2],['N5','N9',3],
  ];
  datasets.network_edges = { header, rows: edges, label: '节点拓扑（网络图）' };
})();

// 6) 经纬度点位：观测站点（原创虚构坐标）
(() => {
  const header = ['station', 'longitude', 'latitude', 'magnitude'];
  const rows = [
    ['站点-甲', 116.40, 39.90, 3.2],
    ['站点-乙', 121.47, 31.23, 4.1],
    ['站点-丙', 113.26, 23.13, 2.7],
    ['站点-丁', 114.06, 22.55, 3.8],
    ['站点-戊', 104.07, 30.67, 2.2],
    ['站点-己', 108.95, 34.27, 3.5],
    ['站点-庚', 117.00, 36.65, 2.9],
    ['站点-辛', 126.63, 45.75, 4.4],
    ['站点-壬', 120.15, 30.28, 3.1],
    ['站点-癸', 106.55, 29.56, 2.6],
    ['站点-子', 113.65, 34.76, 3.9],
    ['站点-丑', 118.78, 32.04, 3.3],
  ];
  datasets.geo_points = { header, rows, label: '观测站点（经纬度点位）' };
})();

// 7) 数据清洗演示：含缺失值与重复行的试验记录
(() => {
  const header = ['run_id', 'material', 'thickness_mm', 'peak_load_kN', 'elongation_pct', 'operator'];
  const mats = ['Q235', 'Q345', '6061-T6', 'TC4'];
  const operators = ['张工', '李工', '王工'];
  const rows = [];
  for (let i = 1; i <= 36; i++) {
    const mat = mats[i % mats.length];
    const base = mat === 'Q235' ? 120 : mat === 'Q345' ? 165 : mat === '6061-T6' ? 88 : 210;
    rows.push([
      'RUN' + String(i).padStart(3, '0'),
      mat,
      round(range(1.5, 6.0), 2),
      round(base * range(0.82, 1.18), 2),
      round(range(0.8, 8.5), 2),
      operators[i % operators.length],
    ]);
  }
  // 制造缺失值（空单元格）：数值列 + 文本列
  [3, 9, 17, 25, 31].forEach(i => { rows[i - 1][3] = ''; });
  [6, 14, 22, 28].forEach(i => { rows[i - 1][4] = ''; });
  [11, 20, 33].forEach(i => { rows[i - 1][5] = ''; });
  // 制造重复行：整行重复 + 除编号外完全相同
  rows.push(rows[0].slice());
  rows.push(rows[5].slice());
  rows.push(['RUN037', rows[10][1], rows[10][2], rows[10][3], rows[10][4], rows[10][5]]);
  rows.push(['RUN038', 'Q345', 3.02, 168.4, 4.55, '李工']);
  rows.push(['RUN038', 'Q345', 3.02, 168.4, 4.55, '李工']);
  datasets.clean_demo = { header, rows, label: '含缺失/重复的试验记录（清洗演示）' };
})();

// 写独立 CSV 文件
for (const [name, d] of Object.entries(datasets)) {
  fs.writeFileSync(path.join(samplesDir, name + '.csv'), toCSV(d.header, d.rows), 'utf8');
}

// 写内联 samples.js
let js = '/* ============================================================\n';
js += '   Miokr samples.js — 内置示例数据（全部自制原创，无版权风险）\n';
js += '   以 CSV 字符串内联，避免 file:// 下 fetch 的 CORS 限制\n';
js += '   ============================================================ */\n';
js += '(function (global) {\n  "use strict";\n  global.Miokr = global.Miokr || {};\n  global.Miokr.samples = [\n';
const keys = Object.keys(datasets);
keys.forEach((name, idx) => {
  const d = datasets[name];
  const csv = toCSV(d.header, d.rows).replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
  js += '    {\n';
  js += '      id: ' + JSON.stringify(name) + ',\n';
  js += '      label: ' + JSON.stringify(d.label) + ',\n';
  js += '      file: "samples/' + name + '.csv",\n';
  js += '      csv: `' + csv.replace(/\n/g, '\\n') + '`\n';
  js += '    }' + (idx < keys.length - 1 ? ',' : '') + '\n';
});
js += '  ];\n})(typeof window !== "undefined" ? window : this);\n';
fs.writeFileSync(path.join(dataDir, 'samples.js'), js, 'utf8');

console.log('生成完成：');
for (const [name, d] of Object.entries(datasets)) {
  console.log('  ' + name + '.csv  行数=' + d.rows.length + '  列=' + d.header.join('/'));
}
console.log('  assets/js/data/samples.js  (' + js.length + ' bytes)');
