(() => {
  const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const SLOTS = ["Breakfast","Lunch","Snack"];
  const STATUS = ["Pending","Accepted","Preparing","Ready","Collected"];
  const NEXT = { Pending: "Accept order", Accepted: "Start preparing", Preparing: "Mark ready", Ready: "Mark collected" };
  const WINDOWS = { Breakfast: ["07:30","08:00","08:30","09:00"], Lunch: ["12:00","12:30","13:00","13:30"], Snack: ["16:00","16:30","17:00"] };
  const PAYNAME = { wallet: "wallet", upi: "UPI", cash: "cash" };
  const KEY = "canteenX.v3";
  const LIBRARY = [
    {slot:"Breakfast",name:"Oats with berries",price:70,tag:"Veg"},
    {slot:"Breakfast",name:"Masala omelette",price:50,tag:"Protein"},
    {slot:"Breakfast",name:"Idli and sambar",price:40,tag:"Light"},
    {slot:"Breakfast",name:"Peanut butter toast",price:45,tag:"Carb-heavy"},
    {slot:"Lunch",name:"Chicken rice bowl",price:120,tag:"Protein"},
    {slot:"Lunch",name:"Dal, rice and salad",price:80,tag:"Veg"},
    {slot:"Lunch",name:"Paneer wrap",price:90,tag:"Protein"},
    {slot:"Lunch",name:"Quinoa chickpea salad",price:100,tag:"Light"},
    {slot:"Snack",name:"Greek yogurt and nuts",price:60,tag:"Protein"},
    {slot:"Snack",name:"Fruit bowl",price:40,tag:"Light"},
    {slot:"Snack",name:"Roasted chana",price:25,tag:"Veg"},
    {slot:"Snack",name:"Dark chocolate square",price:30,tag:"Treat"}
  ];
  const $ = id => document.getElementById(id);
  const el = (t, c) => { const e = document.createElement(t); if (c) e.className = c; return e; };
  const uid = () => Math.random().toString(36).slice(2, 9);
  const todayIdx = (new Date().getDay() + 6) % 7;

  let state = load();
  let editing = null, selDay = DAYS[todayIdx], stDay = DAYS[todayIdx];
  const picks = {}, times = {}; // "Day|Slot" -> meal id / pickup window

  function load() {
    const base = { student: "", tab: "student", meals: {}, orders: [], session: "", wallets: {}, pay: "wallet", upi: "", cap: 10,
      staff: [{ id: "CX-1001", name: "Ravi Kumar" }, { id: "CX-1002", name: "Meena Rao" }, { id: "CX-1003", name: "Kiran Shah" }] };
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.meals) return { ...base, ...s }; } catch (e) {}
    return base;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  const list = (d, s) => state.meals[d + "|" + s] || (state.meals[d + "|" + s] = []);
  const allMeals = () => DAYS.flatMap(d => SLOTS.flatMap(s => list(d, s)));
  const findMeal = id => allMeals().find(m => m.id === id);
  const limited = m => m.stock !== "" && m.stock != null;
  const soldOut = m => m.off || (limited(m) && +m.stock <= 0);
  const me = () => state.student.trim().toLowerCase();
  const bal = () => state.wallets[me()] || 0;
  const rupee = n => "₹" + n;
  const fmt = t => { let [h, m] = t.split(":").map(Number); const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12; return `${h}:${String(m).padStart(2, "0")} ${ap}`; };
  const endOf = t => { let [h, m] = t.split(":").map(Number); m += 30; if (m >= 60) { h++; m -= 60; } return `${h}:${String(m).padStart(2, "0")}`; };
  const winLabel = t => fmt(t) + " – " + fmt(endOf(t));
  const freeAt = (day, slot, t) => Math.max(0, (+state.cap || 10) - state.orders.filter(o => o.day === day && o.slot === slot && o.time === t && o.status !== "Declined").length);
  const timeFor = (day, slot) => { const c = times[day + "|" + slot]; return c && freeAt(day, slot, c) > 0 ? c : (WINDOWS[slot].find(t => freeAt(day, slot, t) > 0) || ""); };
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200); }
  function commit() { save(); render(); }

  /* ---------- tabs ---------- */
  document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => { state.tab = b.dataset.tab; commit(); });
  function renderTabs() {
    document.querySelectorAll(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === state.tab));
    $("studentView").hidden = state.tab !== "student";
    $("teamView").hidden = state.tab !== "team";
  }

  /* ---------- student ---------- */
  $("sName").value = state.student;
  $("sName").oninput = e => { state.student = e.target.value; save(); renderSide(); };
  $("sTag").onchange = renderMenu;

  function renderStudent() { renderPills(); renderMenu(); renderSide(); }

  function renderPills() {
    const pills = $("dayPills"); pills.innerHTML = "";
    DAYS.forEach((d, i) => {
      const b = el("button", i === todayIdx ? "today" : ""); b.textContent = d; b.setAttribute("aria-pressed", d === selDay);
      b.onclick = () => { selDay = d; renderStudent(); }; pills.append(b);
    });
  }

  function renderMenu() {
    const tag = $("sTag").value, box = $("menuList"); box.innerHTML = "";
    SLOTS.forEach(slot => {
      const key = selDay + "|" + slot, fs = el("fieldset", "slot");
      fs.innerHTML = `<legend>${slot}</legend>`;
      const add = (id, m) => {
        const lab = el("label", "opt" + (m ? "" : " none"));
        if (m) lab.style.setProperty("--c", `var(--${m.tag})`);
        const left = m && limited(m) && !soldOut(m) && +m.stock <= 5 ? ` · only ${m.stock} left` : "";
        lab.innerHTML = `<input type="radio" name="slot-${slot}" value="${id}"><span class="nm"></span><span class="meta"></span>${m ? `<span class="price">${rupee(m.price)}</span>` : ""}`;
        lab.querySelector(".nm").textContent = m ? m.name : "No " + slot.toLowerCase();
        lab.querySelector(".meta").textContent = m ? (soldOut(m) ? "Sold out" : m.tag + left) : "Skip this meal";
        const r = lab.querySelector("input"); r.checked = (picks[key] || "") === id; r.disabled = !!m && soldOut(m);
        r.onchange = () => { if (id) picks[key] = id; else delete picks[key]; renderSide(); };
        fs.append(lab);
      };
      add("", null);
      const items = list(selDay, slot).filter(m => !tag || m.tag === tag);
      items.forEach(m => add(m.id, m));
      if (!items.length) { const p = el("p", "empty"); p.textContent = tag ? "No " + tag + " options here." : "Nothing on the menu yet."; fs.append(p); }
      box.append(fs);
    });
  }

  const chosen = () => SLOTS.map(slot => ({ slot, m: findMeal(picks[selDay + "|" + slot]) })).filter(x => x.m && !soldOut(x.m));
  const selected = () => chosen().map(x => ({ ...x, t: timeFor(selDay, x.slot) })).filter(x => x.t);
  function payText(o) {
    if (o.status === "Declined") return o.refunded ? "Refunded" : "No charge";
    return !o.pay ? "" : o.paid ? "Paid by " + PAYNAME[o.pay] : "Pay at counter";
  }

  function renderSide() {
    const ch = chosen(), cart = $("cart"); cart.innerHTML = "";
    if (!ch.length) cart.innerHTML = '<li class="muted">Pick a food on the left, then choose when to collect it.</li>';
    ch.forEach(({ slot, m }) => {
      const li = el("li"), key = selDay + "|" + slot;
      li.innerHTML = `<div><span></span><small></small></div><b>${rupee(m.price)}</b><label class="pick">Pickup <select></select></label>`;
      li.querySelector("span").textContent = m.name; li.querySelector("small").textContent = `${selDay} ${slot}`;
      const ts = li.querySelector("select");
      WINDOWS[slot].forEach(t => {
        const o = el("option"), f = freeAt(selDay, slot, t);
        o.value = t; o.textContent = `${winLabel(t)} · ${f ? f + " left" : "full"}`; o.disabled = !f; ts.append(o);
      });
      ts.value = timeFor(selDay, slot); times[key] = ts.value;
      ts.onchange = () => { times[key] = ts.value; };
      cart.append(li);
    });
    const sel = selected(), cost = sel.reduce((t, x) => t + +x.m.price, 0);
    $("cartTotal").textContent = ch.length > sel.length ? "A meal with no free pickup slot is left out of the order." : (sel.length ? `${selDay} total: ${rupee(cost)}` : "");

    document.querySelectorAll("input[name=pay]").forEach(r => r.checked = r.value === state.pay);
    $("walBal").textContent = me() ? rupee(bal()) : "enter name";
    $("upiId").hidden = state.pay !== "upi"; if ($("upiId") !== document.activeElement) $("upiId").value = state.upi;
    const short = state.pay === "wallet" && sel.length && me() && bal() < cost;
    $("payMsg").textContent = short ? `Wallet has ${rupee(bal())}. Top up or choose another way to pay.` : "";
    $("placeOrder").disabled = !sel.length || !!short;
    $("placeOrder").textContent = !sel.length ? "Place order" : state.pay === "cash" ? `Place order · pay ${rupee(cost)} at pickup` : `Pay ${rupee(cost)} and place order`;

    const mine = state.orders.filter(o => me() && o.student.toLowerCase() === me());
    const ul = $("myOrders"); ul.innerHTML = "";
    if (!me()) ul.innerHTML = '<li class="muted">Enter your name to see your orders.</li>';
    else if (!mine.length) ul.innerHTML = '<li class="muted">No orders yet.</li>';
    mine.slice().reverse().forEach(o => {
      const li = el("li");
      li.innerHTML = `<div><span></span><small></small></div><span class="badge ${o.status}">${o.status}</span>`;
      li.querySelector("span").textContent = o.name;
      li.querySelector("small").textContent = `${o.day} ${o.slot}${o.time ? " · " + fmt(o.time) : ""} · ${rupee(o.price)}${o.pay ? " · " + payText(o) : ""}`;
      if (o.status === "Pending") { const x = el("button", "x"); x.textContent = "Cancel"; x.onclick = () => cancelOrder(o.id); li.append(x); }
      ul.append(li);
    });
    const spent = mine.filter(o => o.status !== "Declined").reduce((t, o) => t + o.price, 0);
    $("mySpend").textContent = spent ? `Total this week: ${rupee(spent)}` : "";
  }

  document.querySelectorAll("input[name=pay]").forEach(r => r.onchange = () => { state.pay = r.value; save(); renderSide(); if (r.value === "upi") $("upiId").focus(); });
  $("upiId").oninput = e => { state.upi = e.target.value; save(); };
  document.querySelectorAll(".topup [data-amt]").forEach(b => b.onclick = () => {
    if (!me()) { toast("Enter your name first"); $("sName").focus(); return; }
    state.wallets[me()] = bal() + +b.dataset.amt; commit(); toast(`Added ₹${b.dataset.amt} to your wallet`);
  });

  $("placeOrder").onclick = () => {
    if (!me()) { toast("Enter your name first"); $("sName").focus(); return; }
    const sel = selected(); if (!sel.length) return;
    const cost = sel.reduce((t, x) => t + +x.m.price, 0);
    if (state.pay === "upi" && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(state.upi.trim())) { toast("Enter a valid UPI ID, like name@bank"); $("upiId").focus(); return; }
    if (state.pay === "wallet") { if (bal() < cost) { toast("Wallet balance is too low"); return; } state.wallets[me()] = bal() - cost; }
    sel.forEach(({ slot, m, t }) => {
      if (limited(m)) m.stock = +m.stock - 1;
      state.orders.push({ id: uid(), student: state.student.trim(), mealId: m.id, name: m.name, price: +m.price, day: selDay, slot, time: t, pay: state.pay, paid: state.pay !== "cash", status: "Pending", at: Date.now() });
      delete picks[selDay + "|" + slot]; delete times[selDay + "|" + slot];
    });
    commit(); toast(state.pay === "cash" ? `Order placed · pay ${rupee(cost)} at the counter` : `Order placed · ${rupee(cost)} paid by ${PAYNAME[state.pay]}`);
  };

  // Puts the portion back in stock and refunds any payment. Returns a short note for the toast.
  function release(o) {
    const m = findMeal(o.mealId); if (m && limited(m)) m.stock = +m.stock + 1;
    let note = "";
    if (o.paid && o.pay === "wallet") { const k = o.student.toLowerCase(); state.wallets[k] = (state.wallets[k] || 0) + o.price; note = ` · ${rupee(o.price)} back in wallet`; }
    else if (o.paid && o.pay === "upi") note = ` · ${rupee(o.price)} refund sent to UPI`;
    if (o.paid) o.refunded = true;
    o.paid = false; return note;
  }
  function cancelOrder(id) {
    const i = state.orders.findIndex(o => o.id === id); if (i < 0) return;
    const note = release(state.orders[i]); state.orders.splice(i, 1); commit(); toast("Order cancelled" + note);
  }

  /* ---------- team ---------- */
  function renderTeam() {
    const st = state.staff.find(x => x.id === state.session);
    $("teamLogin").hidden = !!st; $("teamApp").hidden = !st;
    $("loginHint").textContent = "Demo staff IDs: " + state.staff.slice(0, 3).map(x => x.id).join(", ");
    if (!st) return;
    $("who").innerHTML = "Signed in as <b></b>"; $("who").querySelector("b").textContent = `${st.name} (${st.id})`;
    const live = state.orders.filter(o => o.status !== "Declined");
    const count = s => live.filter(o => o.status === s).length;
    const paid = live.filter(o => o.paid).reduce((t, o) => t + o.price, 0);
    const due = live.filter(o => o.pay === "cash" && !o.paid).reduce((t, o) => t + o.price, 0);
    const low = allMeals().filter(m => limited(m) && +m.stock <= 3).length;
    $("tStats").innerHTML = `<div><b>${count("Pending")}</b>new orders</div><div><b>${count("Accepted") + count("Preparing")}</b>in the kitchen</div><div><b>${count("Ready")}</b>ready for pickup</div><div><b>${rupee(paid)}</b>payments received</div><div><b>${rupee(due)}</b>cash due at counter</div><div><b>${low}</b>low or out of stock</div>`;
    renderBoard(); renderStock(); renderMatrix(); renderStaff();
  }

  function renderBoard() {
    const board = $("board"); board.innerHTML = "";
    STATUS.forEach((st, si) => {
      const col = el("div", "col");
      const os = state.orders.filter(o => o.status === st).sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day) || (a.time || "").localeCompare(b.time || "") || a.at - b.at);
      col.innerHTML = `<h3>${st}<span>${os.length}</span></h3>`;
      os.forEach(o => {
        const d = el("div", "ord"); d.innerHTML = "<b></b><small></small><small></small>";
        const [t, l1, l2] = d.children;
        t.textContent = o.name;
        l1.textContent = `${o.student} · ${o.day} ${o.slot}${o.time ? " · pickup " + fmt(o.time) : ""}`;
        l2.textContent = (o.pay ? (o.paid ? "Paid · " + PAYNAME[o.pay] : "Cash due " + rupee(o.price)) : "") + (o.by ? " · by " + o.by : "");
        if (o.pay && !o.paid) l2.classList.add("due");
        if (si < STATUS.length - 1) {
          const acts = el("div", "acts"), next = STATUS[si + 1], b = el("button", "btn primary");
          const cashDue = next === "Collected" && o.pay === "cash" && !o.paid;
          b.textContent = cashDue ? "Cash received · Collected" : NEXT[st];
          b.onclick = () => { if (cashDue) o.paid = true; o.status = next; o.by = state.session; commit(); toast(`${o.name} for ${o.student}: ${next.toLowerCase()}`); };
          acts.append(b);
          if (st === "Pending") {
            const dc = el("button", "btn danger"); dc.textContent = "Decline";
            dc.onclick = () => { const note = release(o); o.status = "Declined"; o.by = state.session; commit(); toast("Order declined" + note); };
            acts.append(dc);
          }
          d.append(acts);
        }
        col.append(d);
      });
      if (!os.length) { const p = el("p", "empty"); p.textContent = "Empty"; col.append(p); }
      board.append(col);
    });
    const counts = {}; state.orders.filter(o => o.status !== "Declined").forEach(o => counts[o.name] = (counts[o.name] || 0) + 1);
    const ul = $("demand"); ul.innerHTML = "";
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (!rows.length) ul.innerHTML = '<li class="muted">No orders yet. Students will show up here once they order.</li>';
    rows.forEach(([n, c]) => { const li = el("li"); li.innerHTML = "<span></span><em></em>"; li.firstChild.textContent = n; li.lastChild.textContent = c + " ordered"; ul.append(li); });
  }
  $("clearDone").onclick = () => {
    const n = state.orders.length; state.orders = state.orders.filter(o => o.status !== "Collected" && o.status !== "Declined");
    commit(); toast(n === state.orders.length ? "Nothing to remove yet" : "Finished orders removed");
  };

  /* stock */
  $("stDay").innerHTML = '<option value="All">All days</option>' + DAYS.map(d => `<option>${d}</option>`).join("");
  $("stDay").value = stDay; $("stDay").onchange = e => { stDay = e.target.value; renderStock(); };
  function renderStock() {
    const ul = $("stockList"); ul.innerHTML = ""; let n = 0;
    (stDay === "All" ? DAYS : [stDay]).forEach(d => SLOTS.forEach(s => list(d, s).forEach(m => { n++; ul.append(stockRow(m, d, s)); })));
    if (!n) ul.innerHTML = '<li class="muted">No foods on the menu for this day yet. Add a food below or fill the weekly menu.</li>';
  }
  function stockRow(m, d, s) {
    const li = el("li");
    li.innerHTML = '<div class="nm"><b></b><small></small></div><span class="badge"></span><div class="adj"><input type="number" min="0" placeholder="unlimited" aria-label="Stock left"><button class="btn">+5</button><button class="btn">+10</button></div>';
    li.querySelector("b").textContent = m.name; li.querySelector("small").textContent = `${d} · ${s}`;
    const badge = li.querySelector(".badge"), inp = li.querySelector("input"), [p5, p10] = li.querySelectorAll("button");
    inp.value = limited(m) ? m.stock : "";
    if (!limited(m)) badge.textContent = "Unlimited";
    else if (+m.stock <= 0) { badge.textContent = "Out of stock"; badge.classList.add("out"); }
    else if (+m.stock <= 3) { badge.textContent = m.stock + " left · low"; badge.classList.add("low"); }
    else badge.textContent = m.stock + " in stock";
    inp.onchange = () => { m.stock = inp.value === "" ? "" : Math.max(0, Math.floor(+inp.value)); if (!limited(m) || +m.stock > 0) m.off = false; commit(); toast(`${m.name}: stock updated`); };
    const addN = n => () => { m.stock = (limited(m) ? +m.stock : 0) + n; m.off = false; commit(); toast(`Added ${n} to ${m.name}`); };
    p5.onclick = addN(5); p10.onclick = addN(10);
    return li;
  }
  $("stLow").onclick = () => {
    const low = allMeals().filter(m => limited(m) && +m.stock <= 3);
    low.forEach(m => { m.stock = 20; m.off = false; });
    commit(); toast(low.length ? `${low.length} item${low.length > 1 ? "s" : ""} topped up to 20` : "No low-stock items");
  };

  /* menu matrix */
  function renderMatrix() {
    const m = $("matrix"); m.innerHTML = ""; m.append(el("div"));
    DAYS.forEach((d, i) => {
      const h = el("div", "colhead" + (i === todayIdx ? " today" : ""));
      h.innerHTML = `${d}<small>${state.orders.filter(o => o.day === d && o.status !== "Declined").length} orders</small>`; m.append(h);
    });
    SLOTS.forEach(slot => {
      const r = el("div", "rowhead"); r.textContent = slot; m.append(r);
      DAYS.forEach(day => m.append(buildCell(day, slot)));
    });
  }
  function buildCell(day, slot) {
    const c = el("div", "cell");
    c.ondragover = e => { e.preventDefault(); c.classList.add("over"); };
    c.ondragleave = () => c.classList.remove("over");
    c.ondrop = e => {
      e.preventDefault(); c.classList.remove("over");
      let data; try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (x) { return; }
      const from = list(data.day, data.slot), idx = from.findIndex(x => x.id === data.id); if (idx < 0) return;
      list(day, slot).push(from.splice(idx, 1)[0]); commit();
    };
    list(day, slot).forEach(meal => {
      const b = el("button", "meal" + (soldOut(meal) ? " off" : "")); b.style.setProperty("--c", `var(--${meal.tag})`); b.draggable = true;
      b.innerHTML = "<span></span><small></small>"; b.firstChild.textContent = meal.name;
      b.lastChild.textContent = `${rupee(meal.price)} · ${limited(meal) ? meal.stock + " in stock" : "unlimited"}`;
      b.onclick = () => openDialog(day, slot, meal);
      b.ondragstart = e => { e.dataTransfer.setData("text/plain", JSON.stringify({ day, slot, id: meal.id })); b.classList.add("dragging"); };
      b.ondragend = () => b.classList.remove("dragging");
      c.append(b);
    });
    const add = el("button", "add"); add.textContent = "+ Add meal"; add.setAttribute("aria-label", `Add ${slot} on ${day}`);
    add.onclick = () => openDialog(day, slot, null); c.append(add);
    return c;
  }

  /* meal dialog */
  const dlg = $("mealDialog");
  function openDialog(day, slot, meal) {
    editing = { day, slot, id: meal ? meal.id : null };
    $("dlgTitle").textContent = (meal ? "Edit meal" : "Add meal") + " · " + day + " " + slot;
    $("fName").value = meal ? meal.name : ""; $("fPrice").value = meal ? meal.price : 60;
    $("fStock").value = meal ? meal.stock : 20; $("fTag").value = meal ? meal.tag : "Veg"; $("fOff").checked = meal ? !!meal.off : false;
    $("fDelete").style.display = meal ? "" : "none";
    dlg.showModal(); $("fName").focus();
  }
  $("mealForm").onsubmit = e => {
    e.preventDefault();
    const s = $("fStock").value;
    const data = { name: $("fName").value.trim(), price: Math.max(0, +$("fPrice").value || 0), stock: s === "" ? "" : Math.max(0, +s), tag: $("fTag").value, off: $("fOff").checked };
    if (!data.name) return;
    const arr = list(editing.day, editing.slot);
    if (editing.id) Object.assign(arr.find(m => m.id === editing.id), data); else arr.push({ id: uid(), ...data });
    dlg.close(); commit(); toast("Meal saved");
  };
  $("fCancel").onclick = () => dlg.close();
  $("fDelete").onclick = () => {
    const arr = list(editing.day, editing.slot); arr.splice(arr.findIndex(m => m.id === editing.id), 1);
    dlg.close(); commit(); toast("Meal deleted");
  };

  $("shuffle").onclick = () => {
    let n = 0;
    DAYS.forEach(d => SLOTS.forEach(s => {
      if (list(d, s).length) return;
      const opts = LIBRARY.filter(x => x.slot === s), p = opts[Math.floor(Math.random() * opts.length)];
      list(d, s).push({ id: uid(), name: p.name, price: p.price, tag: p.tag, stock: 20, off: false }); n++;
    }));
    commit(); toast(n ? `Added ${n} meals` : "No empty slots left");
  };
  $("clear").onclick = () => {
    const b = $("clear");
    if (!b.dataset.armed) { b.dataset.armed = 1; b.textContent = "Click again to confirm"; setTimeout(() => { delete b.dataset.armed; b.textContent = "Clear week"; }, 3000); return; }
    delete b.dataset.armed; b.textContent = "Clear week";
    state.meals = {}; state.orders = []; commit(); toast("Menu and orders cleared");
  };
  $("export").onclick = () => {
    const a = el("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify({ ...state, session: "" }, null, 2)], { type: "application/json" }));
    a.download = "canteenx.json"; a.click(); URL.revokeObjectURL(a.href); toast("Exported");
  };
  $("import").onclick = () => $("file").click();
  $("file").onchange = e => {
    const f = e.target.files[0]; if (!f) return; const r = new FileReader();
    r.onload = () => {
      try { const s = JSON.parse(r.result); if (!s.meals) throw 0; state = { ...state, ...s, session: state.session }; $("sName").value = state.student; $("capIn").value = state.cap; commit(); toast("Imported"); }
      catch (err) { toast("That file is not a CanteenX export"); }
    };
    r.readAsText(f); e.target.value = "";
  };
  $("capIn").value = state.cap;
  $("capIn").oninput = e => { state.cap = Math.max(1, +e.target.value || 10); commit(); };

  /* staff sign-in and roster */
  $("loginForm").onsubmit = e => {
    e.preventDefault();
    const id = $("staffId").value.trim().toUpperCase(), st = state.staff.find(x => x.id === id);
    if (!st) { $("loginMsg").textContent = "Staff ID not found. Check the ID and try again."; return; }
    $("loginMsg").textContent = ""; $("staffId").value = ""; state.session = id; commit(); toast("Welcome, " + st.name);
  };
  $("staffId").oninput = () => $("loginMsg").textContent = "";
  $("signOut").onclick = () => { state.session = ""; commit(); };
  function renderStaff() {
    const ul = $("staffList"); ul.innerHTML = "";
    state.staff.forEach(s => {
      const li = el("li"); li.innerHTML = "<b></b><span></span>"; li.firstChild.textContent = s.id; li.lastChild.textContent = s.name;
      if (s.id === state.session) { const t = el("em"); t.textContent = "you"; li.append(t); }
      else if (state.staff.length > 1) { const x = el("button", "x"); x.textContent = "Remove"; x.onclick = () => { state.staff = state.staff.filter(y => y.id !== s.id); commit(); toast("Staff removed"); }; li.append(x); }
      ul.append(li);
    });
  }
  $("staffForm").onsubmit = e => {
    e.preventDefault();
    const n = Math.max(1000, ...state.staff.map(s => +s.id.replace(/\D/g, "") || 0)) + 1;
    const s = { id: "CX-" + n, name: $("stName").value.trim() }; if (!s.name) return;
    state.staff.push(s); e.target.reset(); commit(); toast(`${s.name} added with ID ${s.id}`);
  };

  /* add a new food */
  $("nSlot").innerHTML = SLOTS.map(s => `<option>${s}</option>`).join("");
  $("foodDays").innerHTML = DAYS.map(d => `<label class="chip"><input type="checkbox" value="${d}"> ${d}</label>`).join("");
  $("foodNames").innerHTML = LIBRARY.map(f => `<option value="${f.name}">`).join("");
  const dayBoxes = () => [...document.querySelectorAll("#foodDays input")];
  $("nAll").onchange = e => dayBoxes().forEach(b => b.checked = e.target.checked);
  $("nName").oninput = e => {
    const f = LIBRARY.find(x => x.name === e.target.value);
    if (f) { $("nSlot").value = f.slot; $("nTag").value = f.tag; $("nPrice").value = f.price; }
  };
  $("foodForm").onsubmit = e => {
    e.preventDefault();
    const days = dayBoxes().filter(b => b.checked).map(b => b.value);
    if (!days.length) { toast("Pick at least one day to serve it"); return; }
    const st = $("nStock").value, name = $("nName").value.trim();
    days.forEach(d => list(d, $("nSlot").value).push({ id: uid(), name, price: Math.max(0, +$("nPrice").value || 0), stock: st === "" ? "" : Math.max(0, +st), tag: $("nTag").value, off: false }));
    e.target.reset(); commit(); toast(`${name} added to ${days.length} day${days.length > 1 ? "s" : ""}`);
  };

  function render() { renderTabs(); renderStudent(); renderTeam(); }
  render();
})();
