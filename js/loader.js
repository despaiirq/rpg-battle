const MAX_HERO_SLOTS = 30;

window.HEROES = [];

window.registerHero = function (hero) {
  window.HEROES.push(hero);
};

function loadScript(src) {
  return new Promise(function (resolve) {
    const script = document.createElement("script");
    script.src = src;
    script.onload = function () {
      resolve(true);
    };
    script.onerror = function () {
      script.remove();
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

function heroFileName(slot) {
  return "characters/hero-" + String(slot).padStart(2, "0") + ".js";
}

async function loadAllHeroes() {
  for (let slot = 1; slot <= MAX_HERO_SLOTS; slot++) {
    await loadScript(heroFileName(slot));
  }
  return window.HEROES;
}
