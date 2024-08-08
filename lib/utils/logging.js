import chalk from 'chalk';

const logNetworkError = error => {
    console.log(chalk.red(`> Error: ${JSON.stringify(error)}`));
}

export {
    logNetworkError
}