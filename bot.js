require('dotenv').config();
const tmi = require('tmi.js');
const db = require('./database.js');
const { createCommands, PERMISSIONS } = require('./commands.js');
const { refreshAccessToken } = require('./auth.js');

const COMMAND_PREFIX = process.env.COMMAND_PREFIX || '\\';
let client;
let commands;
let commandCooldowns = new Map();
const onCooldown = new Map(); // przechowuje timestampy wygaśnięcia cooldownu dla użytkowników
let commandAliases = new Map(); // przechowuje mapowanie alias -> komenda bazowa

db.initializeDatabase();

async function startBot() {
  commandCooldowns = await db.getAllCommandCooldowns();
  console.log('Załadowano cooldowny dla komend:', commandCooldowns);

  commandAliases = await db.getAllCommandAliases();
  console.log('Załadowano aliasy dla komend:', commandAliases);

  const channelsFromDb = await db.getAllChannels();
  const botOwnChannel = process.env.BOT_OWN_CHANNEL;
  const initialChannels = [...new Set([...channelsFromDb, botOwnChannel].filter(Boolean))];

  console.log('Kanały do dołączenia:', initialChannels);

  client = initializeClient(process.env.TWITCH_OAUTH_TOKEN, initialChannels);
  commands = createCommands(client, COMMAND_PREFIX, commandCooldowns, commandAliases);
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
    console.log('Token odświeżony. Ponowne łączenie...');

    // Zaktualizuj hasło (token) w opcjach istniejącego klienta
    client.opts.identity.password = newToken;

    // Połącz ponownie. TMI.js samo obsłuży rozłączenie i ponowne połączenie.
    await client.connect().catch(err => {
        console.error('Błąd podczas ponownego łączenia po odświeżeniu tokena:', err);
    });

  } catch (error) {
    console.error('FATAL: Nie udało się odświeżyć tokena.', error);
  }
}

function onMessageHandler(target, context, msg, self) {
  if (self) return;

  if (!msg.trim().startsWith(COMMAND_PREFIX)) return;

  const args = msg.split(' ').slice(1);
  let commandWithPrefix = msg.split(' ')[0].toLowerCase();
  let commandName = commandWithPrefix.replace(COMMAND_PREFIX, '');

  // --- Obsługa Aliasów ---
  if (commandAliases.has(commandName)) {
    const baseCommandName = commandAliases.get(commandName);
    commandWithPrefix = COMMAND_PREFIX + baseCommandName; // Zaktualizuj na pełną nazwę komendy bazowej
    commandName = baseCommandName; // Zaktualizuj na nazwę komendy bazowej bez prefixu
    console.log(`* Alias '${commandWithPrefix}' użyty, przekierowanie do komendy bazowej '${COMMAND_PREFIX}${commandName}'.`);
  }
  // --- Koniec Obsługi Aliasów ---

  if (!commands.has(commandWithPrefix)) return;

  // --- Sprawdzanie Cooldownu ---
  const cooldownDuration = commandCooldowns.get(commandName);
  const userId = context['user-id'];

  if (cooldownDuration > 0 && userId) {
    const userCooldowns = onCooldown.get(commandName) || new Map();
    const expirationTime = userCooldowns.get(userId);

    if (expirationTime && Date.now() < expirationTime) {
      console.log(`* Użytkownik ${context.username} jest na cooldownie dla komendy '${commandName}'.`);
      return; // Zatrzymaj wykonanie komendy
    }
  }
  // --- Koniec Sprawdzania Cooldownu ---

  const command = commands.get(commandWithPrefix);

  // Sprawdź, czy komenda wymaga argumentów i czy zostały podane
  if (command.usage && args.length === 0) {
    client.say(target, `@${context['display-name']} Użycie: ${commandWithPrefix} ${command.usage}`);
    return;
  }

  if (hasPermission(context, command.permission)) {
    console.log(`* Wykonuję komendę '${commandWithPrefix}' dla '${context['display-name']}' na kanale ${target}`);
    command.handler(target, context, msg);

    // Ustaw nowy cooldown po wykonaniu komendy
    if (cooldownDuration > 0 && userId) {
      const newExpirationTime = Date.now() + cooldownDuration * 1000;
      if (!onCooldown.has(commandName)) {
        onCooldown.set(commandName, new Map());
      }
      onCooldown.get(commandName).set(userId, newExpirationTime);
    }

  } else {
    console.log(`* Odmowa dostępu dla '${context['display-name']}' do komendy '${commandWithPrefix}'`);
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