// main.js
import DashboardManager from './pages/dashboard.js';
import PlayersManager from './pages/players.js';
import TeamsManager from './pages/teams.js';
import LineupManager from './pages/lineups.js';
import { showLoading, hideLoading, updateFooter } from './core/utils.js';

class App {
    constructor() {
        this.dashboardManager = new DashboardManager();
        this.playersManager = new PlayersManager();
        this.teamsManager = new TeamsManager();
        this.lineupManager = new LineupManager();
        this.currentPage = document.body.dataset.page;
    }

    async init() {
        showLoading();
        
        try {
            showLoading();
            // Cleanup any existing intervals before initializing new page
            if (this.dashboardManager) this.dashboardManager.cleanup();
            if (this.playersManager) this.playersManager.cleanup();
            if (this.teamsManager) this.teamsManager.cleanup();
            if (this.lineupManager) this.lineupManager.cleanup();

            switch (this.currentPage) {
                case 'dashboard':
                    this.dashboardManager.init();
                    break;
                case 'players':
                    this.playersManager.init();
                    break;
                case 'teams':
                    this.teamsManager.init();
                    break;
                case 'lineups':
                    this.lineupManager.init();
                    break;
                default:
                    console.warn('No matching page found for:', this.currentPage);
            }
        } catch (error) {
            console.error('Error initializing page:', error);
            updateFooter(`Error initializing page: ${error.message}`);
        } finally {
            hideLoading();
        }
    }
}

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});