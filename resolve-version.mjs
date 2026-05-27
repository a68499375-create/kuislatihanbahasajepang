import { request } from 'https';
import fs from 'fs';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'node.js',
      }
    };
    request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject).end();
  });
}

function parseSemver(v) {
  return v.replace(/^v/, '').split('.').map(x => parseInt(x, 10) || 0);
}

function compareSemver(v1, v2) {
  const p1 = parseSemver(v1);
  const p2 = parseSemver(v2);
  for (let i = 0; i < 3; i++) {
    if (p1[i] > p2[i]) return 1;
    if (p1[i] < p2[i]) return -1;
  }
  return 0;
}

function incrementPatch(v) {
  const parts = v.replace(/^v/, '').split('.');
  if (parts.length === 3) {
    parts[2] = (parseInt(parts[2], 10) + 1).toString();
  } else {
    parts.push('1');
  }
  return parts.join('.');
}

async function run() {
  try {
    console.log('Fetching latest release from GitHub...');
    const url = 'https://api.github.com/repos/a68499375-create/kuislatihanbahasajepang/releases/latest';
    const release = await fetchJson(url);
    
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    const packageJsonVersion = pkg.version;
    console.log(`Version in package.json: ${packageJsonVersion}`);

    let latestReleaseVersion = '0.0.0';
    if (release && release.tag_name) {
      latestReleaseVersion = release.tag_name.replace(/^v/, '');
      console.log(`Latest release tag found: v${latestReleaseVersion}`);
    } else {
      console.log('No releases found on GitHub.');
    }
    
    // Always increment the maximum of the latest release and the current package.json version
    // to prevent duplicate release errors and ensure the version is strictly auto-incrementing.
    const maxVersion = compareSemver(latestReleaseVersion, packageJsonVersion) >= 0 ? latestReleaseVersion : packageJsonVersion;
    const targetVersion = incrementPatch(maxVersion);
    console.log(`Auto-incremented version to: ${targetVersion}`);
    
    // Update package.json
    pkg.version = targetVersion;
    fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
    console.log(`Successfully updated package.json version to ${targetVersion}`);
    
    // Output for Github Actions env
    if (process.env.GITHUB_ENV) {
      fs.appendFileSync(process.env.GITHUB_ENV, `APP_VERSION=${targetVersion}\n`);
      console.log(`Saved APP_VERSION=${targetVersion} to GITHUB_ENV`);
    }
  } catch (err) {
    console.error('Error resolving version:', err.message);
    process.exit(1);
  }
}

run();
