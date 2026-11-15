function cleanHero(name) {
  return (name || "не определён").replace("npc_dota_hero_", "").replaceAll("_", " ");
}

function analyzeMatch(state = {}) {
  const player = state.player || {};
  const hero = state.hero || {};
  const map = state.map || {};
  const kills = Number(player.kills || 0);
  const deaths = Number(player.deaths || 0);
  const assists = Number(player.assists || 0);
  const level = Number(hero.level || 0);
  const gold = Number(player.gold || 0);
  const seconds = Number(map.game_time || 0);
  const minutes = Math.max(0, Math.floor(seconds / 60));

  let action = {
    priority: "normal",
    title: "Проверь карту и продолжай безопасный фарм",
    detail: "Не заходи в неизвестную область один. Сверяй доступную информацию на мини-карте и учитывай состояние союзников.",
    reason: "Базовая рекомендация: недостаточно данных для более точного решения."
  };

  if (deaths >= 5 && deaths > kills + 2) {
    action = {
      priority: "high",
      title: "Снизь риск смертей",
      detail: "Старайся перемещаться вместе с союзниками и не начинать одиночные действия без информации о противниках.",
      reason: "Смертей заметно больше, чем убийств."
    };
  } else if (minutes >= 20 && kills + assists >= 8) {
    action = {
      priority: "high",
      title: "Оцени возможность командного действия",
      detail: "Проверь готовность ключевых способностей и состояние команды. Если команда готова, согласуйте движение к объекту.",
      reason: "Стадия матча и участие в боях."
    };
  }

  return {
    hero: cleanHero(hero.name),
    level, kills, deaths, assists, gold, gameTime: seconds, minutes,
    phase: minutes < 10 ? "Линия" : minutes < 25 ? "Ранняя / средняя" : minutes < 40 ? "Середина игры" : "Поздняя игра",
    action,
    confidence: "low",
    disclaimer: "Совет основан только на полученных данных и не является гарантией правильного решения."
  };
}

module.exports = { analyzeMatch };