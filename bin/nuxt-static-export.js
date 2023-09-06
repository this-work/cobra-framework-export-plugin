#!/usr/bin/env node

require('@nuxt/cli')

// import { NuxtCommand, run } from '@nuxt/cli'
//
const cmd = NuxtCommand.from({
    name: 'static-export',
    description: 'Export function for static and SCORM exports',
    usage: 'static-export',
    async run(cmd) {
        const argv = cmd.getArgv()
        console.log(11122233333);
    }
})
//
// run(cmd)
