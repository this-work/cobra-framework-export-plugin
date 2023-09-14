const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const rimraf = require('rimraf');
const https = require('https');
const consola = require('consola');
const chalk = require('chalk');
const mkdirp = require('mkdirp');
const fs = require('fs-extra');
const path = require('path');


export default class Exporter {

    constructor(host, scorm, version) {

        this.loginEndpoint = '/?action=users/login';
        this.csrfEndpoint = '/index.php?p=admin/actions/users/session-info&dontExtendSession=1';
        this.entrysEndpoint = '/static-generator/generate/<id>';
        this.api = host;
        this.apiGate = 'api/v1';
        this.jsonPath = 'assets/export';

        this.entryUrlData = undefined;
        this.entryJsons = undefined;
        this.entryAssets = [];

        this.scorm = scorm || false;
        this.scormVersion = version || '1.2';

        this.composer = axiosCookieJarSupport(
            axios.create({
                jar: new tough.CookieJar(null, { rejectPublicSuffixes: false }),
                withCredentials: true,
                baseURL: host,
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false,
                    requestCert: true,
                    keepAlive: true
                })
            })
        );
        https.globalAgent.maxSockets = 100;
    }

    async initialize(username, password, entry, siteHandle) {

        if (this.scorm) {
            consola.info(`Generating ${chalk.bold.cyan('SCORM ' + this.scormVersion)} Export`);
        } else {
            consola.info(`Generating ${chalk.bold.cyan('Static')} Export`);
        }

        await this.login(username, password);

        this.entryUrlData = await this.requestEntryUrls(entry, siteHandle);
        this.entryJsons = await this.requestEntryJsons();

        this.createRouteJsons();

        this.collectAssets();

        this.createEntryJsons();

    }

    async renewCsrfToken() {
        const {
            data: { csrfTokenValue }
        } = await this.composer.get(this.csrfEndpoint).catch(e => {
            consola.error('CSRF TOKEN ERROR:');
            const { response } = e;
            if (response) {
                consola.error(response.data.error || response.statusText);
            } else {
                consola.error(e);
            }
            process.exit(1);
        });

        this.composer.defaults.headers['x-csrf-token'] = csrfTokenValue;
    }

    async login(username, password) {
        await this.renewCsrfToken();

        return await this.composer.post(this.loginEndpoint, {
            loginName: username,
            password: password
        }).catch(({ response }) => {
            consola.error('LOGIN ERROR:');
            consola.error(response.data.error || response.statusText);
            process.exit(1);
        });
    }

    async requestEntryUrls(entry, siteHandle) {

        if (!entry) {
            consola.error("No Craft entry ID present.");
            process.exit(1);
        }
        if (!siteHandle) {
            consola.error("No Craft site handle present");
            process.exit(1);
        }

        const { data } = await this.composer.get(
            this.apiGate + this.entrysEndpoint.replace('<id>', entry)
        ).catch(({ response }) => {
            consola.error('REQUEST ENTRY URLS ERROR:');
            consola.error(response.data.error || response.statusText);
            process.exit(1);
        });

        consola.success("Get list of Entries");

        return data.data.filter(language => language.site.handle === siteHandle)[0];

    }

    async requestEntryJsons() {
        const entryUrls = this.entryUrlData.pages;

        consola.info(`Get the content of ${chalk.bold.cyan(this.entryUrlData.pages.length)} page/s`);

        return Promise.all(
            entryUrls.map(async uri => {

                const { data } = await this.composer.get(
                    this.apiGate + '/' + this.entryUrlData.site.handle + uri
                )
                    .then(data => {
                        consola.success(`- Fetched: ${ data.data.hasOwnProperty('data') ? data.data.data[0].url : data.data.url}`);
                        return data;
                    })
                    .catch(e => {
                        consola.error('REQUEST ENTRY JSONS ERROR:');
                        consola.error(e);
                        process.exit(1);
                    });

                return { [uri]: data };
            })
        );
    };

    getIndexEntryPath() {
        return this.entryUrlData.entry;
    }

    createRouteJsons() {
        this.entryJsons.forEach(json => {
            for (const filePath in json) {

                const target = path.join(
                    process.env.PWD,
                    this.jsonPath,
                    'routes.json'
                );

                mkdirp.sync(path.dirname(target));

                fs.writeFileSync(target, JSON.stringify({index: this.entryUrlData.entry, routes: this.entryUrlData.pages}, null, 4));
            }
        });
    }

    collectAssets() {

        const regexp = new RegExp('\"(' + this.api +'\/)(.[^\\"]*)\"', 'g');
        const regexp33 = new RegExp('\"', 'g');

        const entryJsonsString = JSON.stringify(this.entryJsons)

        let match;
        while ((match = regexp.exec(entryJsonsString)) !== null) {
            this.entryAssets.push(match[0].replace(regexp33, ''));
        }

        const regexp2 = new RegExp(this.api +'\/', 'g');
        this.entryJsons = JSON.parse(entryJsonsString.replace(regexp2, "./"));

        const target = path.join(
            process.env.PWD,
            this.jsonPath,
            'assets.json'
        );

        mkdirp.sync(path.dirname(target));
        fs.writeFileSync(target, JSON.stringify(this.entryAssets, null, 4));

    }

    createEntryJsons() {
        this.entryJsons.forEach(json => {
            for (const filePath in json) {

                const target = path.join(
                    process.env.PWD,
                    this.jsonPath,
                    filePath + '.json'
                );

                const content = json[filePath];

                mkdirp.sync(path.dirname(target));
                fs.writeFileSync(target, JSON.stringify(content, null, 4));
            }
        });
    }

}
