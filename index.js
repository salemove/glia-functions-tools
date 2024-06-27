import CLIIntro from './lib/cli/cliIntro.js';
import CLIMainMenu from './lib/cli/cliMainMenu.js';
import CLISetup from './lib/cli/cliSetup.js';
import CLIAuth from './lib/cli/cliAuth.js';
import CLIBuildMenu from './lib/cli/cliBuildMenu.js';
import dotenv from 'dotenv';
dotenv.config();

const separator = '=============================';

CLIIntro(separator);
CLIMainMenu();
