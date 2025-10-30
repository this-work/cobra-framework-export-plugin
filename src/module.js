/**
 * Cobra-Export
 *
 * @description Vue/Nuxt module integration for a elastic search wrapper.
 * Requires a minimal version of nuxt 2.15+
 *
 * @version 1.0.0
 * @author Charly Wolf
 * @author Tobias Wöstmann
 *
 */

const fs = require('fs-extra');
import { join } from 'path';
import Exporter from './Exporter.class';

let exportAlreadyStarted = false;
let exporter = false;

export default async function(moduleOptions) {

    const { nuxt } = this;

    const nuxtConfig = nuxt.options;

    if (nuxtConfig.publicRuntimeConfig.EXPORT) {

        nuxtConfig.build.extend = (config, loader) => {
            config['output']['publicPath'] = './_nuxt/';
            return config;
        };

        nuxtConfig.router.mode = 'hash';
        nuxtConfig.router.base = './';
        nuxtConfig.generate.manifest = false;
        nuxtConfig.generate.nojekyll = false;
        nuxtConfig.generate.dir = 'export/dist';

        if (!exportAlreadyStarted) {

            exportAlreadyStarted = true;

            exporter = new Exporter(
                nuxtConfig.publicRuntimeConfig.API,
                nuxtConfig.publicRuntimeConfig.SCORM,
                nuxtConfig.publicRuntimeConfig.SCORM_VERSION
            );

            await exporter.initialize(
                process.env.EXPORT_USERNAME,
                nuxtConfig.publicRuntimeConfig.EXPORT_PASSWORD,
                process.env.EXPORT_ENTRY,
                process.env.EXPORT_HANDLE
            );

        }

        nuxtConfig.router.extendRoutes = (routes, resolve) => {
            routes.push(
                {
                    path: '',
                    redirect: exporter.getIndexEntryPath()
                }
            )
        }

        this.nuxt.hook("generate:done", async (generator, errors) => {

            if (errors.length > 0) {

                fs.writeFileSync(
                    generator.options.generate.dir + '/error.log',
                    JSON.stringify(
                        { 'routes': Array.from(generator.generatedRoutes),
                            'errors': errors.map(error => {
                                return {
                                    type: error.type,
                                    route: error.route,
                                    error: error.error.toString()
                                };
                            }) }
                    )
                );
            } else {

                fs.writeFileSync(
                    generator.options.generate.dir + '/success.log',
                    'success'
                );

                exporter.copyAssets();
                exporter.scromTaskManager();

                await exporter.archivePackage(process.env.EXPORT_FILENAME, process.env.EXPORT_DESTINATION);

            }

        });

        this.addPlugin({
            src: join(__dirname, 'export.js'),
            fileName: 'cobra-framework/export.js'
        });

        if (nuxtConfig.publicRuntimeConfig.SCORM) {
            this.addPlugin({
                src: join(__dirname, 'scorm/' + nuxtConfig.publicRuntimeConfig.SCORM_VERSION + '/tracking.js'),
                fileName: 'cobra-framework/scorm.js'
            });
        }

    }

}
