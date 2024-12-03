// pages/dashboard.js  (my code is a mess i know lol have fun reading this)
import NFLDataService from '../core/api.js';
import StorageManager from '../core/storage.js';
import { formatters, createElement, clearElement, handleError, sortBy, showLoading, hideLoading, updateFooter, DebugLogger } from '../core/utils.js';

class DashboardManager {
    constructor() {
        DebugLogger.log('Init', 'DashboardManager initialized');
        this.api = new NFLDataService();
        this.storage = new StorageManager();
        this.containers = {
            liveGames: document.getElementById('live-games-container'),
            topTeams: document.querySelector('.teams-grid'),
            topPlayers: document.querySelector('.players-grid'),
            insights: document.getElementById('insights-container'),
            trends: document.getElementById('trends-container')
        };
        this.updateInterval = null;

        // Test storage for no reason
        try {
            this.storage.set('test_key', { test: 'data' });
            const testData = this.storage.get('test_key');
            console.log('Storage test:', testData ? 'working' : 'failed');
        } catch (error) {
            console.error('Storage test failed:', error);
        }
    }

    async init() {
        try {
            DebugLogger.log('Loading', 'Starting dashboard initialization');
            showLoading();
            const teams = await this.api.getAllTeams();
            DebugLogger.log('API', 'Teams data received', teams);
            // for now lets just try JUST the teams cuz the api sucks rn
            if (teams?.length) {
                //await this.updateTopTeams();
                await this.loadAllSections();
                DebugLogger.log('UI', 'Teams display updated');
            }
            //await this.loadAllSections();
            //this.loadAdditionalData();  // Then maayybbeee we load more stuff
            // theres no way we have enough api bandwidth for this yet
            // this.startUpdateIntervals();
            updateFooter('Dashboard initialized successfully');
        } catch (error) {
            console.error('Dashboard initialization error:', error);
            updateFooter('Error loading dashboard');
            DebugLogger.log('Error', 'Dashboard initialization failed', error);
        } finally {
            hideLoading();
        }
    }

    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        // Clear any event listeners
        Object.values(this.containers).forEach(container => {
            if (container) {
                container.replaceWith(container.cloneNode(true));
            }
        });
    }

    async loadAdditionalData() {
        // Load other sections in the background
        try {
            if (this.containers.liveGames) {
                this.containers.liveGames.innerHTML = '<div class="loading">Loading games...</div>';
            }
            // Additional data loading will go here
        } catch (error) {
            console.error('Error loading additional data:', error);
        }
    }

    // async loadAllSections() {
    //     try {
    //         await Promise.all([
    //             this.updateLiveGames(),
    //             this.updateTopTeams(),
    //             this.updateTopPlayers(),
    //             this.updateInsights()
    //         ]);
    //     } catch (error) {
    //         handleError(error, 'Dashboard loadAllSections');
    //     }
    // }

    // SIIIIIIIKKKKKKKKKEEEEEEEEEEEE

    async loadAllSections() {
        try {
            showLoading();

            // Load sections independently to show partial data
            const loadSection = async (section) => {
                try {
                    await section();
                    return true;
                } catch (error) {
                    console.warn(`Error loading section:`, error);
                    return false;
                }
            };

            const results = await Promise.allSettled([
                loadSection(() => this.updateLiveGames()),
                loadSection(() => this.updateTopTeams()),
                loadSection(() => this.updateTopPlayers()),
                loadSection(() => this.updateInsights())
            ]);

            const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
            updateFooter(`Loaded ${successCount}/4 sections successfully`);

        } catch (error) {
            handleError(error, 'Dashboard loadAllSections');
            updateFooter('Error loading dashboard sections');
        } finally {
            hideLoading();
        }
    }

    // async updateLiveGames() {
    //     try {
    //         const games = await this.api.getLiveGameData();
    //         clearElement(this.containers.liveGames);

    //         games.forEach(game => {
    //             const gameElement = this.createGameElement(game);
    //             this.containers.liveGames.appendChild(gameElement);
    //         });
    //     } catch (error) {
    //         handleError(error, 'updateLiveGames');
    //     }
    // }

    async updateLiveGames() {
        try {
            console.log('Fetching live games...');
            const data = await this.api.getLiveGameData();
            console.log('Received live games:', data);

            if (!this.containers.liveGames) {
                console.warn('Live games container not found');
                return;
            }

            clearElement(this.containers.liveGames);

            const events = data?.events || [];
            if (events.length === 0) {
                this.containers.liveGames.innerHTML = '<div class="no-games">No live games at the moment</div>';
                return;
            }

            events.forEach(event => {
                const { competitions } = event;
                if (!competitions || !competitions[0]) return;

                const gameData = {
                    homeTeam: {
                        name: competitions[0].competitors[0]?.team?.name || 'Unknown Team',
                        score: competitions[0].competitors[0]?.score || '0',
                        logo: competitions[0].competitors[0]?.team?.logo || 'images/genericLogo.jpg'
                    },
                    awayTeam: {
                        name: competitions[0].competitors[1]?.team?.name || 'Unknown Team',
                        score: competitions[0].competitors[1]?.score || '0',
                        logo: competitions[0].competitors[1]?.team?.logo || 'images/genericLogo.jpg'
                    },
                    status: event.status?.type?.detail || 'Unknown Status',
                    startTime: event.date
                };

                const gameElement = this.createGameElement(gameData);
                if (gameElement) {
                    this.containers.liveGames.appendChild(gameElement);
                }
            });

            console.log('Live games updated successfully');
        } catch (error) {
            console.error('Error updating live games:', error);
            if (this.containers.liveGames) {
                this.containers.liveGames.innerHTML = '<div class="error">Error loading live games</div>';
            }
        }
    }

    // async updateTopTeams() {
    //     try {
    //         const teams = await this.api.getAllTeams();
    //         clearElement(this.containers.topTeams);

    //         teams.slice(0, 5).forEach(team => {
    //             const teamElement = this.createTeamElement(team);
    //             this.containers.topTeams.appendChild(teamElement);
    //         });
    //     } catch (error) {
    //         handleError(error, 'updateTopTeams');
    //     }
    // }

    // Adding more debug to this one too..

    // async updateTopTeams() {
    //     try {
    //         console.log('Fetching teams...');
    //         const teams = await this.api.getAllTeams();
    //         console.log('Received teams:', teams);

    //         if (!this.containers.topTeams) {
    //             console.error('Top teams container not found');
    //             return;
    //         }

    //         clearElement(this.containers.topTeams);

    //         if (!teams || teams.length === 0) {
    //             console.log('No teams available');
    //             this.containers.topTeams.innerHTML = '<div class="no-data">No teams available</div>';
    //             return;
    //         }

    //         // Take top 5 teams
    //         const topTeams = teams.slice(0, 5);
    //         topTeams.forEach(team => {
    //             const teamElement = this.createTeamElement(team);
    //             if (teamElement) {
    //                 this.containers.topTeams.appendChild(teamElement);
    //             }
    //         });

    //         console.log('Teams displayed successfully');
    //     } catch (error) {
    //         console.error('Error updating teams:', error);
    //         if (this.containers.topTeams) {
    //             this.containers.topTeams.innerHTML = '<div class="error">Error loading teams</div>';
    //         }
    //     }
    // }

    // Anndd changing it again

    async updateTopTeams() {
        try {
            const teams = await this.api.getAllTeams();
            console.log('Teams data received:', teams);

            if (!this.containers.topTeams) {
                console.error('Top teams container not found');
                return;
            }

            clearElement(this.containers.topTeams);

            if (!teams || teams.length === 0) {
                this.containers.topTeams.innerHTML = '<div class="no-data">No teams available</div>';
                return;
            }

            teams.slice(0, 5).forEach(teamData => {
                const teamElement = this.createTeamElement(teamData);
                if (teamElement) {
                    this.containers.topTeams.appendChild(teamElement);
                }
            });
        } catch (error) {
            console.error('Error updating teams:', error);
            if (this.containers.topTeams) {
                this.containers.topTeams.innerHTML = '<div class="error">Error loading teams</div>';
            }
        }
    }

    async updateTopPlayers() {
        try {
            const players = await this.api.getAllActivePlayers();
            clearElement(this.containers.topPlayers);

            players.slice(0, 5).forEach(player => {
                const playerElement = this.createPlayerElement(player);
                this.containers.topPlayers.appendChild(playerElement);
            });
        } catch (error) {
            handleError(error, 'updateTopPlayers');
        }
    }

    // startUpdateIntervals() {
    //     setInterval(() => this.updateLiveGames(), 30000);
    //     setInterval(() => this.loadAllSections(), 300000);
    // }

    startUpdateIntervals() {
        // Update live games every 30 seconds
        this.updateInterval = setInterval(() => {
            this.updateLiveGames();
        }, 30000);

        // Update all sections every 5 minutes
        setInterval(() => {
            this.loadAllSections();
        }, 300000);
    }

    // Add cleanup method
    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }

    // createGameElement(game) {
    //     const element = createElement('div', 'game-card');
    //     element.innerHTML = `
    //         <div class="teams">
    //             <div class="team home">${game.homeTeam.name}: ${formatters.score(game.homeTeam.score)}</div>
    //             <div class="team away">${game.awayTeam.name}: ${formatters.score(game.awayTeam.score)}</div>
    //         </div>
    //         <div class="game-info">
    //             <div class="status">${game.status}</div>
    //             <div class="odds">Spread: ${game.spread || 'N/A'}</div>
    //         </div>
    //     `;
    //     return element;
    // }

    // Sike lol

    // createGameElement(game) {
    //     const element = createElement('div', 'game-card');
    //     element.innerHTML = `
    //         <div class="teams">
    //             <div class="team home">
    //                 <img src="${game.homeTeam.logo || 'images/genericLogo.jpg'}" alt="${game.homeTeam.name} logo" class="team-logo">
    //                 <span>${game.homeTeam.name}: ${game.homeTeam.score}</span>
    //             </div>
    //             <div class="team away">
    //                 <img src="${game.awayTeam.logo || 'images/genericLogo.jpg'}" alt="${game.awayTeam.name} logo" class="team-logo">
    //                 <span>${game.awayTeam.name}: ${game.awayTeam.score}</span>
    //             </div>
    //         </div>
    //         <div class="game-info">
    //             <div class="status">${game.status}</div>
    //             <div class="odds">Spread: ${game.spread ? game.spread : 'N/A'}</div>
    //         </div>
    //     `;
    //     return element;
    // }

    // Sike again lolol

    // createGameElement(game) {
    //     if (!game) return null;

    //     const element = createElement('div', 'game-card');
    //     try {
    //         element.innerHTML = `
    //             <div class="teams">
    //                 <div class="team home">
    //                     <img src="${game.homeTeam?.logo || 'images/genericLogo.jpg'}" 
    //                          alt="${game.homeTeam?.name || 'Team'} logo" 
    //                          class="team-logo">
    //                     <span>${game.homeTeam?.name || 'Unknown'}: ${game.homeTeam?.score || '0'}</span>
    //                 </div>
    //                 <div class="team away">
    //                     <img src="${game.awayTeam?.logo || 'images/genericLogo.jpg'}" 
    //                          alt="${game.awayTeam?.name || 'Team'} logo" 
    //                          class="team-logo">
    //                     <span>${game.awayTeam?.name || 'Unknown'}: ${game.awayTeam?.score || '0'}</span>
    //                 </div>
    //             </div>
    //             <div class="game-info">
    //                 <div class="status">${game.status || 'Status unknown'}</div>
    //                 <div class="odds">Spread: ${game.spread ? game.spread : 'N/A'}</div>
    //             </div>
    //         `;
    //         return element;
    //     } catch (error) {
    //         console.warn('Error creating game element:', error);
    //         element.innerHTML = '<div class="error">Error loading game data</div>';
    //         return element;
    //     }
    // }

    createGameElement(game) {
        const element = createElement('div', 'game-card');
        
        element.innerHTML = `
            <div class="game-teams">
                <div class="team-matchup">
                    <img src="${game.homeTeam.logo || 'images/genericLogo.jpg'}" 
                         alt="${game.homeTeam.name} logo" 
                         class="team-logo">
                    <div class="team-info">
                        <span class="team-name">${game.homeTeam.name}</span>
                        <span class="team-score">${game.homeTeam.score || '0'}</span>
                    </div>
                </div>
                <div class="vs">VS</div>
                <div class="team-matchup">
                    <div class="team-info">
                        <span class="team-name">${game.awayTeam.name}</span>
                        <span class="team-score">${game.awayTeam.score || '0'}</span>
                    </div>
                    <img src="${game.awayTeam.logo || 'images/genericLogo.jpg'}" 
                         alt="${game.awayTeam.name} logo" 
                         class="team-logo">
                </div>
            </div>
            <div class="game-status">
                ${game.status || 'Upcoming'} • ${formatters.dateTime(game.startTime)}
            </div>
        `;
    
        return element;
    }

    // createTeamElement(team) {
    //     const element = createElement('div', 'team-card');
    //     element.innerHTML = `
    //         <div class="team-header">
    //             <img src="${team.team.logos?.[0]?.href || 'images/genericLogo.jpg'}" 
    //                  alt="${team.team.name} logo" 
    //                  class="team-logo">
    //             <h3>${team.team.name}</h3>
    //         </div>
    //         <div class="team-stats">
    //             <div class="stat-row">
    //                 <span>Record:</span>
    //                 <span>${team.team.record?.overall || '0-0'}</span>
    //             </div>
    //             <div class="stat-row">
    //                 <span>PPG:</span>
    //                 <span>${team.team.statistics?.points?.avg || '0.0'}</span>
    //             </div>
    //             <div class="stat-row">
    //                 <span>PAPG:</span>
    //                 <span>${team.team.statistics?.pointsAgainst?.avg || '0.0'}</span>
    //             </div>
    //             <div class="stat-row">
    //                 <span>Streak:</span>
    //                 <span>${team.team.streak || 'N/A'}</span>
    //             </div>
    //         </div>
    //         <a href="teams.html?id=${team.team.id}" class="team-link">View Details</a>
    //     `;
    //     return element;
    // }

    // better or worse but.. simpler

    createTeamElement(teamData) {
        try {
            const element = createElement('div', 'team-card');
            const team = teamData.team;

            element.innerHTML = `
                <div class="team-header">
                    <img src="${team.logos?.[0]?.href || 'images/genericLogo.jpg'}" 
                         alt="${team.name || 'Team'} logo" 
                         class="team-logo">
                    <h3>${team.name || 'Unknown Team'}</h3>
                </div>
                <div class="team-info">
                    <div class="info-row">Location: ${team.location || 'N/A'}</div>
                    <div class="info-row">Division: ${team.division?.name || 'N/A'}</div>
                    <div class="info-row">Conference: ${team.conference?.name || 'N/A'}</div>
                </div>
            `;
            return element;
        } catch (error) {
            console.error('Error creating team element:', error, teamData);
            return null;
        }
    }

    createPlayerElement(player) {
        const element = createElement('div', 'player-card');
        
        // Use the correct endpoint for player headshots
        const playerHeadshot = player.headshot || `https://a.espncdn.com/combiner/i?img=/i/headshots/nfl/players/full/${player.id}.png&h=150&w=150&scale=crop`;
        
        element.innerHTML = `
            <div class="player-header">
                <img src="${playerHeadshot}" 
                     alt="${player.fullName}" 
                     class="player-image">
                <h3>${player.fullName}</h3>
            </div>
            <div class="player-info">
                <div class="info-row">
                    <span>Position:</span>
                    <span>${player.position}</span>
                </div>
                <div class="info-row">
                    <span>Team:</span>
                    <span>${player.team}</span>
                </div>
                <div class="info-row">
                    <span>Fantasy Pts:</span>
                    <span>${player.fantasyPoints?.toFixed(1) || '0.0'}</span>
                </div>
                <div class="info-row">
                    <span>Status:</span>
                    <span>${player.status?.type || 'Unknown'}</span>
                </div>
            </div>
            <a href="players.html?id=${player.id}" class="player-link">View Details</a>
        `;
        return element;
    }
    

    async updateInsights() {
        try {
            const insights = await this.getInsights();
            clearElement(this.containers.insights);

            insights.forEach(insight => {
                const insightElement = createElement('div', 'insight-card');
                insightElement.innerHTML = `
                    <h4>${insight.title}</h4>
                    <p>${insight.description}</p>
                    <div class="insight-value">${insight.value}</div>
                `;
                this.containers.insights.appendChild(insightElement);
            });
        } catch (error) {
            handleError(error, 'updateInsights');
        }
    }

    async getInsights() {
        // Get relevant data for insights
        const [games, teams] = await Promise.all([
            this.api.getUpcomingGames(),
            this.api.getAllTeams()
        ]);

        // Generate insights based on data
        return [
            {
                title: 'Top Matchup',
                description: this.getTopMatchupDescription(games),
                value: this.getTopMatchupValue(games)
            },
            {
                title: 'Best Betting Value',
                description: this.getBestBettingDescription(games),
                value: this.getBestBettingValue(games)
            },
            {
                title: 'Fantasy Trend',
                description: this.getFantasyTrendDescription(teams),
                value: this.getFantasyTrendValue(teams)
            }
        ];
    }

    getTopMatchupDescription(games) {
        const topGame = games[0]; // Assume first game is top matchup
        return topGame ?
            `${topGame.homeTeam.name} vs ${topGame.awayTeam.name}` :
            'No upcoming games';
    }

    getTopMatchupValue(games) {
        const topGame = games[0];
        return topGame ?
            formatters.dateTime(topGame.startTime) :
            'N/A';
    }

    getBestBettingDescription(games) {
        const bestBet = games.find(game => game.spread && game.overUnder);
        return bestBet ?
            `${bestBet.homeTeam.name} (${bestBet.spread})` :
            'No betting lines available';
    }

    getBestBettingValue(games) {
        const bestBet = games.find(game => game.spread && game.overUnder);
        return bestBet ?
            `O/U ${bestBet.overUnder}` :
            'N/A';
    }

    getFantasyTrendDescription(teams) {
        // Simplified trend analysis
        return teams.length > 0 ?
            `Top performing team: ${teams[0].team.name}` :
            'No trend data available';
    }

    getFantasyTrendValue(teams) {
        return teams.length > 0 ?
            `${teams[0].team.statistics?.points?.avg || 0} PPG` :
            'N/A';
    }
}

export default DashboardManager;