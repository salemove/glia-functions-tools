import chalk from 'chalk';

const logNetworkError = error => {
    console.log(chalk.red(`> Network error: ${error}`));
}

export {
    logNetworkError
}