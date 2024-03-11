require('dotenv').config();

const execSync = require('child_process').execSync;

const martinCommand = `martin -c config.yaml`;

try {
	execSync(martinCommand, { stdio: 'inherit' });
} catch (error) {
	console.error('Error running Martin command:', error.message);
	process.exit(1);
}
