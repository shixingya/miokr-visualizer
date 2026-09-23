/* ============================================================
   Miokr export.js — 图表导出（SVG / PNG）+ 免费版水印
   会员状态：纯客户端 localStorage 标记，无后端校验
   ============================================================ */
(function (global) {
  'use strict';

  var MEMBER_KEY = 'miokr_member';

  function isMember() {
    try { return localStorage.getItem(MEMBER_KEY) === '1'; }
    catch (e) { return false; }
  }

  /** 触发浏览器下载 */
  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /** 克隆 SVG 并内联必要样式，返回可序列化的 SVG 元素 */
  function prepareSVG(svgEl, width, height) {
    var clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    if (width) clone.setAttribute('width', width);
    if (height) clone.setAttribute('height', height);

    // 白色背景（导出图不透明）
    var bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', 0); bg.setAttribute('y', 0);
    bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%');
    bg.setAttribute('fill', '#ffffff');
    clone.insertBefore(bg, clone.firstChild);

    // 免费版水印
    if (!isMember()) {
      var wm = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      wm.setAttribute('x', '50%');
      wm.setAttribute('y', '50%');
      wm.setAttribute('text-anchor', 'middle');
      wm.setAttribute('dominant-baseline', 'middle');
      wm.setAttribute('font-size', Math.round(Math.min(width, height) / 9));
      wm.setAttribute('font-family', 'sans-serif');
      wm.setAttribute('font-weight', 'bold');
      wm.setAttribute('fill', 'rgba(37,99,235,0.14)');
      wm.setAttribute('transform', 'rotate(-24 ' + (width / 2) + ' ' + (height / 2) + ')');
      wm.textContent = 'Miokr 免费版';
      clone.appendChild(wm);
    }
    return clone;
  }

  /** 读取 SVG 的像素尺寸 */
  function getSize(svgEl) {
    var box = svgEl.getBoundingClientRect();
    var w = Math.round(svgEl.getAttribute('width') || box.width || 900);
    var h = Math.round(svgEl.getAttribute('height') || box.height || 560);
    // viewBox 兜底
    var vb = svgEl.getAttribute && svgEl.getAttribute('viewBox');
    if (vb) {
      var p = vb.split(/[\s,]+/).map(Number);
      if (p.length === 4) { w = p[2]; h = p[3]; }
    }
    return { width: w, height: h };
  }

  /** 导出 SVG 文件 */
  function exportSVG(svgEl, filename) {
    var size = getSize(svgEl);
    var clone = prepareSVG(svgEl, size.width, size.height);
    var src = new XMLSerializer().serializeToString(clone);
    var blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + src], { type: 'image/svg+xml;charset=utf-8' });
    download(blob, (filename || 'miokr-chart') + '.svg');
  }

  /** 导出 PNG 文件（会员 3x，免费 2x） */
  function exportPNG(svgEl, filename) {
    var size = getSize(svgEl);
    var scale = isMember() ? 3 : 2;
    var clone = prepareSVG(svgEl, size.width, size.height);
    var src = new XMLSerializer().serializeToString(clone);
    // 用 UTF-8 data URL 载入图像：比 blob URL 兼容性更好，且正确保留中文水印
    var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);

    var img = new Image();
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = size.width * scale;
      canvas.height = size.height * scale;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) {
        download(blob, (filename || 'miokr-chart') + '.png');
      }, 'image/png');
    };
    img.onerror = function () {
      alert('PNG 导出失败，请尝试导出 SVG。');
    };
    img.src = url;
  }

  global.Miokr = global.Miokr || {};
  global.Miokr.export = {
    isMember: isMember,
    exportSVG: exportSVG,
    exportPNG: exportPNG
  };
})(typeof window !== 'undefined' ? window : this);
