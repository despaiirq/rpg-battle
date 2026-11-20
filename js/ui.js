const AUTO_PLAY_DELAY_MS = 700;
const LOW_HP_RATIO = 0.3;
const HIT_FLASH_MS = 250;

const stagesElement = document.getElementById("stages");
const partyElement = document.getElementById("party");
const partyCountElement = document.getElementById("party-count");
const stageLabelElement = document.getElementById("stage-label");
const monsterElement = document.getElementById("monster");
const statusElement = document.getElementById("status");
const logElement = document.getElementById("log");
const nextRoundButton = document.getElementById("next-round");
const autoPlayButton = document.getElementById("auto-play");
const nextBattleButton = document.getElementById("next-battle");
const restartButton = document.getElementById("restart");

let run = null;
let autoPlayTimer = null;

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function createSprite(name, fallback) {
  const image = createElement("img", "sprite");
  image.src = "sprites/" + name + ".svg";
  image.alt = name;
  image.addEventListener("error", function () {
    if (image.src.indexOf(fallback) === -1) {
      image.src = "sprites/" + fallback + ".svg";
    }
  });
  return image;
}

function createHpBar(current, max) {
  const bar = createElement("div", "hp-bar");
  const fill = createElement("div", "hp-fill" + (current / max <= LOW_HP_RATIO ? " low" : ""));
  fill.style.width = (current / max) * 100 + "%";
  bar.appendChild(fill);
  return bar;
}

function damageList(moves) {
  return moves
    .map(function (move) {
      return move.damage;
    })
    .join(" ");
}

function createHeroCard(hero) {
  const card = createElement("div", "card" + (hero.currentHp === 0 ? " fallen" : ""));
  card.title = hero.moves
    .map(function (move) {
      return move.name + ": " + move.damage;
    })
    .join("\n");
  card.appendChild(createSprite(hero.sprite, "knight"));
  card.appendChild(createElement("div", "name", hero.name));
  card.appendChild(createHpBar(hero.currentHp, hero.maxHp));
  card.appendChild(createElement("div", "small", "HP " + hero.currentHp + "/" + hero.maxHp));
  card.appendChild(createElement("div", "small", "DMG " + damageList(hero.moves)));
  if (hero.capped) {
    card.appendChild(createElement("div", "capped", "capped"));
  }
  return card;
}

function stageState(index) {
  if (index < run.stage || (index === run.stage && run.status === "quest-complete")) {
    return "clear";
  }
  if (index === run.stage) {
    return run.status === "defeat" ? "lost" : "current";
  }
  return "locked";
}

function renderStages() {
  stagesElement.replaceChildren(
    ...run.monsters.map(function (monster, index) {
      return createElement("li", stageState(index), monster.name);
    })
  );
}

function renderParty() {
  partyElement.replaceChildren(...run.heroes.map(createHeroCard));
  partyCountElement.textContent = aliveHeroes(run).length + " / " + run.heroes.length;
}

function renderMonster() {
  const monster = currentMonster(run);
  stageLabelElement.textContent = "Stage " + (run.stage + 1) + " / " + run.monsters.length;
  monsterElement.className = "monster" + (monster.currentHp === 0 ? " defeated" : "");
  monsterElement.replaceChildren(
    createSprite(monster.sprite, "slime"),
    createElement("div", "name", monster.name),
    createHpBar(monster.currentHp, monster.maxHp),
    createElement("div", "small", "HP " + monster.currentHp + "/" + monster.maxHp),
    createElement("div", "small", "ATK " + monster.attack)
  );
}

function renderStatus() {
  const messages = {
    fighting: "Fight the " + currentMonster(run).name + "!",
    "stage-won": "Victory! Press Next battle",
    "quest-complete": "Quest complete! Your party won",
    defeat: "Defeat... Restart to try again from stage 1"
  };
  statusElement.className = "status " + run.status;
  statusElement.textContent = messages[run.status];
}

function renderControls() {
  restartButton.disabled = false;
  nextRoundButton.disabled = !canPlayRound(run);
  autoPlayButton.disabled = run.status === "defeat" || run.status === "quest-complete";
  nextBattleButton.disabled = run.status !== "stage-won";
}

function render() {
  renderStages();
  renderParty();
  renderMonster();
  renderStatus();
  renderControls();
}

function flash(element) {
  element.classList.add("hit");
  setTimeout(function () {
    element.classList.remove("hit");
  }, HIT_FLASH_MS);
}

function flashHits(heroHpBefore, monsterHpBefore) {
  if (currentMonster(run).currentHp < monsterHpBefore) {
    flash(monsterElement);
  }
  run.heroes.forEach(function (hero, index) {
    if (hero.currentHp < heroHpBefore[index]) {
      flash(partyElement.children[index]);
    }
  });
}

function appendLog(events) {
  for (const event of events) {
    logElement.appendChild(createElement("li", event.type ? "log-" + event.type : "", event.text));
  }
  logElement.scrollTop = logElement.scrollHeight;
}

function stopAutoPlay() {
  clearInterval(autoPlayTimer);
  autoPlayTimer = null;
  autoPlayButton.classList.remove("active");
  autoPlayButton.textContent = "Auto play";
}

function nextRound() {
  if (!canPlayRound(run)) {
    return;
  }
  const heroHpBefore = run.heroes.map(function (hero) {
    return hero.currentHp;
  });
  const monsterHpBefore = currentMonster(run).currentHp;
  appendLog(playRound(run));
  render();
  flashHits(heroHpBefore, monsterHpBefore);
}

function nextBattle() {
  appendLog(advanceStage(run));
  render();
}

function autoPlayStep() {
  if (run.status === "stage-won") {
    nextBattle();
  } else if (run.status === "fighting") {
    nextRound();
  }
  if (run.status === "defeat" || run.status === "quest-complete") {
    stopAutoPlay();
    renderControls();
  }
}

function toggleAutoPlay() {
  if (autoPlayTimer) {
    stopAutoPlay();
    return;
  }
  autoPlayButton.classList.add("active");
  autoPlayButton.textContent = "Pause";
  autoPlayTimer = setInterval(autoPlayStep, AUTO_PLAY_DELAY_MS);
}

function logCappedHeroes() {
  for (const hero of run.heroes) {
    if (hero.capped) {
      appendLog([
        {
          text: hero.name + " was capped: max " + MAX_HERO_HP + " hp and " + MAX_MOVE_DAMAGE + " damage per move",
          type: "warning"
        }
      ]);
    }
  }
}

function startRun() {
  stopAutoPlay();
  run = createRun(window.HEROES, window.MONSTERS);
  logElement.replaceChildren();
  appendLog([{ text: "Stage 1: " + currentMonster(run).name + " appears!", type: "stage" }]);
  logCappedHeroes();
  render();
}

function showSetupProblem(text) {
  statusElement.textContent = text;
  statusElement.className = "status defeat";
}

async function init() {
  await loadAllHeroes();
  if (!Array.isArray(window.MONSTERS) || window.MONSTERS.length === 0) {
    showSetupProblem("No monsters found. Check js/monsters.js");
    return;
  }
  if (window.HEROES.length === 0) {
    showSetupProblem("No heroes found. Add a file to the characters folder");
    return;
  }
  startRun();
}

nextRoundButton.addEventListener("click", nextRound);
autoPlayButton.addEventListener("click", toggleAutoPlay);
nextBattleButton.addEventListener("click", nextBattle);
restartButton.addEventListener("click", startRun);

init();
