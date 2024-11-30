// pages/dashboard.js
import NFLDataService from '../core/api.js';
import StorageManager from '../core/storage.js';
import { formatters, createElement, clearElement, handleError } from '../core/utils.js';

class DashboardManager {
    constructor() {
        this.api = new NFLDataService();
        this.storage = new StorageManager();
        this.containers = {
            liveGames: document.getElementById('live-games-container'),
            topTeams: document.querySelector('.teams-grid'),
            topPlayers: document.querySelector('.players-grid'),
            insights: document.getElementById('insights-container'),
            trends: document.getElementById('trends-container')
        };
        this.init();
    }

    async init() {
        await this.loadAllSections();
        this.startUpdateIntervals();
    }

    async loadAllSections() {
        try {
            await Promise.all([
                this.updateLiveGames(),
                this.updateTopTeams(),
                this.updateTopPlayers(),
                this.updateInsights()
            ]);
        } catch (error) {
            handleError(error, 'Dashboard loadAllSections');
        }
    }

    async updateLiveGames() {
        try {
            const games = await this.api.getLiveGameData();
            clearElement(this.containers.liveGames);
            
            games.forEach(game => {
                const gameElement = this.createGameElement(game);
                this.containers.liveGames.appendChild(gameElement);
            });
        } catch (error) {
            handleError(error, 'updateLiveGames');
        }
    }

    async updateTopTeams() {
        try {
            const teams = await this.api.getAllTeams();
            clearElement(this.containers.topTeams);
            
            teams.slice(0, 5).forEach(team => {
                const teamElement = this.createTeamElement(team);
                this.containers.topTeams.appendChild(teamElement);
            });
        } catch (error) {
            handleError(error, 'updateTopTeams');
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

    startUpdateIntervals() {
        setInterval(() => this.updateLiveGames(), 30000);
        setInterval(() => this.loadAllSections(), 300000);
    }

    createGameElement(game) {
        const element = createElement('div', 'game-card');
        element.innerHTML = `
            <div class="teams">
                <div class="team home">${game.homeTeam.name}: ${formatters.score(game.homeTeam.score)}</div>
                <div class="team away">${game.awayTeam.name}: ${formatters.score(game.awayTeam.score)}</div>
            </div>
            <div class="game-info">
                <div class="status">${game.status}</div>
                <div class="odds">Spread: ${game.spread || 'N/A'}</div>
            </div>
        `;
        return element;
    }

    createTeamElement(team) {
        const element = createElement('div', 'team-card');
        element.innerHTML = `
            <div class="team-header">
                <img src="${team.team.logos?.[0]?.href || 'images/genericLogo.jpg'}" 
                     alt="${team.team.name} logo" 
                     class="team-logo">
                <h3>${team.team.name}</h3>
            </div>
            <div class="team-stats">
                <div class="stat-row">
                    <span>Record:</span>
                    <span>${team.team.record?.overall || '0-0'}</span>
                </div>
                <div class="stat-row">
                    <span>PPG:</span>
                    <span>${team.team.statistics?.points?.avg || '0.0'}</span>
                </div>
                <div class="stat-row">
                    <span>PAPG:</span>
                    <span>${team.team.statistics?.pointsAgainst?.avg || '0.0'}</span>
                </div>
                <div class="stat-row">
                    <span>Streak:</span>
                    <span>${team.team.streak || 'N/A'}</span>
                </div>
            </div>
            <a href="teams.html?id=${team.team.id}" class="team-link">View Details</a>
        `;
        return element;
    }

    createPlayerElement(player) {
        const element = createElement('div', 'player-card');
        element.innerHTML = `
            <div class="player-header">
                <img src="${player.headshot?.href || 'images/genericProfilePic.jpg'}" 
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
                    <span>${player.statistics?.fantasyPoints?.value || '0.0'}</span>
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