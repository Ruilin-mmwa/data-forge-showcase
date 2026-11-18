(() => {
  const routes = {
    dashboard: {title: '产品运营看板', mount: window.mountOpsDashboard},
    funnel: {title: '转化分析', mount: window.mountOpsFunnel},
    cost: {title: '成本核算', mount: window.mountForgeCost}
  };
  const legacyRoutes = {overview: 'dashboard', trace: 'dashboard', audit: 'funnel'};
  const mounted = new Set();

  function showView(moveFocus) {
    const hash = location.hash.slice(1);
    const active = Object.hasOwn(routes, hash) ? hash
      : Object.hasOwn(legacyRoutes, hash) ? legacyRoutes[hash] : 'dashboard';
    if (hash && hash !== active) history.replaceState(null, '', '#' + active);
    const route = routes[active];
    const title = document.getElementById('view-title');
    title.textContent = route.title;
    document.title = route.title + ' · Data Forge';
    for (const link of document.querySelectorAll('.work-nav a')) {
      if (link.hash === '#' + active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    for (const pane of document.querySelectorAll('.work-pane')) pane.hidden = pane.id !== active + '-pane';
    if (!mounted.has(active)) {
      route.mount(document.getElementById(active + '-pane'));
      mounted.add(active);
    }
    if (hash === 'trace') {
      document.querySelector('#dashboard-pane [data-op-metric="dau"][aria-expanded="false"]')?.click();
    }
    if (moveFocus) title.focus({preventScroll:true});
  }

  window.addEventListener('hashchange', () => { showView(true); window.scrollTo(0, 0); });
  showView(false);
})();
