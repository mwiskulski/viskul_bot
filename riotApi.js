const axios = require('axios');

const RIOT_API_KEY = process.env.RIOT_API_KEY;

if (!RIOT_API_KEY) {
  console.error('Błąd: Brak RIOT_API_KEY w pliku .env. Komendy League of Legends nie będą działać.');
}

const API_BASE_URL = 'https://<region>.api.riotgames.com';
const ACCOUNT_API_BASE_URL = 'https://<account_region>.api.riotgames.com';

// All function definitions first
function mapPlatformRegionToAccountRegion(platformRegion) {
  if (['br1', 'la1', 'la2', 'na1'].includes(platformRegion)) return 'americas';
  if (['eun1', 'euw1', 'tr1', 'ru'].includes(platformRegion)) return 'europe';
  if (['kr', 'jp1'].includes(platformRegion)) return 'asia';
  if (['oc1'].includes(platformRegion)) return 'sea'; // SEA for Oceania
  return platformRegion; // Domyślnie zwracamy oryginalny region, jeśli nie pasuje
}

async function callRiotApi(region, path) {
  if (!RIOT_API_KEY) {
    throw new Error('RIOT_API_KEY nie jest skonfigurowany.');
  }

  const url = API_BASE_URL.replace('<region>', mapServerToApiRegion(region)) + path;

  try {
    const response = await axios.get(url, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Błąd podczas zapytania do API Riot Games (${url}):`, error.response?.data || error.message);
    throw error;
  }
}

function mapServerToApiRegion(server) {
  switch (server.toLowerCase()) {
    case 'eune':
      return 'eun1';
    case 'euw':
      return 'euw1';
    case 'na':
      return 'na1';
    case 'br':
      return 'br1';
    case 'jp':
      return 'jp1';
    case 'kr':
      return 'kr';
    case 'lan':
      return 'la1';
    case 'las':
      return 'la2';
    case 'oce':
      return 'oc1';
    case 'tr':
      return 'tr1';
    case 'ru':
      return 'ru';
    case 'ph':
      return 'ph2';
    case 'sg':
      return 'sg2';
    case 'th':
      return 'th2';
    case 'tw':
      return 'tw2';
    case 'vn':
      return 'vn2';
    default:
      return server; // Domyślnie zwracamy oryginalny serwer, jeśli nie pasuje
  }
}

function getMatchRegion(region) {
  if (['br1', 'la1', 'la2', 'na1'].includes(region)) return 'americas';
  if (['eun1', 'euw1', 'tr1', 'ru'].includes(region)) return 'europe';
  if (['kr', 'jp1'].includes(region)) return 'asia';
  if (['oc1'].includes(region)) return 'sea'; // SEA for Oceania in Match-V5
  return region; // Domyślnie zwracamy oryginalny region, jeśli nie pasuje
}

async function getAccountByRiotId(gameName, tagLine, server) {
  if (!RIOT_API_KEY) {
    throw new Error('RIOT_API_KEY nie jest skonfigurowany.');
  }

  const platformRegion = mapServerToApiRegion(server);
  const accountRegion = mapPlatformRegionToAccountRegion(platformRegion);
  const url = ACCOUNT_API_BASE_URL.replace('<account_region>', accountRegion) + `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;

  try {
    const response = await axios.get(url, {
      headers: {
        'X-Riot-Token': RIOT_API_KEY
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Błąd podczas zapytania do API kont Riot Games (${url}):`, error.response?.data || error.message);
    throw error;
  }
}

async function getSummonerByPuuid(region, puuid) {
  const summoner = await callRiotApi(mapServerToApiRegion(region), `/lol/summoner/v4/summoners/by-puuid/${puuid}`);
  console.log('Summoner object from getSummonerByPuuid:', summoner);
  return summoner;
}

async function getSummonerByName(region, summonerName) {
  const summoner = await callRiotApi(mapServerToApiRegion(region), `/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`);
  console.log('Summoner object from getSummonerByName:', summoner);
  return summoner;
}

async function getLeagueEntriesBySummonerId(region, summonerId) {
  return callRiotApi(mapServerToApiRegion(region), `/lol/league/v4/entries/by-summoner/${summonerId}`);
}

async function getMatchIdsByPuuid(region, puuid, count = 1) {
  // Match-V5 API uses different regional routing (americas, asia, europe)
  const matchRegion = getMatchRegion(mapServerToApiRegion(region));
  return callRiotApi(matchRegion, `/lol/match/v5/matches/by-puuid/${puuid}/ids?count=${count}`);
}

async function getMatchById(region, matchId) {
  const matchRegion = getMatchRegion(mapServerToApiRegion(region));
  return callRiotApi(matchRegion, `/lol/match/v5/matches/${matchId}`);
}

// module.exports at the very end
module.exports = { getAccountByRiotId, getSummonerByPuuid, getSummonerByName, getLeagueEntriesBySummonerId, getMatchIdsByPuuid, getMatchById };