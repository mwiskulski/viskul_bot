require('dotenv').config();
const tmi = require('tmi.js');
const db = require('./database.js');
const { createCommands, PERMISSIONS } = require('./commands.js');
const { refreshAccessToken } = require('./auth.js');

let client;
let commands;

db.initializeDatabase();

async function startBot() {
  const channelsFromDb = await db.getAllChannels();
  const botOwnChannel = process.env.BOT_OWN_CHANNEL;
  const initialChannels = [...new Set([...channelsFromDb, botOwnChannel].filter(Boolean))];

  const COMMAND_PREFIX = process.env.COMMAND_PREFIX || '\\';

  console.log('Kanały do dołączenia:', initialChannels);

  client = initializeClient(process.env.TWITCH_OAUTH_TOKEN, initialChannels);
  commands = createCommands(client, COMMAND_PREFIX);
  console.log('Mapa komend załadowana:', Array.from(commands.keys()));
  registerEventHandlers();
  client.connect().catch(handleReconnect);
}

function initializeClient(token, channels) {
  console.log('Inicjalizacja klienta TMI...');
  return new tmi.client({
    options: { debug: true },
    connection: { reconnect: true, secure: true },
    identity: {
      username: process.env.TWITCH_USERNAME,
      password: token
    },
    channels: channels
  });
}

function registerEventHandlers() {
  client.on('message', onMessageHandler);
  client.on('connected', onConnectedHandler);
  client.on('disconnected', onDisconnectedHandler);
  client.on('error', (err) => console.error('BŁĄD POŁĄCZENIA TMI:', err));
}

function onConnectedHandler(addr, port) {
  console.log(`* Połączono z ${addr}:${port}`);
}

async function onDisconnectedHandler(reason) {
  console.warn(`ROZŁĄCZONO Z CZATEM: ${reason}`);
  if (reason && reason.toLowerCase().includes('authentication failed')) {
    await handleReconnect();
  }
}

async function handleReconnect() {
  console.log('Błąd autoryzacji. Próba odświeżenia tokena...');
  try {
    const newToken = await refreshAccessToken();
    const channels = client.getChannels();
    console.log('Token odświeżony. Ponowne łączenie...');

    if (client) client.disconnect();

    client = initializeClient(newToken, channels);
    commands = createCommands(client, COMMAND_PREFIX);
    registerEventHandlers();
    client.connect().catch(console.error);

  } catch (error) {
    console.error('FATAL: Nie udało się odświeżyć tokena.', error);
  }
}

function onMessageHandler(target, context, msg, self) {
  if (self) return;

  const COMMAND_PREFIX = process.env.COMMAND_PREFIX || '\\';
  if (!msg.trim().startsWith(COMMAND_PREFIX)) return;

  const commandName = msg.split(' ')[0].toLowerCase();
  if (!commands.has(commandName)) return;

  const command = commands.get(commandName);
  if (hasPermission(context, command.permission)) {
    console.log(`* Wykonuję komendę '${commandName}' dla '${context['display-name']}' na kanale ${target}`);
    command.handler(target, context, msg);
  } else {
    console.log(`* Odmowa dostępu dla '${context['display-name']}' do komendy '${commandName}'`);
  }
}

function hasPermission(context, requiredPermission) {
  // Super Admin (z .env) może wszystko
  const superUsers = (process.env.SUPER_USERS || '').toLowerCase().split(',');
  if (superUsers.includes(context.username.toLowerCase())) {
    return true;
  }

  switch (requiredPermission) {
    case PERMISSIONS.PUBLIC:
      return true;
    case PERMISSIONS.SUPER_USER:
      return false; // Już obsłużone na górze
    default:
      return false;
  }
}

// --- Uruchomienie Bota ---
startBot();
