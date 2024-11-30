// main.js
import DashboardManager from './pages/dashboard.js';
import PlayersManager from './pages/players.js';
import TeamsManager from './pages/teams.js';
import LineupManager from './pages/lineups.js';

class App {
    constructor() {
        this.dashboardManager = new DashboardManager();
        this.playersManager = new PlayersManager();
        this.teamsManager = new TeamsManager();
        this.lineupManager = new LineupManager();
    }

    init() {
        // Initialize managers based on current page
        const page = document.body.dataset.page;
        switch (page) {
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
        }
    }
}

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});