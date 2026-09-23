/* ============================================================
   Miokr sankey.js — 桑基流量图（基于 d3-sankey + d3）
   输入：source / target / value 三列
   ============================================================ */
(function (global) {
  'use strict';

  var d3 = global.d3;

  /**
   * 渲染桑基图。
   * @param {Object[]} data 行数据
   * @param {Object} opts {source, target, value, width, height}
   * @returns {SVGElement}
   */
  function render(data, opts) {
    opts = opts || {};
    var width = opts.width || 900;
    var height = opts.height || 560;
    var margin = { top: 16, right: 120, bottom: 16, left: 16 };

    // 构建节点 / 连线（按名称索引）
    var names = [];
    var index = {};
    function idOf(name) {
      name = String(name);
      if (!(name in index)) { index[name] = names.length; names.push(name); }
      return index[name];
    }

    var links = [];
    data.forEach(function (d) {
      var s = d[opts.source], t = d[opts.target];
      if (s == null || t == null || String(s).trim() === '' || String(t).trim() === '') return;
      var v = parseFloat(d[opts.value]);
      if (!isFinite(v) || v <= 0) v = 1;
      links.push({ source: idOf(s), target: idOf(t), value: v });
    });

    var nodes = names.map(function (n) { return { name: n }; });

    var sankey = d3.sankey()
      .nodeId(function (d) { return d.index; })
      .nodeWidth(18)
      .nodePadding(14)
      .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

    var graph = sankey({
      nodes: nodes.map(function (d) { return Object.assign({}, d); }),
      links: links.map(function (d) { return Object.assign({}, d); })
    });

    var color = d3.scaleOrdinal(d3.schemeTableau10);

    var svg = d3.create('svg')
      .attr('viewBox', [0, 0, width, height])
      .attr('width', width)
      .attr('height', height)
      .attr('font-family', 'inherit')
      .attr('font-size', 12)
      .style('max-width', '100%')
      .style('height', 'auto');

    // 连线
    svg.append('g')
      .attr('fill', 'none')
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', d3.sankeyLinkHorizontal())
      .attr('stroke', function (d) { return color(d.source.name); })
      .attr('stroke-opacity', 0.45)
      .attr('stroke-width', function (d) { return Math.max(1, d.width); })
      .append('title')
      .text(function (d) { return d.source.name + ' → ' + d.target.name + '\n数值: ' + d.value; });

    // 节点
    var node = svg.append('g')
      .selectAll('g')
      .data(graph.nodes)
      .join('g');

    node.append('rect')
      .attr('x', function (d) { return d.x0; })
      .attr('y', function (d) { return d.y0; })
      .attr('width', function (d) { return d.x1 - d.x0; })
      .attr('height', function (d) { return Math.max(1, d.y1 - d.y0); })
      .attr('fill', function (d) { return color(d.name); })
      .attr('rx', 2)
      .append('title')
      .text(function (d) { return d.name + '\n合计: ' + d.value; });

    node.append('text')
      .attr('x', function (d) { return d.x1 + 6; })
      .attr('y', function (d) { return (d.y0 + d.y1) / 2; })
      .attr('dy', '0.35em')
      .attr('text-anchor', 'start')
      .attr('fill', '#374151')
      .text(function (d) { return d.name; });

    return svg.node();
  }

  global.Miokr = global.Miokr || {};
  global.Miokr.sankey = { render: render };
})(typeof window !== 'undefined' ? window : this);
