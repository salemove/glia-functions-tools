import CLIIntro from './lib/cli/cliIntro.js';
import CLIMainMenu from './lib/cli/cliMainMenu.js';
import dotenv from 'dotenv';
dotenv.config();

const separator = '=============================';

CLIIntro(separator);
CLIMainMenu();
