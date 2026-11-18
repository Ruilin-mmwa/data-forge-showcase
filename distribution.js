(() => {
  'use strict';
  window.renderForgeDistribution = function distribution(centsByApp) {
    if (!Array.isArray(centsByApp) || !centsByApp.length) return '';
    const ranked = [...centsByApp].sort((a,b)=>a-b);
    const n=ranked.length, rank=Math.ceil(n*.9);
    const median = (ranked[Math.floor((n-1)/2)]+ranked[Math.floor(n/2)])/2;
    const money = cents => '¥'+(cents/100).toFixed(2);
    return '<details class="fdist"><summary>查看本模板单个 App 的成本分布</summary><p>按本期 '+n+' 个合成 App 的结算费用从低到高排列。中位数为 '+money(median)+'，P90 为 '+money(ranked[rank-1])+'（第 '+rank+' 个）。</p><p>排序后的成本：'+ranked.map(money).join('、')+'。</p></details>';
  };
})();
