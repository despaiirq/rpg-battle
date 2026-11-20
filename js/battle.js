const MAX_HERO_HP = 50;
const MAX_MOVE_DAMAGE = 10;
const HEROES_PER_MONSTER_ATTACK = 1;
const REST_HEAL_RATIO = 0.5;

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toWholeNumber(value, fallback) {
  const number = Math.round(Number(value));
  return Number.isFinite(number) ? number : fallback;
}

function prepareMove(move) {
  const wanted = toWholeNumber(move && move.damage, 1);
  const damage = clamp(wanted, 1, MAX_MOVE_DAMAGE);
  return {
    name: String((move && move.name) || "Attack"),
    damage: damage,
    capped: damage !== wanted
  };
}

function prepareHero(hero) {
  const wantedHp = toWholeNumber(hero.hp, 1);
  const maxHp = clamp(wantedHp, 1, MAX_HERO_HP);
  const rawMoves = Array.isArray(hero.moves) && hero.moves.length > 0 ? hero.moves.slice(0, 3) : [{}];
  const moves = rawMoves.map(prepareMove);
  return {
    name: String(hero.name || "Nameless Hero"),
    sprite: String(hero.sprite || "knight"),
    maxHp: maxHp,
    currentHp: maxHp,
    moves: moves,
    capped: maxHp !== wantedHp || moves.some(function (move) {
      return move.capped;
    })
  };
}

function prepareMonster(monster) {
  const maxHp = Math.max(1, toWholeNumber(monster.hp, 1));
  return {
    name: String(monster.name || "Monster"),
    sprite: String(monster.sprite || "slime"),
    attack: Math.max(0, toWholeNumber(monster.attack, 0)),
    maxHp: maxHp,
    currentHp: maxHp
  };
}

function createRun(heroData, monsterData) {
  const run = {
    heroes: heroData.map(prepareHero),
    monsters: monsterData.map(prepareMonster),
    stage: 0,
    round: 1,
    status: "fighting"
  };
  return run;
}

function currentMonster(run) {
  return run.monsters[run.stage];
}

function isLastStage(run) {
  return run.stage === run.monsters.length - 1;
}

function aliveHeroes(run) {
  return run.heroes.filter(function (hero) {
    return hero.currentHp > 0;
  });
}

function canPlayRound(run) {
  return run.status === "fighting";
}

function monsterAttackCount(run) {
  return Math.max(1, Math.ceil(aliveHeroes(run).length / HEROES_PER_MONSTER_ATTACK));
}

function heroAttack(run, hero) {
  const monster = currentMonster(run);
  const move = pickRandom(hero.moves);
  monster.currentHp = Math.max(0, monster.currentHp - move.damage);
  return { text: hero.name + " uses " + move.name + " for " + move.damage + " damage", type: "hero" };
}

function monsterAttack(run, target) {
  const monster = currentMonster(run);
  target.currentHp = Math.max(0, target.currentHp - monster.attack);
  const events = [
    { text: monster.name + " hits " + target.name + " for " + monster.attack + " damage", type: "monster" }
  ];
  if (target.currentHp === 0) {
    events.push({ text: target.name + " has fallen", type: "fallen" });
  }
  return events;
}

function finishRoundIfOver(run, events) {
  const monster = currentMonster(run);
  if (monster.currentHp === 0) {
    run.status = isLastStage(run) ? "quest-complete" : "stage-won";
    const text = isLastStage(run)
      ? monster.name + " is defeated. Quest complete!"
      : "Victory! " + monster.name + " is defeated";
    events.push({ text: text, type: "result" });
  } else if (aliveHeroes(run).length === 0) {
    run.status = "defeat";
    events.push({ text: "Defeat! The party has fallen at stage " + (run.stage + 1), type: "defeat" });
    events.push({ text: monster.name + " still had " + monster.currentHp + " / " + monster.maxHp + " HP", type: "defeat" });
  }
}

function playRound(run) {
  if (!canPlayRound(run)) {
    return [];
  }

  const monster = currentMonster(run);
  const events = [{ text: "Round " + run.round, type: "round" }];

  for (const hero of aliveHeroes(run)) {
    if (monster.currentHp === 0) {
      break;
    }
    events.push(heroAttack(run, hero));
  }

  if (monster.currentHp > 0) {
    const attacks = monsterAttackCount(run);
    for (let i = 0; i < attacks && aliveHeroes(run).length > 0; i++) {
      events.push(...monsterAttack(run, pickRandom(aliveHeroes(run))));
    }
  }

  run.round += 1;
  finishRoundIfOver(run, events);
  return events;
}

function restParty(run) {
  for (const hero of aliveHeroes(run)) {
    const heal = Math.ceil(hero.maxHp * REST_HEAL_RATIO);
    hero.currentHp = Math.min(hero.maxHp, hero.currentHp + heal);
  }
}

function advanceStage(run) {
  if (run.status !== "stage-won") {
    return [];
  }
  restParty(run);
  run.stage += 1;
  run.round = 1;
  run.status = "fighting";
  return [
    { text: "The party rests. Survivors recover " + REST_HEAL_RATIO * 100 + "% HP, the fallen stay down", type: "rest" },
    { text: "Stage " + (run.stage + 1) + ": " + currentMonster(run).name + " appears!", type: "stage" }
  ];
}
