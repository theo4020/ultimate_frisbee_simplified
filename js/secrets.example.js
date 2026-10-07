// secrets.example.js — MODÈLE. Copie ce fichier en « js/secrets.js » et remplis-le.
// js/secrets.js est ignoré par Git : il ne finira jamais dans l'historique du dépôt.
//
// Attention : dans un jeu qui tourne dans le navigateur, ces valeurs restent lisibles
// par n'importe quel joueur qui ouvre le code de la page. Les garder hors de Git évite
// seulement qu'elles traînent dans l'historique public du dépôt.
//
// Relais TURN Metered (https://www.metered.ca/tools/openrelay/, 20 Go/mois gratuits) :
//   Dashboard → TURN Server → Credentials → « Create Credential »
window.ULTIMATE_SECRETS = {
  TURN_USER: '',   // username affiché par Metered
  TURN_PASS: '',   // password affiché par Metered
  // Méthode alternative (facultative) : nom d'application + clé API de credential
  TURN_APP: '',    // ex. 'monjeu' pour monjeu.metered.live
  TURN_KEY: ''
};
