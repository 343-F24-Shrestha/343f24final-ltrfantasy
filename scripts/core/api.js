// api.js

// Import core dependencies
import CONFIG from './config.js';
import { StorageWrapper } from './storage.js';
import { validateApiResponse, formatters } from './utils.js';

class NFLDataService {
    constructor() {
        this.baseUrls = {
            core: 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl',
            site: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'
        };
        this.cache = new StorageWrapper();
        this.requestQueue = [];
        this.rateLimit = {
            requests: 0,
            lastReset: Date.now(),
            maxRequests: 20,
            resetInterval: 30000,
            queueDelay: 500 // ms between requests
        };

        // Add new properties for feature management
        this.activeSubscriptions = new Map();
        this.liveGameData = new Map();
        this.lastUpdate = null;
    }

    async fetchWithRetry(url, options = {}) {
        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            try {
                const response = await this.fetchWithCache(url, options);
                return response;
            } catch (error) {
                attempts++;
                if (attempts === maxAttempts) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
            }
        }
    }

    // New method for managing live data subscriptions
    subscribe(eventType, callback) {
        if (!this.activeSubscriptions.has(eventType)) {
            this.activeSubscriptions.set(eventType, new Set());
        }
        this.activeSubscriptions.get(eventType).add(callback);
        return () => this.unsubscribe(eventType, callback);
    }

    unsubscribe(eventType, callback) {
        if (this.activeSubscriptions.has(eventType)) {
            this.activeSubscriptions.get(eventType).delete(callback);
        }
    }

    // New method for notifying subscribers
    notifySubscribers(eventType, data) {
        if (this.activeSubscriptions.has(eventType)) {
            this.activeSubscriptions.get(eventType).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in subscriber callback for ${eventType}:`, error);
                }
            });
        }
    }

    // Enhanced error handling for API calls
    async safeApiCall(url, options = {}) {
        try {
            await this.throttleRequest();
            const response = await fetch(url, options);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.error) {
                throw new Error(`API error: ${data.error.message || JSON.stringify(data.error)}`);
            }

            return data;
        } catch (error) {
            console.error(`API call failed for ${url}:`, error);
            throw error;
        }
    }

    // New method for batch data fetching
    async batchFetch(urls) {
        const results = await Promise.allSettled(
            urls.map(url => this.safeApiCall(url))
        );

        return results.map((result, index) => ({
            url: urls[index],
            success: result.status === 'fulfilled',
            data: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    }

    // Enhanced data processing method
    processApiData(data, type) {
        if (!validateApiResponse(data, type)) {
            console.warn(`Invalid ${type} data structure received`);
            return null;
        }

        // Add data processing based on type
        switch (type) {
            case 'PLAYER':
                return this.processPlayerData(data);
            case 'TEAM':
                return this.processTeamData(data);
            case 'GAME':
                return this.processGameData(data);
            case 'ODDS':
                return this.processOddsData(data);
            default:
                return data;
        }
    }

    // async throttleRequest() {
    //     const now = Date.now();
    //     if (now - this.rateLimit.lastReset > this.rateLimit.resetInterval) {
    //         this.rateLimit.requests = 0;
    //         this.rateLimit.lastReset = now;
    //         console.log("Rate limit reset");
    //     }

    //     if (this.rateLimit.requests >= this.rateLimit.maxRequests) {
    //         const waitTime = this.rateLimit.resetInterval - (now - this.rateLimit.lastReset);
    //         console.log(`Rate limit reached, waiting ${waitTime}ms`);
    //         await new Promise(resolve => setTimeout(resolve, waitTime));
    //         return this.throttleRequest();
    //     }

    //     // Add slightly longer delay between requests to be more respectful to the API
    //     await new Promise(resolve => setTimeout(resolve, 500)); // 500ms between requests
    //     this.rateLimit.requests++;
    //     return true;
    // }

    async throttleRequest() {
        const now = Date.now();
        if (now - this.rateLimit.lastReset > this.rateLimit.resetInterval) {
            this.rateLimit.requests = 0;
            this.rateLimit.lastReset = now;
            console.log("Rate limit reset");
        }

        if (this.rateLimit.requests >= this.rateLimit.maxRequests) {
            const waitTime = this.rateLimit.resetInterval;
            console.log(`Rate limit reached, waiting ${waitTime / 1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            this.rateLimit.requests = 0;
            this.rateLimit.lastReset = Date.now();
            return true;
        }

        // Add longer delay between requests
        await new Promise(resolve => setTimeout(resolve, this.rateLimit.queueDelay));
        this.rateLimit.requests++;
        return true;
    }

    // Functions for gathering current reference IDs for players, teams, games.

    // async getAllTeams() {
    //     const teams = await this.fetchWithCache(`${this.baseUrls.site}/teams`);
    //     return teams?.sports?.[0]?.leagues?.[0]?.teams || [];
    // }

    // Making this WAYYY more robust for no reason

    // async getAllTeams() {
    //     try {
    //         console.log('Fetching teams...');
    //         const cacheKey = 'nfl_teams';
    //         const cachedTeams = this.cache.get(cacheKey);
            
    //         if (cachedTeams) {
    //             console.log('Using cached teams data');
    //             return cachedTeams;
    //         }
    
    //         const response = await this.fetchWithCache(`${this.baseUrls.site}/teams`);
    //         console.log('Raw teams response:', response);
    
    //         if (!response?.sports?.[0]?.leagues?.[0]?.teams) {
    //             throw new Error('Invalid teams data structure');
    //         }
    
    //         const teams = response.sports[0].leagues[0].teams;
    //         console.log(`Found ${teams.length} teams`);
    
    //         // Cache for 24 hours
    //         this.cache.set(cacheKey, teams, 86400);
            
    //         return teams;
    //     } catch (error) {
    //         console.error('Error fetching teams:', error);
    //         // Return empty array instead of throwing
    //         return [];
    //     }
    // }

    async getAllTeams(forceRefresh = false) {
        const cacheKey = 'all_teams';
        
        try {
            // Check cache first unless force refresh
            if (!forceRefresh) {
                const cachedTeams = this.cache.get(cacheKey);
                if (cachedTeams) {
                    console.log('Using cached teams data');
                    return cachedTeams;
                }
            }

            console.log('Fetching fresh teams data');
            const response = await fetch(`${this.baseUrls.site}/teams`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data?.sports?.[0]?.leagues?.[0]?.teams) {
                throw new Error('Invalid teams data structure');
            }

            const teams = data.sports[0].leagues[0].teams;
            console.log(`Retrieved ${teams.length} teams`);

            // Cache for 24 hours
            this.cache.set(cacheKey, teams, 86400);
            
            return teams;
        } catch (error) {
            console.error('Error fetching teams:', error);
            return [];
        }
    }

    async getTeamRoster(teamId) {
        const cacheKey = `team_roster_${teamId}`;
        try {
            // Check cache first
            const cachedRoster = this.cache.get(cacheKey);
            if (cachedRoster) {
                return cachedRoster;
            }

            await this.throttleRequest();
            const response = await fetch(
                `${this.baseUrls.site}/teams/${teamId}/roster?enable=roster,stats`
            );

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.cache.set(cacheKey, data, 86400); // Cache for 24 hours
            return data;
        } catch (error) {
            console.error(`Error fetching roster for team ${teamId}:`, error);
            return null;
        }
    }



    // async getAllActivePlayers() {
    //     try {
    //         const teams = await this.getAllTeams();
    //         if (!teams?.length) {
    //             throw new Error("No teams retrieved");
    //         }
    //         let allPlayers = [];
    //         let processedTeams = 0;
    //         let failedTeams = 0;

    //         for (const teamData of teams) {
    //             try {
    //                 // Use the correct endpoint with proper parameters
    //                 const rosterData = await this.fetchWithCache(
    //                     `${this.baseUrls.site}/teams/${teamData.team.id}/roster?enable=roster,stats`
    //                 );

    //                 if (!this.validateRosterResponse(rosterData)) {
    //                     console.warn(`Invalid roster data for team ${teamData.team.name}`);
    //                     failedTeams++;
    //                     continue;
    //                 }

    //                 if (rosterData?.athletes) {
    //                     // The roster data is organized by position groups (offense, defense, specialTeam)
    //                     const allPositionGroups = ['offense', 'defense', 'specialTeam'];

    //                     allPositionGroups.forEach(group => {
    //                         if (rosterData.athletes.find(g => g.position === group)) {
    //                             const positionGroup = rosterData.athletes.find(g => g.position === group);
    //                             const activePlayers = positionGroup.items
    //                                 .filter(player => player.status?.type === 'active')
    //                                 .map(player => ({
    //                                     id: player.id,
    //                                     fullName: player.fullName,
    //                                     position: player.position?.abbreviation,
    //                                     team: teamData.team.name,
    //                                     jersey: player.jersey,
    //                                     experience: player.experience,
    //                                     college: player.college?.name
    //                                 }));
    //                             allPlayers = [...allPlayers, ...activePlayers];
    //                         }
    //                     });
    //                 }

    //                 processedTeams++;
    //                 console.log(`Successfully processed ${teamData.team.name}: ${allPlayers.length} total active players`);
    //             } catch (error) {
    //                 failedTeams++;
    //                 console.error(`Error processing team ${teamData.team.name}:`, error.message);
    //                 continue;
    //             }
    //         }

    //         console.log(`Processed ${processedTeams} teams successfully, ${failedTeams} failed`);
    //         return allPlayers;
    //     } catch (error) {
    //         console.error("Error in getAllActivePlayers:", error);
    //         throw error; // Rethrow to ensure test catches it
    //     }
    // }

    // Modified getAllActivePlayers to fetch data in smaller batches

    // async getAllActivePlayers() {
    //     try {
    //         const teams = await this.getAllTeams();
    //         if (!teams?.length) {
    //             throw new Error("No teams retrieved");
    //         }
    //         let allPlayers = [];
    //         let processedTeams = 0;
    //         let failedTeams = 0;

    //         // Process teams in smaller batches
    //         const BATCH_SIZE = 8;
    //         for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    //             const teamBatch = teams.slice(i, i + BATCH_SIZE);

    //             // Process batch sequentially
    //             for (const teamData of teamBatch) {
    //                 try {
    //                     await this.throttleRequest(); // Ensure we respect rate limits
    //                     const rosterData = await this.fetchWithCache(
    //                         `${this.baseUrls.site}/teams/${teamData.team.id}/roster?enable=roster,stats`,
    //                         3600 // Cache for 1 hour
    //                     );

    //                     if (!this.validateRosterResponse(rosterData)) {
    //                         console.warn(`Invalid roster data for team ${teamData.team.name}`);
    //                         failedTeams++;
    //                         continue;
    //                     }

    //                     if (rosterData?.athletes) {
    //                         const activePlayers = this.processRosterData(rosterData, teamData);
    //                         allPlayers = [...allPlayers, ...activePlayers];
    //                     }

    //                     processedTeams++;
    //                     console.log(`Successfully processed ${teamData.team.name}: ${allPlayers.length} total active players`);

    //                     // Add additional delay between teams
    //                     await new Promise(resolve => setTimeout(resolve, 2000));

    //                 } catch (error) {
    //                     failedTeams++;
    //                     console.error(`Error processing team ${teamData.team.name}:`, error.message);
    //                     continue;
    //                 }
    //             }

    //             // Add delay between batches
    //             if (i + BATCH_SIZE < teams.length) {
    //                 console.log(`Waiting between batches...`);
    //                 await new Promise(resolve => setTimeout(resolve, 5000));
    //             }
    //         }

    //         console.log(`Processed ${processedTeams} teams successfully, ${failedTeams} failed`);
    //         return allPlayers;
    //     } catch (error) {
    //         console.error("Error in getAllActivePlayers:", error);
    //         throw error;
    //     }
    // }

    // Sike we re doing this AGAIN

    async getAllActivePlayers() {
        try {
            const teams = await this.getAllTeams();
            if (!teams?.length) {
                throw new Error("No teams retrieved");
            }
            let allPlayers = [];
            
            // Process only 8 teams at a time to avoid rate limits
            const BATCH_SIZE = 8;
            for (let i = 0; i < teams.length; i += BATCH_SIZE) {
                const teamBatch = teams.slice(i, i + BATCH_SIZE);
                
                const batchPromises = teamBatch.map(async (teamData) => {
                    try {
                        // Check cache first with a unique key
                        const cacheKey = `roster_${teamData.team.id}`;
                        const cachedRoster = this.cache.get(cacheKey);
                        
                        if (cachedRoster) {
                            console.log(`Using cached roster for ${teamData.team.name}`);
                            return cachedRoster;
                        }
    
                        await this.throttleRequest();
                        const rosterData = await this.fetchWithCache(
                            `${this.baseUrls.site}/teams/${teamData.team.id}/roster?enable=roster,stats`
                        );
    
                        if (rosterData?.athletes) {
                            const activePlayers = this.processRosterData(rosterData, teamData);
                            this.cache.set(cacheKey, activePlayers, 86400); // Cache for 24 hours
                            return activePlayers;
                        }
                    } catch (error) {
                        console.warn(`Error processing team ${teamData.team.name}:`, error.message);
                        return [];
                    }
                });
    
                // Wait between batches
                const batchResults = await Promise.all(batchPromises);
                allPlayers = [...allPlayers, ...batchResults.flat()];
                
                if (i + BATCH_SIZE < teams.length) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            }
    
            return allPlayers;
        } catch (error) {
            console.error("Error in getAllActivePlayers:", error);
            return []; // Return empty array instead of throwing
        }
    }

    // Helper method to process roster data
    processRosterData(rosterData, teamData) {
        const allPositionGroups = ['offense', 'defense', 'specialTeam'];
        let players = [];

        allPositionGroups.forEach(group => {
            const positionGroup = rosterData.athletes.find(g => g.position === group);
            if (positionGroup) {
                const activePlayers = positionGroup.items
                    .filter(player => player.status?.type === 'active')
                    .map(player => ({
                        id: player.id,
                        fullName: player.fullName,
                        position: player.position?.abbreviation,
                        team: teamData.team.name,
                        jersey: player.jersey,
                        experience: player.experience,
                        college: player.college?.name
                    }));
                players = [...players, ...activePlayers];
            }
        });

        return players;
    }

    async getCurrentWeekGames() {
        const games = await this.fetchWithCache(`${this.baseUrls.site}/scoreboard`);
        return games?.events || [];
    }

    // Validation Functions

    validateResponse(data, type) {
        if (!validateApiResponse(data, type)) {
            console.warn(`Invalid ${type} data structure received:`, data);
            return false;
        }
        return true;
    }

    validateRosterResponse(data) {
        if (!data || !data.athletes || !Array.isArray(data.athletes)) {
            console.error("Invalid roster data structure:", data);
            return false;
        }
        return true;
    }

    async validateTeamId(teamId) {
        const teams = await this.getAllTeams();
        return teams.some(team => team.team.id === teamId);
    }

    async validatePlayerId(playerId) {
        const players = await this.getAllActivePlayers();
        return players.some(player => player.id === playerId);
    }

    validatePlayerData(data) {
        const required = ['id', 'fullName', 'position'];
        return required.every(field => data?.[field]);
    }

    async validateGameId(gameId) {
        const games = await this.getCurrentWeekGames();
        return games.some(game => game.id === gameId);
    }

    // Fantasy-relevant player stats
    async getPlayerFantasyStats(playerId) {
        const stats = await this.fetchWithCache(
            `${this.baseUrls.core}/seasons/2024/types/2/athletes/${playerId}/statistics`
        );

        return {
            passing: {
                yards: this.extractStat(stats, 'passing', 'passingYards'),
                touchdowns: this.extractStat(stats, 'passing', 'passingTouchdowns'),
                interceptions: this.extractStat(stats, 'passing', 'interceptions')
            },
            rushing: {
                yards: this.extractStat(stats, 'rushing', 'rushingYards'),
                touchdowns: this.extractStat(stats, 'rushing', 'rushingTouchdowns')
            },
            receiving: {
                yards: this.extractStat(stats, 'receiving', 'receivingYards'),
                touchdowns: this.extractStat(stats, 'receiving', 'receivingTouchdowns'),
                receptions: this.extractStat(stats, 'receiving', 'receptions')
            }
        };
    }

    // Betting-relevant team stats
    async getTeamBettingStats(teamId) {
        const stats = await this.fetchWithCache(
            `${this.baseUrls.core}/seasons/2024/types/2/teams/${teamId}/statistics`
        );

        return {
            offense: {
                pointsPerGame: this.extractStat(stats, 'scoring', 'totalPointsPerGame'),
                totalYards: this.extractStat(stats, 'general', 'totalYards'),
                passingYards: this.extractStat(stats, 'passing', 'netPassingYards'),
                rushingYards: this.extractStat(stats, 'rushing', 'rushingYards')
            },
            defense: {
                pointsAllowed: this.extractStat(stats, 'defensive', 'pointsAllowed'),
                sacks: this.extractStat(stats, 'defensive', 'sacks'),
                interceptions: this.extractStat(stats, 'defensiveInterceptions', 'interceptions')
            },
            trends: {
                homeRecord: this.extractStat(stats, 'miscellaneous', 'homeRecord'),
                awayRecord: this.extractStat(stats, 'miscellaneous', 'awayRecord'),
                lastFiveGames: this.extractStat(stats, 'miscellaneous', 'lastFiveGames')
            }
        };
    }

    // Live game data for real-time betting
    async getLiveGameData() {
        return this.fetchWithCache(`${this.baseUrls.site}/scoreboard`);
    }

    // UTILITY FUNCTIONS

    async fetchWithCache(url, expireSeconds = 3600, retries = 3) {
        // Set different cache times based on URL content
        if (expireSeconds === null) {
            // Yeah we're making this a LOT longer haha
            if (url.includes('roster')) {
                expireSeconds = 86400; // 24 hours for roster data
            } else if (url.includes('statistics')) {
                expireSeconds = 3600; // 1 hour for stats
            } else if (url.includes('odds') || url.includes('scores')) {
                expireSeconds = 300; // 5 minutes for live data
            } else {
                expireSeconds = 3600; // Default 1 hour
            }
        }

        // Check cache first
        const cachedData = this.cache.get(url);
        if (cachedData) {
            console.log(`Cache hit for ${url}`);
            return cachedData;
        }
        console.log(`Cache miss for ${url}`);

        for (let i = 0; i < retries; i++) {                    // Retry loop
            try {
                await this.throttleRequest();                   // Rate limiting

                // We do this once above, if this code executes method returns

                // Works in both Node and browser
                // const cachedData = this.cache.get(url);        // Check cache first
                // if (cachedData) {
                //     return cachedData;
                // }

                const response = await fetch(url);              // Make API request
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} for ${url}`);
                }

                const data = await response.json();             // Parse response
                if (!data) {
                    throw new Error(`No data received from ${url}`);
                }

                // Check for error responses from ESPN API
                if (data.error) {
                    throw new Error(`ESPN API error: ${data.error.message || JSON.stringify(data.error)}`);
                }

                // Store in cache. Works in both Node and browser
                this.cache.set(url, data, expireSeconds);      // Store in cache
                console.log(`Cached data for ${url} (expires in ${expireSeconds}s)`);

                return data;

            } catch (error) {
                console.error(`Attempt ${i + 1}/${retries} failed for ${url}:`, error.message);
                if (i === retries - 1) throw error;

                // Exponential backoff
                const waitTime = Math.pow(2, i) * 1000;
                console.log(`Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    extractStat(stats, category, statName, perGame = false) {
        try {
            if (!stats?.splits?.categories) {
                return {
                    value: null,
                    displayValue: "N/A",
                    rank: null
                };
            }
            const categoryStats = stats.splits.categories.find(c => c.name === category);
            if (!categoryStats?.stats) return null;

            const stat = categoryStats.stats.find(s => s.name === statName);
            if (!stat) return null;

            return {
                value: perGame ? stat.value / stats.gamesPlayed : stat.value,
                displayValue: stat.displayValue || String(stat.value),
                rank: stat.rank || null
            };
        } catch (e) {
            console.warn(`Failed to extract ${category}.${statName}:`, e);
            return null;
        }
    }

    extractTeamGameStats(team) {
        return {
            totalYards: team.statistics.find(s => s.name === 'totalYards')?.value,
            passingYards: team.statistics.find(s => s.name === 'netPassingYards')?.value,
            rushingYards: team.statistics.find(s => s.name === 'rushingYards')?.value,
            turnovers: team.statistics.find(s => s.name === 'turnovers')?.value,
            timeOfPossession: team.statistics.find(s => s.name === 'possessionTime')?.value
        };
    }

    extractSpread(event) {
        try {
            const odds = event.competitions[0].odds[0];
            return {
                favorite: odds.details.split(' ')[0],
                line: parseFloat(odds.details.split(' ')[1])
            };
        } catch (e) {
            return null;
        }
    }

    extractOverUnder(event) {
        try {
            return parseFloat(event.competitions[0].odds[0].overUnder);
        } catch (e) {
            return null;
        }
    }

    extractLastNGames(stats, n) {
        try {
            return stats.splits.find(s => s.type === 'lastNGames' && s.value === n)?.stats || null;
        } catch (e) {
            return null;
        }
    }

    // GAME DATA FUNCTIONS

    async getUpcomingGames() {
        const scoreboard = await this.fetchWithCache(`${this.baseUrls.site}/scoreboard`);
        return scoreboard.events.map(event => ({
            id: event.id,
            homeTeam: {
                id: event.competitions[0].competitors[0].id,
                name: event.competitions[0].competitors[0].team.name,
                score: event.competitions[0].competitors[0].score
            },
            awayTeam: {
                id: event.competitions[0].competitors[1].id,
                name: event.competitions[0].competitors[1].team.name,
                score: event.competitions[0].competitors[1].score
            },
            startTime: event.date,
            spread: this.extractSpread(event),
            overUnder: this.extractOverUnder(event),
            status: event.status.type.detail
        }));
    }

    async getGameDetails(gameId) {
        if (!gameId || gameId === 'invalid_game') {
            throw new Error('Invalid game ID provided');
        }

        try {
            const game = await this.fetchWithCache(
                `${this.baseUrls.site}/summary?event=${gameId}`
            );

            if (!game) {
                throw new Error('No game data found');
            }

            return {
                gameInfo: {
                    startTime: game?.header?.timeValid || null,
                    venue: game?.gameInfo?.venue?.fullName || null,
                    attendance: game?.gameInfo?.attendance || 0,
                    weather: game?.gameInfo?.weather || null
                },
                teamStats: {
                    home: game?.boxscore?.teams?.[0] ?
                        this.extractTeamGameStats(game.boxscore.teams[0]) : null,
                    away: game?.boxscore?.teams?.[1] ?
                        this.extractTeamGameStats(game.boxscore.teams[1]) : null
                },
                situation: game?.situation ? {
                    possession: game.situation.possession,
                    down: game.situation.down,
                    distance: game.situation.distance,
                    yardLine: game.situation.yardLine,
                    lastPlay: game.situation.lastPlay?.text
                } : null,
                score: {
                    home: game?.header?.competitions?.[0]?.competitors?.[0]?.score || '0',
                    away: game?.header?.competitions?.[0]?.competitors?.[1]?.score || '0'
                }
            };
        } catch (error) {
            console.error("Error fetching game details:", error);
            throw error; // Rethrow to ensure error test catches it
        }
    }

    // BETTING DATA FUNCTIONS

    async getBettingData(gameId) {
        if (!gameId) throw new Error('Game ID is required');

        try {
            const odds = await this.fetchWithCache(
                `${this.baseUrls.core}/events/${gameId}/competitions/${gameId}/odds`
            );

            // Check if odds data exists
            if (!odds || !odds[0]) {
                return {
                    spread: null,
                    moneyline: null,
                    overUnder: null,
                    movements: []
                };
            }

            const currentOdds = odds[0];

            // Validate the odds data structure
            if (!this.validateResponse(currentOdds, 'ODDS')) {
                console.warn('Invalid odds data structure received');
                return {
                    spread: null,
                    moneyline: null,
                    overUnder: null,
                    movements: []
                };
            }

            return {
                spread: currentOdds.spread ? {
                    favorite: currentOdds.spread.favorite?.abbreviation || null,
                    line: currentOdds.spread.line || null,
                    odds: currentOdds.spread.odds || null
                } : null,
                moneyline: {
                    home: currentOdds.moneyline?.home || null,
                    away: currentOdds.moneyline?.away || null
                },
                overUnder: {
                    total: currentOdds.overUnder || null,
                    overOdds: currentOdds.overOdds || null,
                    underOdds: currentOdds.underOdds || null
                },
                movements: currentOdds.movements?.map(m => ({
                    time: m.timestamp,
                    type: m.type,
                    from: m.from,
                    to: m.to
                })) || []
            };
        } catch (error) {
            console.error("Error fetching betting data:", error);
            return {
                spread: null,
                moneyline: null,
                overUnder: null,
                movements: []
            };
        }
    }

    async getTeamTrends(teamId) {
        const stats = await this.fetchWithCache(
            `${this.baseUrls.core}/seasons/2024/types/2/teams/${teamId}/statistics`
        );

        return {
            overall: {
                wins: this.extractStat(stats, 'record', 'wins'),
                losses: this.extractStat(stats, 'record', 'losses'),
                pointsPerGame: this.extractStat(stats, 'scoring', 'totalPointsPerGame'),
                pointsAllowedPerGame: this.extractStat(stats, 'defensive', 'pointsAllowedPerGame')
            },
            ats: {
                record: this.extractStat(stats, 'betting', 'atsRecord'),
                homeRecord: this.extractStat(stats, 'betting', 'homeAtsRecord'),
                awayRecord: this.extractStat(stats, 'betting', 'awayAtsRecord')
            },
            overUnder: {
                overs: this.extractStat(stats, 'betting', 'oversRecord'),
                unders: this.extractStat(stats, 'betting', 'undersRecord'),
                pushes: this.extractStat(stats, 'betting', 'pushesRecord')
            },
            situational: {
                homeStraightUp: this.extractStat(stats, 'record', 'homeRecord'),
                awayStraightUp: this.extractStat(stats, 'record', 'awayRecord'),
                asFavorite: this.extractStat(stats, 'record', 'favoriteRecord'),
                asUnderdog: this.extractStat(stats, 'record', 'underdogRecord')
            }
        };
    }

    // FANTASY DATA FUNCTIONS

    async getPlayerProjections(playerId) {
        const stats = await this.fetchWithCache(
            `${this.baseUrls.core}/seasons/2024/types/2/athletes/${playerId}/projections`
        );

        return {
            passing: {
                attempts: this.extractStat(stats, 'passing', 'passingAttempts'),
                completions: this.extractStat(stats, 'passing', 'completions'),
                yards: this.extractStat(stats, 'passing', 'passingYards'),
                touchdowns: this.extractStat(stats, 'passing', 'passingTouchdowns'),
                interceptions: this.extractStat(stats, 'passing', 'interceptions')
            },
            rushing: {
                attempts: this.extractStat(stats, 'rushing', 'rushingAttempts'),
                yards: this.extractStat(stats, 'rushing', 'rushingYards'),
                touchdowns: this.extractStat(stats, 'rushing', 'rushingTouchdowns')
            },
            receiving: {
                targets: this.extractStat(stats, 'receiving', 'receivingTargets'),
                receptions: this.extractStat(stats, 'receiving', 'receptions'),
                yards: this.extractStat(stats, 'receiving', 'receivingYards'),
                touchdowns: this.extractStat(stats, 'receiving', 'receivingTouchdowns')
            }
        };
    }

    async getPlayerMatchupStats(playerId, opponentId) {
        const [playerStats, opponentStats] = await Promise.all([
            this.getPlayerStats(playerId),
            this.getTeamDefensiveStats(opponentId)
        ]);

        return {
            player: {
                seasonAverages: {
                    passingYards: this.extractStat(playerStats, 'passing', 'passingYardsPerGame'),
                    rushingYards: this.extractStat(playerStats, 'rushing', 'rushingYardsPerGame'),
                    receivingYards: this.extractStat(playerStats, 'receiving', 'receivingYardsPerGame')
                },
                recentForm: this.extractLastNGames(playerStats, 3)
            },
            opponent: {
                vsPosition: {
                    passingYardsAllowed: this.extractStat(opponentStats, 'defensive', 'passingYardsAllowedPerGame'),
                    rushingYardsAllowed: this.extractStat(opponentStats, 'defensive', 'rushingYardsAllowedPerGame'),
                    receivingYardsAllowed: this.extractStat(opponentStats, 'defensive', 'receivingYardsAllowedPerGame')
                },
                recentDefense: this.extractLastNGames(opponentStats, 3)
            }
        };
    }

    // For moneyline/spread predictions
    async getTeamPerformanceMetrics(teamId) {
        const stats = await this.fetchWithCache(
            `${this.baseUrls.core}/seasons/2024/types/2/teams/${teamId}/statistics`
        );

        return {
            offense: {
                pointsPerGame: this.extractStat(stats, 'scoring', 'totalPointsPerGame'),
                yardsPerGame: this.extractStat(stats, 'passing', 'yardsPerGame'),
                thirdDownConvPct: this.extractStat(stats, 'miscellaneous', 'thirdDownConvPct'),
                redZoneEfficiency: this.extractStat(stats, 'miscellaneous', 'redzoneScoringPct')
            },
            defense: {
                pointsAllowedPerGame: this.extractStat(stats, 'defensive', 'pointsAllowed'),
                yardsAllowedPerGame: this.extractStat(stats, 'defensive', 'yardsAllowed'),
                sacks: this.extractStat(stats, 'defensive', 'sacks'),
                takeaways: this.extractStat(stats, 'miscellaneous', 'totalTakeaways')
            }
        };
    }

    // For player props
    async getPlayerPropMetrics(playerId) {
        const stats = await this.fetchWithCache(
            `${this.baseUrls.core}/seasons/2024/types/2/athletes/${playerId}/statistics`
        );

        return {
            passing: {
                yardsPerGame: this.extractStat(stats, 'passing', 'passingYardsPerGame'),
                completionPct: this.extractStat(stats, 'passing', 'completionPct'),
                attemptsPerGame: this.extractStat(stats, 'passing', 'passingAttempts', true),
                yardsPerAttempt: this.extractStat(stats, 'passing', 'yardsPerPassAttempt')
            },
            rushing: {
                yardsPerGame: this.extractStat(stats, 'rushing', 'rushingYardsPerGame'),
                attemptsPerGame: this.extractStat(stats, 'rushing', 'rushingAttempts', true),
                yardsPerCarry: this.extractStat(stats, 'rushing', 'yardsPerRushAttempt')
            },
            receiving: {
                yardsPerGame: this.extractStat(stats, 'receiving', 'receivingYardsPerGame'),
                receptionsPerGame: this.extractStat(stats, 'receiving', 'receptions', true),
                yardsPerReception: this.extractStat(stats, 'receiving', 'yardsPerReception'),
                targetShare: this.extractStat(stats, 'receiving', 'receivingTargets', true)
            }
        };
    }

    // For over/under predictions
    async getGameScoringFactors(homeTeamId, awayTeamId) {
        const [homeStats, awayStats] = await Promise.all([
            this.getTeamPerformanceMetrics(homeTeamId),
            this.getTeamPerformanceMetrics(awayTeamId)
        ]);

        return {
            homeTeam: {
                averagePointsFor: homeStats.offense.pointsPerGame,
                averagePointsAgainst: homeStats.defense.pointsAllowedPerGame,
                offensiveEfficiency: homeStats.offense.redZoneEfficiency,
                defensiveEfficiency: homeStats.defense.takeaways
            },
            awayTeam: {
                averagePointsFor: awayStats.offense.pointsPerGame,
                averagePointsAgainst: awayStats.defense.pointsAllowedPerGame,
                offensiveEfficiency: awayStats.offense.redZoneEfficiency,
                defensiveEfficiency: awayStats.defense.takeaways
            }
        };
    }

    // For live betting updates
    async getLiveGameStats(gameId) {
        const game = await this.fetchWithCache(
            `${this.baseUrls.site}/scoreboard/events/${gameId}`,
            30 // shorter cache time for live data
        );

        return {
            score: {
                home: game.homeTeam.score,
                away: game.awayTeam.score
            },
            timeRemaining: game.status.displayClock,
            quarter: game.status.period,
            possession: game.situation.possession,
            lastPlay: game.situation.lastPlay,
            momentum: {
                yardsLastDrive: game.drives.current.yards,
                timeOfPossession: game.drives.current.timeOfPossession
            }
        };
    }

    // FANTASY LINEUP OPTIMIZATION METHODS

    async getOptimalLineup(settings = {
        budget: 50000,
        scoring: 'ppr',
        positions: ['QB', 'RB', 'RB', 'WR', 'WR', 'TE', 'FLEX', 'DST']
    }) {
        try {
            const allPlayers = await this.getAllActivePlayers();
            const projections = await this.getPlayerProjectionsBatch(
                allPlayers.map(p => p.id)
            );

            const eligiblePlayers = allPlayers.map(player => ({
                ...player,
                projection: projections[player.id] || 0,
                value: this.calculatePlayerValue(player, projections[player.id])
            })).filter(p => p.projection > 0);

            return this.optimizeLineup(eligiblePlayers, settings);
        } catch (error) {
            console.error('Error generating optimal lineup:', error);
            throw error;
        }
    }

    calculatePlayerValue(player, projection) {
        return {
            raw: projection,
            perDollar: projection / player.salary,
            confidence: this.calculateProjectionConfidence(player)
        };
    }

    calculateProjectionConfidence(player) {
        // Implement confidence calculation based on:
        // - Historical accuracy
        // - Matchup difficulty
        // - Injury status
        // - Weather conditions
        // Returns value 0-1

        // Simple confidence score based on available data
        let confidence = 0.5; // Base confidence

        // Adjust based on games played
        if (player.experience > 2) confidence += 0.1;
        if (player.status?.type === 'active') confidence += 0.2;
        if (!player.injuries?.length) confidence += 0.2;

        return Math.min(confidence, 1.0);
    }

    optimizeLineup(players, settings) {
        const lineup = {
            totalSalary: 0,
            projectedPoints: 0,
            players: {}
        };

        // Implement knapsack algorithm for lineup optimization
        // Consider:
        // - Position requirements
        // - Salary constraints
        // - Player correlations
        // - Stack opportunities

        return lineup;
    }

    // BETTING PREDICTION METHODS

    async getPredictionInsights(gameId) {
        const [
            gameDetails,
            homeTeamStats,
            awayTeamStats,
            historicalMatchups,
            injuries
        ] = await Promise.all([
            this.getGameDetails(gameId),
            this.getTeamBettingStats(gameDetails.homeTeam.id),
            this.getTeamBettingStats(gameDetails.awayTeam.id),
            this.getHistoricalMatchups(gameDetails.homeTeam.id, gameDetails.awayTeam.id),
            this.getTeamInjuryImpact([gameDetails.homeTeam.id, gameDetails.awayTeam.id])
        ]);

        return {
            spread: this.predictSpread(homeTeamStats, awayTeamStats, injuries),
            totalScore: this.predictTotalScore(homeTeamStats, awayTeamStats, gameDetails),
            winProbability: this.calculateWinProbability(homeTeamStats, awayTeamStats),
            keyFactors: this.analyzeKeyFactors(homeTeamStats, awayTeamStats, historicalMatchups),
            confidence: this.calculatePredictionConfidence(gameId)
        };
    }

    async getHistoricalMatchups(team1Id, team2Id, seasons = 3) {
        const matchups = await this.fetchWithCache(
            `${this.baseUrls.site}/teams/${team1Id}/schedule?season=${new Date().getFullYear()}`
        );

        return matchups?.events?.filter(event =>
            event.competitions[0].competitors.some(c => c.id === team2Id)
        ) || [];
    }

    async getTeamInjuryImpact(teamIds) {
        // Analyze impact of injuries on team performance
        const injuries = {};
        for (const teamId of teamIds) {
            const teamInjuries = await this.fetchWithCache(
                `${this.baseUrls.core}/teams/${teamId}/injuries`
            );
            injuries[teamId] = teamInjuries?.length || 0;
        }
        return injuries;
    }

    predictSpread(homeStats, awayStats, injuries) {
        // Implement spread prediction algorithm considering:
        // - Team performance metrics
        // - Home field advantage
        // - Injury impacts
        // - Weather conditions
        // - Historical ATS performance

        // Simple spread prediction based on points differential
        const homePointsDiff = homeStats.offense.pointsPerGame.value -
            awayStats.defense.pointsAllowedPerGame.value;
        const awayPointsDiff = awayStats.offense.pointsPerGame.value -
            homeStats.defense.pointsAllowedPerGame.value;

        const spread = homePointsDiff - awayPointsDiff + 3; // Add home field advantage
        return Math.round(spread * 10) / 10;
    }

    predictTotalScore(homeStats, awayStats, gameDetails) {
        // Implement total score prediction considering:
        // - Team scoring trends
        // - Pace of play
        // - Weather impact
        // - Defense vs position stats

        // Simple over/under prediction
        const predictedTotal =
            homeStats.offense.pointsPerGame.value +
            awayStats.offense.pointsPerGame.value;

        return Math.round(predictedTotal);
    }

    // REAL-TIME TRACKING AND UPDATES

    async startLiveGameTracking(gameId) {
        if (this.liveGameData.has(gameId)) {
            return;
        }

        const updateInterval = setInterval(async () => {
            try {
                const gameData = await this.getLiveGameData(gameId);
                this.liveGameData.set(gameId, gameData);
                this.notifySubscribers('gameUpdate', { gameId, data: gameData });

                // Update predictions based on live data
                const updatedPredictions = await this.updateLivePredictions(gameId, gameData);
                this.notifySubscribers('predictionUpdate', { gameId, predictions: updatedPredictions });

            } catch (error) {
                console.error(`Error tracking game ${gameId}:`, error);
            }
        }, CONFIG.UI.UPDATE_INTERVALS.LIVE);

        this.liveGameData.set(gameId, { updateInterval });
    }

    stopLiveGameTracking(gameId) {
        const gameData = this.liveGameData.get(gameId);
        if (gameData?.updateInterval) {
            clearInterval(gameData.updateInterval);
            this.liveGameData.delete(gameId);
        }
    }

    async updateLivePredictions(gameId, liveData) {
        // Update predictions based on live game data
        // Consider:
        // - Score
        // - Time remaining
        // - Possession
        // - Momentum
        // - Key events

        const predictions = await this.getPredictionInsights(gameId);
        const timeRemaining = this.calculateRemainingTime(liveData);
        const scoreDiff = liveData.score.home - liveData.score.away;

        return {
            ...predictions,
            adjustedSpread: this.adjustSpreadForLiveGame(predictions.spread, scoreDiff, timeRemaining),
            adjustedTotal: this.adjustTotalForLiveGame(predictions.totalScore,
                liveData.score.home + liveData.score.away, timeRemaining)
        };
    }

    // ADVANCED STATISTICS PROCESSING

    calculateAdvancedStats(rawStats) {
        return {
            efficiency: {
                passingSuccess: this.calculatePassingEfficiency(rawStats),
                rushingSuccess: this.calculateRushingEfficiency(rawStats),
                redZone: this.calculateRedZoneEfficiency(rawStats)
            },
            situational: {
                thirdDowns: this.calculateSituationalEfficiency(rawStats, '3rd'),
                redZone: this.calculateSituationalEfficiency(rawStats, 'RZ'),
                twoMinute: this.calculateSituationalEfficiency(rawStats, '2min')
            },
            trends: {
                scoring: this.analyzeScoringTrends(rawStats),
                momentum: this.analyzeMomentumFactors(rawStats)
            }
        };
    }
}


export default NFLDataService;