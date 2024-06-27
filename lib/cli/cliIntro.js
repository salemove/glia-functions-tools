import chalk from 'chalk';

const CLIIntro = (separator) => {

	console.log(chalk.hex('#7C19DE').bold(` #####                     #######                                                   
#     # #      #   ##      #       #    # #    #  ####  ##### #  ####  #    #  ####  
#       #      #  #  #     #       #    # ##   # #    #   #   # #    # ##   # #      
#  #### #      # #    #    #####   #    # # #  # #        #   # #    # # #  #  ####  
#     # #      # ######    #       #    # #  # # #        #   # #    # #  # #      # 
#     # #      # #    #    #       #    # #   ## #    #   #   # #    # #   ## #    # 
 #####  ###### # #    #    #        ####  #    #  ####    #   #  ####  #    #  ####  `))
	console.log(chalk.italic('v0.1.0'))
	console.log(separator)

}

export default CLIIntro