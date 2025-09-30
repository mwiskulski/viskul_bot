const sqlite3 = require('sqlite3').verbose();

// Definicja ścieżki do pliku bazy danych
const DB_PATH = './database.sqlite';

// Utworzenie i eksportowanie instancji bazy danych
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Błąd podczas łączenia z bazą danych:', err.message);
  } else {
    console.log('Połączono z bazą danych SQLite.');
  }
});

/**
 * Inicjalizuje bazę danych, tworząc niezbędne tabele, jeśli nie istnieją.
 */
function initializeDatabase() {
  db.serialize(() => {
    // Tabela dla kont LoL
    db.run(`
      CREATE TABLE IF NOT EXISTS accounts (
        twitch_channel TEXT NOT NULL PRIMARY KEY,
        game_name TEXT NOT NULL,
        tag_line TEXT NOT NULL,
        puuid TEXT NOT NULL,
        lol_server TEXT NOT NULL,
        summoner_name TEXT NOT NULL
      );
    `, (err) => {
      if (err) console.error('Błąd podczas tworzenia tabeli \'accounts\':', err.message);
      else console.log('Tabela \'accounts\' jest gotowa.');
    });

    // Tabela dla kanałów, do których bot ma dołączać
    db.run(`
      CREATE TABLE IF NOT EXISTS channels (
        name TEXT NOT NULL PRIMARY KEY
      );
    `, (err) => {
      if (err) console.error('Błąd podczas tworzenia tabeli \'channels\':', err.message);
      else console.log('Tabela \'channels\' jest gotowa.');
    });

    // Tabela dla cooldownów komend
    db.run(`
      CREATE TABLE IF NOT EXISTS command_cooldowns (
        command_name TEXT NOT NULL PRIMARY KEY,
        duration_seconds INTEGER NOT NULL
      );
    `, (err) => {
      if (err) console.error('Błąd podczas tworzenia tabeli \'command_cooldowns\':', err.message);
      else console.log('Tabela \'command_cooldowns\' jest gotowa.');
    });

    // Tabela dla aliasów komend
    db.run(`
      CREATE TABLE IF NOT EXISTS command_aliases (
        alias_name TEXT NOT NULL PRIMARY KEY,
        base_command TEXT NOT NULL
      );
    `, (err) => {
      if (err) console.error('Błąd podczas tworzenia tabeli \'command_aliases\':', err.message);
      else console.log('Tabela \'command_aliases\' jest gotowa.');
    });
  });
}

// --- Zarządzanie Cooldownami Komend ---

function setCommandCooldown(commandName, durationSeconds) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT OR REPLACE INTO command_cooldowns (command_name, duration_seconds) VALUES (?, ?);`;
    db.run(sql, [commandName, durationSeconds], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getAllCommandCooldowns() {
  return new Promise((resolve, reject) => {
    const sql = `SELECT command_name, duration_seconds FROM command_cooldowns;`;
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else {
        const cooldowns = new Map(rows.map(row => [row.command_name, row.duration_seconds]));
        resolve(cooldowns);
      }
    });
  });
}

// --- Zarządzanie Aliasami Komend ---

function setCommandAlias(aliasName, baseCommand) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT OR REPLACE INTO command_aliases (alias_name, base_command) VALUES (?, ?);`;
    db.run(sql, [aliasName, baseCommand], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getAllCommandAliases() {
  return new Promise((resolve, reject) => {
    const sql = `SELECT alias_name, base_command FROM command_aliases;`;
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else {
        const aliases = new Map(rows.map(row => [row.alias_name, row.base_command]));
        resolve(aliases);
      }
    });
  });
}

// --- Zarządzanie kontami LoL ---

/**
 * Ustawia lub aktualizuje konto League of Legends dla danego kanału Twitcha.
 * @param {string} twitchChannel - Nazwa kanału Twitcha.
 * @param {string} gameName - Nazwa gry (część Riot ID przed #).
 * @param {string} tagLine - Tagline (część Riot ID po #).
 * @param {string} puuid - PUUID summonera.
 * @param {string} lolServer - Serwer League of Legends (np. 'eun1', 'euw1').
 * @param {string} summonerName - Nazwa przywoływacza (legacy summoner name).
 * @returns {Promise<void>} - Promise, który rozwiązuje się po zakończeniu operacji.
 */
function setLoLAccount(twitchChannel, gameName, tagLine, puuid, lolServer, summonerName) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT OR REPLACE INTO accounts (twitch_channel, game_name, tag_line, puuid, lol_server, summoner_name)
      VALUES (?, ?, ?, ?, ?, ?);
    `;
    db.run(sql, [twitchChannel, gameName, tagLine, puuid, lolServer, summonerName], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Pobiera konto League of Legends dla danego kanału Twitcha.
 * @param {string} twitchChannel - Nazwa kanału Twitcha.
 * @returns {Promise<object|null>} - Obiekt z danymi konta lub null, jeśli nie znaleziono.
 */
function getLoLAccount(twitchChannel) {
  return new Promise((resolve, reject) => {
    const sql = `SELECT game_name, tag_line, puuid, lol_server, summoner_name FROM accounts WHERE twitch_channel = ?;`;
    db.get(sql, [twitchChannel], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// --- Zarządzanie kanałami ---

function addChannel(channelName) {
  return new Promise((resolve, reject) => {
    const sql = `INSERT OR IGNORE INTO channels (name) VALUES (?);`;
    db.run(sql, [channelName], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function removeChannel(channelName) {
  return new Promise((resolve, reject) => {
    const sql = `DELETE FROM channels WHERE name = ?;`;
    db.run(sql, [channelName], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getAllChannels() {
  return new Promise((resolve, reject) => {
    const sql = `SELECT name FROM channels;`;
    db.all(sql, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map(row => row.name));
    });
  });
}

module.exports = { 
  db, 
  initializeDatabase, 
  setLoLAccount, 
  getLoLAccount, 
  addChannel, 
  removeChannel, 
  getAllChannels,
  setCommandCooldown,
  getAllCommandCooldowns,
  setCommandAlias,
  getAllCommandAliases
};