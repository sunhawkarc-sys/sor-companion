//
//  render.js
//  HFWSoR Companion
//
//  Created on 28.03.26.
//

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

function goToEntry(id) {
  //console.log("Preview navigation disabled:", id);
  console.log("Preview navigation enabled:", id);
  
  selectedEntryId = id;
  
  renderFlow();
  renderEditor();
  renderPreview();
}

function renderEntryPreview(entry, container) {
  container.innerHTML = "";
  
  if (!entry) return;
  
  const el = renderEntry(entry);
  container.appendChild(el);
}
