#!/usr/bin/env node

const DEMO_URL = 'oldmartijntje/Project-Kazamata'
const BASE_URL = 'oldmartijntje/Project-Kazamata'
const ALLOW_DEMO = false
const CANCELL_IF_FOLDER_HAS = ['index.html', 'package.json'] // make empty to skip this check

const { Command } = require('commander');
const axios = require('axios');
const tar = require('tar');
const fs = require('fs');
const path = require('path');
const program = new Command();

// Function to download and extract a GitHub release
async function downloadRelease(repo, dest) {
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const response = await axios.get(url);
    const tarballUrl = response.data.tarball_url;

    const writer = fs.createWriteStream(dest);
    const responseTar = await axios.get(tarballUrl, { responseType: 'stream' });
    responseTar.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
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
    .action(async (appName, options) => {
        if (options.demoApp && !ALLOW_DEMO) {
            console.log('Demo app does not exist yet. Cancelling...');
            return;
        }

        if (fs.existsSync(appName) && CANCELL_IF_FOLDER_HAS.length > 0) {
            const files = fs.readdirSync(appName)
            for (const file of files) {
                if (CANCELL_IF_FOLDER_HAS.includes(file)) {
                    console.log('Detected existing project. Cancelling...');
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
            await downloadRelease(repo, dest);
            await extractTarball(dest, extractPath);
            fs.unlinkSync(dest);
            console.log('Project created successfully!');
        } catch (error) {
            console.error('Error creating project:', error);
        }
    });

program
    .command('generate <type> <name>')
    .action((type, name) => {
        console.log(`Generating ${type} named ${name}...`);
        // Add your generation logic here
    });

program.parse(process.argv);
