//
//  app.js
//  HFWSoR Companion
//
//  Created on 29.03.26.
//


const STORAGE_KEY = "questViewerData";

let state = loadState();

const questListEl = document.getElementById("questList");
const questViewEl = document.getElementById("questView");
const fileInput = document.getElementById("fileInput");

let contextMenu = null;

init();

function init() {
  renderQuestList();
  
  fileInput.addEventListener("change", handleImport);
}

// ======================
// 📦 STORAGE
// ======================

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : { quests: {}, activeQuestId: null };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ======================
// CONTEXT MENU
// ======================

function createContextMenu(x, y, questId) {
  removeContextMenu();
  
  contextMenu = document.createElement("div");
  contextMenu.style.position = "fixed";
  contextMenu.style.top = y + "px";
  contextMenu.style.left = x + "px";
  contextMenu.style.background = "#222";
  contextMenu.style.color = "white";
  contextMenu.style.padding = "8px";
  contextMenu.style.border = "1px solid #555";
  contextMenu.style.cursor = "pointer";
  contextMenu.style.zIndex = 1000;
  
  const deleteBtn = document.createElement("div");
  deleteBtn.textContent = "🗑 Delete Quest";
  
  deleteBtn.onclick = () => {
    deleteQuest(questId);
    removeContextMenu();
  };
  
  contextMenu.appendChild(deleteBtn);
  
  document.body.appendChild(contextMenu);
  
    // 🔥 Klick irgendwo schließt Menü
  setTimeout(() => {
    document.addEventListener("click", removeContextMenu, { once: true });
  }, 0);
}

function removeContextMenu() {
  if (contextMenu) {
    contextMenu.remove();
    contextMenu = null;
  }
}

function deleteQuest(id) {
  if (!confirm("Quest wirklich löschen?")) return;
  
  delete state.quests[id];
  
    // 🔥 falls aktive Quest gelöscht wird
  if (state.activeQuestId === id) {
    state.activeQuestId = Object.keys(state.quests)[0] || null;
  }
  
  saveState();
  renderQuestList();
  renderActiveQuest();
}

// ======================
// 📥 IMPORT
// ======================

function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  
  reader.onload = () => {
    try {
      const quest = parseQuestFile(reader.result);
      
      /*state.quests[quest.id] = {
        data: quest,
        currentEntry: 1
      };*/
      state.quests[quest.id] = {
        data: quest,
        currentEntry: 1,
        history: [1] // 🔥 Startpunkt
      };
      
      state.activeQuestId = quest.id;
      
      saveState();
      renderQuestList();
      renderActiveQuest();
      
    } catch (err) {
      alert("Fehler beim Laden der Quest:\n" + err.message);
    }
  };
  
  reader.readAsText(file);
}

function parseQuestFile(text) {
  text = text.trim();
  
    // ======================
    // 🆔 QUEST ID EXTRAHIEREN
    // ======================
  const idMatch = text.match(/^(\w+)\s*:/);
  if (!idMatch) {
    throw new Error("Ungültiges Format: Keine Quest-ID gefunden");
  }
  
  const questId = idMatch[1];
  
    // ======================
    // 📦 OBJEKT TEIL HOLEN
    // ======================
  const objectStart = text.indexOf("{");
  const objectEnd = text.lastIndexOf("}");
  
  if (objectStart === -1 || objectEnd === -1) {
    throw new Error("Ungültiges Format: Kein Objekt gefunden");
  }
  
  let objText = text.slice(objectStart, objectEnd + 1);
  
    // ======================
    // 🔧 FORMAT FIXES
    // ======================
  
    // 🔹 Keys in Quotes setzen: name: → "name":
  objText = objText.replace(/(\w+)\s*:/g, '"$1":');
  
    // 🔹 Trailing commas entfernen
  objText = objText.replace(/,\s*([}\]])/g, "$1");
  
    // ======================
    // 🧪 PARSEN
    // ======================
  let questData;
  try {
    questData = JSON.parse(objText);
  } catch (e) {
    console.error("Parsing Fehler bei:", objText);
    throw new Error("Parser konnte Datei nicht lesen");
  }
  
    // ======================
    // 🧩 FINAL OBJEKT
    // ======================
  questData.id = questId;
  
  return questData;
}

// ======================
// 📋 QUEST LISTE
// ======================

function renderQuestList() {
  questListEl.innerHTML = "";

  Object.keys(state.quests).forEach(id => {
    const quest = state.quests[id];

    const btn = document.createElement("button");
    btn.textContent = `${quest.data.name || id} (Entry ${quest.currentEntry})`;
    
    btn.onclick = () => {
      state.activeQuestId = id;
      saveState();
      renderActiveQuest();
    };
    
      // 🔥 RECHTSKLICK
    btn.oncontextmenu = (e) => {
      e.preventDefault();
      createContextMenu(e.clientX, e.clientY, id);
    };
    
    questListEl.appendChild(btn);
  });
}

// ======================
// 🎮 QUEST SPIELEN
// ======================

function renderActiveQuest() {
  questViewEl.innerHTML = "";
  
  const active = state.quests[state.activeQuestId];
  if (!active) return;
  
    // ======================
    // 🔥 CONTROL BAR
    // ======================
  const controls = document.createElement("div");
  
  const backBtn = document.createElement("button");
  backBtn.textContent = "← Back";
  backBtn.onclick = goBack;
  
  const restartBtn = document.createElement("button");
  restartBtn.textContent = "⟳ Restart";
  restartBtn.onclick = restartQuest;
  
  controls.appendChild(backBtn);
  controls.appendChild(restartBtn);
  
  questViewEl.appendChild(controls);
  
    // ======================
    // 🔥 ENTRY
    // ======================
  const entry = getEntry(active.data, active.currentEntry);
  
  const el = renderEntry(entry);
  questViewEl.appendChild(el);
}

// ======================
// 🔎 ENTRY HELPER
// ======================

function getEntry(quest, id) {
  return quest.entries.find(e => e.id === id);
}

// ======================
// 🔥 DEIN GO TO ENTRY (ANGEPASST)
// ======================

function goToEntry(id) {
  const active = state.quests[state.activeQuestId];
  if (!active) return;
  
  const current = active.currentEntry;
  
    // 🔥 Nur hinzufügen, wenn es kein Backtracking ist
  if (current !== id) {
    active.history.push(id);
  }
  
  active.currentEntry = id;
  
  saveState();
  renderActiveQuest();
}

function goBack() {
  const active = state.quests[state.activeQuestId];
  if (!active) return;
  
  if (active.history.length <= 1) return;
  
    // 🔥 aktuellen entfernen
  active.history.pop();
  
    // 🔥 vorherigen holen
  const prev = active.history[active.history.length - 1];
  
  active.currentEntry = prev;
  
  saveState();
  renderActiveQuest();
}

function restartQuest() {
  const active = state.quests[state.activeQuestId];
  if (!active) return;
  
  const start = active.data.start || 1;
  
  active.currentEntry = start;
  active.history = [start]; // 🔥 reset history
  
  saveState();
  renderActiveQuest();
}

// ======================
// 🔁 INITIAL RENDER
// ======================

renderActiveQuest();

// ======================
// ======================
// ======================
// RENDERING
// ======================
// ======================
// ======================
function renderEntry(entry) {
  const container = document.createElement("div");
  
    // 🔥 HEADER
  const title = document.createElement("h1");
  title.textContent = `${entry.id}`;
  title.style.color = "red";
  container.appendChild(title);
  
  let contentBlock;
  
  switch (entry.type) {
    case "Narrative Entry":
      contentBlock = renderNarrative(entry);
      break;
      
    case "Trader":
      contentBlock = renderStyledBlock(entry, "yellow", "trader.png");
      break;
      
    case "Recovery":
      contentBlock = renderStyledBlock(entry, "green", "recovery.png");
      break;
      
    case "Action Roll":
      contentBlock = renderActionRoll(entry);
      break;
      
    case "Additional Rules":
      contentBlock = renderAdditionalRules(entry);
      break;
  }
  
  container.appendChild(contentBlock);
  
    // 🔥 ENTSCHEIDUNGS-LOGIK
  const hasChoices = contentBlock.dataset.hasChoices === "true";
  const hasEncounter = contentBlock.dataset.hasEncounter === "true";
  
    // 🔥 NEXT BUTTON NUR WENN:
    // - kein Action Roll
    // - keine Narrative Choices
    // - kein Encounter
  if (
      entry.type !== "Action Roll" &&
      entry.next &&
      !hasChoices &&
      !hasEncounter
      ) {
        const nextBtn = document.createElement("button");
        nextBtn.textContent = `Next → Read Entry ${entry.next}`;
        
        nextBtn.onclick = () => goToEntry(entry.next);
        
        container.appendChild(nextBtn);
      }
  
  return container;
}

function renderNarrative(entry) {
  const div = document.createElement("div");
  
  let hasChoices = false; // 🔥 wichtig
  
  entry.content.forEach(el => {
    
      // 🔹 NORMALER TEXT
    if (typeof el === "string") {
      const p = document.createElement("p");
      p.innerHTML = renderTextWithIcons(el);
      div.appendChild(p);
    }
    
      // 🔹 RULEBLOCK
    else if (el.type === "ruleblock") {
      
        // HEADING
      if (el.role === "heading") {
        const h = document.createElement("p");
        h.style.fontWeight = "bold";
        h.innerHTML = renderTextWithIcons(el.content);
        div.appendChild(h);
      }
      
        // 🔥 ITEM (JETZT KLICKBAR)
      if (el.role === "item") {
        const item = document.createElement("p");
        item.style.marginLeft = "16px";
        item.style.cursor = "pointer";
        
        item.innerHTML = `> ${renderTextWithIcons(el.content)}`;
        
        if (el.next) {
          hasChoices = true;
          
          item.onclick = () => goToEntry(el.next);
          
          item.style.textDecoration = "underline";
        }
        
        div.appendChild(item);
      }
    }
  });
  
    // 🔥 FLAG zurückgeben
  div.dataset.hasChoices = hasChoices;
  
  return div;
}

function renderAdditionalRules(entry) {
  const wrapper = document.createElement("div");
  wrapper.className = "quest-block";
  
  let hasEncounter = false;
  
  const contentHTML = entry.content.map(el => {
    
      // 🔥 ENCOUNTER
    if (el.type === "encounter") {
      hasEncounter = true;
      
      return `
        <p>${renderTextWithIcons(el.text)}</p>
        <p><b>Pass:</b> Read entry ${el.pass}.</p>
        <p><b>Fail:</b> Read entry ${el.fail}.</p>
        
        <div class="action-buttons">
          <button class="pass-btn" data-next="${el.pass}">Pass</button>
          <button class="fail-btn" data-next="${el.fail}">Fail</button>
        </div>
      `;
    }
    
      // 🔹 NORMALER TEXT
    if (typeof el === "string") {
      return `<p>${renderTextWithIcons(el)}</p>`;
    }
    
    return "";
  }).join("");
  
  wrapper.innerHTML = `
    <div class="quest-line blue"></div>
  
    <div class="quest-content blue">
      <img src="../resources/icons/rules.png" class="quest-icon">
  
      <div class="quest-text">
        ${contentHTML}
      </div>
    </div>
  
    <div class="quest-line blue"></div>
  `;
  
    // 🔥 BUTTON EVENTS
  wrapper.querySelectorAll(".pass-btn").forEach(btn => {
    btn.onclick = () => goToEntry(Number(btn.dataset.next));
  });
  
  wrapper.querySelectorAll(".fail-btn").forEach(btn => {
    btn.onclick = () => goToEntry(Number(btn.dataset.next));
  });
  
    // 🔥 FLAG setzen
  wrapper.dataset.hasEncounter = hasEncounter;
  
  return wrapper;
}

function renderStyledBlock(entry, color, iconName) {
  const wrapper = document.createElement("div");
  wrapper.className = "quest-block";
  
  wrapper.innerHTML = `
    <div class="quest-line ${color}"></div>
    
    <div class="quest-content ${color}">
      
      <img src="../resources/icons/${iconName}" class="quest-icon">
      
      <div class="quest-text">
        ${renderBlockContent(entry)}
      </div>
      
    </div>
    
    <div class="quest-line ${color}"></div>
  `;
  
  return wrapper;
}

function renderBlockContent(entry) {
  
    // 🔥 FALL 1: einfacher Text
  if (typeof entry.content[0] === "string") {
    return entry.content
    .map(t => `<p>${renderTextWithIcons(t)}</p>`)
    .join("");
  }
  
    // 🔥 FALL 2: Resource + Text
  return entry.content.map(item => {
    
    const resHTML = item.resources?.map(res => {
      return `
        <img src="../resources/icons/${res.resourceID}.png" class="resource-icon">
        ${res.amount}
      `;
    }).join(" ") || "";
    
    return `
      <div>
        ${resHTML}
        ${resHTML ? " - " : ""}
        ${renderTextWithIcons(item.text || "")}
      </div>
    `;
    
  }).join("");
}

function renderActionRoll(entry) {
  const wrapper = document.createElement("div");
  wrapper.className = "quest-block";
  
  const c = entry.content;
  
    // 🔥 SYMBOLS
  const pips = Array(c.pips)
  .fill(`<img src="../resources/icons/pip.png" class="inline-icon">`)
  .join(" ");
  
  const critical = Array(c.critical)
  .fill(`<img src="../resources/icons/critical.png" class="inline-icon">`)
  .join(" ");
  
  wrapper.innerHTML = `
    <div class="quest-line red"></div>
    
    <div class="quest-content red">
      
      <img src="../resources/icons/action.png" class="quest-icon">
      
      <div class="quest-text">
        <p>Make a ${pips} / ${critical} action roll.</p>
        <p><b>Pass:</b> Read entry ${c.pass}.</p>
        <p><b>Fail:</b> Read entry ${c.fail}.</p>
        
        <div class="action-buttons">
          <button class="pass-btn">Pass</button>
          <button class="fail-btn">Fail</button>
        </div>
        
      </div>
      
    </div>
    
    <div class="quest-line red"></div>
  `;
  
    // 🔥 BUTTON EVENTS (WICHTIG: nach innerHTML)
  wrapper.querySelector(".pass-btn").onclick = () => goToEntry(c.pass);
  wrapper.querySelector(".fail-btn").onclick = () => goToEntry(c.fail);
  
  return wrapper;
}

function renderTextWithIcons(text) {
  return parseInlineIcons_quest(text);
}

function parseInlineIcons_quest(text) {
  return text.replace(/#(.*?)#/g, (match, src) => {
    return `<img src="../resources/icons/${src}" class="inline-icon">`;
  });
}

function renderEntryPreview(entry, container) {
  container.innerHTML = "";
  
  if (!entry) return;
  
  const el = renderEntry(entry);
  container.appendChild(el);
}

