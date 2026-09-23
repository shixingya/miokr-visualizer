/* ============================================================
   Miokr charts.js — 基础图表 + 热力图（基于 Observable Plot）
   统一 render(type, data, opts) 接口，返回 SVG 元素
   ============================================================ */
(function (global) {
  'use strict';

  var Plot = global.Plot;

  var PALETTE = ['#2563eb', '#0ea5e9', '#059669', '#d97706', '#dc2626', '#7c3aed'];

  /** 通用坐标轴 / 尺寸设置 */
  function baseOpts(opts) {
    return {
      width: opts.width,
      height: opts.height,
      marginLeft: 56, marginRight: 24, marginTop: 24, marginBottom: 46,
      grid: true,
      style: { fontFamily: 'inherit', background: 'transparent' }
    };
  }

  /**
   * 渲染基础图表。
   * @param {string} type scatter|line|area|bar|histogram|box
   * @param {Object[]} data 已做数值转换的数据
   * @param {Object} opts {x, y, series?, width, height}
   * @returns {SVGElement}
   */
  function render(type, data, opts) {
    opts = opts || {};
    var o = baseOpts(opts);
    var x = opts.x, y = opts.y;
    var marks = [];

    // 折线 / 面积：按 X 值升序排列，保证连线顺序正确
    function sorted() {
      return data.slice().sort(function (a, b) {
        var av = a[x], bv = b[x];
        if (av instanceof Date && bv instanceof Date) return av - bv;
        if (typeof av === 'number' && typeof bv === 'number') return av - bv;
        return String(av).localeCompare(String(bv));
      });
    }

    switch (type) {
      case 'scatter':
        marks.push(Plot.dot(data, { x: x, y: y, fill: opts.series || '#2563eb', fillOpacity: 0.7, r: 4, tip: true }));
        break;

      case 'line':
        marks.push(Plot.line(sorted(), { x: x, y: y, stroke: opts.series || '#2563eb', strokeWidth: 2 }));
        marks.push(Plot.dot(data, { x: x, y: y, fill: opts.series || '#2563eb', r: 2.5, fillOpacity: 0.6 }));
        break;

      case 'area':
        marks.push(Plot.areaY(sorted(), { x: x, y: y, fill: '#2563eb', fillOpacity: 0.25 }));
        marks.push(Plot.lineY(sorted(), { x: x, y: y, stroke: '#2563eb', strokeWidth: 2 }));
        break;

      case 'bar':
        marks.push(Plot.rectY(data, Plot.groupX({ y: 'count' }, { x: x, fill: '#2563eb', tip: true })));
        break;

      case 'histogram':
        marks.push(Plot.rectY(data, Plot.binX({ y: 'count' }, { x: x, thresholds: opts.bins || 20, fill: '#2563eb', fillOpacity: 0.85, tip: true })));
        break;

      case 'box':
        marks.push(Plot.boxY(data, { x: opts.series || x, y: y, fill: '#dbeafe', stroke: '#2563eb', tip: true }));
        break;

      case 'heatmap':
        return renderHeatmap(data, opts);

      default:
        throw new Error('未知图表类型: ' + type);
    }

    o.x = { label: x, grid: true };
    o.y = { label: y, grid: true };
    o.marks = marks;
    return Plot.plot(o);
  }

  /**
   * 2D 网格热力图。
   * @param {Object} opts {x, y, value, width, height}
   */
  function renderHeatmap(data, opts) {
    var o = baseOpts(opts);
    var xc = opts.x, yc = opts.y, vc = opts.value;

    // 依据网格间距推算单元格半宽，保证线性坐标下也有可见面积
    function step(col) {
      var vals = data.map(function (d) { return +d[col]; })
        .filter(function (v) { return isFinite(v); })
        .sort(function (a, b) { return a - b; });
      var uniq = [];
      for (var i = 0; i < vals.length; i++) if (uniq[uniq.length - 1] !== vals[i]) uniq.push(vals[i]);
      if (uniq.length < 2) return 1;
      var minGap = Infinity;
      for (var j = 1; j < uniq.length; j++) minGap = Math.min(minGap, uniq[j] - uniq[j - 1]);
      return isFinite(minGap) && minGap > 0 ? minGap : 1;
    }
    var hx = step(xc) / 2, hy = step(yc) / 2;

    o.x = { label: xc, grid: false };
    o.y = { label: yc, grid: false };
    o.color = { label: vc, scheme: 'blues', legend: true };
    o.marks = [
      Plot.rect(data, {
        x1: function (d) { return +d[xc] - hx; },
        x2: function (d) { return +d[xc] + hx; },
        y1: function (d) { return +d[yc] - hy; },
        y2: function (d) { return +d[yc] + hy; },
        fill: vc,
        tip: function (d) { return xc + ': ' + d[xc] + '\n' + yc + ': ' + d[yc] + '\n' + vc + ': ' + d[vc]; }
      })
    ];
    return Plot.plot(o);
  }

  global.Miokr = global.Miokr || {};
  global.Miokr.charts = {
    render: render,
    renderHeatmap: renderHeatmap,
    palette: PALETTE,
    // 支持的类型列表（供 UI 使用）
    types: ['scatter', 'line', 'area', 'bar', 'histogram', 'box', 'heatmap']
  };
})(typeof window !== 'undefined' ? window : this);
