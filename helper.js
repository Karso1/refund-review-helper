(() => {
  'use strict';
  if (document.getElementById('refund-review-helper')) return;
  const all = (s, r = document) => [...r.querySelectorAll(s)];
  const txt = e => (e?.textContent || '').replace(/\s+/g, '').trim();
  const visible = e => !!e?.isConnected && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const enabled = e => visible(e) && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && !/disabled|loading/.test(e.className || '');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const dialogs = () => all('.ant-modal-content,.el-dialog,[role="dialog"]').filter(visible);
  const refundDialog = () => dialogs().find(e => txt(e).includes('退款初审'));
  function button(root, label) {
    if (!root) return null;
    const controls = 'button,a,[role="button"],.ant-btn,.el-button,input[type="button"],input[type="submit"]';
    const matches = e => (e.matches('input') ? e.value : txt(e)) === label;
    const usable = e => enabled(e) && !e.closest('[disabled],[aria-disabled="true"],.ant-btn-loading,.el-button.is-loading,.is-disabled');
    const standard = all(controls, root).find(e => matches(e) && usable(e));
    if (standard) return standard;
    // Custom components often render a div/span with a delegated click handler.
    // Restrict fallback to the refund dialog and an exact, leaf-most label.
    if (label !== '同意' || !txt(root).includes('退款初审')) return null;
    const candidates = all('div,span', root).filter(e => matches(e) && usable(e)
      && !all('div,span', e).some(child => matches(child) && visible(child)));
    if (candidates.length !== 1) return null;
    const leaf = candidates[0];
    const control = leaf.closest(controls);
    return control && root.contains(control) ? (usable(control) ? control : null) : leaf;
  }
  function rows() {
    const result = new Map();
    for (const row of all('tbody tr')) {
      if (!visible(row)) continue;
      const action = button(row, '初审');
      const cells = all('td', row);
      const key = txt(cells[0]);
      if (action && /^\d+$/.test(key) && cells.length >= 3) result.set(key, {key, action});
    }
    return [...result.values()];
  }
  const onList = () => all('thead').some(e => txt(e).includes('退款金额'));
  const host = document.createElement('aside');
  host.id = 'refund-review-helper';
  host.style.cssText = 'position:fixed;left:16px;bottom:20px;z-index:2147483647;width:290px';
  const ui = host.attachShadow({mode:'closed'});
  ui.innerHTML = `<style>
    section{font:14px/1.6 system-ui;color:#172033;background:white;padding:16px;border:1px solid #ccd4e0;border-radius:12px;box-shadow:0 6px 28px #0003}
    header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}#fold{margin:0;padding:0;width:25px;height:25px;flex-shrink:0;font-size:18px}#body[hidden]{display:none}h3{margin:0;font-size:16px;cursor:move;touch-action:none;user-select:none}p{margin:8px 0;white-space:pre-wrap;overflow-wrap:anywhere}small{color:#64748b}
    button{background:#2563eb;color:white;border:0;border-radius:6px;padding:8px 10px;margin:5px 3px 0 0;cursor:pointer}button:disabled{opacity:.45}#stop{background:#dc2626}#export{background:#64748b}
    #status{background:#f1f5f9;padding:8px;border-radius:6px}
    </style><section><header><h3 title="按住这里拖动面板">退款管理列表初审</h3><button id="fold" type="button" aria-expanded="true" aria-controls="body" title="折叠窗口">−</button></header><div id="body"><small>自动遍历全部页：初审 → 同意。报错跳过，不重复提交。</small>
    <p id="status">请在“初审中”列表点击开始。</p><small id="count">尚未处理</small><br>
    <button id="start">开始自动处理</button><button id="stop" disabled>停止</button><button id="export">导出日志</button></div></section>`;
  document.body.appendChild(host);
  const $ = id => ui.getElementById(id);
  const positionKey = 'refund-review-helper-position-v1';
  let folded = false;
  function place(x, y) {
    const rect = host.getBoundingClientRect();
    host.style.bottom = 'auto';
    host.style.left = Math.max(0, Math.min(x, innerWidth - rect.width)) + 'px';
    host.style.top = Math.max(0, Math.min(y, innerHeight - rect.height)) + 'px';
  }
  function savePosition() {
    const rect = host.getBoundingClientRect();
    try { localStorage.setItem(positionKey, JSON.stringify({x:rect.x,y:rect.y,folded})); } catch {}
  }
  function setFolded(value) {
    const rect = host.getBoundingClientRect();
    folded = !!value;
    $('body').hidden = folded;
    $('fold').textContent = folded ? '+' : '−';
    $('fold').title = folded ? '展开窗口' : '折叠窗口';
    $('fold').setAttribute('aria-expanded', String(!folded));
    place(rect.x, rect.y);
  }
  $('fold').onclick = () => { setFolded(!folded); savePosition(); };
  try {
    const saved = JSON.parse(localStorage.getItem(positionKey));
    if (saved) setFolded(saved.folded);
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) place(saved.x, saved.y);
  } catch {}
  const handle = ui.querySelector('h3');
  let drag = null;
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const rect = host.getBoundingClientRect();
    drag = {id:event.pointerId,dx:event.clientX-rect.x,dy:event.clientY-rect.y};
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  handle.addEventListener('pointermove', event => {
    if (drag?.id === event.pointerId) place(event.clientX-drag.dx, event.clientY-drag.dy);
  });
  function endDrag(event) {
    if (drag?.id !== event.pointerId) return;
    drag = null;
    savePosition();
  }
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  handle.addEventListener('lostpointercapture', endDrag);
  addEventListener('resize', () => {
    if (host.hidden) return;
    const rect = host.getBoundingClientRect();
    place(rect.x,rect.y); savePosition();
  });
  const status = message => { $('status').textContent = message; };
  const logs = [], attempted = new Set();
  let running = false, stopped = false, route = '', notices = [], watching = false;
  const noticeState = new WeakMap();
  const noticeSelector = '.ant-message-notice-content,.ant-notification-notice,.el-message,.el-notification,.ant-form-item-explain-error,.el-form-item__error,[role="alert"]';
  function scanNotices() {
    for (const node of all(noticeSelector).filter(visible)) {
      const message = txt(node);
      if (noticeState.get(node) === message) continue;
      noticeState.set(node, message);
      if (!watching || !message) continue;
      const error = !!node.querySelector('.anticon-close-circle,.ant-message-error,.el-icon-error') || node.matches('.el-message--error,.ant-form-item-explain-error,.el-form-item__error') || /失败|错误|异常|不足|不允许|无法|超限|超过|请填写|必填|不能|无权限|error|failed/i.test(message);
      const success = !error && (!!node.querySelector('.anticon-check-circle,.ant-message-success') || node.matches('.el-message--success') || /成功/.test(message));
      if (error || success) notices.push({error, success, message});
    }
  }
  new MutationObserver(scanNotices).observe(document.body, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class','style']});
  function check() {
    if (stopped || location.href !== route) throw new Error('STOP');
  }
  async function until(fn, timeout = 12000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      check(); scanNotices();
      const value = fn();
      if (value) return value;
      await sleep(150);
    }
    return null;
  }
  function record(key, outcome, detail) {
    logs.push({time:new Date().toISOString(), id:key, outcome, detail});
    $('count').textContent = `成功 ${logs.filter(e=>e.outcome==='成功').length} · 跳过 ${logs.filter(e=>e.outcome==='跳过').length} · 待核实 ${logs.filter(e=>e.outcome==='待核实').length}`;
  }
  async function closeRefund() {
    const dialog = refundDialog();
    if (!dialog) return true;
    const close = all('.ant-modal-close,.el-dialog__headerbtn,button[aria-label="Close"],button[aria-label="关闭"]', dialog).find(enabled);
    if (!close) return false;
    check(); close.click();
    return !!await until(() => !refundDialog(), 3500);
  }
  // Pure scheduler: drain replacement rows before advancing; rescan after mutations.
  function chooseAction(items, seen, page, hasNext, passWork) {
    const row = items.find(item => !seen.has(item.key));
    if (row) return {type:'process', row};
    if (hasNext) return {type:'next'};
    if (page > 1 && passWork > 0) return {type:'rewind'};
    return {type:'done'};
  }
  function pagination() {
    const table = all('table').find(e => visible(e) && txt(e.querySelector('thead')).includes('退款金额'));
    // Limit pagination to the table's nearest container when possible.
    let container = table?.parentElement;
    let pagers = [];
    while (container && !pagers.length) {
      pagers = all('.ant-pagination,.el-pagination', container).filter(visible);
      container = container.parentElement;
    }
    if (pagers.length > 1) throw new Error('识别到多个分页区域，已停止，请检查');
    const pager = pagers[0];
    if (!pager) throw new Error('未识别到分页控件，已停止，不能确认全部处理完成');
    const active = pager.querySelector('.ant-pagination-item-active,.el-pager .active,.el-pager .is-active');
    const page = Number(txt(active));
    if (!Number.isInteger(page) || page < 1) throw new Error('无法读取当前页码，已停止');
    const next = pager.querySelector('.ant-pagination-next,.btn-next');
    const prev = pager.querySelector('.ant-pagination-prev,.btn-prev');
    const available = node => enabled(node) && !node.querySelector('button:disabled,[aria-disabled="true"]');
    if (!next || !prev) throw new Error('无法识别上一页或下一页，已停止');
    return {page, next, prev, hasNext:available(next), hasPrev:available(prev)};
  }
  function loading() {
    return all('.ant-spin-spinning,.el-loading-mask,[aria-busy="true"]').some(visible);
  }
  async function settle() {
    let last = '', stableSince = Date.now();
    const ready = await until(() => {
      const signature = rows().map(e=>e.key).join(',');
      if (loading() || signature !== last) { last = signature; stableSince = Date.now(); }
      return !loading() && Date.now() - stableSince >= 1200;
    }, 15000);
    if (!ready) throw new Error('列表加载超时，已停止');
  }
  async function movePage(direction) {
    check();
    const before = pagination();
    if (direction === 'prev' ? !before.hasPrev : !before.hasNext) throw new Error('分页按钮不可用，已停止');
    const oldRows = rows().map(e=>e.key).join(',');
    const control = before[direction];
    const target = control.querySelector('button,a') || control;
    check(); target.click();
    const changed = await until(() => {
      const after = pagination();
      return after.page !== before.page && !loading() && rows().map(e=>e.key).join(',') !== oldRows;
    }, 15000);
    if (!changed) throw new Error('翻页后未检测到新列表，已停止，避免误处理旧页面');
    await settle();
  }
  async function firstPage() {
    while (pagination().page > 1) {
      check();
      await movePage('prev');
    }
  }
  async function run() {
    if (running) return;
    if (!onList()) return status('未识别到退款列表及“初审”按钮，请打开退款管理列表。');
    if (dialogs().length) return status('请先关闭已打开的弹窗，再开始。');
    running = true; stopped = false; route = location.href;
    $('start').disabled = true; $('stop').disabled = false;
    let current = null, submitted = false, passWork = 0;
    try {
      await settle();
      await firstPage();
      while (true) {
        check();
        await settle();
        const state = pagination();
        const decision = chooseAction(rows(), attempted, state.page, state.hasNext, passWork);
        if (decision.type === 'done') break;
        if (decision.type === 'next') {
          status(`第 ${state.page} 页已处理，正在翻页……`);
          await movePage('next');
          continue;
        }
        if (decision.type === 'rewind') {
          status('正在从第一页复查，补处理列表缩短后移动的记录……');
          await firstPage(); passWork = 0;
          continue;
        }
        const row = decision.row, key = row.key;
        passWork++;
        if (dialogs().length) throw new Error('出现其他弹窗，已停止，请手动检查');
        current = key; submitted = false; attempted.add(key);
        notices = []; watching = false; scanNotices(); watching = true;
        status(`正在处理 ID ${key}：打开初审……`);
        row.action.click();
        const opened = await until(() => refundDialog() || notices.find(e => e.error));
        if (!opened || !refundDialog()) {
          record(key,'跳过',notices.find(e=>e.error)?.message || '未出现退款初审弹窗');
          current = null;
          if (opened?.error) {
            watching = false; await sleep(900); continue;
          }
          // An unexplained delayed dialog could belong to the previous order.
          throw new Error('初审弹窗未正常打开，已停止；请检查后再次开始');
        }
        status(`正在处理 ID ${key}：等待同意按钮……`);
        const ready = await until(() => notices.find(e=>e.error) || button(refundDialog(), '同意'), 12000);
        const agree = ready?.error ? null : ready;
        if (!agree) {
          record(key,'跳过',ready?.error ? ready.message : '等待12秒后仍未找到可点击的同意按钮；弹窗控件：' + all('button,a,[role="button"],div,span', refundDialog() || document).filter(e=>visible(e) && txt(e)==='同意').map(e=>e.tagName+'.'+e.className).slice(0,8).join(' | ')); current = null;
          if (!await closeRefund()) throw new Error('无法关闭弹窗，已停止');
          continue;
        }
        notices = []; watching = false; scanNotices(); watching = true;
        status(`正在处理 ID ${key}：点击同意……`);
        check(); submitted = true; agree.click();
        const outcome = await until(() => notices.find(e=>e.error) || (notices.some(e=>e.success) && !refundDialog() ? {success:true} : null));
        if (outcome?.error) record(key,'跳过',outcome.message);
        else if (outcome?.success) record(key,'成功','已检测到成功提示且初审弹窗关闭');
        else record(key,'待核实','未检测到明确成功提示；不重试此记录');
        current = null;
        if (!await closeRefund()) throw new Error('无法关闭初审弹窗，已停止');
        watching = false;
        await sleep(900);
      }
      status('全部页面处理结束。报错及待核实记录已跳过，可导出日志查看。');
    } catch (error) {
      if (current) record(current,submitted?'待核实':'跳过',submitted?'已点同意后停止，请人工核实结果':'已停止，未点同意');
      status(error.message === 'STOP' ? '已停止。已发出的提交不会撤回；未确认结果请查看日志。' : error.message);
    } finally {
      watching = false; running = false;
      $('start').disabled = false; $('stop').disabled = true;
    }
  }
  $('start').onclick = run;
  $('stop').onclick = () => { stopped = true; status('正在停止……'); };
  $('export').onclick = () => {
    const blob = new Blob([JSON.stringify(logs,null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = '退款初审日志.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  setInterval(() => { host.hidden = !running && !onList() && !refundDialog(); },1000);
})();
