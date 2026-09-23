/* ============================================================
   Miokr network.js — 拓扑网络图（d3-force 力学模拟 + 可拖拽）
   输入：边表 source / target [/ weight]
   ============================================================ */
(function (global) {
  'use strict';

  var d3 = global.d3;

  /**
   * 渲染拓扑网络图。
   * @param {Object[]} data 边表行数据
   * @param {Object} opts {source, target, weight?, width, height}
   * @returns {SVGElement}
   */
  function render(data, opts) {
    opts = opts || {};
    var width = opts.width || 900;
    var height = opts.height || 560;

    // 从边表推导节点
    var nodeIndex = {};
    var nodes = [];
    function ensure(name) {
      name = String(name);
      if (!(name in nodeIndex)) {
        nodeIndex[name] = nodes.length;
        nodes.push({ id: name });
      }
      return nodeIndex[name];
    }

    var links = [];
    data.forEach(function (d) {
      var s = d[opts.source], t = d[opts.target];
      if (s == null || t == null || String(s).trim() === '' || String(t).trim() === '') return;
      var w = opts.weight ? parseFloat(d[opts.weight]) : 1;
      if (!isFinite(w) || w <= 0) w = 1;
      links.push({ source: ensure(s), target: ensure(t), weight: w });
    });

    // 节点度数（用于半径与配色）
    var degree = new Array(nodes.length).fill(0);
    links.forEach(function (l) { degree[l.source]++; degree[l.target]++; });
    nodes.forEach(function (n, i) { n.degree = degree[i]; });

    var maxDeg = Math.max(1, d3.max(nodes, function (n) { return n.degree; }));
    var rScale = d3.scaleSqrt().domain([1, maxDeg]).range([6, 18]);
    var color = d3.scaleSequential(d3.interpolateBlues).domain([1, maxDeg]);

    var svg = d3.create('svg')
      .attr('viewBox', [0, 0, width, height])
      .attr('width', width)
      .attr('height', height)
      .attr('font-family', 'inherit')
      .attr('font-size', 11)
      .style('max-width', '100%')
      .style('height', 'auto');

    var link = svg.append('g')
      .attr('stroke', '#9ca3af')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', function (d) { return Math.max(1, Math.sqrt(d.weight)); })
      .append('title')
      .text(function (d) { return d.source.id + ' — ' + d.target.id + '\n权重: ' + d.weight; });

    // 重新选中 line（上一步 append title 返回的是 title 选择集）
    link = svg.select('g').selectAll('line');

    var node = svg.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'grab');

    node.append('circle')
      .attr('r', function (d) { return rScale(d.degree); })
      .attr('fill', function (d) { return d.degree > 1 ? color(d.degree) : '#2563eb'; })
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .append('title')
      .text(function (d) { return d.id + '\n连接数: ' + d.degree; });

    node.append('text')
      .attr('dy', function (d) { return -rScale(d.degree) - 3; })
      .attr('text-anchor', 'middle')
      .attr('fill', '#374151')
      .attr('pointer-events', 'none')
      .text(function (d) { return d.id; });

    var simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(function (d) { return d.index; }).distance(70).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(function (d) { return rScale(d.degree) + 4; }));

    simulation.on('tick', function () {
      link
        .attr('x1', function (d) { return d.source.x; })
        .attr('y1', function (d) { return d.source.y; })
        .attr('x2', function (d) { return d.target.x; })
        .attr('y2', function (d) { return d.target.y; });
      node.attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    });

    // 拖拽行为
    node.call(d3.drag()
      .on('start', function (event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', function (event, d) { d.fx = event.x; d.fy = event.y; })
      .on('end', function (event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      }));

    // 暴露 stop 便于切换图表时清理
    svg.node().__simulation = simulation;
    return svg.node();
  }

  global.Miokr = global.Miokr || {};
  global.Miokr.network = { render: render };
})(typeof window !== 'undefined' ? window : this);
