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
        // this.init(); let main.js do this.
    }

    async init() {
        this.setupEventListeners();
        await this.loadTeams();
    }

    cleanup() {
        // Similar to players.js
        ['conference-filter', 'division-filter', 'sort-options'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.replaceWith(element.cloneNode(true));
            }
        });
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
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
        const currentYear = new Date().getFullYear();
        const seasonType = 2; // Regular season
    
        return Promise.all(teams.map(async teamData => {
            const team = teamData.team;
    
            try {
                const teamId = team.id;
    
                // Fetch team betting stats and trends as before
                const [stats, bettingTrends] = await Promise.all([
                    this.api.getTeamBettingStats(teamId),
                    this.api.getTeamTrends(teamId),
                ]);
    
                // Fetch the record details from the record endpoint
                const recordResponse = await fetch(
                    `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${currentYear}/types/${seasonType}/teams/${teamId}/record`
                );
                const recordData = await recordResponse.json();
    
                // Locate the "overall" record using the "name" field
                const overallRecord = recordData.items.find((record) => record.name === 'overall');
    
                // Extract wins, losses, and ties from stats
                const winsStat = overallRecord?.stats.find(stat => stat.name === 'wins');
                const lossesStat = overallRecord?.stats.find(stat => stat.name === 'losses');
                const tiesStat = overallRecord?.stats.find(stat => stat.name === 'ties');
    
                const wins = winsStat?.value || 0;
                const losses = lossesStat?.value || 0;
                const ties = tiesStat?.value || 0;
    
                const totalGames = wins + losses + ties;
                const winPercentage = totalGames > 0 ? wins / totalGames : 0;
    
                return {
                    ...teamData,
                    team: {
                        ...team,
                        wins,
                        losses,
                        ties,
                    },
                    winPercentage,
                    stats,
                    bettingTrends,
                };
            } catch (error) {
                console.warn(`Failed to load stats for team ${team.id}`, error);
                return {
                    ...teamData,
                    team: {
                        ...team,
                        wins: 0,
                        losses: 0,
                        ties: 0,
                    },
                    winPercentage: 0,
                    stats: {},
                    bettingTrends: {},
                };
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
            <div class="team-record">${this.formatRecord(team)}</div>
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

    formatRecord(team) {
        const wins = team.team.wins || 0;
        const losses = team.team.losses || 0;
        const ties = team.team.ties || 0;
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

export default TeamsManager;