// src/utils/stringUtils.js

// Exemple : mettre une chaîne en majuscules
export function toUpperCase(str) {
  return str.toUpperCase();
}

// Exemple : tronquer une chaîne à une longueur donnée avec "..."
export function truncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

// Exemple : mettre la première lettre en majuscule
export function capitalizeFirstLetter(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
