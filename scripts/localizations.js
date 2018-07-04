const axios = require('axios');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs').argv;
const unzip = require('unzip');
const existingSettings = require('../src/extension/features/general/localization/settings');

const API_KEY = yargs.key;
const API_PREFIX = 'https://api.crowdin.com/api/project/toolkit-for-ynab';
const CROWDIN_PARAMS = { json: true, key: API_KEY };

const DOWNLOAD_FILE_PATH = path.join(__dirname, 'all.zip');
const FEATURE_PATH = path.join(__dirname, '..', 'src/extension/features/general/localization');
const LOCALES_PATH = path.join(FEATURE_PATH, 'locales');

if (!API_KEY) {
  console.log('Please supply a Crowdin API key, obtained on this page: http://translate.toolkitforynab.com/project/toolkit-for-ynab/settings#api');
  console.log('Usage: node localization.js --key <KEY>)');
  process.exit();
}

function getProgressedLocalizations() {
  return axios({
    url: `${API_PREFIX}/status`,
    params: CROWDIN_PARAMS
  }).then(({ data }) => {
    return data.filter(({ translated_progress: progress }) => progress !== 0);
  }).catch((error) => {
    console.error('Error fetching status', error);
  });
}

function downloadLocalizations() {
  return axios({
    url: `${API_PREFIX}/export`,
    params: CROWDIN_PARAMS
  }).then(() => {
    return axios({
      url: `${API_PREFIX}/download/all.zip`,
      params: CROWDIN_PARAMS,
      responseType: 'stream'
    }).then((resp) => {
      const file = fs.createWriteStream(DOWNLOAD_FILE_PATH);
      return new Promise((resolve, reject) => {
        resp.data.on('data', (chunk) => {
          file.write(chunk);
        });

        resp.data.on('end', () => {
          resolve();
        });

        resp.data.on('error', (error) => {
          reject(error);
        });
      });
    }).catch((error) => {
      console.error('Error fetching download', error);
    });
  }).catch((error) => {
    console.error('Error initializing export', error);
  });
}

function extractLocalizations(progressed) {
  if (!fs.existsSync(LOCALES_PATH)) {
    fs.mkdirSync(LOCALES_PATH);
  }

  return new Promise((resolve) => {
    const exportedLocalizations = [];

    fs.createReadStream(DOWNLOAD_FILE_PATH)
      .pipe(unzip.Parse())
      .on('entry', (entry) => {
        if (entry.type === 'Directory') {
          return entry.autodrain();
        }

        const [code, name] = entry.path.split(path.sep);
        const [localeName] = name.split('.');
        const progress = progressed.find((status) => status.code === code && status.name === localeName);
        if (progress) {
          const fileName = `${localeName.toLowerCase().replace(',', '').replace(' ', '-')}.json`;
          entry.pipe(fs.createWriteStream(`${LOCALES_PATH}/${fileName}`));
          exportedLocalizations.push({
            fileName,
            progress
          });
        } else {
          entry.autodrain();
        }
      })
      .on('close', () => {
        resolve(exportedLocalizations);
      });
  });
}

function writeIndexFile(exportedLocalizations) {
  const fileExports = exportedLocalizations.map(({ fileName }) => {
    const variableName = fileName.split('.')[0].replace(/-([a-z])/g, (match) => match[1].toUpperCase());
    return `export { default as ${variableName} } from './${fileName}';`;
  });

  fs.writeFileSync(`${LOCALES_PATH}/index.js`, `${fileExports.join('\n')}\n`);
}

function writeSettingsFile(exportedLocalizations) {
  const newSettings = { ...existingSettings };
  newSettings.options = exportedLocalizations.map(({ fileName, progress }) => {
    return { name: `${progress.name} (${progress.translated_progress}%)`, value: fileName.split('.')[0] };
  });

  newSettings.options.unshift({ name: 'Default', value: '0' });
  // magical regex so that the generated settings file matches ESLINT rules...
  fs.writeFileSync(`${FEATURE_PATH}/settings.js`, `module.exports = ${JSON.stringify(newSettings, null, 2).replace(/"([^(")"]+)":/g, '$1:').replace(/"/g, '\'')};\n`);
}

async function main() {
  const progressed = await getProgressedLocalizations();

  await downloadLocalizations();

  const exportedLocalizations = await extractLocalizations(progressed);
  writeIndexFile(exportedLocalizations);
  writeSettingsFile(exportedLocalizations);

  fs.unlinkSync(DOWNLOAD_FILE_PATH);
}

main();
