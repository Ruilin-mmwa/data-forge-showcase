(() => {
  "use strict";

  // Workload percentages are independently invented and intentionally fixed for replay.
  const samples = {
    trail:   [84, 103, 62, 119, 96, 154, 77, 91, 108, 132, 68, 101, 183, 113, 89],
    exhibit: [129, 75, 162, 100, 86, 124, 213, 95, 58, 144, 79, 106, 268, 116, 93],
    almanac: [102, 73, 89, 114, 81, 98, 139, 87, 100, 108, 155, 92, 112, 96, 78]
  };
  const centsToYuan = cents => '¥' + (cents / 100).toFixed(2);
  const percent = (count, total) => (100 * count / total).toFixed(1).replace(/\.0$/, '') + '%';
  const moneyRound = n => Math.round(n + 1e-9);

  window.renderForgeDistribution = function renderForgeDistribution(t, baseCost, net) {
    const factors = samples[t && t.id];
    if (!Array.isArray(factors) || !Number.isFinite(baseCost) || baseCost < 0 || !Number.isFinite(net)) return '';
    // With factors expressed as whole percentages, baseCost (yuan) × factor yields cents.
    const cents = factors.map(factor => moneyRound(baseCost * factor));
    const ranked = [...cents].sort((a, b) => a - b);
    const n = cents.length;
    const mean = cents.reduce((total, value) => total + value, 0) / n;
    const median = n % 2 ? ranked[(n - 1) / 2] : (ranked[n / 2 - 1] + ranked[n / 2]) / 2;
    const p90Rank = Math.ceil(0.9 * n);
    const p90 = ranked[p90Rank - 1];
    const netCents = moneyRound(net * 100);
    const over = cents.filter(value => value > netCents).length;
    const stats = [
      ["均值", centsToYuan(mean)], ["中位数", centsToYuan(median)],
      ["P90 成本", centsToYuan(p90)], ["成本超出实收", percent(over, n)]
    ];
    const statList = stats.map(([label,value]) => '<div><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('');
    const sampleRows = cents.map((value, i) => '<tr><th scope="row">'+String(i + 1).padStart(2,'0')+'</th><td>'+factors[i]+'%</td><td>'+centsToYuan(value)+'</td><td>'+(value > netCents ? '超出' : value === netCents ? '持平' : '覆盖')+'</td></tr>').join('');
    return '<details class="fdist"><summary>同一模板的成本分布 <span>'+n+' 件模拟样本</span></summary>' +
      '<p>把当前模板的典型单件模型成本按逐件工作量缩放，观察高用量任务的定价风险。这组独立模拟样本仅用于敏感性分析，组合核算继续使用典型单件成本。</p>' +
      '<dl class="fdist-stats">'+statList+'</dl><p>单件实收 '+centsToYuan(netCents)+'，其中 '+over+' / '+n+' 件的模型成本超过实收。采购、缓存、编辑次数或补贴变化后，样本按新参数重算。</p>' +
      '<details class="fdist-proof"><summary>复核逐件倍率与 P90</summary><p>按当前典型成本的未舍入值乘以固定工作量倍率，每件取到分。P90 采用最近秩法，在费用升序中取第 '+p90Rank+' 件（'+n+' × 90% 向上取整）。</p>' +
      '<div class="fdist-scroll"><table><thead><tr><th>样本</th><th>工作量倍率</th><th>模型成本</th><th>与实收比较</th></tr></thead><tbody>'+sampleRows+'</tbody></table></div></details></details>';
  };
})();
