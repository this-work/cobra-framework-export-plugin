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
const fetch = require('node-fetch');
const ejs = require('ejs');ejs
const archiver = require('archiver');

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

        this.cleanDirs();

        this.entryUrlData = await this.requestEntryUrls(entry, siteHandle);
        this.entryJsons = await this.requestEntryJsons();

        this.createRouteJsons();

        this.createIdJson();

        await this.collectAssets();

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

    cleanDirs() {
        try {
            rimraf.sync(path.join(
                process.env.PWD,
                this.jsonPath,
                'assets'
            ));
            rimraf.sync(path.join(
                process.env.PWD,
                this.jsonPath,
                'data'
            ));
            rimraf.sync(path.join(
                process.env.PWD,
                'export/dist'
            ));
        } catch (err) {
            console.error(`Error while deleting ${dir} or export/dist.`);
        }
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

        if (!this.entryUrlData) {
            consola.error("No Craft entry is present with given entry ID.");
            process.exit(1);
        }

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

    createIdJson() {

        const idList = {
            playlists: {},
            quizzes: {}
        };

        this.entryJsons.forEach(page => {
            const pageUrl = Object.keys(page).join();

            if (pageUrl.search('/playlists/') >= 0) {
                idList.playlists[page[pageUrl].data[0].id] = pageUrl;
            }
            if (pageUrl.search('/quizzes/') >= 0) {
                idList.quizzes[page[pageUrl].id] = pageUrl;
            }

        });

        const target = path.join(
            process.env.PWD,
            this.jsonPath,
            'ids.json'
        );

        fs.writeFileSync(target, JSON.stringify(idList, null, 4));

    }

    async collectAssets() {

        consola.info(`Get all assets`);

        const regexp = new RegExp('\"(' + this.api +'\/)(.[^\\"]*)\"', 'g');
        const regexp33 = new RegExp('\"', 'g');

        const entryJsonsString = JSON.stringify(this.entryJsons)

        let match;
        while ((match = regexp.exec(entryJsonsString)) !== null) {
            this.entryAssets.push(match[0].replace(regexp33, ''));
        }

        const regexp99 = new RegExp('\"\/assets(.[^\\"]*)\"', 'g');
        let match2;
        while ((match2 = regexp99.exec(entryJsonsString)) !== null) {
            this.entryAssets.push(this.api + match2[0].replace(regexp33, ''));
        }

        const regexp2 = new RegExp(this.api +'\/', 'g');
        const regexp9933 = new RegExp('\"\/assets\/', 'g');
        this.entryJsons = JSON.parse(entryJsonsString.replace(regexp2, "./").replace(regexp9933, '"./assets/'));

        const target = path.join(
            process.env.PWD,
            this.jsonPath,
            'assets.json'
        );

        mkdirp.sync(path.dirname(target));
        fs.writeFileSync(target, JSON.stringify(this.entryAssets, null, 4));

        await Promise.all(this.entryAssets.map(async asset => {

            const splittedAsset = asset.split('/');

            let assetPathArray = splittedAsset.slice(3);
            const assetName = assetPathArray.pop();
            const assetPath = assetPathArray.join('/');

            fs.mkdirSync(path.join(
                process.env.PWD,
                'assets/export/assets/' + assetPath,
            ), { recursive: true })

            return await fetch(asset).then(res =>
                res.body.pipe(fs.createWriteStream(path.join(
                        process.env.PWD,
                        'assets/export/assets/' + assetPath,
                        assetName
                    )
                ))
            )
        }));

        consola.success("Collected all assets");

    }

    copyAssets() {

        const srcDir = path.join(
            process.env.PWD,
            this.jsonPath + '/assets'
        );
        const destDir = path.join(
            process.env.PWD,
            'export/dist'
        );
        fs.copySync(srcDir, destDir, { overwrite: true })

    }

    scromTaskManager() {
        if (this.scorm) {
            this.copyScormData();
            this.addScormManifest();
        }
    }

    copyScormData() {

        consola.info("Get all SCORM files");

        const srcDir = path.join(
            __dirname,
            'scorm/' + this.scormVersion + '/static'
        );

        const destDir = path.join(
            process.env.PWD,
            'export/dist'
        );

        fs.copySync(srcDir, destDir, { overwrite: true });

    }

    addScormManifest (organization, description, keyword) {

        const routes = JSON.parse(fs.readFileSync(path.join(
            process.env.PWD,
            this.jsonPath + '/routes.json'
        ), 'utf8'));

        let routeIndexPath = routes.index;

        const entryContent = JSON.parse(fs.readFileSync(path.join(
            process.env.PWD,
            this.jsonPath + '/data' + routeIndexPath + '.json'
        ), 'utf8'));

        const data = {
            organization: process.env.npm_package_name || 'default',
            description: process.env.EXPORT_SCORM_DESCRIPTION,
            keyword: process.env.EXPORT_SCORM_KEYWORD
        };

        if (routeIndexPath.search('/quizzes/') >= 0) {
            data['title'] = entryContent.meta.title;
        } else {
            data['title'] = entryContent.data[0].stage.heading.headline;
        }

        try {

            let manifest = fs.readFileSync(path.join(__dirname, 'scorm/' + this.scormVersion ) + '/imsmanifest.xml', 'utf-8');
            manifest = ejs.render( manifest, data );
            fs.writeFileSync(path.join( process.env.PWD, 'export/dist') + '/imsmanifest.xml', manifest, 'utf8');

        } catch (e) {
            console.log(e);
        }

        consola.success("Generated all SCORM files");

    }

    createEntryJsons() {
        this.entryJsons.forEach(json => {
            for (const filePath in json) {

                const target = path.join(
                    process.env.PWD,
                    this.jsonPath + '/data',
                    filePath + '.json'
                );

                const content = json[filePath];

                mkdirp.sync(path.dirname(target));
                fs.writeFileSync(target, JSON.stringify(content, null, 4));
            }
        });
    }

    async archivePackage(filename, destination) {

        return new Promise((resolve, reject) => {

            if (!destination) {
                destination = 'export/'
            }

            if (!fs.existsSync(destination)) {
                fs.mkdirSync(destination, { recursive: true });
            }

            if (!filename) {
                const dateNow = new Date();

                const date = ('0' + dateNow.getDate()).slice(-2);
                const month = ('0' + (dateNow.getMonth() + 1)).slice(-2);
                const year = dateNow.getFullYear();

                filename = `${destination}export_${year + '-' + month + '-' + date + '_' + dateNow.getHours() + '-' + dateNow.getMinutes()}`;
            } else {
                filename = destination + filename;
            }

            const output = fs.createWriteStream(filename + '.zip');
            const archive = archiver('zip');

            archive.pipe(output);

            archive.directory('export/dist', false);
            archive.finalize();

            output.on('finish', () => {
                resolve(filename);
                if (this.scorm) {
                    consola.success(`${chalk.bold.cyan('SCORM ' + this.scormVersion)} Export completed`);
                } else {
                    consola.success(`${chalk.bold.cyan('Static')} Export completed`);
                }
                consola.info(`The export was stored in ${chalk.bold.gray(filename)}`);
            });
            output.on('error', reject);

        });



    }

}
