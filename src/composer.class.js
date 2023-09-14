const axios = require('axios');
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const rimraf = require('rimraf');
const https = require('https');

export default class Composer {

    constructor(host, name, password) {

        this.loginEndpoint = '/?action=users/login';
        this.csrfEndpoint = '/index.php?p=admin/actions/users/session-info&dontExtendSession=1';
        this.entrysEndpoint = '/static-generator/generate/<id>';
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

        login(name, password);

    }

    async renewCsrfToken() {
        const {
            data: { csrfTokenValue }
        } = await this.composer.get(this.csrfEndpoint).catch(e => {
            console.error('CSRF TOKEN ERROR:');
            const { response } = e;
            if (response) {
                console.error(response.data.error || response.statusText);
            } else {
                console.error(e);
            }
            process.exit(1);
        });

        this.composer.defaults.headers['x-csrf-token'] = csrfTokenValue;
    }

    async login(name, password) {
        await this.renewCsrfToken();

        return await this.composer.post(this.loginEndpoint, {
            loginName: name,
            password: password
        }).catch(({ response }) => {
            console.error('LOGIN ERROR:');
            console.error(response.data.error || response.statusText);
            process.exit(1);
        });
    }

    async get(entry) {

        const { data } = await this.composer.get(
            this.entrysEndpoint.replace('<id>', entry)
        ).catch(({ response }) => {
            console.error('REQUEST ENTRY URLS ERROR:');
            console.error(response.data.error || response.statusText);
            process.exit(1);
        });

        return data.data;

    }

}
