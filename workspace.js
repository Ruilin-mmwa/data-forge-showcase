(() => {
  const routes = {
    cost: ['成本实验室', '逐个调整模板的售价、采购条件和用量，检验哪些业务组合还能覆盖模型成本。', window.mountForgeCost],
    trace: ['指标追溯', '从一个指标回到口径、计算和样本记录，核对漏报对结论的影响。', window.mountForgeTrace],
    audit: ['埋点验收', '沿需求、触发、入库三层定位缺口，用同一批合成用例回放并复验。', window.mountForgeAudit],
    overview: ['经营概览', '按日期、模板和账号筛选构建记录，点击指标卡可核对本批样本和成本分摊。', mountOverview]
  };
  const mounted = new Set();

  function mountOverview(container) {
    const frame = document.createElement('iframe');
    frame.title = '经营概览的构建样本、指标明细与成本分摊';
    frame.className = 'overview-frame';
    frame.addEventListener('load', () => {
      const innerMain = frame.contentDocument.querySelector('main');
      new ResizeObserver(() => {
        frame.style.height = Math.ceil(innerMain.getBoundingClientRect().height + 6) + 'px';
      }).observe(innerMain);
    });
    frame.src = 'overview.html';
    container.append(frame);
  }

  function showView(moveFocus) {
    const requested = location.hash.slice(1);
    const active = Object.hasOwn(routes, requested) ? requested : 'cost';
    const [name, description, mount] = routes[active];
    const title = document.getElementById('view-title');
    title.textContent = name;
    document.getElementById('view-description').textContent = description;
    document.title = name + ' · Data Forge';
    for (const link of document.querySelectorAll('.work-nav a')) {
      if (link.hash === '#' + active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    for (const pane of document.querySelectorAll('.work-pane')) pane.hidden = pane.id !== active + '-pane';
    if (!mounted.has(active)) {
      mount(document.getElementById(active + '-pane'));
      mounted.add(active);
    }
    if (moveFocus) title.focus({preventScroll: true});
  }

  window.addEventListener('hashchange', () => { showView(true); window.scrollTo(0, 0); });
  showView(false);
})();
