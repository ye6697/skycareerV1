/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Account from './pages/Account';
import ActiveFlights from './pages/ActiveFlights';
import AdminAircraftImages from './pages/AdminAircraftImages';
import CompletedFlightDetails from './pages/CompletedFlightDetails';
import ContractDetails from './pages/ContractDetails';
import Contracts from './pages/Contracts';
import Dashboard from './pages/Dashboard';
import Finances from './pages/Finances';
import Fleet from './pages/Fleet';
import FlightHistory from './pages/FlightHistory';
import FlightMap from './pages/FlightMap';
import FlightTracker from './pages/FlightTracker';
import FreeFlight from './pages/FreeFlight';
import GameSettingsAdmin from './pages/GameSettingsAdmin';
import Landing from './pages/Landing';
import PerformanceCalculator from './pages/PerformanceCalculator';
import Setup from './pages/Setup';
import XPlaneDebug from './pages/XPlaneDebug';
import XPlaneSetup from './pages/XPlaneSetup';
import Leaderboard from './pages/Leaderboard';
import AdminDiscounts from './pages/AdminDiscounts';
import Achievements from './pages/Achievements';
import TypeRatings from './pages/TypeRatings.jsx';
import About from './pages/About.jsx';
import Contact from './pages/Contact.jsx';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Account": Account,
    "ActiveFlights": ActiveFlights,
    "AdminAircraftImages": AdminAircraftImages,
    "CompletedFlightDetails": CompletedFlightDetails,
    "ContractDetails": ContractDetails,
    "Contracts": Contracts,
    "Dashboard": Dashboard,
    "Finances": Finances,
    "Fleet": Fleet,
    "FlightHistory": FlightHistory,
    "FlightMap": FlightMap,
    "FlightTracker": FlightTracker,
    "FreeFlight": FreeFlight,
    "GameSettingsAdmin": GameSettingsAdmin,
    "Landing": Landing,
    "Leaderboard": Leaderboard,
    "AdminDiscounts": AdminDiscounts,
    "Achievements": Achievements,
    "TypeRatings": TypeRatings,
    "PerformanceCalculator": PerformanceCalculator,
    "Setup": Setup,
    "XPlaneDebug": XPlaneDebug,
    "XPlaneSetup": XPlaneSetup,
    "About": About,
    "Contact": Contact,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};