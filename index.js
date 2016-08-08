const https = require('https');
const parseURL = require('url').parse;
const util = require('util');
const COLORS = {
    'reset': '\033[0m',
    'black': '\033[30m',
    'red': '\033[31m',
    'green': '\033[32m',
    'yellow': '\033[33m',
    'blue': '\033[34m',
    'magenta': '\033[35m',
    'cyan': '\033[36m',
    'white': '\033[37m'
};
const debug = {
    log() { console.log(...arguments); },
    success() { console.log(COLORS.green, ...arguments, COLORS.reset); },
    warn() { console.log(COLORS.yellow, ...arguments, COLORS.reset); },
    info() { console.log(COLORS.blue, ...arguments, COLORS.reset); },
    error() { console.log(COLORS.red, ...arguments, COLORS.reset); }
};
const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
const GITHUB_API_URL = 'https://api.github.com';

function fetch(url, cb) {
    let parts = parseURL(url);
    let opts = {
        host: parts,
        hostname: parts.hostname,
        path: parts.pathname,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'User-agent':'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)'
        },
        method: 'GET'
    }

    debug.info('Request: ', url);

    let req = https.get(opts, (res) => {
        let body = '';

        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            if (body === '{}') {
                cb(null);
            } else {
                cb(JSON.parse(body));
            }
        });
    });

    req.end();
    req.on('error', (e) => {
        debug.error(e);
    });
}

function getGitHubPath(url) {
    let rest = url
        .replace('git+ssh://git@github.com/', '')
        .replace('git://github.com/', '')
        .replace('.git', '');

    return `${GITHUB_API_URL}/repos/${rest}`;
}

let argv = process.argv.slice(2);
let pkgName = argv[0];

if (!pkgName) {
    debug.error('Package name cannot be empty\n');
    process.exit(1);
}

let pkgURL = `${NPM_REGISTRY_URL}/${pkgName}`;

fetch(pkgURL, (res) => {
    if (!res) {
        debug.error('No module has been found');
        process.exit(1);
    }

    let hasGitHub = (res.repository && res.repository.type === 'git');
    let result = {
        name: res.name,
        versions: res['dist-tags'],
        last_modified: res.time.modified,
        www: res.homepage,
        repository: res.repository,
        author: res.author
    };

    if (!hasGitHub) {
        debug.warn('Module has no github repository...');
        debug.log(util.inspect(result, { depth: 2 }));
        process.exit(1);
    }

    let ghURL = getGitHubPath(res.repository.url)
    fetch(ghURL, (ghData) => {
        result.github = {
            name: ghData.name,
            stargazers_count: ghData.stargazers_count,
            updated_at: ghData.updated_at,
            subscribers_count: ghData.subscribers_count,
            forks_count: ghData.forks_count,
            open_issues_count: ghData.open_issues_count
        };

        debug.log(JSON.stringify(result, null, 4));
    });
});
