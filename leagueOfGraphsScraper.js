const axios = require('axios');
const cheerio = require('cheerio');

async function getStats(gameName, tagLine, region) {
    const summonerUrlName = `${gameName}-${tagLine}`;
    const url = `https://www.leagueofgraphs.com/summoner/${region}/${summonerUrlName}`;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'
    };

    try {
        const response = await axios.get(url, { headers });
        const html = response.data;
        const $ = cheerio.load(html);

        const rank = $('.leagueTier').text().trim();
        const lpText = $('.league-points').text().trim();
        
        let winsLossesDiv = $('.wins-losses');
        if (winsLossesDiv.length === 0) {
            winsLossesDiv = $('.winslosses');
        }

        let wins = null;
        let losses = null;
        if (winsLossesDiv.length > 0) {
            const winsText = winsLossesDiv.find('.wins').text().trim();
            const lossesText = winsLossesDiv.find('.losses').text().trim();
            
            const winsMatch = winsText.match(/\d+/);
            if (winsMatch) {
                wins = parseInt(winsMatch[0], 10);
            }

            const lossesMatch = lossesText.match(/\d+/);
            if (lossesMatch) {
                losses = parseInt(lossesMatch[0], 10);
            }
        }

        let lp = null;
        const lpMatch = lpText.match(/\d+/);
        if (lpMatch) {
            lp = parseInt(lpMatch[0], 10);
        }

        if (!rank) {
             return { error: "Failed to retrieve stats from HTML. The summoner profile may not exist or the page structure has changed." };
        }

        return {
            rank,
            lp,
            wins,
            losses
        };

    } catch (error) {
        console.error(`Error fetching data from ${url}:`, error.message);
        // The page might return a 404 if the summoner doesn't exist
        if (error.response && error.response.status === 404) {
            return { error: `Summoner profile for ${gameName} on ${region} not found.` };
        }
        return { error: 'Failed to fetch data from League of Graphs.' };
    }
}

async function getMatchHistory(gameName, tagLine, region, count = 5) {
    const summonerUrlName = `${gameName}-${tagLine}`;
    const url = `https://www.leagueofgraphs.com/summoner/${region}/${summonerUrlName}`;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/102.0.0.0 Safari/537.36'
    };

    try {
        const response = await axios.get(url, { headers });
        const html = response.data;
        const $ = cheerio.load(html);

        const matches = [];
        // Selektory dla historii meczów na głównej stronie profilu
        $('.matches-list-content .match').slice(0, count).each((i, element) => {
            const matchElement = $(element);
            const outcome = matchElement.find('.match-outcome .result').text().trim(); // 'Victory' or 'Defeat'
            const championName = matchElement.find('.champion-icon img').attr('alt');
            const kdaText = matchElement.find('.kda').text().trim();
            
            // Extract KDA numbers (e.g., '5 / 2 / 10')
            const kdaMatch = kdaText.match(/(\d+)\s*\/\s*(\d+)\s*\/\s*(\d+)/);
            let kills = null, deaths = null, assists = null;
            if (kdaMatch) {
                kills = parseInt(kdaMatch[1], 10);
                deaths = parseInt(kdaMatch[2], 10);
                assists = parseInt(kdaMatch[3], 10);
            }

            matches.push({
                outcome: outcome === 'Victory' ? 'W' : 'L',
                championName,
                kills,
                deaths,
                assists
            });
        });

        return matches;

    } catch (error) {
        console.error(`Error fetching match history from ${url}:`, error.message);
        if (error.response && error.response.status === 404) {
            return { error: `Summoner profile for ${gameName} on ${region} not found.` };
        }
        return { error: 'Failed to fetch match history from League of Graphs.' };
    }
}

module.exports = { getStats, getMatchHistory };