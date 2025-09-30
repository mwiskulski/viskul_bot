const { addChannel, removeChannel, setLoLAccount, getLoLAccount, setCommandCooldown, setCommandAlias } = require('./database');
const riotApi = require('./riotApi');
const leagueOfGraphsScraper = require('./leagueOfGraphsScraper');

// Definicje poziomów uprawnień
const PERMISSIONS = {
  PUBLIC: 'PUBLIC',
  SUPER_USER: 'SUPER_USER'
};

function createCommands(client, commandPrefix, commandCooldowns, commandAliases) {
  const prefix = commandPrefix || '\\';

  // --- Komendy dla Super Admina ---

  async function handleConnect(target, context, msg) {
    const channelToJoin = msg.split(' ')[1]?.toLowerCase();
    if (!channelToJoin) {
      client.say(target, `@${context['display-name']} Użycie: ${prefix}connect <nazwa_kanalu>`);
      return;
    }
    try {
      await addChannel(channelToJoin);
      await client.join(channelToJoin);
      client.say(target, `@${context['display-name']} Pomyślnie dołączono do kanału: ${channelToJoin}`);
    } catch (error) {
      console.error('Błąd podczas dołączania do kanału:', error);
      client.say(target, `@${context['display-name']} Wystąpił błąd podczas dołączania do kanału.`);
    }
  }

  async function handleDisconnect(target, context, msg) {
    const channelToLeave = msg.split(' ')[1]?.toLowerCase();
    if (!channelToLeave) {
      client.say(target, `@${context['display-name']} Użycie: ${prefix}disconnect <nazwa_kanalu>`);
      return;
    }
    try {
      await removeChannel(channelToLeave);
      await client.part(channelToLeave);
      client.say(target, `@${context['display-name']} Pomyślnie opuszczono kanał: ${channelToLeave}`);
    } catch (error) {
      console.error('Błąd podczas opuszczania kanału:', error);
      client.say(target, `@${context['display-name']} Wystąpił błąd podczas opuszczania kanału.`);
    }
  }

  async function handleAccounts(target, context) {
    const channels = client.getChannels();
    if (channels && channels.length > 0) {
      const channelList = channels.map(c => c.replace('#', '')).join(', ');
      client.say(target, `@${context['display-name']} Jestem połączony z kanałami: ${channelList}.`);
    } else {
      client.say(target, `@${context['display-name']} Nie jestem połączony z żadnym kanałem.`);
    }
  }

  async function handleSetLoLAccount(target, context, msg) {
    const args = msg.split(' ').slice(1);
    if (args.length < 2) {
      client.say(target, `@${context['display-name']} Użycie: ${prefix}setlolaccount <nazwa_gracza>#<tagline> <serwer>`);
      return;
    }
    const riotId = args[0];
    const server = args[1].toLowerCase();
    const [gameName, tagLine] = riotId.split('#');

    if (!gameName || !tagLine) {
      client.say(target, `@${context['display-name']} Nieprawidłowy format Riot ID. Użycie: <nazwa_gry>#<tagline> <serwer>`);
      return;
    }
    try {
      // Get PUUID from Riot API
      const account = await riotApi.getAccountByRiotId(gameName, tagLine, server);
      if (!account || !account.puuid) {
        client.say(target, `@${context['display-name']} Nie udało się znaleźć konta Riot dla podanego Riot ID.`);
        return;
      }

      await setLoLAccount(target, gameName, tagLine, account.puuid, server, gameName); // summoner_name is legacy, using gameName as placeholder
      client.say(target, `@${context['display-name']} Konto LoL (${gameName}#${tagLine}) zostało przypisane do tego kanału.`);
    } catch (error) {
      console.error('Błąd podczas ustawiania konta LoL:', error);
      client.say(target, `@${context['display-name']} Wystąpił błąd podczas ustawiania konta.`);
    }
  }

  async function handleCooldown(target, context, msg) {
    const args = msg.split(' ').slice(1);
    if (args.length < 2) {
      client.say(target, `@${context['display-name']} Użycie: ${prefix}cooldown <komenda> <sekundy>`);
      return;
    }
    const commandName = args[0].toLowerCase().replace(prefix, '');
    const duration = parseInt(args[1], 10);

    if (isNaN(duration) || duration < 0) {
      client.say(target, `@${context['display-name']} Czas musi być liczbą nieujemną.`);
      return;
    }

    try {
      await setCommandCooldown(commandName, duration);
      commandCooldowns.set(commandName, duration);
      client.say(target, `@${context['display-name']} Cooldown dla komendy '${commandName}' został ustawiony na ${duration} sekund.`);
    } catch (error) {
      console.error('Błąd podczas ustawiania cooldownu:', error);
      client.say(target, `@${context['display-name']} Wystąpił błąd podczas ustawiania cooldownu.`);
    }
  }

  async function handleAlias(target, context, msg) {
    const args = msg.split(' ').slice(1);
    if (args.length < 3 || args[0].toLowerCase() !== 'add') {
      client.say(target, `@${context['display-name']} Użycie: ${prefix}alias add <komenda_bazowa> <alias>`);
      return;
    }

    const baseCommand = args[1].toLowerCase().replace(prefix, '');
    const aliasName = args[2].toLowerCase().replace(prefix, '');

    // Sprawdź, czy komenda bazowa istnieje
    if (!commands.has(prefix + baseCommand)) {
      client.say(target, `@${context['display-name']} Komenda bazowa '${prefix}${baseCommand}' nie istnieje.`);
      return;
    }

    // Sprawdź, czy alias nie jest już istniejącą komendą
    if (commands.has(prefix + aliasName)) {
      client.say(target, `@${context['display-name']} '${prefix}${aliasName}' jest już istniejącą komendą.`);
      return;
    }

    try {
      await setCommandAlias(aliasName, baseCommand);
      commandAliases.set(aliasName, baseCommand);
      client.say(target, `@${context['display-name']} Alias '${prefix}${aliasName}' został dodany dla komendy '${prefix}${baseCommand}'.`);
    } catch (error) {
      console.error('Błąd podczas dodawania aliasu:', error);
      client.say(target, `@${context['display-name']} Wystąpił błąd podczas dodawania aliasu.`);
    }
  }

  // --- Komendy publiczne ---

  function handleHello(target, context) {
    client.say(target, `Hello @${context['display-name']}!`);
  }

  function handleDice(target, context) {
    const num = Math.floor(Math.random() * 6) + 1;
    client.say(target, `@${context['display-name']} wyrzucił(a) ${num}!`);
  }

  function handle8Ball(target, context) {
    const answers = [
      // Odpowiedzi twierdzące
      'To pewne.',
      'Zdecydowanie tak.',
      'Bez wątpienia.',
      'Tak - zdecydowanie.',
      'Możesz na tym polegać.',
      'Z mojego punktu widzenia, tak.',
      'Najprawdopodobniej.',
      'Perspektywy są dobre.',
      'Tak.',
      'Wszystko wskazuje na to, że tak.',

      // Odpowiedzi neutralne/niejasne
      'Odpowiedź mglista, spróbuj ponownie.',
      'Zapytaj ponownie później.',
      'Lepiej, żebym ci teraz nie mówił.',
      'Nie mogę teraz tego przewidzieć.',
      'Skup się i zapytaj ponownie.',

      // Odpowiedzi negatywne
      'Nie licz na to.',
      'Moja odpowiedź brzmi nie.',
      'Moje źródła mówią nie.',
      'Perspektywy nie są zbyt dobre.',
      'Bardzo wątpliwe.'
    ];
    const randomAnswer = answers[Math.floor(Math.random() * answers.length)];
    client.say(target, `@${context['display-name']} ${randomAnswer}`);
  }

  async function handleMyLoLAccount(target, context) {
    try {
      const account = await getLoLAccount(target);
      if (account) {
        client.say(target, `@${context['display-name']} Przypisane konto LoL: ${account.game_name}#${account.tag_line} (serwer: ${account.lol_server}).`);
      } else {
        client.say(target, `@${context['display-name']} Brak przypisanego konta LoL. Użyj ${prefix}setlolaccount.`);
      }
    } catch (error) {
      console.error('Błąd podczas pobierania konta LoL:', error);
      client.say(target, `@${context['display-name']} Wystąpił błąd podczas pobierania konta.`);
    }
  }

  async function handleRank(target, context) {
    try {
      const account = await getLoLAccount(target);
      if (!account) {
        client.say(target, `@${context['display-name']} Brak przypisanego konta LoL.`);
        return;
      }

      const { game_name, tag_line, lol_server } = account;
      const riotId = `${game_name}#${tag_line}`;

      const stats = await leagueOfGraphsScraper.getStats(game_name, tag_line, lol_server);

      if (stats.error) {
        client.say(target, `@${context['display-name']} Błąd: ${stats.error}`);
        return;
      }
      
      const { rank, lp, wins, losses } = stats;
      const winrate = (wins && losses) ? Math.round((wins / (wins + losses)) * 100) : 'N/A';
      
      client.say(target, `@${context['display-name']} ${riotId} (${lol_server}): ${rank} ${lp} LP | W: ${wins} L: ${losses} | Winrate: ${winrate}%`);

    } catch (error) {
      console.error('Błąd podczas pobierania rangi LoL:', error);
      client.say(target, `@${context['display-name']} Wystąpił błąd podczas pobierania rangi.`);
    }
  }

  async function handleLastGames(target, context) {
    try {
      const account = await getLoLAccount(target);
      if (!account) {
        client.say(target, `@${context['display-name']} Brak przypisanego konta LoL. Użyj ${prefix}setlolaccount.`);
        return;
      }

      const { game_name, tag_line, lol_server } = account;

      const matches = await leagueOfGraphsScraper.getMatchHistory(game_name, tag_line, lol_server, 5); // Pobierz 5 ostatnich gier

      if (matches.error) {
        client.say(target, `@${context['display-name']} Błąd: ${matches.error}`);
        return;
      }

      if (!matches || matches.length === 0) {
        client.say(target, `@${context['display-name']} Nie znaleziono ostatnich gier dla ${game_name}#${tag_line}.`);
        return;
      }

      let wins = 0;
      const recentGamesDetails = [];

      for (const match of matches) {
        if (match.outcome === 'W') {
          wins++;
        }
        recentGamesDetails.push(`${match.outcome} (${match.championName} ${match.kills}/${match.deaths}/${match.assists})`);
      }

      const losses = matches.length - wins;
      
      let response = `@${context['display-name']} Ostatnie ${matches.length} gier dla ${game_name}#${tag_line}: ${wins}W - ${losses}L.`;
      if (recentGamesDetails.length > 0) {
          response += ` Ostatnie: ${recentGamesDetails.join(', ')}`;
      }

      client.say(target, response);

    } catch (error) {
      console.error('Błąd podczas pobierania ostatnich gier:', error);
      client.say(target, `@${context['display-name']} Wystąpił błąd podczas pobierania historii gier.`);
    }
  }

  // --- Mapa komend ---
  const commands = new Map([
    // Komendy Super Admina
    [`${prefix}connect`, { handler: handleConnect, permission: PERMISSIONS.SUPER_USER, usage: '<nazwa_kanalu>' }],
    [`${prefix}disconnect`, { handler: handleDisconnect, permission: PERMISSIONS.SUPER_USER, usage: '<nazwa_kanalu>' }],
    [`${prefix}accounts`, { handler: handleAccounts, permission: PERMISSIONS.SUPER_USER }],
    [`${prefix}setlolaccount`, { handler: handleSetLoLAccount, permission: PERMISSIONS.SUPER_USER, usage: '<nazwa_gracza>#<tagline> <serwer>' }],
    [`${prefix}cooldown`, { handler: handleCooldown, permission: PERMISSIONS.SUPER_USER, usage: '<komenda> <sekundy>' }],
    [`${prefix}cikulinka`, {
      handler: (target, context) => {
        const randomNumber = Math.floor(Math.random() * (1000 - 100 + 1)) + 100;
        client.say(target, `Cikulinka jest słodka na ${randomNumber}% 🐾`);
      },
      permission: PERMISSIONS.SUPER_USER
    }],

    // Komendy publiczne
    [`${prefix}hello`, { handler: handleHello, permission: PERMISSIONS.PUBLIC }],
    [`${prefix}dice`, { handler: handleDice, permission: PERMISSIONS.PUBLIC }],
    [`${prefix}8ball`, { handler: handle8Ball, permission: PERMISSIONS.PUBLIC, usage: '<pytanie>' }],
    [`${prefix}mylolaccount`, { handler: handleMyLoLAccount, permission: PERMISSIONS.PUBLIC }],
    [`${prefix}rank`, { handler: handleRank, permission: PERMISSIONS.PUBLIC }],
    [`${prefix}lol`, { handler: handleLastGames, permission: PERMISSIONS.PUBLIC }]
  ]);

  // Dodaj komendę \help, która ma dostęp do mapy `commands`
  commands.set(`${prefix}help`, {
    handler: (target, context) => {
      const publicCommands = Array.from(commands.keys())
        .filter(key => commands.get(key).permission === PERMISSIONS.PUBLIC);
      client.say(target, `@${context['display-name']} Dostępne komendy: ${publicCommands.join(', ')}`);
    },
    permission: PERMISSIONS.PUBLIC
  });

  return commands;
}

module.exports = { createCommands, PERMISSIONS };