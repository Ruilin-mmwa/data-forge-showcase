(() => {
  const specifications = [
    {id:'open', title:'打开工作单', evidence:'工作单编号', field:'sheet', description:'每次打开样例工作单，都应有一条包含工作单编号的记录。'},
    {id:'save', title:'保存筛选条件', evidence:'筛选方案编号', field:'filter', description:'保存筛选条件时记录方案编号，供复盘哪些方案被重复使用。'},
    {id:'preview', title:'预览结果', evidence:'预览版本', field:'edition', description:'预览计算结果时，记录使用的版本以便复查。'},
    {id:'export', title:'导出结果', evidence:'导出格式', field:'format', description:'保存结果时保留导出格式，以便对照分析人员的交付需求。'},
    {id:'archive', title:'归档方案', evidence:'归档批次', field:'batch', description:'归档完成时应记录批次，供后续核对。'}
  ];
  const testCases = [
    ['晨间核算','open','save','preview','export'],
    ['月底复盘','open','preview','export','archive'],
    ['草稿留存','open','save','archive']
  ];
  const reasons = {
    open:'样例流程、触发记录和入库字段一致。',
    save:'保存操作完成后，样例客户端遗漏了事件触发。',
    preview:'第一条预览记录在写入环节丢失，客户端仍有触发凭据。',
    export:'第一条导出记录入库成功，但缺少导出格式。',
    archive:'第二次归档重试沿用相同事件编号，产生了重复回执。'
  };
  function replay(corrected) {
    const records = [];
    for (const [caseIndex, [name,...actions]] of testCases.entries()) {
      for (const [stepIndex, key] of actions.entries()) {
        const id = 'U' + (caseIndex + 1) + '-' + (stepIndex + 1);
        const field = specifications.find(spec => spec.id === key).field;
        const payload = {[field]:({sheet:'W'+(caseIndex+1),filter:'F'+(stepIndex+1),edition:'v2',format:'CSV',batch:'G4'})[field]};
        const fired = corrected || key !== 'save';
        let received = fired && (corrected || !(key === 'preview' && caseIndex === 0)) ? [payload] : [];
        if (!corrected && key === 'export' && caseIndex === 0) received = [{}];
        if (!corrected && key === 'archive' && caseIndex === 2) received = [payload, {...payload}];
        records.push({key,id,name,fired,received});
      }
    }
    return records;
  }
  function measure(spec, records) {
    const chosen = records.filter(r => r.key === spec.id);
    const fired = chosen.filter(r => r.fired).length;
    const receipts = chosen.reduce((n,r) => n + r.received.length,0);
    const unique = chosen.filter(r => r.received.length).length;
    const usable = chosen.filter(r => r.received.some(p=>p[spec.field])).length;
    const issue = fired < chosen.length ? '未触发' : unique < fired ? '未入库' : usable < unique ? '字段缺失' : receipts > unique ? '重复回执' : '通过';
    return {chosen,fired,receipts,unique,usable,issue};
  }

  window.mountForgeAudit = container => {
    let corrected = false;
    let selected = 'save';
    function render() {
      const records = replay(corrected);
      const checked = specifications.map(s=>measure(s,records));
      const pass = checked.filter(x=>x.issue==='通过').length;
      const spec = specifications.find(x=>x.id===selected);
      const current = measure(spec,records);
      container.innerHTML = `<div class="audit-panel">
        <div class="audit-toolbar"><div><h2>验收回放</h2><p>3 条流程覆盖 5 个事件。相同用例可以分别在两种采集实现上运行。</p></div>
        <div role="group" aria-label="选择采集实现" class="audit-toggle">
        <button type="button" data-audit="initial" aria-pressed="${!corrected}">原始采集</button>
        <button type="button" data-audit="fixed" aria-pressed="${corrected}">模拟修复并回放</button></div></div>
        <div class="audit-score" role="status"><b>${pass} / ${specifications.length} 项通过</b><span>${corrected?'复验覆盖相同的 '+records.length+' 个预期动作。选择下方事件可核对修复前的缺口。':'选择异常事件，可以看到缺口出现在哪一层。'}</span></div>
        <div class="audit-scroll"><table><caption>需求、触发与入库对账</caption><thead><tr><th scope="col">需求事件</th><th scope="col">预期次数</th><th scope="col">客户端触发</th><th scope="col">入库回执</th><th scope="col">验收</th></tr></thead>
        <tbody>${specifications.map((s,i)=>{const a=checked[i];return `<tr class="${s===spec?'audit-current':''}"><th scope="row"><button data-event="${s.id}" aria-pressed="${s===spec}">${s.title}</button></th><td>${a.chosen.length}</td><td>${a.fired}</td><td>${a.receipts}</td><td><span class="audit-status ${a.issue==='通过'?'audit-ok':''}">${a.issue}</span></td></tr>`;}).join('')}</tbody></table></div></div>
        <section class="audit-panel audit-detail"><h2>${spec.title} · 样本证据</h2><p>${spec.description}</p><p class="audit-finding"><strong>${corrected?'复验发现':'定位结果'}</strong>　${corrected?(spec.id==='open'?reasons.open:'修复前：'+reasons[spec.id]+' 本次按相同事件编号复验，回执完整且每次只写入一条。'):reasons[spec.id]}</p>
        <div class="audit-scroll"><table><caption>逐条回放记录</caption><thead><tr><th>用例／事件编号</th><th>触发</th><th>回执数</th><th>${spec.evidence}</th></tr></thead><tbody>${current.chosen.map(r=>`<tr><th scope="row">${r.name} · ${r.id}</th><td>${r.fired?'已触发':'未触发'}</td><td>${r.received.length}</td><td>${r.received.length?r.received[0][spec.field]||'字段缺失':'无回执'}</td></tr>`).join('')}</tbody></table></div>
        <p>通过条件为每个预期动作触发一次、恰有一条回执，且回执包含必填字段。</p></section>`;
    }
    container.addEventListener('click', e => {
      const button = e.target.closest('button');
      if (!button) return;
      let selector;
      if (button.dataset.audit) {
        corrected = button.dataset.audit === 'fixed';
        selector = '[data-audit="' + button.dataset.audit + '"]';
      } else if (button.dataset.event) {
        selected = button.dataset.event;
        selector = '[data-event="' + selected + '"]';
      } else return;
      render();
      container.querySelector(selector).focus({preventScroll:true});
    });
    render();
  };
})();
