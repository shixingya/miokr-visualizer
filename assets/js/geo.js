/* ============================================================
   Miokr geo.js — 经纬度点位图
   合规要点：仅用 D3 等距投影渲染点位 + 经纬网格线，
   不加载任何底图瓦片、不调用第三方地图 SDK、不联网。
   ============================================================ */
(function (global) {
  'use strict';

  var d3 = global.d3;

  /**
   * 渲染经纬度点位图。
   * @param {Object[]} data 行数据
   * @param {Object} opts {lon, lat, label?, value?, width, height}
   * @returns {SVGElement}
   */
  function render(data, opts) {
    opts = opts || {};
    var width = opts.width || 900;
    var height = opts.height || 560;

    // 仅保留合法经纬度点
    var pts = [];
    data.forEach(function (d) {
      var lon = parseFloat(d[opts.lon]);
      var lat = parseFloat(d[opts.lat]);
      if (!isFinite(lon) || !isFinite(lat)) return;
      if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return;
      pts.push({
        lon: lon, lat: lat,
        name: opts.label ? String(d[opts.label]) : ('(' + lon + ', ' + lat + ')'),
        value: opts.value ? parseFloat(d[opts.value]) : null
      });
    });

    var svg = d3.create('svg')
      .attr('viewBox', [0, 0, width, height])
      .attr('width', width)
      .attr('height', height)
      .attr('font-family', 'inherit')
      .attr('font-size', 11)
      .style('max-width', '100%')
      .style('height', 'auto');

    // 等距圆柱投影（无底图，仅坐标框架）
    var projection = d3.geoEquirectangular()
      .fitExtent([[40, 30], [width - 40, height - 40]], {
        type: 'MultiPoint',
        coordinates: pts.length ? pts.map(function (p) { return [p.lon, p.lat]; }) : [[0, 0]]
      });
    var path = d3.geoPath(projection);

    // 经纬网格（graticule）——纯坐标参考，非地图底图
    svg.append('path')
      .datum(d3.geoGraticule10())
      .attr('d', path)
      .attr('fill', 'none')
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 0.6);

    // 外框（赤道/本初子午线强调）
    svg.append('path')
      .datum({ type: 'Sphere' })
      .attr('d', path)
      .attr('fill', '#f9fafb')
      .attr('fill-opacity', 0.4)
      .attr('stroke', '#d1d5db')
      .attr('stroke-width', 1)
      .lower();

    // 数值色阶
    var hasVal = pts.some(function (p) { return p.value != null && isFinite(p.value); });
    var extent = hasVal ? d3.extent(pts, function (p) { return p.value; }) : [0, 1];
    var rScale = d3.scaleSqrt().domain(extent).range([5, 14]);
    var cScale = d3.scaleSequential(d3.interpolateBlues).domain(extent);

    svg.append('g')
      .selectAll('circle')
      .data(pts)
      .join('circle')
      .attr('cx', function (d) { return projection([d.lon, d.lat])[0]; })
      .attr('cy', function (d) { return projection([d.lon, d.lat])[1]; })
      .attr('r', function (d) { return hasVal && isFinite(d.value) ? rScale(d.value) : 6; })
      .attr('fill', function (d) { return hasVal && isFinite(d.value) ? cScale(d.value) : '#2563eb'; })
      .attr('fill-opacity', 0.75)
      .attr('stroke', '#1d4ed8')
      .attr('stroke-width', 1)
      .append('title')
      .text(function (d) {
        var s = d.name + '\n经度: ' + d.lon + '  纬度: ' + d.lat;
        if (d.value != null && isFinite(d.value)) s += '\n' + (opts.value || '数值') + ': ' + d.value;
        return s;
      });

    // 合规提示文字
    svg.append('text')
      .attr('x', 12).attr('y', height - 10)
      .attr('fill', '#9ca3af').attr('font-size', 10)
      .text('坐标散点示意（无地图底图） · 数据仅在本地渲染');

    return svg.node();
  }

  global.Miokr = global.Miokr || {};
  global.Miokr.geo = { render: render };
})(typeof window !== 'undefined' ? window : this);
