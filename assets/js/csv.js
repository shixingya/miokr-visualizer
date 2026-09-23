/* ============================================================
   Miokr csv.js — 轻量 CSV 解析 + 列类型自动识别
   纯本地实现，不引入外部库、不发起任何网络请求
   ============================================================ */
(function (global) {
  'use strict';

  /**
   * 解析 CSV 文本为对象数组。
   * 支持：引号包裹字段、字段内逗号、双引号转义("")、\r\n 与 \n 换行。
   * @param {string} text 原始 CSV 文本
   * @returns {{columns:string[], rows:Object[]}}
   */
  function parseCSV(text) {
    if (typeof text !== 'string') text = String(text == null ? '' : text);
    // 去除 BOM
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    var rows = [];
    var field = '';
    var record = [];
    var inQuotes = false;
    var i = 0;
    var n = text.length;

    while (i < n) {
      var c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ',') { record.push(field); field = ''; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { record.push(field); rows.push(record); record = []; field = ''; i++; continue; }
      field += c; i++;
    }
    // 收尾最后一段
    if (field.length > 0 || record.length > 0) { record.push(field); rows.push(record); }

    // 过滤完全空白的行
    rows = rows.filter(function (r) {
      return !(r.length === 1 && r[0].trim() === '');
    });
    if (rows.length === 0) return { columns: [], rows: [] };

    var columns = rows[0].map(function (h, idx) {
      h = (h || '').trim();
      return h === '' ? ('列' + (idx + 1)) : h;
    });

    var data = [];
    for (var r = 1; r < rows.length; r++) {
      var obj = {};
      for (var cIdx = 0; cIdx < columns.length; cIdx++) {
        obj[columns[cIdx]] = rows[r][cIdx] !== undefined ? rows[r][cIdx] : '';
      }
      data.push(obj);
    }
    return { columns: columns, rows: data };
  }

  /** 判断字符串是否为数值（含整数、小数、科学计数法、负号） */
  function isNumericString(s) {
    if (s == null) return false;
    var t = String(s).trim();
    if (t === '') return false;
    return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t);
  }

  /**
   * 自动识别列类型。
   * 规则：非空值中 >=80% 可解析为数值 → 数值列；否则文本列。
   * 额外识别经度 / 纬度候选列（按列名与取值范围）。
   * @param {Object[]} rows 对象数组
   * @param {string[]} columns 列名
   * @returns {{numeric:string[], text:string[], meta:Object}}
   */
  function detectColumns(rows, columns) {
    var numeric = [], text = [], meta = {};

    columns.forEach(function (col) {
      var total = 0, numCount = 0;
      for (var i = 0; i < rows.length; i++) {
        var v = rows[i][col];
        if (v == null || String(v).trim() === '') continue;
        total++;
        if (isNumericString(v)) numCount++;
      }
      var isNum = total > 0 && (numCount / total) >= 0.8;
      meta[col] = {
        type: isNum ? 'numeric' : 'text',
        nonEmpty: total,
        numericRatio: total ? numCount / total : 0
      };
      if (isNum) numeric.push(col); else text.push(col);
    });

    // 经纬度识别：列名匹配 + 取值范围
    meta.__geo = guessGeoColumns(rows, columns, numeric);

    return { numeric: numeric, text: text, meta: meta };
  }

  /** 依据列名与数值范围猜测经度 / 纬度列 */
  function guessGeoColumns(rows, columns, numeric) {
    var lonPat = /(经度|longitude|lon|lng|x)/i;
    var latPat = /(纬度|latitude|lat|y)/i;
    var lon = null, lat = null;

    numeric.forEach(function (col) {
      var range = columnRange(rows, col);
      if (!range) return;
      var looksLon = lonPat.test(col) && range.min >= -180 && range.max <= 180;
      var looksLat = latPat.test(col) && range.min >= -90 && range.max <= 90;
      if (!lon && looksLon) lon = col;
      if (!lat && looksLat) lat = col;
    });
    return { lon: lon, lat: lat };
  }

  /** 计算数值列的最小 / 最大值 */
  function columnRange(rows, col) {
    var min = Infinity, max = -Infinity, found = false;
    for (var i = 0; i < rows.length; i++) {
      var v = rows[i][col];
      if (isNumericString(v)) {
        var num = parseFloat(v);
        if (num < min) min = num;
        if (num > max) max = num;
        found = true;
      }
    }
    return found ? { min: min, max: max } : null;
  }

  /**
   * 将对象数组中的数值列转换为 number 类型（供图表库使用）。
   * 文本列保持字符串。返回新数组，不修改原数据。
   */
  function coerceNumeric(rows, columns, meta) {
    var numSet = {};
    columns.forEach(function (c) { if (meta && meta[c] && meta[c].type === 'numeric') numSet[c] = true; });
    return rows.map(function (row) {
      var out = {};
      columns.forEach(function (c) {
        var v = row[c];
        out[c] = numSet[c] && isNumericString(v) ? parseFloat(v) : v;
      });
      return out;
    });
  }

  global.Miokr = global.Miokr || {};
  global.Miokr.csv = {
    parse: parseCSV,
    isNumericString: isNumericString,
    detectColumns: detectColumns,
    columnRange: columnRange,
    coerceNumeric: coerceNumeric
  };
})(typeof window !== 'undefined' ? window : this);
