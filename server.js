/*
 * Copyright 2016 Turner Broadcasting System, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const hapi = require('cnn-hapi'),
    config = require('./config.js'),
    pkg = require('./package.json'),
    healthCheck = require('./tasks/healthcheck.js');

global.gnsHealthStatus = {
    status: 201,
    testMode: config.get('gnsMonitoringTest'),
    sectionFeeds: {
        business: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        us: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        world: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        politics: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        entertainment: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        tech: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        latest: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        // TODO: Remove once business feed is confirmed in production
        money: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        health: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        opinions: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        videos: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        elections: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        style: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        travel: {
            status: 201,
            generateFeed: {status: 'Pending'}
        },
        winterOlympics2018: {
            status: 201,
            generateFeed: {status: 'Pending'}
        }
    }
};

let server = module.exports = hapi({
    directory: __dirname,
    port: process.env.PORT,
    withSwagger: true,
    name: 'CNN Google Newsstand',
    description: 'Google Newsstand feed generator',
    version: pkg.version
});

process.on('unhandledRejection', function (error, promise) {
    console.error(`Possible unhandled rejection at: Promise ${JSON.stringify(promise)} reason: ${error.stack}`);
});

server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {
        reply.redirect('/documentation');
    }
});

server.route({
    method: 'GET',
    path: '/_healthcheck',
    handler: function healthcheckHandler(request, reply) {
        let checks = healthCheck.getStatus();

        checks.version = pkg.version;
        reply(checks);
    },
    config: {
        description: 'Healthcheck',
        notes: 'Health of the app',
        tags: ['api', 'healthcheck']
    }
});

server.start(function () {
    console.log(`Server running at ${JSON.stringify(server.info.uri)}`);
    console.log('Configuration:');
    console.log(`    ENVIRONMENT: ${config.get('ENVIRONMENT')}`);
    console.log(`    PORT: ${config.get('PORT')}`);
    console.log(`    GNS_TASK_INTERVAL_MS: ${config.get('GNS_TASK_INTERVAL_MS')}`);

    require('./tasks/google-newsstand-articles.js');
    require('./tasks/google-newsstand-videos.js');
});
