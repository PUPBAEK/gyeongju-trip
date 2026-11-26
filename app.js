/* 경주 여행 페이지
 * 내용은 data.json에서만 읽는다. data.json 값은 전부 textContent로 넣고 innerHTML에 넣지 않는다.
 */
(function () {
  'use strict';

  const TODO_KEY = 'gyeongju-trip:todos';
  const $ = (id) => document.getElementById(id);

  /* 요소 만들기: 문자열·숫자 자식은 텍스트 노드로만 붙는다 */
  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
        else if (k in node && typeof v !== 'string') node[k] = v;
        else node.setAttribute(k, v);
      }
    }
    for (const c of children.flat()) {
      if (c == null || c === false || c === '') continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  }
  const fill = (id, ...nodes) => $(id).replaceChildren(...nodes.flat());
  const list = (arr) => (Array.isArray(arr) ? arr : []);
  const str = (v) => (v == null ? '' : String(v));

  /* ── 금액 ────────────────────────────── */
  const won = (v) => (Number(v) || 0);
  const fmt = (v) => (v === 0 ? '–' : v.toLocaleString('ko-KR'));

  /* ── 날짜 (한국 시간 기준) ──────────── */
  function todayKST() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  }
  function dayDiff(a, b) {
    // 'YYYY-MM-DD' 두 개 사이의 일 수 (b - a)
    const p = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    return Math.round((p(b) - p(a)) / 86400000);
  }
  const isISO = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

  /* ── 섹션별 렌더 ─────────────────────── */
  function renderHeader(trip, stay) {
    const title = str(trip.title) || '여행';
    document.title = title;
    $('title').textContent = title;
    $('dates').textContent = str(trip.dates);

    const members = list(trip.members);
    const stayShort = str(stay.name).split(/\s+[–-]\s+/)[0];
    const facts = [
      ['멤버', members.length ? `${members.length}명 · ${members.join(', ')}` : ''],
      ['숙소', stayShort],
      ['이동', str(trip.transport)],
      ['총무', str(trip.treasurer)],
    ].filter(([, v]) => v);
    fill('facts', facts.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]));

    $('footer').textContent = trip.treasurer
      ? `경주 여행 · 문의는 총무 ${trip.treasurer}에게`
      : '경주 여행';
  }

  // 여행 전엔 D-day, 여행 중엔 몇 일차인지, 끝나면 "다녀왔어요"
  function tripPhase(trip) {
    if (!isISO(trip.start)) return null;
    const today = todayKST();
    const end = isISO(trip.end) ? trip.end : trip.start;
    const toStart = dayDiff(today, trip.start);
    if (toStart > 0) return { label: `D-${toStart}` };
    if (toStart === 0) return { label: 'D-DAY · 오늘 출발', dayIndex: 0 };
    if (dayDiff(today, end) >= 0) return { label: `여행 ${-toStart + 1}일차`, dayIndex: -toStart };
    return { label: '다녀왔어요' };
  }

  // "택시 10분" → taxi, "걸어서 5분" → walk, 그 밖(차·렌트카) → car
  function wayMode(way) {
    const w = str(way);
    if (w.includes('택시')) return 'taxi';
    if (w.includes('걸어') || w.includes('도보')) return 'walk';
    return 'car';
  }

  function renderDays(days, places, phase) {
    const routes = [];
    fill('days', list(days).map((day, i) => {
      const isToday = phase && phase.dayIndex === i;
      const stops = list(day.stops);
      const items = [];
      stops.forEach((s, j) => {
        if (s.way && (j > 0 || day.from)) {
          const mode = wayMode(s.way);
          items.push(h('li', { class: `leg ${mode}` },
            h('span'), h('span', { class: 'rail' }),
            h('span', null, h('span', { class: 'leg-chip', text: str(s.way) }))
          ));
        }
        items.push(h('li', { class: 'stop' + (s.kind ? ' ' + s.kind : '') },
          h('div', { class: 'time', text: str(s.time) }),
          h('div', { class: 'rail' }, h('span', { class: 'num', 'aria-hidden': 'true', text: String(j + 1) })),
          h('div', null,
            h('h3', null,
              s.kind === 'eat' && h('span', { class: 'dot', role: 'img', 'aria-label': '식사' }),
              str(s.name),
              s.tag && h('span', { class: 'tag', text: str(s.tag) })
            ),
            s.desc && h('p', { text: str(s.desc) })
          )
        ));
      });

      const hasMap = stops.some((s) => places[s.place]);
      const svg = hasMap ? document.createElementNS(SVG_NS, 'svg') : null;
      if (svg) {
        svg.setAttribute('class', 'route');
        svg.setAttribute('role', 'img');
        const names = stops.map((s) => places[s.place] && places[s.place].name).filter(Boolean);
        svg.setAttribute('aria-label', `${str(day.label)} 동선: ${names.join(' → ')}`);
        routes.push({ svg, day, places });
      }

      return h('article', { class: 'day' + (isToday ? ' is-today' : ''), 'aria-label': `${str(day.label)} ${str(day.date)}` },
        h('div', { class: 'day-head' },
          h('h3', { text: str(day.label) }),
          h('span', { class: 'date', text: str(day.date) }),
          isToday && h('span', { class: 'today', text: '오늘' })
        ),
        svg,
        svg && h('p', { class: 'map-note', text: '대략적인 위치예요. 번호를 누르면 네이버 지도가 열려요.' }),
        h('ol', { class: 'tl' }, items)
      );
    }));
    watchRoutes(routes);
  }

  /* ── 동선 지도 (실제 지도가 아니라 좌표로 그린 약도) ──────────── */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  function s(tag, attrs, text) {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) n.setAttribute(k, v);
    if (text != null) n.textContent = text;
    return n;
  }

  function drawRoute({ svg, day, places }) {
    const W = Math.round(svg.clientWidth) || 340;
    const H = Math.round(Math.max(170, Math.min(250, W * 0.55)));
    svg.style.height = H + 'px';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const pad = { l: 40, r: 40, t: 28, b: 36 }; // 아래쪽은 축척 막대 자리

    // 들르는 순서대로 장소 id. from(출발지)이 있으면 맨 앞에 번호 없이.
    const seq = list(day.stops).map((st, j) => ({ id: st.place, n: j + 1, way: st.way }))
      .filter((x) => places[x.id]);
    const start = day.from && places[day.from] ? day.from : null;

    // 같은 장소는 마커 하나로 묶는다 ("3·8")
    const ids = [...new Set([start, ...seq.map((x) => x.id)].filter(Boolean))];
    const nums = Object.fromEntries(ids.map((id) => [id, seq.filter((x) => x.id === id).map((x) => x.n)]));

    // 범위: far 장소는 빼고 계산, 최소 범위 보장
    const near = ids.filter((id) => !places[id].far).map((id) => places[id]);
    const pts = near.length ? near : ids.map((id) => places[id]);
    let minLat = Math.min(...pts.map((p) => p.lat)), maxLat = Math.max(...pts.map((p) => p.lat));
    let minLng = Math.min(...pts.map((p) => p.lng)), maxLng = Math.max(...pts.map((p) => p.lng));
    const grow = (lo, hi, min) => { const c = (lo + hi) / 2, half = Math.max(hi - lo, min) / 2; return [c - half, c + half]; };
    [minLat, maxLat] = grow(minLat, maxLat, 0.012);
    [minLng, maxLng] = grow(minLng, maxLng, 0.015);
    const kx = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
    const spanX = (maxLng - minLng) * kx, spanY = maxLat - minLat;
    const scale = Math.min((W - pad.l - pad.r) / spanX, (H - pad.t - pad.b) / spanY); // px per degree(lat)
    const ox = pad.l + ((W - pad.l - pad.r) - spanX * scale) / 2;
    const oy = pad.t + ((H - pad.t - pad.b) - spanY * scale) / 2;
    const proj = (p) => ({ x: ox + (p.lng - minLng) * kx * scale, y: oy + (maxLat - p.lat) * scale });

    const pos = {};
    const cx = W / 2, cy = H / 2;
    for (const id of ids) {
      let p = proj(places[id]);
      p.far = false;
      // 화면 밖 장소는 테두리에 붙이고 방향만 보여준다
      const inX = [16, W - 16], inY = [16, H - 32];
      if (p.x < inX[0] || p.x > inX[1] || p.y < inY[0] || p.y > inY[1]) {
        const dx = p.x - cx, dy = p.y - cy;
        const t = Math.min(dx ? (dx > 0 ? inX[1] - cx : inX[0] - cx) / dx : Infinity,
                           dy ? (dy > 0 ? inY[1] - cy : inY[0] - cy) / dy : Infinity);
        p = { x: cx + dx * t, y: cy + dy * t, far: true, dir: Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? '←' : '→') : (dy < 0 ? '↑' : '↓') };
      }
      pos[id] = p;
    }
    // 너무 가까운 마커는 살짝 떼어 놓는다
    for (let it = 0; it < 30; it++) {
      for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) {
        const A = pos[ids[a]], B = pos[ids[b]];
        const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 0.01, min = 26;
        if (d < min) {
          const push = (min - d) / 2, ux = dx / d, uy = dy / d;
          if (!A.far) { A.x -= ux * push; A.y -= uy * push; }
          if (!B.far) { B.x += ux * push; B.y += uy * push; }
        }
      }
    }

    const frag = document.createDocumentFragment();

    // 축척 막대
    const kmPx = scale / 111; // 위도 1도 ≈ 111km
    const km = [0.5, 1, 2, 5].find((k) => k * kmPx >= 40) || 5;
    const sw = km * kmPx, sx = W - 12 - sw, sy = H - 10;
    frag.append(s('path', { class: 'scale', d: `M${sx.toFixed(1)},${sy - 4} V${sy} H${(sx + sw).toFixed(1)} V${sy - 4}` }));
    frag.append(s('text', { class: 'scale-t', x: (sx - 5).toFixed(1), y: sy - 1, 'text-anchor': 'end', 'dominant-baseline': 'middle' }, km < 1 ? `${km * 1000}m` : `${km}km`));

    // 이동 선: 같은 두 곳을 오가면 서로 반대쪽으로 휘게
    const legs = [];
    let prev = start;
    for (const x of seq) {
      if (prev && prev !== x.id) legs.push({ a: prev, b: x.id, mode: wayMode(x.way) });
      prev = x.id;
    }
    for (const L of legs) {
      const A = pos[L.a], B = pos[L.b];
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1;
      const bend = Math.min(18, d * 0.15);
      const qx = mx - (dy / d) * bend, qy = my + (dx / d) * bend;
      frag.append(s('path', { class: `ln ${L.mode}`, d: `M${A.x.toFixed(1)},${A.y.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${B.x.toFixed(1)},${B.y.toFixed(1)}` }));
    }

    // 마커 + 이름표
    const placed = [];
    for (const id of ids) {
      const P = places[id], p = pos[id];
      const label = nums[id].join('·');
      const hollow = !label;
      const w = Math.max(22, label.length * 7 + 10);
      const a = s('a', { href: safeUrl(P.url) || mapLink(str(P.query || P.name)), target: '_blank', rel: 'noopener noreferrer' });
      a.append(s('title', null, str(P.name)));
      const g = s('g', { class: 'mk' + (hollow ? ' hollow' : ''), transform: `translate(${p.x.toFixed(1)},${p.y.toFixed(1)})` });
      g.append(s('rect', { class: 'mk-bg', x: -w / 2, y: -11, width: w, height: 22, rx: 11 }));
      if (label) g.append(s('text', { y: 0.5 }, label));
      a.append(g);
      frag.append(a);

      const name = (p.far ? (p.dir === '←' || p.dir === '↑' ? `${p.dir} ${P.name}` : `${P.name} ${p.dir}`) : str(P.name)) + (hollow ? ' (출발)' : '');
      const tw = [...name].reduce((a, ch) => a + (/[ㄱ-힝]/.test(ch) ? 11.5 : 7), 0); // 대략적인 글자 폭
      const off = w / 2 + 5;
      const pref = p.far ? (p.x < W / 2 ? 'r' : 'l') : (P.label || 'r');
      const opp = { r: 'l', l: 'r', t: 'b', b: 't' }[pref];
      const place = (side) => {
        let lx = side === 'r' ? p.x + off : side === 'l' ? p.x - off : p.x;
        const ly = side === 't' ? p.y - 17 : side === 'b' ? p.y + 19 : p.y;
        if (side === 't' || side === 'b') lx = Math.min(Math.max(lx, tw / 2 + 4), W - tw / 2 - 4);
        const x0 = side === 'r' ? lx : side === 'l' ? lx - tw : lx - tw / 2;
        return { side, lx, ly, box: { x0, x1: x0 + tw, y0: ly - 8, y1: ly + 8 } };
      };
      // 테두리를 넘거나 다른 마커·이름표와 겹치지 않는 자리를 고른다
      const hits = (b) => b.x0 < 2 || b.x1 > W - 2 || b.y0 < 2 || b.y1 > H - 18 ||
        ids.some((o) => o !== id && pos[o].x > b.x0 - 12 && pos[o].x < b.x1 + 12 && pos[o].y > b.y0 - 11 && pos[o].y < b.y1 + 11) ||
        placed.some((q) => b.x0 < q.x1 && b.x1 > q.x0 && b.y0 < q.y1 && b.y1 > q.y0);
      const tries = [pref, opp, 'b', 't', 'r', 'l'].map(place);
      const pick = tries.find((t) => !hits(t.box)) || tries[0];
      placed.push(pick.box);
      const anchor = pick.side === 'r' ? 'start' : pick.side === 'l' ? 'end' : 'middle';
      frag.append(s('text', { class: 'lbl', x: pick.lx.toFixed(1), y: pick.ly.toFixed(1), 'text-anchor': anchor, 'dominant-baseline': 'middle' }, name));
    }

    svg.replaceChildren(frag);
  }

  function watchRoutes(routes) {
    const last = new WeakMap();
    const redraw = (r) => {
      const w = Math.round(r.svg.clientWidth);
      if (!w || last.get(r.svg) === w) return;
      last.set(r.svg, w);
      drawRoute(r);
    };
    if ('ResizeObserver' in window) {
      const byEl = new Map(routes.map((r) => [r.svg, r]));
      const ro = new ResizeObserver((entries) => entries.forEach((e) => redraw(byEl.get(e.target))));
      routes.forEach((r) => ro.observe(r.svg));
    } else {
      window.addEventListener('resize', () => routes.forEach(redraw));
    }
    routes.forEach(redraw);
  }

  function safeUrl(u) {
    try {
      const url = new URL(str(u));
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch (e) { return null; }
  }

  function renderStay(stay, travel, travelNote) {
    $('stay-name').textContent = str(stay.name);
    fill('stay-notes', list(stay.notes).map((n) => h('li', { text: str(n) })));
    const link = $('stay-url');
    const href = safeUrl(stay.url);
    if (href) link.href = href; else link.parentElement.hidden = true;

    const cell = (v) => h('td', { class: v === '따로' ? 'muted' : null, text: str(v) });
    fill('travel', list(travel).map((t) =>
      h('tr', null, h('th', { scope: 'row', class: 'nowrap', text: str(t.name) }), cell(t.go), cell(t.back))
    ));
    $('travel-note').textContent = str(travelNote);
  }

  function mapLink(name) {
    const q = name.startsWith('경주') ? name : `경주 ${name}`;
    return 'https://map.naver.com/p/search/' + encodeURIComponent(q);
  }

  function renderFoods(foods) {
    fill('foods', list(foods).map((f) => {
      const hours = str(f.hours);
      return h('tr', null,
        h('td', { class: 'nowrap', text: str(f.when) }),
        h('td', null, h('a', { href: mapLink(str(f.name)), target: '_blank', rel: 'noopener noreferrer', text: str(f.name) })),
        h('td', { class: 'hide-s', text: str(f.where) }),
        h('td', { class: hours.includes('확인') ? 'warn' : null, text: hours }),
        h('td', { text: str(f.note) })
      );
    }));
  }

  // 합계 = 숙소 + KTX + 렌트카, 남은 금액 = 합계 − 기입금. 총계는 열별 합.
  function computePayment(rows) {
    const out = list(rows).map((r) => {
      const stay = won(r.stay), ktx = won(r.ktx), car = won(r.car), paid = won(r.paid);
      const total = stay + ktx + car;
      return { name: str(r.name), memo: str(r.memo), stay, ktx, car, paid, total, left: total - paid };
    });
    const sum = (k) => out.reduce((a, r) => a + r[k], 0);
    return { rows: out, totals: { stay: sum('stay'), ktx: sum('ktx'), car: sum('car'), total: sum('total'), paid: sum('paid'), left: sum('left') } };
  }

  function leftCell(left) {
    if (left === 0) return h('td', { class: 'n done', text: '완료' });
    if (left < 0) return h('td', { class: 'n over', text: `${(-left).toLocaleString('ko-KR')} 더 냄` });
    return h('td', { class: 'n', text: fmt(left) });
  }

  function renderPayment(payment, treasurer) {
    const { rows, totals } = computePayment(payment.rows);
    $('money-to').textContent = treasurer ? `${treasurer}에게 보내기` : '';

    fill('pay', rows.map((r) => h('tr', null,
      h('th', { scope: 'row', class: 'nowrap' }, r.name, r.memo && h('span', { class: 'who', text: r.memo })),
      h('td', { class: 'n', text: fmt(r.stay) }),
      h('td', { class: 'n', text: fmt(r.ktx) }),
      h('td', { class: 'n', text: fmt(r.car) }),
      h('td', { class: 'n', text: fmt(r.total) }),
      leftCell(r.left)
    )));
    fill('pay-total', h('tr', null,
      h('td', { text: '총계' }),
      ['stay', 'ktx', 'car', 'total', 'left'].map((k) => h('td', { class: 'n', text: fmt(totals[k]) }))
    ));

    const doneCount = rows.filter((r) => r.left <= 0).length;
    fill('money-sum',
      '받을 돈 ', h('b', { text: `${Math.max(totals.left, 0).toLocaleString('ko-KR')}원` }),
      ` · 정산 끝난 사람 ${doneCount}/${rows.length}명`
    );
    $('pay-note').textContent = str(payment.note);
  }

  /* 할 일 체크: 각자 브라우저에만 저장. 항목 문구를 키로 써서 순서가 바뀌어도 체크가 따라간다. */
  const store = {
    ok: (function () {
      try {
        const k = TODO_KEY + ':test';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
      } catch (e) { return false; }
    })(),
    load() {
      if (!this.ok) return {};
      try { return JSON.parse(localStorage.getItem(TODO_KEY)) || {}; } catch (e) { return {}; }
    },
    save(v) {
      if (!this.ok) return;
      try { localStorage.setItem(TODO_KEY, JSON.stringify(v)); } catch (e) { /* 저장 못 해도 체크는 동작 */ }
    },
  };

  function renderTodos(todos, prep) {
    const done = store.load();
    fill('todos', list(todos).map((t, i) => {
      const key = str(t.text);
      return h('li', null,
        h('label', null,
          h('input', {
            type: 'checkbox', checked: !!done[key], id: `todo-${i}`,
            onchange: (e) => {
              if (e.target.checked) done[key] = true; else delete done[key];
              store.save(done);
            },
          }),
          h('span', null, key, t.who && h('span', { class: 'who', text: `· ${t.who}` }))
        )
      );
    }));
    $('todo-note').textContent = store.ok
      ? '체크 표시는 내 브라우저에만 저장돼요. 다른 사람 화면에는 보이지 않으니, 끝낸 일은 단톡에도 알려 주세요.'
      : '이 브라우저(사생활 보호 모드 등)에서는 체크 표시가 저장되지 않아요. 새로고침하면 지워져요.';

    fill('prep', list(prep).map((p) => h('li', { text: str(p) })));
  }

  /* ── 섹션 메뉴: 지금 보고 있는 섹션 표시 ─────── */
  function watchMenu() {
    const links = [...document.querySelectorAll('.menu a')];
    const scroller = document.querySelector('.menu-scroll');
    const byId = new Map(links.map((a) => [a.hash.slice(1), a]));
    const visible = new Set();
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id);
      const current = [...byId.keys()].find((id) => visible.has(id));
      links.forEach((a) => a.removeAttribute('aria-current'));
      const a = current && byId.get(current);
      if (a) {
        a.setAttribute('aria-current', 'true');
        const left = a.offsetLeft - 16;
        if (left < scroller.scrollLeft || a.offsetLeft + a.offsetWidth > scroller.scrollLeft + scroller.clientWidth) {
          scroller.scrollTo({ left: Math.max(0, left) });
        }
      }
    }, { rootMargin: '-60px 0px -55% 0px' });
    byId.forEach((_, id) => { const s = $(id); if (s) io.observe(s); });
  }

  /* ── 일러스트: 해질녘 왕릉 언덕 + 첨성대 + 달 + 별 ─────── */
  function drawScene(svg) {
    const W = Math.round(svg.clientWidth) || 800;
    const H = Math.round(svg.clientHeight) || 240;
    const f = (n) => n.toFixed(1);

    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const starCount = Math.round(Math.min(70, W / 16));
    let stars = '';
    for (let i = 0; i < starCount; i++) {
      stars += `<circle cx="${f(rnd() * W)}" cy="${f(rnd() * H * 0.42)}" r="${f(rnd() * 1.2 + 0.5)}" fill="#fff" opacity="${(rnd() * 0.5 + 0.35).toFixed(2)}"/>`;
    }

    // 왕릉: 둥근 봉분. 왼쪽 위에서 빛을 받아 오른쪽이 어둡다.
    const mound = (cx, w, h, base, lit, shade) => {
      const l = cx - w / 2, r = cx + w / 2;
      return `<path d="M${f(l)},${f(base)} C${f(l + w * 0.12)},${f(base - h * 1.05)} ${f(r - w * 0.12)},${f(base - h * 1.05)} ${f(r)},${f(base)} Z" fill="${lit}"/>` +
        `<path d="M${f(cx + w * 0.05)},${f(base - h * 0.79)} C${f(r - w * 0.16)},${f(base - h * 0.72)} ${f(r - w * 0.06)},${f(base - h * 0.4)} ${f(r)},${f(base)} L${f(cx + w * 0.1)},${f(base)} Z" fill="${shade}" opacity=".6"/>`;
    };

    // 첨성대: 2단 기단 + 병 모양 몸통 + 창 + 정(井)자 머리돌
    const sc = Math.max(0.45, Math.min(1, H / 270, W / 620));
    const tx = W - Math.max(64 * sc + 12, W * 0.17);
    const ground = H * 0.9;
    const courses = Array.from({ length: 10 }, (_, i) => {
      const y = -26 - i * 13;
      return `<line x1="-46" x2="46" y1="${y}" y2="${y}" stroke="#0a211b" stroke-width="1.1" opacity=".55"/>`;
    }).join('');
    const tower =
      `<g transform="translate(${f(tx)},${f(ground)}) scale(${sc.toFixed(3)})">` +
      `<clipPath id="body"><path d="M-40,-16 C-44,-70 -26,-118 -20,-152 L20,-152 C26,-118 44,-70 40,-16 Z"/></clipPath>` +
      `<rect x="-58" y="-8" width="116" height="8" fill="#0b241e"/>` +
      `<rect x="-50" y="-16" width="100" height="8" fill="#0e2a23"/>` +
      `<path d="M-40,-16 C-44,-70 -26,-118 -20,-152 L20,-152 C26,-118 44,-70 40,-16 Z" fill="#1a4236"/>` +
      `<g clip-path="url(#body)"><rect x="2" y="-160" width="50" height="150" fill="#0f2c24" opacity=".75"/>${courses}</g>` +
      `<rect x="-10" y="-96" width="20" height="18" fill="#f3c46b"/>` +
      `<rect x="-26" y="-162" width="52" height="10" fill="#1a4236"/>` +
      `<rect x="-26" y="-174" width="52" height="10" fill="#14382e"/>` +
      `<rect x="-26" y="-174" width="52" height="3" fill="#2f6252"/>` +
      `</g>`;

    const moonX = W * 0.2, moonY = H * 0.28, moonR = Math.max(14, Math.min(H * 0.085, 26));

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML =
      `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#135c4b"/><stop offset=".5" stop-color="#2c7765"/>` +
      `<stop offset=".82" stop-color="#c99a5e"/><stop offset="1" stop-color="#eaa65d"/></linearGradient>` +
      `<radialGradient id="glow"><stop offset="0" stop-color="#fbe7b8" stop-opacity=".35"/><stop offset="1" stop-color="#fbe7b8" stop-opacity="0"/></radialGradient></defs>` +
      `<rect width="${W}" height="${H}" fill="url(#sky)"/>${stars}` +
      `<circle cx="${f(moonX)}" cy="${f(moonY)}" r="${f(moonR * 3)}" fill="url(#glow)"/>` +
      `<circle cx="${f(moonX)}" cy="${f(moonY)}" r="${f(moonR)}" fill="#fbe7b8"/>` +
      // 먼 산 능선
      `<path d="M0,${f(H * 0.7)} Q${f(W * 0.2)},${f(H * 0.55)} ${f(W * 0.42)},${f(H * 0.66)} T${f(W * 0.8)},${f(H * 0.6)} T${W},${f(H * 0.64)} L${W},${H} L0,${H} Z" fill="#3e7062" opacity=".75"/>` +
      // 뒷줄 왕릉 2기
      mound(W * 0.1, W * 0.3, H * 0.2, H * 0.88, '#8d7a45', '#5b5030') +
      mound(W * 0.43, W * 0.36, H * 0.3, H * 0.93, '#b3955a', '#6e5f33') +
      tower +
      `<rect y="${f(ground)}" width="${W}" height="${f(H - ground + 1)}" fill="#3a3220"/>` +
      // 앞줄 왕릉 2기
      mound(W * 0.27, W * 0.26, H * 0.16, H + 1, '#c9a865', '#8a7341') +
      mound(W * 0.66, W * 0.2, H * 0.12, H + 1, '#bfa05e', '#7d6a3c');
  }

  function watchScene() {
    const svg = $('scene');
    let last = '', frame = 0;
    const redraw = () => {
      const key = svg.clientWidth + 'x' + svg.clientHeight;
      if (key === last) return;
      last = key;
      drawScene(svg);
    };
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(redraw); }).observe(svg);
    } else {
      window.addEventListener('resize', redraw);
    }
    redraw();
  }

  /* ── 의견 보드 ───────────────────────────
   * data.json의 ideas.supabaseUrl + anonKey가 있으면 Supabase에 저장(모두 공유),
   * 없으면 이 브라우저에만 저장되는 미리보기 모드.
   */
  const KINDS = [['food', '식당'], ['place', '가볼 곳'], ['plan', '일정 의견'], ['etc', '기타']];
  const KIND_NAME = Object.fromEntries(KINDS);
  const ME_KEY = 'gyeongju-trip:me';
  const MINE_KEY = 'gyeongju-trip:my-ideas'; // { postId: 삭제용 토큰 }

  const local = {
    get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 */ } },
  };

  function supabaseBackend(cfg) {
    const base = cfg.supabaseUrl.replace(/\/+$/, '') + '/rest/v1';
    const key = cfg.anonKey;
    const trip = str(cfg.trip) || 'trip';
    const headers = { apikey: key, 'Content-Type': 'application/json' };
    if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key; // 예전 형식 anon 키
    async function req(path, opts = {}) {
      const res = await fetch(base + path, { ...opts, headers: { ...headers, ...(opts.headers || {}) } });
      if (!res.ok && !(opts.okStatus || []).includes(res.status)) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    }
    return {
      shared: true,
      async list() {
        const rows = await req(`/trip_posts?select=id,created_at,author,kind,title,body,url,trip_likes(voter)&trip=eq.${encodeURIComponent(trip)}&order=created_at.desc&limit=300`);
        return rows.map((r) => ({ ...r, likes: list(r.trip_likes).map((l) => l.voter) }));
      },
      async add(post, tokenHash) {
        const rows = await req('/trip_posts?select=id', {
          method: 'POST', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ trip, ...post, token_hash: tokenHash }),
        });
        return rows[0].id;
      },
      like(id, voter) {
        // 이미 누른 경우(409)는 그대로 성공 처리
        return req('/trip_likes', { method: 'POST', okStatus: [409], headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ post_id: id, voter }) });
      },
      unlike(id, voter) {
        return req(`/trip_likes?post_id=eq.${encodeURIComponent(id)}&voter=eq.${encodeURIComponent(voter)}`, { method: 'DELETE' });
      },
      async remove(id, token) {
        const ok = await req('/rpc/delete_trip_post', { method: 'POST', body: JSON.stringify({ p_id: id, p_token: token }) });
        if (ok !== true) throw new Error('삭제 권한 없음');
      },
    };
  }

  function localBackend() {
    const K = 'gyeongju-trip:demo-ideas';
    const all = () => local.get(K, []);
    const save = (v) => local.set(K, v);
    return {
      shared: false,
      async list() { return all().slice().sort((a, b) => b.created_at.localeCompare(a.created_at)); },
      async add(post) {
        const rows = all();
        const id = rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
        rows.push({ id, created_at: new Date().toISOString(), ...post, likes: [] });
        save(rows);
        return id;
      },
      async like(id, voter) { save(all().map((r) => (r.id === id && !r.likes.includes(voter) ? { ...r, likes: [...r.likes, voter] } : r))); },
      async unlike(id, voter) { save(all().map((r) => (r.id === id ? { ...r, likes: r.likes.filter((v) => v !== voter) } : r))); },
      async remove(id) { save(all().filter((r) => r.id !== id)); },
    };
  }

  async function sha256Hex(text) {
    if (!(window.crypto && crypto.subtle)) return null;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  function newToken() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2)).join('');
  }

  function timeAgo(iso) {
    const t = new Date(iso).getTime();
    if (!t) return '';
    const m = Math.floor((Date.now() - t) / 60000);
    if (m < 1) return '방금';
    if (m < 60) return `${m}분 전`;
    if (m < 60 * 24) return `${Math.floor(m / 60)}시간 전`;
    if (m < 60 * 24 * 7) return `${Math.floor(m / 1440)}일 전`;
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function setupIdeas(cfg, members) {
    const configured = cfg && /^https:\/\/.+/.test(str(cfg.supabaseUrl)) && str(cfg.anonKey).length > 20;
    const api = configured ? supabaseBackend(cfg) : localBackend();
    const state = { posts: [], filter: 'all', sort: local.get('gyeongju-trip:idea-sort', 'new'), mine: local.get(MINE_KEY, {}), loading: false, error: false };

    const banner = $('ideas-mode');
    if (!api.shared) {
      banner.hidden = false;
      banner.textContent = '미리보기 모드예요. 아직 공유 저장소가 연결되지 않아서 여기 남긴 글은 이 브라우저에만 보여요.';
    }

    // 이름 선택 (기억해 둠)
    const meSel = $('idea-me');
    members.forEach((m) => meSel.append(h('option', { value: m, text: m })));
    const savedMe = local.get(ME_KEY, '');
    if (members.includes(savedMe)) meSel.value = savedMe;
    meSel.addEventListener('change', () => { local.set(ME_KEY, meSel.value); paint(); });

    fill('idea-kinds', KINDS.map(([v, label], i) =>
      h('label', { class: 'chip' }, h('input', { type: 'radio', name: 'idea-kind', value: v, checked: i === 0 }), h('span', { text: label }))
    ));

    const filterBtns = [['all', '전체'], ...KINDS].map(([v, label]) =>
      h('button', { type: 'button', class: 'chip', 'aria-pressed': String(v === 'all'), 'data-v': v, text: label,
        onclick: () => {
          state.filter = v;
          filterBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
          paint();
        } })
    );
    fill('idea-filter', filterBtns);
    const sortSel = $('idea-sort');
    sortSel.value = state.sort;
    sortSel.addEventListener('change', () => { state.sort = sortSel.value; local.set('gyeongju-trip:idea-sort', state.sort); paint(); });

    const msg = $('idea-msg');
    const say = (text, tone) => { msg.textContent = text; msg.className = 'form-msg' + (tone ? ' ' + tone : ''); };
    const needMe = () => {
      if (meSel.value) return false;
      say('이름을 먼저 골라 주세요', 'bad');
      meSel.focus();
      return true;
    };

    async function load() {
      state.loading = true;
      try {
        state.posts = await api.list();
        state.error = false;
      } catch (e) {
        console.warn('[경주 여행] 의견을 불러오지 못했어요:', e);
        state.error = true;
      }
      state.loading = false;
      paint();
    }

    function paint() {
      const me = meSel.value;
      let rows = state.posts.filter((p) => state.filter === 'all' || p.kind === state.filter);
      if (state.sort === 'like') rows = rows.slice().sort((a, b) => b.likes.length - a.likes.length || b.created_at.localeCompare(a.created_at));

      if (state.error && !state.posts.length) {
        fill('idea-list', h('li', { class: 'empty' }, '의견을 불러오지 못했어요. ',
          h('button', { type: 'button', class: 'like', text: '다시 시도', onclick: load })));
        return;
      }
      if (!rows.length) {
        fill('idea-list', h('li', { class: 'empty', text: state.loading ? '불러오는 중…' : (state.posts.length ? '이 종류로 남긴 글이 아직 없어요' : '아직 남긴 글이 없어요. 첫 번째로 남겨 주세요!') }));
        return;
      }

      fill('idea-list', rows.map((p) => {
        const href = safeUrl(p.url) || (p.kind === 'food' || p.kind === 'place' ? mapLink(str(p.title)) : null);
        const liked = !!me && p.likes.includes(me);
        const token = state.mine[p.id];
        return h('li', { class: 'idea' + (token ? ' mine' : '') },
          h('div', { class: 'idea-head' },
            h('span', { class: 'kchip ' + str(p.kind), text: KIND_NAME[p.kind] || '기타' }),
            h('span', { text: timeAgo(p.created_at) })
          ),
          h('h3', null, href ? h('a', { href, target: '_blank', rel: 'noopener noreferrer', text: str(p.title) }) : str(p.title)),
          p.body && h('p', { text: str(p.body) }),
          h('div', { class: 'idea-foot' },
            h('span', { class: 'author', text: str(p.author) }),
            h('button', {
              type: 'button', class: 'like', 'aria-pressed': String(liked),
              'aria-label': `좋아요 ${p.likes.length}개${liked ? ', 내가 누름' : ''}`,
              text: `${liked ? '♥' : '♡'} 좋아요 ${p.likes.length}`,
              onclick: async (e) => {
                if (needMe()) return;
                e.currentTarget.disabled = true;
                try { await (liked ? api.unlike(p.id, me) : api.like(p.id, me)); } catch (err) { say('좋아요를 저장하지 못했어요', 'bad'); }
                load();
              },
            }),
            p.likes.length > 0 && h('span', { class: 'likers', text: p.likes.join(', ') }),
            token && h('button', {
              type: 'button', class: 'del', text: '삭제',
              onclick: async () => {
                if (!confirm('이 글을 지울까요?')) return;
                try {
                  await api.remove(p.id, token);
                  delete state.mine[p.id];
                  local.set(MINE_KEY, state.mine);
                } catch (err) { say('삭제하지 못했어요', 'bad'); }
                load();
              },
            })
          )
        );
      }));
    }

    $('idea-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (needMe()) return;
      const title = $('idea-title').value.trim();
      const body = $('idea-body').value.trim();
      const urlRaw = $('idea-url').value.trim();
      const kind = (document.querySelector('input[name="idea-kind"]:checked') || {}).value || 'etc';
      if (!title) { say('장소나 제목을 적어 주세요', 'bad'); $('idea-title').focus(); return; }
      const url = urlRaw ? safeUrl(/^https?:\/\//i.test(urlRaw) ? urlRaw : 'https://' + urlRaw) : null;
      if (urlRaw && !url) { say('링크 주소를 확인해 주세요', 'bad'); $('idea-url').focus(); return; }

      const btn = $('idea-submit');
      btn.disabled = true;
      say('남기는 중…');
      try {
        const token = newToken();
        const id = await api.add({ author: meSel.value, kind, title: title.slice(0, 60), body: body.slice(0, 300) || null, url }, await sha256Hex(token));
        state.mine[id] = token;
        local.set(MINE_KEY, state.mine);
        $('idea-title').value = ''; $('idea-body').value = ''; $('idea-url').value = '';
        say('남겼어요!', 'good');
        await load();
      } catch (err) {
        console.warn('[경주 여행] 의견 저장 실패:', err);
        say('저장하지 못했어요. 잠시 후 다시 시도해 주세요', 'bad');
      } finally {
        btn.disabled = false;
      }
    });

    load();
    if (api.shared) {
      // 다른 사람이 남긴 글: 화면을 보고 있을 때 1분마다, 다시 돌아왔을 때 새로고침
      setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
    }
  }

  /* ── 시작 ─────────────────────────────── */
  function render(data) {
    if (!data || typeof data !== 'object' || !data.trip) throw new Error('data.json 형식이 맞지 않아요');
    const trip = data.trip, stay = data.stay || {};
    const phase = tripPhase(trip);

    renderHeader(trip, stay);
    if (phase) { $('dday').textContent = phase.label; $('dday').hidden = false; }
    renderDays(data.days, data.places || {}, phase);
    renderStay(stay, data.travel, data.travelNote);
    renderFoods(data.foods);
    setupIdeas(data.ideas, list(trip.members).map(str));
    renderPayment(data.payment || {}, trip.treasurer);
    renderTodos(data.todos, data.prep);
  }

  function showError(err) {
    console.warn('[경주 여행] data.json을 불러오지 못했어요:', err);
    $('app').hidden = true;
    $('menu').hidden = true;
    $('error').hidden = false;
  }

  watchScene();

  fetch('data.json', { cache: 'no-cache' })
    .then((res) => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
    .then((data) => {
      render(data);
      $('app').removeAttribute('aria-busy');
      watchMenu();
      // 주소에 #money 같은 앵커가 있으면 그려진 뒤에 다시 이동
      const target = location.hash && $(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    })
    .catch(showError);

  // 테스트용으로 계산 함수만 노출
  window.__trip = { computePayment };
})();
