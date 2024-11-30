// pages/lineups.js
import NFLDataService from '../core/api.js';
import StorageManager from '../core/storage.js';
import { formatters, createElement, clearElement, handleError, sortBy, showLoading, hideLoading, updateFooter } from '../core/utils.js';

class LineupManager {
    constructor() {
        this.api = new NFLDataService();
        this.storage = new StorageManager();
        this.currentLineup = {
            QB: null,
            RB1: null,
            RB2: null,
            WR1: null,
            WR2: null,
            TE: null,
            FLEX: null,
            DST: null
        };
        this.positions = {
            QB: { max: 1, label: 'Quarterback' },
            RB: { max: 2, label: 'Running Back' },
            WR: { max: 2, label: 'Wide Receiver' },
            TE: { max: 1, label: 'Tight End' },
            FLEX: { max: 1, label: 'Flex (RB/WR/TE)' },
            DST: { max: 1, label: 'Defense/Special Teams' }
        };
        this.availablePlayers = [];
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadAvailablePlayers();
        this.loadSavedLineup();
        this.renderLineup();
    }

    setupEventListeners() {
        // Save lineup button
        document.getElementById('save-lineup')?.addEventListener('click', () => {
            this.saveLineup();
        });

        // Optimize lineup button
        document.getElementById('optimize-lineup')?.addEventListener('click', async () => {
            await this.optimizeLineup();
        });

        // Clear lineup button
        document.getElementById('clear-lineup')?.addEventListener('click', () => {
            this.clearLineup();
        });

        // Position dropdowns
        Object.keys(this.currentLineup).forEach(position => {
            document.getElementById(`${position}-select`)?.addEventListener('change', (e) => {
                this.updatePosition(position, e.target.value);
            });
        });
    }

    async loadAvailablePlayers() {
        try {
            showLoading();
            const players = await this.api.getAllActivePlayers();
            this.availablePlayers = await this.enhancePlayersWithProjections(players);
            this.updatePositionDropdowns();
            updateFooter('Available players loaded successfully');
        } catch (error) {
            handleError(error, 'loadAvailablePlayers');
            updateFooter(`Error loading players: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    async enhancePlayersWithProjections(players) {
        return Promise.all(players.map(async player => {
            try {
                const projections = await this.api.getPlayerProjections(player.id);
                return {
                    ...player,
                    projectedPoints: this.calculateProjectedPoints(projections)
                };
            } catch (error) {
                console.warn(`Failed to load projections for player ${player.id}`, error);
                return player;
            }
        }));
    }

    calculateProjectedPoints(projections) {
        if (!projections) return 0;

        // PPR scoring
        return (
            (projections.passing?.yards?.value || 0) * 0.04 +
            (projections.passing?.touchdowns?.value || 0) * 4 +
            (projections.rushing?.yards?.value || 0) * 0.1 +
            (projections.rushing?.touchdowns?.value || 0) * 6 +
            (projections.receiving?.receptions?.value || 0) * 1 +
            (projections.receiving?.yards?.value || 0) * 0.1 +
            (projections.receiving?.touchdowns?.value || 0) * 6
        );
    }

    loadSavedLineup() {
        const savedLineup = this.storage.getLineup();
        if (savedLineup) {
            this.currentLineup = savedLineup;
        }
    }

    saveLineup() {
        if (!this.validateLineup()) {
            alert('Please fill all required positions');
            return;
        }
        this.storage.saveLineup(this.currentLineup);
        alert('Lineup saved successfully!');
    }

    validateLineup() {
        return Object.entries(this.currentLineup).every(([position, player]) => {
            if (position !== 'FLEX') {
                return player !== null;
            }
            return true;
        });
    }

    async optimizeLineup() {
        try {
            const optimal = await this.api.getOptimalLineup();
            this.currentLineup = optimal;
            this.renderLineup();
            alert('Lineup optimized based on projections!');
        } catch (error) {
            handleError(error, 'optimizeLineup');
            alert('Failed to optimize lineup. Please try again.');
        }
    }

    clearLineup() {
        this.currentLineup = Object.keys(this.currentLineup).reduce((acc, pos) => {
            acc[pos] = null;
            return acc;
        }, {});
        this.renderLineup();
    }

    updatePosition(position, playerId) {
        if (playerId === '') {
            this.currentLineup[position] = null;
        } else {
            const player = this.availablePlayers.find(p => p.id === playerId);
            this.currentLineup[position] = player;
        }
        this.renderLineup();
    }

    updatePositionDropdowns() {
        Object.keys(this.currentLineup).forEach(position => {
            const select = document.getElementById(`${position}-select`);
            if (!select) return;

            clearElement(select);

            // Add empty option
            const emptyOption = createElement('option', '', '-- Select Player --');
            emptyOption.value = '';
            select.appendChild(emptyOption);

            // Add available players for position
            this.getEligiblePlayers(position).forEach(player => {
                const option = createElement('option', '', player.fullName);
                option.value = player.id;
                if (this.currentLineup[position]?.id === player.id) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        });
    }

    getEligiblePlayers(position) {
        if (position === 'FLEX') {
            return this.availablePlayers.filter(p => 
                ['RB', 'WR', 'TE'].includes(p.position) &&
                !Object.values(this.currentLineup).some(player => player?.id === p.id)
            );
        }

        return this.availablePlayers.filter(p => 
            p.position === position &&
            !Object.values(this.currentLineup).some(player => player?.id === p.id)
        );
    }

    renderLineup() {
        const container = document.getElementById('lineup-container');
        if (!container) return;

        clearElement(container);

        // Render each position
        Object.entries(this.positions).forEach(([pos, info]) => {
            const positionElement = this.createPositionElement(pos, info);
            container.appendChild(positionElement);
        });

        // Update total projected points
        this.updateProjectedPoints();
    }

    createPositionElement(position, info) {
        const element = createElement('div', 'position-slot');
        
        const players = position === 'RB' || position === 'WR' 
            ? [this.currentLineup[`${position}1`], this.currentLineup[`${position}2`]]
            : [this.currentLineup[position]];

        element.innerHTML = `
            <div class="position-header">
                <h4>${info.label}</h4>
                <span class="max-players">(Max: ${info.max})</span>
            </div>
            ${players.map((player, index) => `
                <div class="player-slot">
                    ${player ? this.renderPlayer(player) : 'Empty Slot'}
                    <select id="${position}${index + 1}-select" class="player-select">
                        <!-- Options populated by updatePositionDropdowns -->
                    </select>
                </div>
            `).join('')}
        `;

        return element;
    }

    renderPlayer(player) {
        return `
            <div class="selected-player">
                <img src="${player.headshot || 'images/genericProfilePic.jpg'}" 
                     alt="${player.fullName}" 
                     class="player-image">
                <div class="player-info">
                    <div class="player-name">${player.fullName}</div>
                    <div class="player-details">
                        ${player.team} - ${player.position}
                    </div>
                    <div class="projected-points">
                        Projected: ${player.projectedPoints?.toFixed(1) || '0.0'}
                    </div>
                </div>
            </div>
        `;
    }

    updateProjectedPoints() {
        const totalPoints = Object.values(this.currentLineup)
            .reduce((total, player) => {
                return total + (player?.projectedPoints || 0);
            }, 0);

        const pointsElement = document.getElementById('total-projected-points');
        if (pointsElement) {
            pointsElement.textContent = `Total Projected Points: ${totalPoints.toFixed(1)}`;
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.lineupManager = new LineupManager();
});

export default LineupManager;