#!/usr/bin/env node

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

program
    .command('new <app-name>')
    .option('--demo-app', 'Create demo app')
    .action(async (appName, options) => {
        const repo = options.demo_app ? 'your-username/your-demo-repo' : 'oldmartijntje/Project-Kazamata';
        const dest = path.resolve(__dirname, `${appName}.tgz`);
        const extractPath = path.resolve(process.cwd(), appName);

        console.log(`Creating a new project in ${extractPath}...`);

        try {
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
