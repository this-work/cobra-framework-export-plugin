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

import { join } from 'path';
import Exporter from './Exporter.class';

let exportAlreadyStarted = false;
let exporter = false;

export default async function(moduleOptions) {

    const { nuxt } = this;

    const nuxtConfig = nuxt.options;

    if (nuxtConfig.publicRuntimeConfig.IS_GENERATE_PROCESS) {

        nuxtConfig.build.extend = (config, loader) => {
            config['output']['publicPath'] = './_nuxt/';
            return config;
        };

        nuxtConfig.router.mode = 'hash';
        nuxtConfig.router.base = './';
        nuxtConfig.generate.manifest = false;
        nuxtConfig.generate.nojekyll = false;

        if (!exportAlreadyStarted) {

            exportAlreadyStarted = true;

            exporter = new Exporter(
                nuxtConfig.publicRuntimeConfig.API,
                nuxtConfig.publicRuntimeConfig.SCORM,
                nuxtConfig.publicRuntimeConfig.SCORM_VERSION
            );

            await exporter.initialize(
                process.env.SCORM_USERNAME,
                process.env.SCORM_PASSWORD,
                process.env.npm_config_entry,
                process.env.npm_config_handle
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

        this.nuxt.hook("generate:done", async (moduleContainer) => {
            exporter.copyAssets();
            exporter.scromTaskManager();

            await exporter.archivePackage(process.env.npm_config_filename, process.env.npm_config_destination);

        });

    }


}
