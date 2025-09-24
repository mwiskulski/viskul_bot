const { addChannel, removeChannel, setLoLAccount, getLoLAccount } = require('./database');
const riotApi = require('./riotApi');

// Definicje poziomów uprawnień
const PERMISSIONS = {
  PUBLIC: 'PUBLIC',
  SUPER_USER: 'SUPER_USER'
};

function createCommands(client, commandPrefix) {
  const prefix = commandPrefix || '\\'; // Użyj przekazanego prefiksu lub domyślnego

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

  // --- Komendy dla Super Adminów ---

  async function handleSetLoLAccount(target, context, msg) {
    const args = msg.split(' ').slice(1);
    if (args.length < 3) {
      client.say(target, `@${context['display-name']} Użycie: ${prefix}setlolaccount <nazwa_gracza>#<tagline> <nazwa_przywolywacza> <serwer>`);
      return;
    }

    const riotId = args[0];
    const summonerName = args[1];
    const server = args[2].toLowerCase();
    const [gameName, tagLine] = riotId.split('#');

    if (!gameName || !tagLine) {
      client.say(target, `@${context['display-name']} Nieprawidłowy format Riot ID. Użycie: <nazwa_gry>#<tagline> <nazwa_przywolywacza> <serwer>`);
      return;
    }

    try {
      const account = await riotApi.getAccountByRiotId(gameName, tagLine, server);
      if (!account || !account.puuid) {
        client.say(target, `@${context['display-name']} Nie znaleziono konta Riot Games dla ${gameName}#${tagLine}.`);
        return;
      }

      // Używamy `target` (kanał, na którym padła komenda) jako klucza
      await setLoLAccount(target, gameName, tagLine, account.puuid, server, summonerName);
      client.say(target, `@${context['display-name']} Konto LoL (${gameName}#${tagLine}, ${summonerName}) zostało przypisane do tego kanału.`);
    } catch (error) {
      console.error('Błąd podczas ustawiania konta LoL:', error);
      client.say(target, `@${context['display-name']} Wystąpił błąd podczas ustawiania konta.`);
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
    const answers = ['Tak', 'Nie', 'Może', 'Zdecydowanie tak', 'Zdecydowanie nie'];
    const randomAnswer = answers[Math.floor(Math.random() * answers.length)];
    client.say(target, `@${context['display-name']} ${randomAnswer}`);
  }

  async function handleMyLoLAccount(target, context) {
    try {
      const account = await getLoLAccount(target);
      if (account) {
        client.say(target, `@${context['display-name']} Przypisane konto LoL: ${account.game_name}#${account.tag_line} (${account.summoner_name} na ${account.lol_server}).`);
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

      const { game_name, tag_line, summoner_name, lol_server } = account;
      const summoner = await riotApi.getSummonerByName(lol_server, summoner_name);
      const leagueEntries = await riotApi.getLeagueEntriesBySummonerId(lol_server, summoner.id);
      const soloQueueEntry = leagueEntries.find(entry => entry.queueType === 'RANKED_SOLO_5x5');

      if (soloQueueEntry) {
        client.say(target, `@${context['display-name']} ${game_name}#${tag_line} (${summoner_name} na ${lol_server}): ${soloQueueEntry.tier} ${soloQueueEntry.rank} ${soloQueueEntry.leaguePoints} LP.`);
      } else {
        client.say(target, `@${context['display-name']} ${game_name}#${tag_line} (${summoner_name} na ${lol_server}) nie ma rangi w Solo/Duo.`);
      }
    } catch (error) {
      console.error('Błąd podczas pobierania rangi LoL:', error);
      client.say(target, `@${context['display-name']} Wystąpił błąd podczas pobierania rangi.`);
    }
  }

  // ... inne komendy publiczne jak !lastgame ...

  // --- Mapa komend ---
  const commands = new Map([
    // Komendy Super Admina
    [`${prefix}connect`, { handler: handleConnect, permission: PERMISSIONS.SUPER_USER }],
    [`${prefix}disconnect`, { handler: handleDisconnect, permission: PERMISSIONS.SUPER_USER }],
    [`${prefix}accounts`, { handler: handleAccounts, permission: PERMISSIONS.SUPER_USER }],
    [`${prefix}setlolaccount`, { handler: handleSetLoLAccount, permission: PERMISSIONS.SUPER_USER }],

    // Komendy publiczne
    [`${prefix}hello`, { handler: handleHello, permission: PERMISSIONS.PUBLIC }],
    [`${prefix}dice`, { handler: handleDice, permission: PERMISSIONS.PUBLIC }],
    [`${prefix}8ball`, { handler: handle8Ball, permission: PERMISSIONS.PUBLIC }],
    [`${prefix}mylolaccount`, { handler: handleMyLoLAccount, permission: PERMISSIONS.PUBLIC }],
    [`${prefix}rank`, { handler: handleRank, permission: PERMISSIONS.PUBLIC }],
    // Upewnij się, że \lastgame jest zdefiniowane, jeśli ma tu być
    // [`${prefix}lastgame`, { handler: handleLastGame, permission: PERMISSIONS.PUBLIC }]
  ]);

  return commands;
}

module.exports = { createCommands, PERMISSIONS };