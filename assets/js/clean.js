/* ============================================================
   Miokr clean.js — 数据清洗与筛选引擎
   规则管线：缺失值处理 → 行去重 → 条件筛选 → 行排序
   全部为纯函数，在浏览器内存中完成，不发起任何网络请求
   ============================================================ */
(function (global) {
  'use strict';

  var ALL = '*'; // 「全部列」占位符

  function isNum(v) { return global.Miokr.csv.isNumericString(v); }
  function num(v) { return parseFloat(String(v).trim()); }
  function isEmpty(v) { return v == null || String(v).trim() === ''; }
  function text(v) { return v == null ? '' : String(v); }

  /** 把 op.column 解析为实际参与运算的列数组 */
  function resolveColumns(columns, sel) {
    if (!sel || sel === ALL) return columns.slice();
    return columns.indexOf(sel) >= 0 ? [sel] : [];
  }

  function round(v, d) {
    var p = Math.pow(10, d);
    return Math.round(v * p) / p;
  }

  // ---------- 各规则实现 ----------

  /**
   * 缺失值处理。
   * strategy: drop 删除含缺失的行 | mean 填充均值（仅数值列） | constant 填充常数
   */
  function opMissing(rows, columns, meta, op) {
    var cols = resolveColumns(columns, op.column);
    if (!cols.length) return rows;

    if (op.strategy === 'drop') {
      return rows.filter(function (r) {
        for (var i = 0; i < cols.length; i++) {
          if (isEmpty(r[cols[i]])) return false;
        }
        return true;
      });
    }

    var fill = {};
    if (op.strategy === 'mean') {
      cols.forEach(function (c) {
        if (!(meta[c] && meta[c].type === 'numeric')) return; // 文本列不做均值填充
        var sum = 0, cnt = 0;
        rows.forEach(function (r) {
          if (isNum(r[c])) { sum += num(r[c]); cnt++; }
        });
        if (cnt) fill[c] = String(round(sum / cnt, 4));
      });
    } else {
      cols.forEach(function (c) { fill[c] = text(op.value); });
    }

    if (!Object.keys(fill).length) return rows;
    return rows.map(function (r) {
      var out = null;
      for (var i = 0; i < cols.length; i++) {
        var c = cols[i];
        if (fill[c] === undefined || !isEmpty(r[c])) continue;
        if (!out) out = shallowCopy(r);
        out[c] = fill[c];
      }
      return out || r;
    });
  }

  /** 行去重：按指定列（或全部列）比对，保留首次出现的行 */
  function opDedupe(rows, columns, meta, op) {
    var cols = resolveColumns(columns, op.column);
    if (!cols.length) return rows;
    var seen = Object.create(null);
    return rows.filter(function (r) {
      var key = cols.map(function (c) { return text(r[c]).trim(); }).join('\u0001');
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  /** 按列值过滤：range 范围 / contains 包含 / eq 等于 / neq 不等于 / gt 大于 / lt 小于 */
  function opFilter(rows, columns, meta, op) {
    var c = op.column;
    if (columns.indexOf(c) < 0) return rows;

    if (op.mode === 'range') {
      var min = isEmpty(op.min) ? null : parseFloat(op.min);
      var max = isEmpty(op.max) ? null : parseFloat(op.max);
      if (min == null && max == null) return rows;
      return rows.filter(function (r) {
        if (!isNum(r[c])) return false;
        var n = num(r[c]);
        if (min != null && !isNaN(min) && n < min) return false;
        if (max != null && !isNaN(max) && n > max) return false;
        return true;
      });
    }

    var q = text(op.value);
    if (op.mode === 'contains') {
      var needle = q.toLowerCase();
      return rows.filter(function (r) { return text(r[c]).toLowerCase().indexOf(needle) >= 0; });
    }
    if (op.mode === 'eq') {
      return rows.filter(function (r) { return sameValue(r[c], q); });
    }
    if (op.mode === 'neq') {
      return rows.filter(function (r) { return !sameValue(r[c], q); });
    }
    if (op.mode === 'gt' || op.mode === 'lt') {
      if (!isNum(q)) return rows;
      var bound = num(q);
      return rows.filter(function (r) {
        if (!isNum(r[c])) return false;
        return op.mode === 'gt' ? num(r[c]) > bound : num(r[c]) < bound;
      });
    }
    return rows;
  }

  function sameValue(cell, expect) {
    if (isNum(cell) && isNum(expect)) return num(cell) === num(expect);
    return text(cell).trim() === expect.trim();
  }

  /** 行排序：数值列按数值比较，文本列按本地化字符串比较；空值恒排末位 */
  function opSort(rows, columns, meta, op) {
    var c = op.column;
    if (columns.indexOf(c) < 0) return rows;
    var numeric = !!(meta[c] && meta[c].type === 'numeric');
    var dir = op.dir === 'desc' ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      var av = a[c], bv = b[c];
      var ae = isEmpty(av), be = isEmpty(bv);
      if (ae || be) return ae && be ? 0 : (ae ? 1 : -1);
      if (numeric && isNum(av) && isNum(bv)) {
        var d = num(av) - num(bv);
        return d === 0 ? 0 : (d > 0 ? dir : -dir);
      }
      var s = text(av).localeCompare(text(bv), 'zh');
      return s === 0 ? 0 : (s > 0 ? dir : -dir);
    });
  }

  function shallowCopy(r) {
    var o = {};
    for (var k in r) if (Object.prototype.hasOwnProperty.call(r, k)) o[k] = r[k];
    return o;
  }

  var OPS = { missing: opMissing, dedupe: opDedupe, filter: opFilter, sort: opSort };

  function applyOp(rows, columns, meta, op) {
    var fn = OPS[op && op.type];
    if (!fn) throw new Error('未知清洗规则：' + (op && op.type));
    return fn(rows, columns, meta, op);
  }

  /** 生成规则的中文描述（用于规则列表展示） */
  function describe(op, columns) {
    var scope = !op.column || op.column === ALL ? '全部列' : '「' + op.column + '」';
    switch (op.type) {
      case 'missing':
        if (op.strategy === 'drop') return '缺失值：删除' + scope + '含空值的行';
        if (op.strategy === 'mean') return '缺失值：' + scope + '空值填均值（数值列）';
        return '缺失值：' + scope + '空值填「' + text(op.value) + '」';
      case 'dedupe':
        return '去重：按' + scope + '去除重复行';
      case 'filter':
        if (op.mode === 'range') {
          var lo = isEmpty(op.min) ? '不限' : op.min;
          var hi = isEmpty(op.max) ? '不限' : op.max;
          return '筛选：' + scope + ' ∈ [' + lo + ', ' + hi + ']';
        }
        if (op.mode === 'contains') return '筛选：' + scope + ' 包含「' + text(op.value) + '」';
        if (op.mode === 'eq') return '筛选：' + scope + ' = 「' + text(op.value) + '」';
        if (op.mode === 'neq') return '筛选：' + scope + ' ≠ 「' + text(op.value) + '」';
        if (op.mode === 'gt') return '筛选：' + scope + ' > ' + text(op.value);
        if (op.mode === 'lt') return '筛选：' + scope + ' < ' + text(op.value);
        return '筛选';
      case 'sort':
        return '排序：按' + scope + (op.dir === 'desc' ? ' 降序' : ' 升序');
      default:
        return '未知规则';
    }
  }

  /**
   * 从原始数据出发，按顺序应用全部规则。
   * @param {Object[]} rows 原始行
   * @param {string[]} columns 列名
   * @param {Object} meta 列类型元信息
   * @param {Object[]} ops 规则数组
   * @returns {{rows:Object[], steps:Object[]}}
   */
  function applyOps(rows, columns, meta, ops) {
    var cur = rows.slice();
    var steps = [];
    (ops || []).forEach(function (op) {
      var before = cur.length;
      var err = null;
      try { cur = applyOp(cur, columns, meta, op); }
      catch (e) { err = e.message; }
      steps.push({
        op: op,
        label: describe(op, columns),
        before: before,
        after: cur.length,
        error: err
      });
    });
    return { rows: cur, steps: steps };
  }

  global.Miokr = global.Miokr || {};
  global.Miokr.clean = {
    ALL: ALL,
    isEmpty: isEmpty,
    describe: describe,
    applyOp: applyOp,
    applyOps: applyOps
  };
})(typeof window !== 'undefined' ? window : this);
