// pages/players.js
import NFLDataService from '../core/api.js';
import StorageManager from '../core/storage.js';
import { formatters, createElement, clearElement, handleError, sortBy } from '../core/utils.js';

class PlayersManager {
    constructor() {
        this.api = new NFLDataService();
        this.storage = new StorageManager();
        this.players = [];
        this.filters = {
            position: 'ALL',
            team: 'ALL',
            search: ''
        };
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadPlayers();
    }

    setupEventListeners() {
        // Search input
        document.getElementById('player-search')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.renderPlayers();
        });

        // Position filter
        document.getElementById('position-filter')?.addEventListener('change', (e) => {
            this.filters.position = e.target.value;
            this.renderPlayers();
        });

        // Team filter
        document.getElementById('team-filter')?.addEventListener('change', (e) => {
            this.filters.team = e.target.value;
            this.renderPlayers();
        });

        // Sort options
        document.getElementById('sort-options')?.addEventListener('change', (e) => {
            this.renderPlayers(e.target.value);
        });
    }

    async loadPlayers() {
        try {
            const players = await this.api.getAllActivePlayers();
            this.players = await this.enhancePlayersWithStats(players);
            this.renderPlayers();
        } catch (error) {
            handleError(error, 'loadPlayers');
        }
    }

    async enhancePlayersWithStats(players) {
        return Promise.all(players.map(async player => {
            try {
                const stats = await this.api.getPlayerFantasyStats(player.id);
                return {
                    ...player,
                    fantasyStats: stats,
                    fantasyPoints: await this.calculateFantasyPoints(stats)
                };
            } catch (error) {
                console.warn(`Failed to load stats for player ${player.id}`, error);
                return player;
            }
        }));
    }

    async calculateFantasyPoints(stats) {
        if (!stats) return 0;
        
        // Basic PPR scoring
        return (
            (stats.passing?.yards?.value || 0) * 0.04 +
            (stats.passing?.touchdowns?.value || 0) * 4 +
            (stats.rushing?.yards?.value || 0) * 0.1 +
            (stats.rushing?.touchdowns?.value || 0) * 6 +
            (stats.receiving?.receptions?.value || 0) * 1 +
            (stats.receiving?.yards?.value || 0) * 0.1 +
            (stats.receiving?.touchdowns?.value || 0) * 6
        );
    }

    filterPlayers() {
        return this.players.filter(player => {
            const matchesPosition = this.filters.position === 'ALL' || 
                                  player.position === this.filters.position;
            const matchesTeam = this.filters.team === 'ALL' || 
                              player.team === this.filters.team;
            const matchesSearch = player.fullName.toLowerCase()
                                .includes(this.filters.search.toLowerCase());
            
            return matchesPosition && matchesTeam && matchesSearch;
        });
    }

    renderPlayers(sortKey = 'fantasyPoints') {
        const container = document.getElementById('players-container');
        if (!container) return;

        clearElement(container);
        
        const filteredPlayers = this.filterPlayers();
        const sortedPlayers = sortBy(filteredPlayers, sortKey, true);

        sortedPlayers.forEach(player => {
            const playerCard = this.createPlayerCard(player);
            container.appendChild(playerCard);
        });
    }

    createPlayerCard(player) {
        const card = createElement('div', 'player-card');
        
        card.innerHTML = `
            <div class="player-header">
                <img src="${player.headshot || 'images/genericProfilePic.jpg'}" 
                     alt="${player.fullName}" 
                     class="player-image">
                <h3>${player.fullName}</h3>
                <div class="player-position">${player.position}</div>
                <div class="player-team">${player.team}</div>
            </div>
            <div class="player-stats">
                <div class="stat">
                    <label>Fantasy Points</label>
                    <value>${player.fantasyPoints.toFixed(1)}</value>
                </div>
                ${this.getPositionSpecificStats(player)}
            </div>
            <div class="player-actions">
                <button onclick="addToLineup(${player.id})" class="add-to-lineup">
                    Add to Lineup
                </button>
                <button onclick="showPlayerDetails(${player.id})" class="view-details">
                    View Details
                </button>
            </div>
        `;

        return card;
    }

    getPositionSpecificStats(player) {
        const stats = player.fantasyStats;
        if (!stats) return '';

        switch (player.position) {
            case 'QB':
                return `
                    <div class="stat">
                        <label>Pass Yards</label>
                        <value>${stats.passing?.yards?.value || 0}</value>
                    </div>
                    <div class="stat">
                        <label>Pass TD</label>
                        <value>${stats.passing?.touchdowns?.value || 0}</value>
                    </div>
                `;
            case 'RB':
                return `
                    <div class="stat">
                        <label>Rush Yards</label>
                        <value>${stats.rushing?.yards?.value || 0}</value>
                    </div>
                    <div class="stat">
                        <label>Rush TD</label>
                        <value>${stats.rushing?.touchdowns?.value || 0}</value>
                    </div>
                `;
            case 'WR':
            case 'TE':
                return `
                    <div class="stat">
                        <label>Receptions</label>
                        <value>${stats.receiving?.receptions?.value || 0}</value>
                    </div>
                    <div class="stat">
                        <label>Rec Yards</label>
                        <value>${stats.receiving?.yards?.value || 0}</value>
                    </div>
                `;
            default:
                return '';
        }
    }

    addToLineup(playerId) {
        // Store selected player in lineup (to be implemented with LineupManager)
        this.storage.set(`lineup_player_${playerId}`, true);
        // Show confirmation
        alert('Player added to lineup!');
    }

    showPlayerDetails(playerId) {
        window.location.href = `playerCard.html?id=${playerId}`;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.playersManager = new PlayersManager();
});

export default PlayersManager;