/* Life Planner prototype — ECharts initialisation.
   Charts are mounted on [data-chart="emotion"] elements so that both the live
   phone prototype and text-mode prototype clones can render independently. */
(function () {
  'use strict';

  if (typeof echarts === 'undefined') return;

  var instances = [];

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    v = v ? v.trim() : '';
    return v || fallback;
  }

  function renderEmotion(el) {
    if (!el || el.getAttribute('data-chart-ready') === '1') return;
    if (!el.clientWidth) {
      var tries = parseInt(el.getAttribute('data-chart-tries') || '0', 10);
      if (tries > 25) return; /* 容器不可见时放弃，避免无限轮询 */
      el.setAttribute('data-chart-tries', String(tries + 1));
      window.setTimeout(function () { renderEmotion(el); }, 120);
      return;
    }
    el.setAttribute('data-chart-ready', '1');

    var accent = cssVar('--primary-soft', '#8FB996');
    var accent2 = cssVar('--accent2', '#E8A87C');
    var ink = cssVar('--text-main', '#2B3A2E');
    var muted = cssVar('--text-muted', '#6B7A6F');
    var rule = cssVar('--border-color', '#E7E3DA');

    var days = ['10/08', '10/09', '10/10', '10/11', '10/12', '10/13'];
    var before = [4, 3, 5, 4, 6, 3];
    var after = [7, 6, 6, 8, 7, 7];

    var chart = echarts.init(el, null, { renderer: 'svg' });
    chart.setOption({
      animation: false,
      color: [accent, accent2],
      grid: { left: 24, right: 10, top: 14, bottom: 20 },
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        backgroundColor: '#FFFFFF',
        borderColor: rule,
        textStyle: { color: ink, fontSize: 11 },
        axisPointer: { lineStyle: { color: rule } }
      },
      xAxis: {
        type: 'category',
        data: days,
        boundaryGap: false,
        axisLine: { lineStyle: { color: rule } },
        axisTick: { show: false },
        axisLabel: { color: muted, fontSize: 9 }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 10,
        interval: 5,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: muted, fontSize: 9 },
        splitLine: { lineStyle: { color: rule, type: 'dashed' } }
      },
      series: [
        {
          name: '会话开始',
          type: 'line',
          smooth: true,
          symbolSize: 5,
          data: before,
          lineStyle: { color: accent, width: 2 },
          itemStyle: { color: accent, borderColor: '#fff', borderWidth: 1 },
          areaStyle: { color: 'rgba(143,185,150,0.18)' }
        },
        {
          name: '会话结束',
          type: 'line',
          smooth: true,
          symbolSize: 5,
          data: after,
          lineStyle: { color: accent2, width: 2 },
          itemStyle: { color: accent2, borderColor: '#fff', borderWidth: 1 },
          areaStyle: { color: 'rgba(232,168,124,0.16)' }
        }
      ]
    });
    instances.push(chart);
  }

  window.LifePlannerCharts = {
    attachAll: function (root) {
      var scope = root || document;
      var mounts = scope.querySelectorAll('[data-chart="emotion"]');
      for (var i = 0; i < mounts.length; i++) renderEmotion(mounts[i]);
    }
  };

  window.addEventListener('resize', function () {
    for (var i = 0; i < instances.length; i++) {
      if (instances[i]) instances[i].resize();
    }
  });
})();
