//
//  script.js
//  HFWSoR Companion
//
//  Created on 28.03.26.
//


document.getElementById('toggle-btn').addEventListener('click', function() {
    document.getElementById('sidebar').classList.toggle('collapsed');
});

document.getElementById("add-entry-btn").addEventListener("click", addEntry);

document.getElementById("scroll-start-btn").addEventListener("click", () => {
  const container = document.getElementById("flow-container");
  container.scrollTo({ left: 0, behavior: "smooth" });
});

document.getElementById("scroll-end-btn").addEventListener("click", () => {
  const container = document.getElementById("flow-container");
  container.scrollTo({ left: container.scrollWidth, behavior: "smooth" });
});

document.getElementById("export-btn").addEventListener("click", openExportModal);

const STORAGE_KEY = "questEditorData";
let selectedEntryId = null;

  // ===== STATE =====
let state = {
  quests: {},
  activeQuestId: null
};

  // ===== INIT =====
init();

function init() {
  loadState();
  renderQuestList();
  bindUI();
  renderActiveQuest();
}

  // ===== LOCAL STORAGE =====
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    state = JSON.parse(data);
  }
}

  // ===== UI BINDINGS =====
function bindUI() {
  document.getElementById("new-quest-btn")
  .addEventListener("click", createNewQuest);
  
  document.getElementById("quest-name-input")
  .addEventListener("input", (e) => {
    if (!state.activeQuestId) return;
    
    state.quests[state.activeQuestId].name = e.target.value;
    saveState();
    renderQuestList(); // Name live updaten
  });
}

  // ===== QUEST LIST =====
function renderQuestList() {
  const list = document.getElementById("quest-list");
  list.innerHTML = "";
  
  Object.entries(state.quests).forEach(([id, quest]) => {
    const li = document.createElement("li");
    li.textContent = quest.name || "Unbenannte Quest";
    
    if (id === state.activeQuestId) {
      li.style.fontWeight = "bold";
      li.style.color = "var(--accent)";
    }
    
    li.addEventListener("click", () => {
      state.activeQuestId = id;
      saveState();
      renderQuestList();
      renderActiveQuest();
    });
    
    li.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      showQuestContextMenu(e.pageX, e.pageY, id);
    });
    
    list.appendChild(li);
  });
}

function showQuestContextMenu(x, y, questId) {
  removeContextMenu(); // vorhandenes schließen
  
  const menu = document.createElement("div");
  menu.id = "context-menu";
  menu.style.position = "absolute";
  menu.style.top = y + "px";
  menu.style.left = x + "px";
  menu.style.background = "white";
  menu.style.border = "1px solid #ccc";
  menu.style.padding = "5px";
  menu.style.zIndex = 1000;
  
    // DELETE OPTION
  const del = document.createElement("div");
  del.textContent = "Quest löschen";
  
  del.onclick = () => {
    deleteQuest(questId);
    removeContextMenu();
  };
  
  menu.appendChild(del);
  
  document.body.appendChild(menu);
}

function deleteQuest(id) {
  if (!confirm("Quest wirklich löschen?")) return;
  
  delete state.quests[id];
  
    // 👉 Falls aktive Quest gelöscht wurde
  if (state.activeQuestId === id) {
    state.activeQuestId = null;
  }
  
  saveState();
  renderQuestList();
  renderActiveQuest();
}

  // ===== ACTIVE QUEST =====
function renderActiveQuest() {
  const input = document.getElementById("quest-name-input");
  
  if (!state.activeQuestId) {
    input.value = "";
    input.disabled = true;
    return;
  }
  
  input.disabled = false;
  
  const quest = state.quests[state.activeQuestId];
  input.value = quest.name || "";
  
  renderFlow();
  renderEditor();
  renderPreview();
  renderStats();
}

  // ===== CREATE QUEST =====
function createNewQuest() {
  const name = prompt("Name der neuen Quest:");
  if (!name) return;
  
  const id = "quest_" + Date.now();
  
  state.quests[id] = {
    name: name,
    entries: []
  };
  
  state.activeQuestId = id;
  
  saveState();
  renderQuestList();
  renderActiveQuest();
}

  // ===== CREATE ENTRY =====
function addEntry() {
  if (!state.activeQuestId) return;
  
  const quest = state.quests[state.activeQuestId];
  
  const newId = getNextEntryId(quest);
  
  quest.entries.push({
    id: newId,
    type: "Narrative Entry",
    next: null,
    content: []
  });
  
  saveState();
  renderFlow();
  renderEditor();
  renderPreview();
  renderStats();
}

function getNextEntryId(quest) {
  if (quest.entries.length === 0) return 1;
  return Math.max(...quest.entries.map(e => e.id)) + 1;
}

  // ===== RENDER FLOW =====
function renderFlow() {
  const container = document.getElementById("flow-container");
  
    // 👉 Scroll speichern
  const scrollLeft = container.scrollLeft;
  const scrollTop = container.scrollTop;
  
  container.innerHTML = "";
  
  if (!state.activeQuestId) return;
  
  const quest = state.quests[state.activeQuestId];
  if (!quest.entries.length) return;
  
  // SVG GRAPH OVERLAY
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("flow-svg");
  svg.style.position = "absolute";
  svg.style.top = 0;
  svg.style.left = 0;
  //svg.style.width = container.scrollWidth + "px";
  //svg.style.height = container.scrollHeight + "px";
  svg.style.zIndex = "10";
  
  container.style.position = "relative";
  container.appendChild(svg);
  
  const nodePositions = {};
  
  const entryMap = Object.fromEntries(
                                      quest.entries.map(e => [e.id, e])
                                      );
  
    // BFS für Spaltenstruktur
  const columns = [];
  let currentLevel = [1]; // Start immer bei Entry 1
  const visited = new Set();
  
  const rendered = new Set();
  
  while (currentLevel.length) {
    //columns.push(currentLevel);
    const uniqueLevel = [...new Set(currentLevel)]
    .filter(id => !rendered.has(id));
    
    uniqueLevel.forEach(id => rendered.add(id));
    
    columns.push(uniqueLevel);
    
    const nextLevel = [];
    
    currentLevel.forEach(id => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const entry = entryMap[id];
      if (!entry) return;
      
      //let next = entry.next;
      let nextIds = getAllNextIds(entry);
      
      /*if (next == null) return;
      
      if (Array.isArray(next)) {
        next.forEach(n => nextLevel.push(n));
      } else {
        nextLevel.push(next);
      }*/
      nextIds.forEach(n => nextLevel.push(n));
    });
    
    //currentLevel = nextLevel;
    currentLevel = [...new Set(nextLevel)];
  }
  
    // Rendering
  columns.forEach(col => {
    const colDiv = document.createElement("div");
    colDiv.className = "flow-column";
    
    col.forEach(id => {
      const hex = createHex(id);
      colDiv.appendChild(hex);
    });
    
    container.appendChild(colDiv);
  });
  
    // ===== UNUSED ENTRIES =====
  const referenced = new Set([1]);
  
  quest.entries.forEach(e => {
    if (e.next == null) return;
    
    /*if (Array.isArray(e.next)) {
      e.next.forEach(n => referenced.add(n));
    } else {
      referenced.add(e.next);
    }*/
    getAllNextIds(e).forEach(n => referenced.add(n));
  });
  
  /*const unused = quest.entries.filter(e =>
                                      e.id !== 1 && !referenced.has(e.id)
                                      );*/
    // new version
  const reachable = new Set(rendered);
  const unused = quest.entries.filter(e =>
                                      !reachable.has(e.id)
                                      );
  
  if (unused.length) {
    const unusedDiv = document.createElement("div");
    unusedDiv.className = "unused-container";
    
    unused.forEach(e => {
      const box = document.createElement("div");
      box.className = "unused-entry";
      box.textContent = e.id;
      
      attachEntryEvents(box, e); // wichtig!
      
      unusedDiv.appendChild(box);
    });
    
    container.appendChild(unusedDiv);
  }
  
  // RENDER SVG GRAPH OVERLAY
  setTimeout(() => {
    svg.setAttribute("width", container.scrollWidth);
    svg.setAttribute("height", container.scrollHeight);
    
    drawConnections(svg, quest, nodePositions);
    
      // 👉 Scroll wiederherstellen
    container.scrollLeft = scrollLeft;
    container.scrollTop = scrollTop;
    
    renderStats();
  }, 50);
  
  function createHex(id) {
    const entry = getEntryById(id);
    
    let el;
    
    if (entry.type === "unknown") {
      el = document.createElement("div");
      el.className = "hex";
      
      const label = document.createElement("div");
      label.textContent = id;
      label.className = "node-label";
      
      el.appendChild(label);
      
    } else {
      el = document.createElement("div");
      el.className = "flow-icon-wrapper";
      
      const img = document.createElement("img");
      img.className = "flow-icon";
      
      switch (entry.type) {
        case "Action Roll":
          img.src = "../resources/icons/action.png"; break;
        case "Additional Rules":
          img.src = "../resources/icons/rules.png"; break;
        case "Trader":
          img.src = "../resources/icons/trader.png"; break;
        case "Recovery":
          img.src = "../resources/icons/recovery.png"; break;
        case "Narrative Entry":
          img.src = "../resources/icons/hex.png"; break;
      }
      
      const label = document.createElement("div");
      label.textContent = id;
      label.className = "node-label";
      
      el.appendChild(img);
      el.appendChild(label);
    }
    
    if (id === selectedEntryId) {
      el.querySelector(".node-label").style.color = "red";
    }
    
    attachEntryEvents(el, entry);
    
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const parentRect = document.getElementById("flow-container").getBoundingClientRect();
      
      /*nodePositions[id] = {
        x: rect.left - parentRect.left + rect.width / 2,
        y: rect.top - parentRect.top + rect.height / 2
      };*/
      const container = document.getElementById("flow-container");
      
      nodePositions[id] = {
        x: el.offsetLeft + el.offsetWidth / 2,
        y: el.offsetTop + el.offsetHeight / 2
      };
    });
    
    return el;
  }
}

function getAllNextIds(entry) {
  const ids = [];
  
    // ===== STANDARD NEXT =====
  if (entry.next != null) {
    if (Array.isArray(entry.next)) {
      ids.push(...entry.next);
    } else {
      ids.push(entry.next);
    }
  }
  
    // ===== ACTION ROLL =====
  if (entry.type === "Action Roll" && entry.content) {
    if (entry.content.pass) ids.push(entry.content.pass);
    if (entry.content.fail) ids.push(entry.content.fail);
  }
  
    // ===== CONTENT BASED =====
  if (Array.isArray(entry.content)) {
    entry.content.forEach(item => {
      
        // ENCOUNTER
      if (item.type === "encounter") {
        if (item.pass) ids.push(item.pass);
        if (item.fail) ids.push(item.fail);
      }
      
        // RULEBLOCK ITEM
      if (item.type === "ruleblock" && item.role === "item") {
        if (item.next) ids.push(item.next);
      }
      
    });
  }
  
  return ids.filter(id => id != null);
}

function getAllConnections(entry) {
  const connections = [];
  
    // STANDARD
  if (entry.next != null) {
    const targets = Array.isArray(entry.next) ? entry.next : [entry.next];
    targets.forEach(t => connections.push({ id: t, type: "default" }));
  }
  
    // ACTION ROLL
  if (entry.type === "Action Roll" && entry.content) {
    if (entry.content.pass)
      connections.push({ id: entry.content.pass, type: "pass" });
    
    if (entry.content.fail)
      connections.push({ id: entry.content.fail, type: "fail" });
  }
  
    // CONTENT
  if (Array.isArray(entry.content)) {
    entry.content.forEach(item => {
      
      if (item.type === "encounter") {
        if (item.pass)
          connections.push({ id: item.pass, type: "pass" });
        
        if (item.fail)
          connections.push({ id: item.fail, type: "fail" });
      }
      
      if (item.type === "ruleblock" && item.role === "item") {
        if (item.next)
          connections.push({ id: item.next, type: "rule" });
      }
      
    });
  }
  
  return connections;
}

function getConnectionColor(type) {
  switch (type) {
    case "pass": return "green";
    case "fail": return "red";
    case "rule": return "blue";
    default: return "gray";
  }
}

function drawConnections(svg, quest, positions) {
  svg.innerHTML = "";
  
  addArrowMarkers(svg); // NEU (plural!)
  
  quest.entries.forEach(entry => {
    const from = positions[entry.id];
    if (!from) return;
    
    const connections = getAllConnections(entry);
    
    connections.forEach((conn, index) => {
      const to = positions[conn.id];
      if (!to) return;
      
      const color = getConnectionColor(conn.type);
      
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      
      //const dx = to.x - from.x;
      
        // 👉 Smart Routing:
      //const midX = from.x + dx * 0.5;
      /*const offset = (index - connections.length / 2) * 4; // spacing
      const midX = from.x + dx * 0.5 + offset;
      
      const d = `
        M ${from.x} ${from.y}
        L ${midX} ${from.y}
        L ${midX} ${to.y}
        L ${to.x} ${to.y}
      `;*/
      
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      
      const midX = from.x + dx * 0.5;
      
        // 🔥 Ziel leicht vorher stoppen
      const offset = 10;
      
      let endX = to.x;
      let endY = to.y;
      
        // 👉 Entscheide ob vertikal oder horizontal dominiert
      if (Math.abs(dy) > Math.abs(dx)) {
          // Vertikale Verbindung
        endY = to.y - Math.sign(dy) * offset;
      } else {
          // Horizontale Verbindung
        endX = to.x - Math.sign(dx) * offset;
      }
      
      const d = `
        M ${from.x} ${from.y}
        L ${midX} ${from.y}
        L ${midX} ${endY}
        L ${endX} ${endY}
        L ${to.x} ${to.y}
      `;
      
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", color);
      path.setAttribute("stroke-width", "3");
      
      path.setAttribute("marker-end", `url(#arrow-${color})`);
      
      svg.appendChild(path);
    });
  });
}

function addArrowMarkers(svg) {
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  
  ["green", "red", "blue", "gray"].forEach(color => {
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    
    marker.setAttribute("id", `arrow-${color}`);
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "10");
    marker.setAttribute("refX", "10");
    marker.setAttribute("refY", "3");
    marker.setAttribute("orient", "auto");
    
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M0,0 L0,6 L9,3 z");
    path.setAttribute("fill", color);
    
    marker.appendChild(path);
    defs.appendChild(marker);
  });
  
  svg.appendChild(defs);
}

/*function createHex(id) {
  const div = document.createElement("div");
  div.className = "hex";
  
  if (id === selectedEntryId) {
    div.style.color = "red";
  }
  
  div.textContent = id;
  
  const entry = getEntryById(id);
  attachEntryEvents(div, entry);
  
  return div;
}*/

  // ===== RENDER EDITOR =====
function renderEditor() {
  const container = document.querySelector(".editor-bottom");
  container.innerHTML = "";
  
  if (!selectedEntryId) return;
  
  const entry = getEntryById(selectedEntryId);
  
    // ID FIELD
  const idInput = document.createElement("input");
  idInput.type = "number";
  idInput.value = entry.id;
  
  idInput.oninput = (e) => {
    entry.id = Number(e.target.value);
    saveState();
    renderFlow();
    renderEditor();
    renderPreview();
  };
  
  container.appendChild(idInput);
  
    // TYPE DROPDOWN
  const typeSelect = document.createElement("select");
  ["Narrative Entry", "Trader", "Recovery", "Action Roll", "Additional Rules"]
  .forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    if (entry.type === t) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  
  typeSelect.onchange = (e) => {
    entry.type = e.target.value;
    saveState();
    renderEditor();
    renderPreview();
  };
  
  container.appendChild(typeSelect);
  
    // NEXT FIELD (nur bestimmte Typen)
  if (["Narrative Entry", "Trader", "Recovery"].includes(entry.type)) {
    const nextInput = document.createElement("input");
    nextInput.type = "number";
    nextInput.placeholder = "next id";
    nextInput.value = entry.next || "";
    
    nextInput.oninput = (e) => {
      entry.next = e.target.value ? Number(e.target.value) : null;
      saveState();
      renderFlow();
      renderEditor();
      renderPreview();
    };
    
    container.appendChild(nextInput);
  }
  
    // ===== CONTENT LIST =====
  const list = document.createElement("div");
  list.className = "content-list";
  
  container.appendChild(list);
  
    // Spezialfall: Action Roll (kein Array!)
  if (entry.type === "Action Roll") {
    if (!entry.content || Array.isArray(entry.content)) {
      entry.content = { pips: 1, critical: 1, pass: null, fail: null };
    }
    
    renderActionRollEditor(list, entry);
  } else {
    if (!Array.isArray(entry.content)) {
      entry.content = [];
    }
    
    entry.content.forEach((item, index) => {
      const el = createContentItem(entry, item, index);
      list.appendChild(el);
    });
    
      // ADD BUTTON
    /*const addBtn = document.createElement("button");
    addBtn.textContent = "+ Content";
    
    addBtn.onclick = () => {
      addContentItem(entry);
    };
    
    container.appendChild(addBtn);*/
      // ADD BUTTON + MENU
    const addWrapper = document.createElement("div");
    
    const addBtn = document.createElement("button");
    addBtn.textContent = "+ Content";
    
    const menu = document.createElement("div");
    menu.style.display = "none";
    menu.style.border = "1px solid #ccc";
    menu.style.marginTop = "5px";
    menu.style.padding = "5px";
    menu.style.background = "white";
    
      // verfügbare Typen je Entry-Type
    const types = getAvailableContentTypes(entry.type);
    
    types.forEach(type => {
      const btn = document.createElement("button");
      btn.textContent = type;
      
      btn.onclick = () => {
        createContentByType(entry, type);
        menu.style.display = "none";
      };
      
      menu.appendChild(btn);
    });
    
    addBtn.onclick = () => {
      menu.style.display = menu.style.display === "none" ? "block" : "none";
    };
    
    addWrapper.appendChild(addBtn);
    addWrapper.appendChild(menu);
    container.appendChild(addWrapper);
  }
}

function getAvailableContentTypes(entryType) {
  switch (entryType) {
    case "Narrative Entry":
      return ["Text", "Ruleblock Heading", "Ruleblock Item"];
      
    case "Trader":
    case "Recovery":
      return ["Resource"];
      
    case "Additional Rules":
      return ["Text", "Encounter"];
      
    default:
      return [];
  }
}

function createContentByType(entry, type) {
  let newItem;
  
  switch (type) {
    case "Text":
      newItem = "Neuer Text";
      break;
      
    case "Resource":
      newItem = {
        resources: [{ resourceID: "resource", amount: 1 }],
        text: "Beschreibung"
      };
      break;
      
    case "Ruleblock Heading":
      newItem = {
        type: "ruleblock",
        role: "heading",
        content: "Text"
      };
      break;
      
    case "Ruleblock Item":
      newItem = {
        type: "ruleblock",
        role: "item",
        content: "Text",
        next: null
      };
      break;
      
    case "Encounter":
      newItem = {
        type: "encounter",
        text: "Encounter starten",
        pass: null,
        fail: null
      };
      break;
  }
  
  entry.content.push(newItem);
  saveState();
  renderEditor();
  renderPreview();
}

function addContentItem(entry) {
  const type = prompt(
                      "Typ wählen:\ntext\nresource\nruleblock\nencounter"
                      );
  
  let newItem;
  
  switch (type) {
    case "text":
      newItem = "Neuer Text";
      break;
      
    case "resource":
      newItem = {
        resources: [{ resourceID: "resource", amount: 1 }],
        text: "Beschreibung"
      };
      break;
      
    case "ruleblock":
      newItem = {
        type: "ruleblock",
        role: "heading",
        content: "Text"
      };
      break;
      
    case "encounter":
      newItem = {
        type: "encounter",
        text: "Encounter starten",
        pass: null,
        fail: null
      };
      break;
      
    default:
      return;
  }
  
  entry.content.push(newItem);
  saveState();
  renderEditor();
  renderPreview();
}

function createContentItem(entry, item, index) {
  const wrapper = document.createElement("div");
  wrapper.className = "content-item";
  
  const header = document.createElement("div");
  header.className = "content-header";
  
  const title = document.createElement("span");
  title.textContent = getContentType(item);
  
  const del = document.createElement("button");
  del.textContent = "X";
  del.onclick = () => {
    entry.content.splice(index, 1);
    saveState();
    renderEditor();
    renderPreview();
  };
  
  header.appendChild(title);
  header.appendChild(del);
  wrapper.appendChild(header);
  
    // ===== TYPE SWITCH =====
  
    // TEXT
  if (typeof item === "string") {
    const input = document.createElement("input");
    input.value = item;
    
    input.oninput = (e) => {
      entry.content[index] = e.target.value;
      saveState();
    };
    
    wrapper.appendChild(input);
  }
  
    // RESOURCE BLOCK
  else if (item.resources) {
    const text = document.createElement("input");
    text.value = item.text;
    
    text.oninput = (e) => {
      item.text = e.target.value;
      saveState();
    };
    
    wrapper.appendChild(text);
    
    item.resources.forEach((r, i) => {
      const resId = document.createElement("input");
      resId.value = r.resourceID;
      
      resId.oninput = (e) => {
        r.resourceID = e.target.value;
        saveState();
      };
      
      const amount = document.createElement("input");
      amount.type = "number";
      amount.value = r.amount;
      
      amount.oninput = (e) => {
        r.amount = Number(e.target.value);
        saveState();
      };
      
      wrapper.appendChild(resId);
      wrapper.appendChild(amount);
    });
  }
  
    // RULEBLOCK
  else if (item.type === "ruleblock") {
    const role = document.createElement("select");
    ["heading", "item"].forEach(r => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      if (item.role === r) opt.selected = true;
      role.appendChild(opt);
    });
    
    /*role.onchange = (e) => {
      item.role = e.target.value;
      saveState();
    };*/
    role.onchange = (e) => {
      item.role = e.target.value;
      
        // 🔥 FIX: next reset wenn kein item
      if (item.role !== "item") {
        delete item.next;
      } else {
        item.next = item.next || null;
      }
      
      saveState();
      renderEditor(); // 🔥 WICHTIG
      renderPreview();
    };
    
    const content = document.createElement("input");
    content.value = item.content;
    
    content.oninput = (e) => {
      item.content = e.target.value;
      saveState();
    };
    
    wrapper.appendChild(role);
    wrapper.appendChild(content);
    
      // NEXT nur bei item
    if (item.role === "item") {
      const next = document.createElement("input");
      next.type = "number";
      next.value = item.next || "";
      
      next.oninput = (e) => {
        item.next = Number(e.target.value);
        saveState();
        renderFlow();
      };
      
      wrapper.appendChild(next);
    }
  }
  
    // ENCOUNTER
  else if (item.type === "encounter") {
    const text = document.createElement("input");
    text.value = item.text;
    
    text.oninput = (e) => {
      item.text = e.target.value;
      saveState();
    };
    
    const pass = document.createElement("input");
    pass.type = "number";
    pass.placeholder = "pass";
    pass.value = item.pass || "";
    
    pass.oninput = (e) => {
      item.pass = Number(e.target.value);
      saveState();
    };
    
    const fail = document.createElement("input");
    fail.type = "number";
    fail.placeholder = "fail";
    fail.value = item.fail || "";
    
    fail.oninput = (e) => {
      item.fail = Number(e.target.value);
      saveState();
    };
    
    wrapper.appendChild(text);
    wrapper.appendChild(pass);
    wrapper.appendChild(fail);
  }
  
  return wrapper;
}

function renderActionRollEditor(container, entry) {
  const c = entry.content;
  
  ["pips", "critical", "pass", "fail"].forEach(key => {
    const input = document.createElement("input");
    input.type = "number";
    input.placeholder = key;
    input.value = c[key] || "";
    
    input.oninput = (e) => {
      c[key] = Number(e.target.value);
      saveState();
    };
    
    container.appendChild(input);
  });
}

  // ===== CREATE CONTEXT MENU =====
function showContextMenu(x, y, entry) {
  removeContextMenu();
  
  const menu = document.createElement("div");
  menu.id = "context-menu";
  menu.style.position = "absolute";
  menu.style.top = y + "px";
  menu.style.left = x + "px";
  menu.style.background = "white";
  menu.style.border = "1px solid #ccc";
  menu.style.padding = "5px";
  menu.style.zIndex = 1000;
  
    // DELETE
  const del = document.createElement("div");
  del.textContent = "Löschen";
  del.onclick = () => {
    deleteEntry(entry.id);
    removeContextMenu();
  };
  menu.appendChild(del);
  
    // CREATE + LINK (nur wenn referenziert)
  if (isReferenced(entry.id)) {
    const add = document.createElement("div");
    add.textContent = "+ Verbundener Entry";
    add.onclick = () => {
      createLinkedEntry(entry);
      removeContextMenu();
    };
    menu.appendChild(add);
  }
  
  document.body.appendChild(menu);
}

function removeAllReferences(targetId) {
  const quest = state.quests[state.activeQuestId];
  
  quest.entries.forEach(e => {
    
      // STANDARD NEXT
    if (Array.isArray(e.next)) {
      e.next = e.next.filter(n => n !== targetId);
    } else if (e.next === targetId) {
      e.next = null;
    }
    
      // ACTION ROLL
    if (e.type === "Action Roll" && e.content) {
      if (e.content.pass === targetId) e.content.pass = null;
      if (e.content.fail === targetId) e.content.fail = null;
    }
    
      // CONTENT
    if (Array.isArray(e.content)) {
      e.content.forEach(item => {
        
        if (item.type === "encounter") {
          if (item.pass === targetId) item.pass = null;
          if (item.fail === targetId) item.fail = null;
        }
        
        if (item.type === "ruleblock" && item.role === "item") {
          if (item.next === targetId) item.next = null;
        }
        
      });
    }
    
  });
}

function removeContextMenu() {
  const existing = document.getElementById("context-menu");
  if (existing) existing.remove();
}

document.addEventListener("click", removeContextMenu);

  // ===== HELPER =====
/*function isReferenced(id) {
  const quest = state.quests[state.activeQuestId];
  
  return quest.entries.some(e => {
    if (Array.isArray(e.next)) return e.next.includes(id);
    return e.next === id;
  }) || id === 1;
}*/
function isReferenced(id) {
  const quest = state.quests[state.activeQuestId];
  
  return quest.entries.some(e =>
                            getAllNextIds(e).includes(id)
                            ) || id === 1;
}

function deleteEntry(id) {
  const quest = state.quests[state.activeQuestId];
  
  quest.entries = quest.entries.filter(e => e.id !== id);
  
    // remove references
  /*quest.entries.forEach(e => {
    if (Array.isArray(e.next)) {
      e.next = e.next.filter(n => n !== id);
    } else if (e.next === id) {
      e.next = null;
    }
  });*/
  removeAllReferences(id);
  
  saveState();
  renderFlow();
  renderEditor();
  renderPreview();
  renderStats();
}

function createLinkedEntry(entry) {
  const quest = state.quests[state.activeQuestId];
  const newId = getNextEntryId(quest);
  
  const newEntry = {
    id: newId,
    type: "Narrative Entry",
    next: null,
    content: []
  };
  
  quest.entries.push(newEntry);
  
    // verbinden
  if (!entry.next) {
    entry.next = newId;
  } else if (Array.isArray(entry.next)) {
    entry.next.push(newId);
  } else {
    entry.next = [entry.next, newId];
  }
  
  saveState();
  renderFlow();
  renderEditor();
  renderPreview();
  renderStats();
}

function getEntryById(id) {
  const quest = state.quests[state.activeQuestId];
  return quest.entries.find(e => e.id === id);
}

function getContentType(item) {
  if (typeof item === "string") return "Text";
  if (item.resources) return "Resource";
  if (item.type === "ruleblock") return "Ruleblock";
  if (item.type === "encounter") return "Encounter";
  return "Unknown";
}

  // EVENT BINDING
function attachEntryEvents(el, entry) {
    // LEFT CLICK
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    selectedEntryId = entry.id;
    renderFlow();
    renderEditor();
    renderPreview();
  });
  
    // RIGHT CLICK
  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showContextMenu(e.pageX, e.pageY, entry);
  });
}


  // ===== RENDER STATS =====
function renderStats() {
  const terminal = document.getElementById("stats");
  
  if (!state.activeQuestId) {
    terminal.innerHTML = "";
    return;
  }
  
  const quest = state.quests[state.activeQuestId];
  
  const stats = {
    total: quest.entries.length
  };
  
  quest.entries.forEach(e => {
    stats[e.type] = (stats[e.type] || 0) + 1;
  });
  
  let html = `Entries: ${stats.total}<br>`;
  
  Object.keys(stats).forEach(key => {
    if (key === "total") return;
    html += `${key}: ${stats[key]}<br>`;
  });
  
  terminal.innerHTML = html;
}

  // ===== RENDER PREVIEW =====
function renderPreview() {
  const top = document.querySelector(".editor-top");
  top.innerHTML = "";
  
  //console.log(selectedEntryId);
  
  if (!selectedEntryId) return;
  
  const entry = getEntryById(selectedEntryId);
  
    // 🔥 WICHTIG: fake quest wrapper
  const previewContainer = document.createElement("div");
  
  renderEntryPreview(entry, previewContainer);
  
  top.appendChild(previewContainer);
}

renderPreview();

  // ===== EXPORT =====

function openExportModal() {
  const existing = document.getElementById("export-modal");
  if (existing) existing.remove();
  
  const modal = document.createElement("div");
  modal.id = "export-modal";
  modal.style.position = "fixed";
  modal.style.top = "50%";
  modal.style.left = "50%";
  modal.style.transform = "translate(-50%, -50%)";
  modal.style.background = "white";
  modal.style.padding = "20px";
  modal.style.border = "2px solid black";
  modal.style.zIndex = 2000;
  
  const text = document.createElement("pre");
  text.style.maxHeight = "300px";
  text.style.overflow = "auto";
  
  const exportText = generateExportText();
  text.textContent = exportText;
  
    // Buttons
  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy";
  
  copyBtn.onclick = async () => {
    await navigator.clipboard.writeText(exportText);
    alert("Kopiert!");
  };
  
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save File";
  
  saveBtn.onclick = () => {
    downloadFile(exportText);
  };
  
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Abbrechen";
  
  cancelBtn.onclick = () => modal.remove();
  
  modal.appendChild(text);
  modal.appendChild(copyBtn);
  modal.appendChild(saveBtn);
  modal.appendChild(cancelBtn);
  
  document.body.appendChild(modal);
}

function generateExportText() {
  if (!state.activeQuestId) return "";
  
  const quest = state.quests[state.activeQuestId];
  
  const key = state.activeQuestId;
  
  return `${key}: ${formatObject(quest, 2)}`;
}

function formatObject(obj, indent = 2, level = 0) {
  const space = " ".repeat(level * indent);
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    
    return `[\n${obj.map(item =>
      space + " ".repeat(indent) + formatObject(item, indent, level + 1)
    ).join(",\n")}\n${space}]`;
  }
  
  if (typeof obj === "object" && obj !== null) {
    const entries = Object.entries(obj);
    
    return `{\n${entries.map(([key, value]) => {
      return `${space}${" ".repeat(indent)}${key}: ${formatObject(value, indent, level + 1)}`;
    }).join(",\n")}\n${space}}`;
  }
  
  if (typeof obj === "string") {
    return `"${obj}"`;
  }
  
  return String(obj);
}

function downloadFile(text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement("a");
  a.href = url;
  a.download = "quest.txt";
  a.click();
  
  URL.revokeObjectURL(url);
}
