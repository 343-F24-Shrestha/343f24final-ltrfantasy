// pages/teams.js
import NFLDataService from '../core/api.js';
import StorageManager from '../core/storage.js';
import { formatters, createElement, clearElement, handleError, sortBy, showLoading, hideLoading, updateFooter } from '../core/utils.js';

class TeamsManager {
    constructor() {
        this.api = new NFLDataService();
        this.storage = new StorageManager();
        this.teams = [];
        this.filters = {
            division: 'ALL',
            conference: 'ALL',
            search: ''
        };
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadTeams();
    }

    setupEventListeners() {
        // Search input
        document.getElementById('team-search')?.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.renderTeams();
        });

        // Conference filter
        document.getElementById('conference-filter')?.addEventListener('change', (e) => {
            this.filters.conference = e.target.value;
            this.renderTeams();
        });

        // Division filter
        document.getElementById('division-filter')?.addEventListener('change', (e) => {
            this.filters.division = e.target.value;
            this.renderTeams();
        });

        // Sort options
        document.getElementById('sort-options')?.addEventListener('change', (e) => {
            this.renderTeams(e.target.value);
        });
    }

    async loadTeams() {
        try {
            showLoading();
            const teams = await this.api.getAllTeams();
            this.teams = await this.enhanceTeamsWithStats(teams);
            this.renderTeams();
            updateFooter('Team data loaded successfully');
        } catch (error) {
            handleError(error, 'loadTeams');
            updateFooter(`Error loading teams: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    async enhanceTeamsWithStats(teams) {
        return Promise.all(teams.map(async team => {
            try {
                const stats = await this.api.getTeamBettingStats(team.team.id);
                const bettingTrends = await this.api.getTeamTrends(team.team.id);
                return {
                    ...team,
                    stats,
                    bettingTrends
                };
            } catch (error) {
                console.warn(`Failed to load stats for team ${team.team.id}`, error);
                return team;
            }
        }));
    }

    filterTeams() {
        return this.teams.filter(team => {
            const matchesConference = this.filters.conference === 'ALL' || 
                                    team.team.conference === this.filters.conference;
            const matchesDivision = this.filters.division === 'ALL' || 
                                  team.team.division === this.filters.division;
            const matchesSearch = team.team.name.toLowerCase()
                                .includes(this.filters.search.toLowerCase());
            
            return matchesConference && matchesDivision && matchesSearch;
        });
    }

    renderTeams(sortKey = 'winPercentage') {
        const container = document.getElementById('teams-container');
        if (!container) return;

        clearElement(container);
        
        const filteredTeams = this.filterTeams();
        const sortedTeams = sortBy(filteredTeams, sortKey, true);

        sortedTeams.forEach(team => {
            const teamCard = this.createTeamCard(team);
            container.appendChild(teamCard);
        });
    }

    createTeamCard(team) {
        const card = createElement('div', 'team-card');
        
        card.innerHTML = `
            <div class="team-header">
                <img src="${team.team.logos?.[0]?.href || 'images/genericLogo.jpg'}" 
                     alt="${team.team.name} logo" 
                     class="team-logo">
                <h3>${team.team.name}</h3>
                <div class="team-record">${this.formatRecord(team.stats)}</div>
            </div>
            <div class="team-stats">
                <div class="stat-column">
                    <div class="stat">
                        <label>Points Per Game</label>
                        <value>${team.stats?.offense?.pointsPerGame?.value?.toFixed(1) || '0.0'}</value>
                    </div>
                    <div class="stat">
                        <label>Points Allowed</label>
                        <value>${team.stats?.defense?.pointsAllowed?.value?.toFixed(1) || '0.0'}</value>
                    </div>
                </div>
                <div class="stat-column">
                    <div class="stat">
                        <label>ATS Record</label>
                        <value>${this.formatAtsRecord(team.bettingTrends)}</value>
                    </div>
                    <div class="stat">
                        <label>Over/Under</label>
                        <value>${this.formatOverUnder(team.bettingTrends)}</value>
                    </div>
                </div>
            </div>
            <div class="team-trends">
                <h4>Betting Trends</h4>
                ${this.renderBettingTrends(team.bettingTrends)}
            </div>
            <div class="team-actions">
                <button onclick="showTeamSchedule(${team.team.id})" class="view-schedule">
                    View Schedule
                </button>
                <button onclick="showTeamDetails(${team.team.id})" class="view-details">
                    View Details
                </button>
            </div>
        `;

        return card;
    }

    formatRecord(stats) {
        const wins = stats?.overall?.wins?.value || 0;
        const losses = stats?.overall?.losses?.value || 0;
        const ties = stats?.overall?.ties?.value || 0;
        return `${wins}-${losses}${ties > 0 ? `-${ties}` : ''}`;
    }

    formatAtsRecord(trends) {
        const wins = trends?.ats?.record?.wins || 0;
        const losses = trends?.ats?.record?.losses || 0;
        return `${wins}-${losses} ATS`;
    }

    formatOverUnder(trends) {
        const overs = trends?.overUnder?.overs?.value || 0;
        const unders = trends?.overUnder?.unders?.value || 0;
        return `O/U: ${overs}-${unders}`;
    }

    renderBettingTrends(trends) {
        if (!trends) return 'No trend data available';

        return `
            <div class="trends-grid">
                <div class="trend">
                    <label>Home</label>
                    <value>${trends.situational?.homeStraightUp?.value || '0-0'}</value>
                </div>
                <div class="trend">
                    <label>Away</label>
                    <value>${trends.situational?.awayStraightUp?.value || '0-0'}</value>
                </div>
                <div class="trend">
                    <label>As Favorite</label>
                    <value>${trends.situational?.asFavorite?.value || '0-0'}</value>
                </div>
                <div class="trend">
                    <label>As Underdog</label>
                    <value>${trends.situational?.asUnderdog?.value || '0-0'}</value>
                </div>
            </div>
        `;
    }

    showTeamSchedule(teamId) {
        window.location.href = `schedule.html?team=${teamId}`;
    }

    showTeamDetails(teamId) {
        window.location.href = `teamCard.html?id=${teamId}`;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.teamsManager = new TeamsManager();
});

export default TeamsManager;