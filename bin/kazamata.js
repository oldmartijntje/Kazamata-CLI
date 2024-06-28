#!/usr/bin/env node
const CLI_VERSION = '1.1.0'
const OLDEST_COMPATIBLE_KAZAMATA_VERSION = '1.2.0'

const DEMO_URL = 'oldmartijntje/Project-Kazamata'
const BASE_URL = 'oldmartijntje/Project-Kazamata'
const ALLOW_DEMO = false
const CANCELL_IF_FOLDER_HAS = ['index.html', 'package.json', 'main.js', 'config.js', 'vite.config.js'] // make empty to skip this check
// const CANCELL_IF_FOLDER_HAS = []

const { Command } = require('commander');
const axios = require('axios');
const tar = require('tar');
const fs = require('fs');
const path = require('path');
const program = new Command();

// Function to get the default branch (main or master)
async function getDefaultBranch(repo) {
    const repoUrl = `https://api.github.com/repos/${repo}`;
    const response = await axios.get(repoUrl);
    return response.data.default_branch;
}

async function warn(message) {
    const chalk = (await import('chalk')).default;
    console.log(chalk.bgYellow.black(' WARNING ') + ' ' + chalk.yellow(message));
}

async function error(message) {
    const chalk = (await import('chalk')).default;
    console.log(chalk.bgRed.black(' ERROR ') + ' ' + chalk.red(message));
}

// Function to download and extract a GitHub release
async function downloadRelease(repo, dest, nonRelease = false) {
    let url = '';
    let versionInfo = '';
    if (nonRelease) {
        const defaultBranch = await getDefaultBranch(repo);
        url = `https://github.com/${repo}/tarball/${defaultBranch}`;
        const commitUrl = `https://api.github.com/repos/${repo}/commits/${defaultBranch}`;
        const commitResponse = await axios.get(commitUrl);
        versionInfo = { 'version': commitResponse.data.sha, type: 'commit' };
    } else {
        const releaseUrl = `https://api.github.com/repos/${repo}/releases/latest`;
        const response = await axios.get(releaseUrl);
        url = response.data.tarball_url;
        versionInfo = { 'version': response.data.tag_name, type: 'release' };
    }

    console.log('Downloading from:', url);

    const writer = fs.createWriteStream(dest);
    const responseTar = await axios.get(url, { responseType: 'stream' });
    responseTar.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(versionInfo));
        writer.on('error', reject);
    });
}

/**
 * 
 * @param {*} version Current version (needs to be newer)
 * @param {*} neededVersion Needed version (oldest compatible version)
 * @returns 
 */
function compatibleVersion(version, neededVersion) {
    const versionParts = version.split('.').map(Number);
    const neededVersionParts = neededVersion.split('.').map(Number);

    for (let i = 0; i < neededVersionParts.length; i++) {
        if (versionParts[i] > neededVersionParts[i]) {
            return true;
        } else if (versionParts[i] < neededVersionParts[i]) {
            return false;
        }
    }

    return true;
}

// Function to extract the tarball
async function extractTarball(tarballPath, extractPath) {
    await tar.x({
        file: tarballPath,
        cwd: extractPath,
        strip: 1
    });
}

// Ensure the directory exists before extracting the tarball
async function ensureDirectoryExists(directory) {
    return fs.promises.mkdir(directory, { recursive: true });
}

program
    .command('new <app-name>')
    .option('--demo-app', 'Create demo app')
    .option('--latest-commit', 'Latest commit instead of latest release')
    .action(async (appName, options) => {
        if (options.demoApp && !ALLOW_DEMO) {
            console.log('Demo app does not exist yet. Cancelling...');
            return;
        }

        if (fs.existsSync(appName) && CANCELL_IF_FOLDER_HAS.length > 0) {
            const files = fs.readdirSync(appName)
            for (const file of files) {
                if (CANCELL_IF_FOLDER_HAS.includes(file)) {
                    error('Detected existing project. Cancelling...');
                    return;
                }
            }
        }

        const repo = options.demoApp ? DEMO_URL : BASE_URL;
        const dest = path.resolve(__dirname, `${appName}.tgz`);
        const extractPath = path.resolve(process.cwd(), appName);

        console.log(`Creating a new project in ${extractPath}...`);

        try {
            await ensureDirectoryExists(extractPath);
            const versionInfo = await downloadRelease(repo, dest, options.latestCommit);
            await extractTarball(dest, extractPath);
            fs.unlinkSync(dest);
            console.log('Project created successfully!');

            // Read kazamata.json
            const kazamataJson = require(path.resolve(extractPath, 'kazamata.json'));
            kazamataJson['kazamata-cli']['generated'] = true;
            kazamataJson['kazamata-cli']['generated-from'] = repo;
            kazamataJson['kazamata-cli']['generated-version'] = versionInfo;
            kazamataJson['kazamata-cli']['CLI-version'] = CLI_VERSION;
            if (versionInfo.tpye == 'release') {
                kazamataJson['version'] = versionInfo.version;
            }

            fs.writeFileSync(path.resolve(extractPath, 'kazamata.json'), JSON.stringify(kazamataJson, null, 2));

            const neededVersion = kazamataJson['kazamata-cli']['oldest-compatible-version']
            console.log(`${process.version} = Current Node.js version`)
            console.log(kazamataJson);
            if (!compatibleVersion(CLI_VERSION, neededVersion)) {
                await warn(`This Kazamata project is not compatible with the current Kazamata-CLI version (v${CLI_VERSION}), it needs CLI v${neededVersion}+. Please update your CLI version.\nDo \`npm install -g kazamata-cli@latest\` to update your CLI version.`);
                return;
            }
        } catch (errorMsg) {
            await error('An error occurred while creating the project.\n\n' + errorMsg);
        }
    });

program
    .command('generate <type> <name>')
    .action(async (type, name) => {
        const extractPath = process.cwd();
        let kazamataJson;
        try {
            kazamataJson = require(path.resolve(extractPath, 'kazamata.json'));
        } catch (errorMsg) {
            await error('This directory is not a Kazamata project.\n\n' + errorMsg);
            return
        }
        const neededVersion = kazamataJson['kazamata-cli']['oldest-compatible-version']
        const version = kazamataJson['version']
        console.log(`Generating ${type} named ${name}...`);

        if (!compatibleVersion(CLI_VERSION, neededVersion)) {
            await warn(`This Kazamata project is not compatible with the current Kazamata-CLI version (v${CLI_VERSION}), it needs CLI v${neededVersion}+. Please update your CLI version.\nDo \`npm install -g kazamata-cli@latest\` to update your CLI version.`);
            await error('Generation cancelled because of incompatible CLI version.\n\nUsing an outdated CLI to generate code can lead to errors and incompatibilities. Please update your CLI version.');
            return;
        }
        else if (!compatibleVersion(version, OLDEST_COMPATIBLE_KAZAMATA_VERSION)) {
            await warn(`This Kazamata project (v${version}) is not compatible with the Kazamata CLI version, the CLI is for a newer version, which supports Kazamata v${OLDEST_COMPATIBLE_KAZAMATA_VERSION}+. Please update your project version, or get a compatible CLI version.`);
            await error('Generation cancelled because of incompatible project version.\n\nGenerating code with an incompatible generator can lead to errors and incompatibilities. Please update your project version or downgrade the CLI version.');
            return;
        }
        // Add your generation logic here
    });

program.parse(process.argv);
