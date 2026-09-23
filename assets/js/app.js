/* ============================================================
   Miokr app.js — 工具页主控
   职责：加载数据(示例/上传) → 列识别 → 字段映射 → 分派渲染 → 导出
   纯本地运行，无任何网络请求
   ============================================================ */
(function (global) {
  'use strict';

  var M = global.Miokr;
  var csv = M.csv, charts = M.charts;

  // 图表类型定义（含各自所需字段映射）
  var CHARTS = [
    { id: 'scatter', name: '散点图', icon: '⬡', fields: [
      { key: 'x', label: 'X 轴', prefer: 'numeric' },
      { key: 'y', label: 'Y 轴', prefer: 'numeric' },
      { key: 'series', label: '分组着色(可选)', prefer: 'text', optional: true } ] },
    { id: 'line', name: '折线图', icon: '📈', fields: [
      { key: 'x', label: 'X 轴', prefer: 'numeric' },
      { key: 'y', label: 'Y 轴', prefer: 'numeric' } ] },
    { id: 'area', name: '面积图', icon: '▧', fields: [
      { key: 'x', label: 'X 轴', prefer: 'numeric' },
      { key: 'y', label: 'Y 轴', prefer: 'numeric' } ] },
    { id: 'bar', name: '柱状图', icon: '▮', fields: [
      { key: 'x', label: '分类 X 轴', prefer: 'text' } ] },
    { id: 'histogram', name: '直方图', icon: '📶', fields: [
      { key: 'x', label: '数值列', prefer: 'numeric' } ] },
    { id: 'box', name: '箱线图', icon: '📦', fields: [
      { key: 'series', label: '分组(可选)', prefer: 'text', optional: true },
      { key: 'y', label: '数值 Y 轴', prefer: 'numeric' } ] },
    { id: 'heatmap', name: '2D 热力图', icon: '🔥', fields: [
      { key: 'x', label: 'X 网格列', prefer: 'numeric' },
      { key: 'y', label: 'Y 网格列', prefer: 'numeric' },
      { key: 'value', label: '数值列', prefer: 'numeric' } ] },
    { id: 'sankey', name: '桑基流量图', icon: '🌊', fields: [
      { key: 'source', label: '源节点列', prefer: 'text' },
      { key: 'target', label: '目标节点列', prefer: 'text' },
      { key: 'value', label: '数值列', prefer: 'numeric' } ] },
    { id: 'network', name: '拓扑网络图', icon: '🕸️', fields: [
      { key: 'source', label: '源节点列', prefer: 'text' },
      { key: 'target', label: '目标节点列', prefer: 'text' },
      { key: 'weight', label: '权重(可选)', prefer: 'numeric', optional: true } ] },
    { id: 'geo', name: '地图点位', icon: '🌐', fields: [
      { key: 'lon', label: '经度列', prefer: 'numeric' },
      { key: 'lat', label: '纬度列', prefer: 'numeric' },
      { key: 'label', label: '名称(可选)', prefer: 'text', optional: true },
      { key: 'value', label: '数值(可选)', prefer: 'numeric', optional: true } ] }
  ];

  // 全局状态
  var state = {
    name: '—',
    columns: [],
    rows: [],        // 原始字符串行
    typed: [],       // 数值转换后的行
    meta: null,      // 列类型元信息
    chart: 'scatter',
    fields: {}       // 当前图表的字段映射 {key: columnName}
  };

  var el = {}; // DOM 缓存
  function $(id) { return document.getElementById(id); }

  // ---------- 初始化 ----------
  function init() {
    el.fileInput = $('fileInput');
    el.sampleSelect = $('sampleSelect');
    el.typeGrid = $('typeGrid');
    el.fieldMap = $('fieldMap');
    el.container = $('chartContainer');
    el.chartTitle = $('chartTitle');
    el.chartSubtitle = $('chartSubtitle');

    // 图表类型按钮
    CHARTS.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'type-btn' + (c.id === state.chart ? ' active' : '');
      b.textContent = c.icon + ' ' + c.name;
      b.dataset.id = c.id;
      b.addEventListener('click', function () { selectChart(c.id); });
      el.typeGrid.appendChild(b);
    });

    // 示例数据下拉
    var samples = M.samples || [];
    samples.forEach(function (s, i) {
      var opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = s.label;
      el.sampleSelect.appendChild(opt);
    });
    el.sampleSelect.addEventListener('change', function () {
      var s = samples[parseInt(el.sampleSelect.value, 10)];
      if (s) loadCSVText(s.csv, s.label);
    });

    // 文件上传（纯本地 FileReader）
    el.fileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) { loadCSVText(ev.target.result, file.name); };
      reader.readAsText(file, 'utf-8');
    });

    $('btnRefresh').addEventListener('click', render);
    $('btnReset').addEventListener('click', function () {
      el.sampleSelect.value = '0';
      var s = samples[0];
      if (s) loadCSVText(s.csv, s.label);
    });
    $('btnSVG').addEventListener('click', function () { doExport('svg'); });
    $('btnPNG').addEventListener('click', function () { doExport('png'); });

    updateMemberBadge();

    // 默认加载第一个示例
    if (samples.length) loadCSVText(samples[0].csv, samples[0].label);
    else showPlaceholder('暂无示例数据');
  }

  function updateMemberBadge() {
    var badge = $('memberBadge');
    if (!badge) return;
    var on = M.export.isMember();
    badge.textContent = on ? '会员版 · 无水印' : '免费版';
    badge.style.background = on ? '#d1fae5' : '';
    badge.style.color = on ? '#065f46' : '';
  }

  // ---------- 数据加载 ----------
  function loadCSVText(text, name) {
    try {
      var parsed = csv.parse(text);
      if (!parsed.columns.length || !parsed.rows.length) {
        showError('未能从该 CSV 解析出有效数据，请检查文件格式。');
        return;
      }
      var det = csv.detectColumns(parsed.rows, parsed.columns);
      state.name = name;
      state.columns = parsed.columns;
      state.rows = parsed.rows;
      state.meta = det.meta;
      state.typed = csv.coerceNumeric(parsed.rows, parsed.columns, det.meta);
      updateDataBar(det);
      selectChart(pickDefaultChart(det), true);
    } catch (err) {
      showError('数据解析出错：' + err.message);
    }
  }

  // 依据识别到的列，智能挑选默认图表类型
  function pickDefaultChart(det) {
    if (det.meta.__geo && det.meta.__geo.lon && det.meta.__geo.lat) return 'geo';
    // 若存在明显的 source/target 文本对，倾向桑基
    var texts = det.text;
    if (texts.length >= 2 && /(source|源|from)/i.test(texts[0]) && /(target|目标|to)/i.test(texts[1])) return 'sankey';
    if (det.numeric.length >= 3 && state.columns.length === 3) return 'heatmap';
    if (det.numeric.length >= 2) return 'scatter';
    if (det.numeric.length === 1) return 'histogram';
    return 'bar';
  }

  function updateDataBar(det) {
    $('statName').textContent = state.name;
    $('statRows').textContent = state.rows.length;
    $('statCols').textContent = state.columns.length;
    var numBox = $('statNumeric'), textBox = $('statText');
    numBox.innerHTML = ''; textBox.innerHTML = '';
    det.numeric.forEach(function (c) { numBox.appendChild(chip(c, true)); });
    det.text.forEach(function (c) { textBox.appendChild(chip(c, false)); });
    if (!det.numeric.length) numBox.appendChild(chip('无', true));
    if (!det.text.length) textBox.appendChild(chip('无', false));
  }

  function chip(text, num) {
    var s = document.createElement('span');
    s.className = 'chip' + (num ? ' num' : '');
    s.textContent = text;
    return s;
  }

  // ---------- 图表类型切换 ----------
  function selectChart(id, keepFields) {
    state.chart = id;
    // 高亮按钮
    Array.prototype.forEach.call(el.typeGrid.children, function (b) {
      b.classList.toggle('active', b.dataset.id === id);
    });
    if (!keepFields) { /* 字段每次重建 */ }
    autoMapFields(id);
    buildFieldUI(id);
    render();
  }

  function chartDef(id) {
    for (var i = 0; i < CHARTS.length; i++) if (CHARTS[i].id === id) return CHARTS[i];
    return CHARTS[0];
  }

  // 为当前图表类型自动挑选合适列
  function autoMapFields(id) {
    var def = chartDef(id);
    var fields = {};
    var used = {};
    var geo = state.meta && state.meta.__geo;

    def.fields.forEach(function (f) {
      var pick = null;
      // 地图经纬度优先用识别结果
      if (id === 'geo' && geo) {
        if (f.key === 'lon' && geo.lon) pick = geo.lon;
        if (f.key === 'lat' && geo.lat) pick = geo.lat;
      }
      if (!pick) {
        var pool = f.prefer === 'numeric' ? numericCols()
                 : f.prefer === 'text' ? textCols()
                 : state.columns;
        // 必选字段避免重复占用；可选字段允许重复/留空
        for (var i = 0; i < pool.length; i++) {
          if (!used[pool[i]] || f.optional) { pick = pool[i]; break; }
        }
        if (!pick && f.optional) pick = '';
      }
      if (pick) used[pick] = true;
      fields[f.key] = pick || '';
    });

    // 桑基/网络：value/weight 默认取数值列
    if ((id === 'sankey') && !fields.value) fields.value = numericCols()[0] || '';
    state.fields = fields;
  }

  function numericCols() {
    return state.columns.filter(function (c) { return state.meta[c] && state.meta[c].type === 'numeric'; });
  }
  function textCols() {
    return state.columns.filter(function (c) { return state.meta[c] && state.meta[c].type === 'text'; });
  }

  // 构建字段映射下拉 UI
  function buildFieldUI(id) {
    var def = chartDef(id);
    el.fieldMap.innerHTML = '';
    def.fields.forEach(function (f) {
      var wrap = document.createElement('div');
      wrap.className = 'field';
      var label = document.createElement('label');
      label.textContent = f.label;
      var sel = document.createElement('select');
      // 可选字段带「无」项
      var pool = state.columns.slice();
      if (f.optional) {
        var none = document.createElement('option');
        none.value = ''; none.textContent = '（不使用）';
        sel.appendChild(none);
      }
      pool.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c;
        var t = state.meta[c] ? state.meta[c].type : '';
        opt.textContent = c + (t === 'numeric' ? '  #数值' : t === 'text' ? '  #文本' : '');
        sel.appendChild(opt);
      });
      sel.value = state.fields[f.key] || '';
      sel.addEventListener('change', function () {
        state.fields[f.key] = sel.value;
        render();
      });
      wrap.appendChild(label);
      wrap.appendChild(sel);
      el.fieldMap.appendChild(wrap);
    });
  }

  // ---------- 渲染 ----------
  function stopSimulation() {
    var old = el.container.firstElementChild;
    if (old && old.__simulation) { try { old.__simulation.stop(); } catch (e) {} }
  }

  /**
   * 取当前图表的主 SVG。
   * 说明：启用图例时 Observable Plot 返回 <figure>，内含「图例 svg + 图表 svg」，
   * 图例 svg 带有渐变 <image>；据此过滤，始终返回真正的图表 svg。
   */
  function getChartSVG() {
    var c = el.container;
    var first = c.firstElementChild;
    if (first && first.tagName === 'svg') return first;
    var svgs = Array.prototype.slice.call(c.querySelectorAll('svg'));
    if (!svgs.length) return null;
    var charts = svgs.filter(function (s) { return !s.querySelector('image'); });
    return charts.length ? charts[charts.length - 1] : svgs[svgs.length - 1];
  }

  function chartSize() {
    var w = el.container.clientWidth || 900;
    w = Math.max(560, Math.min(w - 8, 1400));
    return { width: w, height: Math.max(460, Math.min(620, Math.round(w * 0.56))) };
  }

  function render() {
    if (!state.rows.length) return;
    updateMemberBadge();
    var def = chartDef(state.chart);
    var size = chartSize();
    var f = state.fields;
    var data = state.typed;

    el.chartTitle.textContent = def.icon + ' ' + def.name;
    el.chartSubtitle.textContent = '数据集：' + state.name + ' · ' + state.rows.length + ' 行';

    stopSimulation();

    var svg;
    try {
      switch (state.chart) {
        case 'sankey':
          requireFields([f.source, f.target], ['源节点列', '目标节点列']);
          svg = M.sankey.render(data, { source: f.source, target: f.target, value: f.value || firstNumeric(), width: size.width, height: size.height });
          break;
        case 'network':
          requireFields([f.source, f.target], ['源节点列', '目标节点列']);
          svg = M.network.render(data, { source: f.source, target: f.target, weight: f.weight || null, width: size.width, height: size.height });
          break;
        case 'geo':
          requireFields([f.lon, f.lat], ['经度列', '纬度列']);
          svg = M.geo.render(data, { lon: f.lon, lat: f.lat, label: f.label || null, value: f.value || null, width: size.width, height: size.height });
          break;
        default:
          svg = renderBasic(state.chart, data, f, size);
      }
    } catch (err) {
      showError(err.message);
      return;
    }

    el.container.innerHTML = '';
    el.container.appendChild(svg);
  }

  function renderBasic(type, data, f, size) {
    var opts = { width: size.width, height: size.height };
    switch (type) {
      case 'scatter':
        requireFields([f.x, f.y], ['X 轴', 'Y 轴']);
        opts.x = f.x; opts.y = f.y; opts.series = f.series || null;
        return charts.render('scatter', data, opts);
      case 'line':
        requireFields([f.x, f.y], ['X 轴', 'Y 轴']);
        opts.x = f.x; opts.y = f.y;
        return charts.render('line', data, opts);
      case 'area':
        requireFields([f.x, f.y], ['X 轴', 'Y 轴']);
        opts.x = f.x; opts.y = f.y;
        return charts.render('area', data, opts);
      case 'bar':
        requireFields([f.x], ['分类 X 轴']);
        opts.x = f.x;
        return charts.render('bar', data, opts);
      case 'histogram':
        requireFields([f.x], ['数值列']);
        opts.x = f.x;
        return charts.render('histogram', data, opts);
      case 'box':
        requireFields([f.y], ['数值 Y 轴']);
        opts.x = f.series || f.y; opts.y = f.y; opts.series = f.series || null;
        return charts.render('box', data, opts);
      case 'heatmap':
        requireFields([f.x, f.y, f.value], ['X 网格列', 'Y 网格列', '数值列']);
        opts.x = f.x; opts.y = f.y; opts.value = f.value;
        return charts.render('heatmap', data, opts);
      default:
        throw new Error('未知图表类型');
    }
  }

  function firstNumeric() {
    var n = numericCols();
    return n.length ? n[0] : null;
  }

  function requireFields(vals, labels) {
    for (var i = 0; i < vals.length; i++) {
      if (!vals[i]) throw new Error('请先选择「' + labels[i] + '」对应的数据列。');
    }
  }

  // ---------- 导出 ----------
  function doExport(kind) {
    var svg = getChartSVG();
    if (!svg) { alert('当前没有可导出的图表。'); return; }
    var base = 'miokr-' + state.chart;
    if (kind === 'svg') M.export.exportSVG(svg, base);
    else M.export.exportPNG(svg, base);
  }

  // ---------- 提示 ----------
  function showError(msg) {
    el.container.innerHTML = '';
    var d = document.createElement('div');
    d.className = 'error-msg';
    d.textContent = '⚠ ' + msg;
    el.container.appendChild(d);
  }
  function showPlaceholder(msg) {
    el.container.innerHTML = '<div class="placeholder"><div class="ph-icon">📊</div><p>' + msg + '</p></div>';
  }

  // 窗口尺寸变化时重绘（防抖）
  var rzTimer = null;
  global.addEventListener('resize', function () {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(function () { if (state.rows.length) render(); }, 200);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
