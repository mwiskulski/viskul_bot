
const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';
const ENV_PATH = path.resolve(process.cwd(), '.env');

// --- Funkcje pomocnicze do zarządzania plikiem .env ---

/**
 * Odczytuje i aktualizuje wartości w pliku .env.
 * @param {object} newValues - Obiekt z kluczami i wartościami do zaktualizowania.
 */
function updateEnvFile(newValues) {
  try {
    console.log(`[updateEnvFile] Próba aktualizacji pliku .env w ścieżce: ${ENV_PATH}`);
    let envContent = '';
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf8');
      console.log('[updateEnvFile] Odczytano istniejący plik .env.');
    }

    let lines = envContent.split('\n');
    const keysToUpdate = Object.keys(newValues);

    keysToUpdate.forEach(key => {
      const value = newValues[key];
      const keyRegex = new RegExp(`^${key}=.*`);
      let found = false;

      lines = lines.map(line => {
        if (keyRegex.test(line)) {
          found = true;
          return `${key}=${value}`;
        }
        return line;
      });

      if (!found) {
        lines.push(`${key}=${value}`);
      }
    });

    console.log('[updateEnvFile] Przygotowano nową zawartość. Próba zapisu...');
    fs.writeFileSync(ENV_PATH, lines.join('\n'));
    console.log('[updateEnvFile] Zapis do pliku .env zakończony pomyślnie.');

    // Zaktualizuj bieżące zmienne środowiskowe w procesie
    keysToUpdate.forEach(key => {
      process.env[key] = newValues[key];
    });
  } catch (error) {
    console.error('[updateEnvFile] KRYTYCZNY BŁĄD podczas zapisu do pliku .env:', error);
    // Re-throw the error to be caught by the caller
    throw error;
  }
}

// --- Logika autoryzacji ---

/**
 * Uruchamia jednorazowy serwer do uzyskania tokenów od Twitcha.
 */
function getInitialTokens() {
  const app = express();
  const port = 3000;

  app.get('/login', (req, res) => {
    const authUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=chat:read+chat:edit`;
    res.redirect(authUrl);
  });

  app.get('/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Błąd: Brak kodu autoryzacyjnego.');
    }

    try {
      const tokenUrl = 'https://id.twitch.tv/oauth2/token';
      const params = new URLSearchParams();
      params.append('client_id', CLIENT_ID);
      params.append('client_secret', CLIENT_SECRET);
      params.append('code', code);
      params.append('grant_type', 'authorization_code');
      params.append('redirect_uri', REDIRECT_URI);

      const response = await axios.post(tokenUrl, params);
      const { access_token, refresh_token } = response.data;

      console.log('Pomyślnie uzyskano tokeny.');
      updateEnvFile({
        TWITCH_OAUTH_TOKEN: `oauth:${access_token}`,
        TWITCH_REFRESH_TOKEN: refresh_token
      });

      res.send('Autoryzacja zakończona pomyślnie! Możesz zamknąć to okno i wrócić do konsoli.');
      console.log('Tokeny zostały zapisane w pliku .env. Serwer zostanie zamknięty.');
      server.close();
      process.exit(0);

    } catch (error) {
      console.error('Błąd podczas wymiany kodu na token:', error.response ? error.response.data : error.message);
      res.status(500).send('Wystąpił błąd podczas autoryzacji.');
      server.close();
      process.exit(1);
    }
  });

  const server = app.listen(port, () => {
    console.log(`Serwer autoryzacji uruchomiony na http://localhost:${port}`);
    console.log('-----------------------------------------------------------------');
    console.log('PROSZĘ OTWORZYĆ PONIŻSZY LINK W PRZEGLĄDARCE, ABY SIĘ ZALOGOWAĆ:');
    console.log(`http://localhost:3000/login`);
    console.log('-----------------------------------------------------------------');
  });
}

/**
 * Odświeża access token przy użyciu refresh tokena.
 * @returns {Promise<string>} Nowy access token.
 */
async function refreshAccessToken() {
  console.log('Próba odświeżenia tokena dostępowego...');
  const refreshToken = process.env.TWITCH_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('Brak refresh tokena w pliku .env. Uruchom proces autoryzacji.');
  }

  try {
    const tokenUrl = 'https://id.twitch.tv/oauth2/token';
    const params = new URLSearchParams();
    params.append('client_id', CLIENT_ID);
    params.append('client_secret', CLIENT_SECRET);
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    const response = await axios.post(tokenUrl, params);
    const { access_token, refresh_token } = response.data;

    console.log('Pomyślnie odświeżono tokeny.');
    updateEnvFile({
      TWITCH_OAUTH_TOKEN: `oauth:${access_token}`,
      TWITCH_REFRESH_TOKEN: refresh_token // Twitch może zwrócić nowy refresh token
    });
    
    return `oauth:${access_token}`;

  } catch (error) {
    console.error('Błąd podczas odświeżania tokena:', error.response ? error.response.data : error.message);
    // Jeśli refresh token jest zły, może trzeba będzie ponownie przejść autoryzację
    if (error.response && error.response.data.message === 'Invalid refresh token') {
        console.error('Refresh token jest nieprawidłowy. Proszę ponownie uruchomić proces autoryzacji.');
    }
    throw error;
  }
}

module.exports = { getInitialTokens, refreshAccessToken };
