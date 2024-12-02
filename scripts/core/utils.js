// core/utils.js
import CONFIG from './config.js';

const REQUIRED_API_FIELDS = {
    PLAYER: ['id', 'fullName', 'position'],
    TEAM: ['id', 'name', 'abbreviation'],
    GAME: ['id', 'homeTeam', 'awayTeam', 'startTime'],
    ODDS: ['spread', 'moneyline', 'overUnder']
};

// Data validation
export const validateApiResponse = (data, type) => {
    if (!data) {
        console.warn(`Empty data received for ${type}`);
        return false;
    }

    if (typeof data !== 'object') {
        console.warn(`Invalid data type received for ${type}: ${typeof data}`);
        return false;
    }

    const requiredFields = REQUIRED_API_FIELDS[type];
    const hasFields = requiredFields.some(field => data.hasOwnProperty(field));

    if (!hasFields) {
        console.debug(`Missing required fields for ${type}:`, requiredFields);
        return false;
    }

    return true;
};

// New data validation (will i use it idk)

// export const validateApiResponse = (data, type) => {
//     if (!data) return false;
//     return typeof data === 'object';
// };

// Old formatters

// export const formatters = {
//     currency: (amount) => new Intl.NumberFormat('en-US', {
//         style: 'currency',
//         currency: 'USD'
//     }).format(amount),
    
//     percentage: (value) => `${(value * 100).toFixed(1)}%`,
    
//     date: (date) => new Intl.DateTimeFormat('en-US').format(new Date(date))
// };

// Formatting utilities
export const formatters = {
    currency: (amount) => new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0
    }).format(amount),

    percentage: (value) => `${(value * 100).toFixed(1)}%`,

    score: (value) => value?.toString() || '0',

    playerName: (firstName, lastName) => `${firstName} ${lastName}`,

    dateTime: (isoString) => {
        const date = new Date(isoString);
        return date.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }
};

// Dont need this anymore

// export const calculators = {
//     fantasyPoints: (stats) => {
//         // Fantasy scoring logic
//     },
    
//     winProbability: (teamStats, opponentStats) => {
//         // Win probability calculation
//     }
// };


// Fantasy scoring calculations
export const calculateFantasyPoints = (stats, scoring = 'PPR') => {
    const scoringRules = CONFIG.SCORING[scoring];
    if (!stats) return 0;

    return (
        (stats.passing?.yards?.value || 0) * scoringRules.PASS_YD +
        (stats.passing?.touchdowns?.value || 0) * scoringRules.PASS_TD +
        (stats.passing?.interceptions?.value || 0) * scoringRules.INT +
        (stats.rushing?.yards?.value || 0) * scoringRules.RUSH_YD +
        (stats.rushing?.touchdowns?.value || 0) * scoringRules.RUSH_TD +
        (stats.receiving?.receptions?.value || 0) * scoringRules.REC +
        (stats.receiving?.yards?.value || 0) * scoringRules.REC_YD +
        (stats.receiving?.touchdowns?.value || 0) * scoringRules.REC_TD
    );
};

// DOM utilities
export const createElement = (tag, className, textContent = '') => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (textContent) element.textContent = textContent;
    return element;
};

export const clearElement = (element) => {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
};

// Error handling
export const handleError = (error, context) => {
    console.error(`Error in ${context}:`, error);
    // Could add error reporting service here
    return null;
};

// Data sorting
export const sortBy = (array, key, descending = false) => {
    return [...array].sort((a, b) => {
        const aVal = typeof a[key] === 'string' ? a[key].toLowerCase() : a[key];
        const bVal = typeof b[key] === 'string' ? b[key].toLowerCase() : b[key];
        
        if (aVal < bVal) return descending ? 1 : -1;
        if (aVal > bVal) return descending ? -1 : 1;
        return 0;
    });
};

export default {
    validateApiResponse,
    formatters,
    calculateFantasyPoints,
    createElement,
    clearElement,
    handleError,
    sortBy
};

export const showLoading = () => {
    document.getElementById('loading-overlay')?.classList.remove('hidden');
    updateFooter('Loading...');
  };
  
  export const hideLoading = () => {
    document.getElementById('loading-overlay')?.classList.add('hidden');
  };
  
  export const updateFooter = (message) => {
    const footer = document.getElementById('last-updated');
    if (footer) {
      footer.textContent = `${message} • ${new Date().toLocaleTimeString()}`;
    }
  };