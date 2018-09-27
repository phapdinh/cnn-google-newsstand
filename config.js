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


const nconf = require('nconf');



// whitelist environment variables
nconf.env([
    'BUSINESS_SECTIONS',
    'CLOUDAMQP_AUTH',
    'DYNAIMAGE_AUTH',
    'ENVIRONMENT',
    'GNS_BLACK_LIST',
    'GNS_GENERIC_THUMB_IMAGE',
    'GNS_TASK_INTERVAL_MS',
    'GNS_ENABLE_ELECTION_STORY',
    'GNS_ELECTION_MODULE_TEST',
    'GNS_ELECTION_TITLE',
    'GNS_ELECTION_IMG_ENV',
    'GNS_ELECTION_SLUG',
    'GNS_ELECTION_CAPTION',
    'GNS_ELECTION_STORY_CONSTANT_UPDATE',
    'GNS_ELECTION_STORY_CONSTANT_UPDATE_URL',
    'GNS_ELECTION_LOWER_HEADER',
    'GNS_ELECTION_MODULE_LINK_1',
    'GNS_ELECTION_MODULE_LINK_2',
    'GNS_ENABLE_INLINE_GALLERIES',
    'GNS_MONITORING_TEST',
    'HYPATIA_TIMEOUT',
    'HYPATIA_HOST',
    'ACCESS_KEY_ID',
    'SECRET_ACCESS_KEY',
    'PORT',
    'LOGZIO_TOKEN'
]);



// These are required to be set to start up
if (!nconf.get('ENVIRONMENT') || !nconf.get('PORT') || !nconf.get('CLOUDAMQP_AUTH') || !nconf.get('LOGZIO_TOKEN') || !nconf.get('ACCESS_KEY_ID') || !nconf.get('SECRET_ACCESS_KEY') || !nconf.get('DYNAIMAGE_AUTH')) {
    console.error('ENVIRONMENT, PORT, CLOUDAMQP_AUTH, LOGZIO_TOKEN, ACCESS_KEY_ID, DYNAIMAGE_AUTH and/or SECRET_ACCESS_KEY are not set');
    process.exit(1);
}

let blackList = '\\/studentnews\\/,\\/videos\\/spanish\\/,fast-facts\\/index.html$,\\/applenews-live.*,\\/cnn.com\\/\\d{4}\\/\\d{2}\\/\\d{2}\\/cnn-info,\\/vr\\/,\\/cnn-underscored\\/',
    config = {
        default: {
            cloudamqpConnectionString: `amqp://${nconf.get('CLOUDAMQP_AUTH')}@red-rhino.rmq.cloudamqp.com/cnn-towncrier`,
            gnsBlackList: (nconf.get('GNS_BLACK_LIST')) ? nconf.get('GNS_BLACK_LIST') : blackList,
            gnsTaskIntervalMS: (nconf.get('GNS_TASK_INTERVAL_MS')) ? parseInt(nconf.get('GNS_TASK_INTERVAL_MS')) : 1000 * 60 * 30, // 30 minutes
            lsdHosts: 'lsd-prod-pub-cop.turner.com,lsd-prod-pub-56m.turner.com',
            exchangeName: 'cnn-town-crier-ref',
            queueNameArticles: `cnn-google-newsstand-articles-${nconf.get('ENVIRONMENT').toLowerCase()}`,
            queueNameVideos: `cnn-google-newsstand-videos-${nconf.get('ENVIRONMENT').toLowerCase()}`,
            // TODO: remove when Money feed is decommissioned
            routingKeysArticles: ['cnn.article', 'money.article', 'cnn.gallery'],
            routingKeysVideos: ['cnn.video'],
            adbpTrackingURL: 'https://smetrics.cnn.com/b/ss/cnnoffsitedev',
            gnsTurnOnElectionModule: (nconf.get('GNS_ENABLE_ELECTION_STORY')) ? nconf.get('GNS_ENABLE_ELECTION_STORY') : false,
            gnsElectionModuleTest: (nconf.get('GNS_ELECTION_MODULE_TEST')) ? nconf.get('GNS_ELECTION_MODULE_TEST') : false,
            gnsElectionSlug: (nconf.get('GNS_ELECTION_SLUG')) ? nconf.get('GNS_ELECTION_SLUG') : 'what-is-the-hatch-act',
            gnsElectionCaption: (nconf.get('GNS_ELECTION_CAPTION')) ? nconf.get('GNS_ELECTION_CAPTION') : 'A candidate needs 270 Electoral College votes to win the presidency. These modules show the total Electoral College votes and when a state has a projected winner (Maine and Nebraska allow Electoral College votes to be split). Not all candidates are listed. All party representation can be seen in the full results. CNN will broadcast a projected winner only after an extensive review of data from a number of sources.',
            gnsElectionTitle: (nconf.get('GNS_ELECTION_TITLE')) ? nconf.get('GNS_ELECTION_TITLE') : '<h3 class="style-id:presResultsHeader"><span class="style-id:presResultsHeader">Presidential Results</span></h3>',
            gnsElectionStoryConstantUpdate: (nconf.get('GNS_ELECTION_STORY_CONSTANT_UPDATE')) ? nconf.get('GNS_ELECTION_STORY_CONSTANT_UPDATE') : false,
            gnsElectionStoryConstantUpdateURL: (nconf.get('GNS_ELECTION_STORY_CONSTANT_UPDATE_URL')) ? nconf.get('GNS_ELECTION_STORY_CONSTANT_UPDATE_URL') : 'http://www.cnn.com/2016/10/28/politics/trump-bus-denmark-trnd/index.html',
            gnsElectionModuleLowerHeader: (nconf.get('GNS_ELECTION_LOWER_HEADER')) ? nconf.get('GNS_ELECTION_LOWER_HEADER') : 'Election Day Highlights',
            gnsElectionModuleLink1: (nconf.get('GNS_ELECTION_MODULE_LINK_1')) ? nconf.get('GNS_ELECTION_MODULE_LINK_1') : '<p class="style-id:electionLinks"><a class="style-id:electionLink" href="http://www.cnn.com/election/results">Full&nbsp;Election&nbsp;Results</a> | <a class="style-id:electionLink" href="http://www.cnn.com/election/president">Presidential</a> | <a class="style-id:electionLink" href="http://www.cnn.com/election/senate">Senate</a></p>',
            gnsElectionModuleLink2: (nconf.get('GNS_ELECTION_MODULE_LINK_2')) ? nconf.get('GNS_ELECTION_MODULE_LINK_2') : '<p class="style-id:electionLinks2"><a class="style-id:electionLink" href="http://www.cnn.com/election/house">House</a> | <a class="style-id:electionLink" href="http://www.cnn.com/election/governor">Governer</a> | <a class="style-id:electionLink" href="http://www.cnn.com/election/ballot-measures">Ballot&nbsp;Measures</a> | <a class="style-id:electionLink" href="http://www.cnn.com/election/results/exit-polls">Exit&nbsp;Polls</a> | <a class="style-id:electionLink" href="http://www.cnn.com/election/results/states">States</a></p>',
            gnsElectiomImgEnv: (nconf.get('GNS_ELECTION_IMG_ENV')) ? nconf.get('GNS_ELECTION_IMG_ENV') : nconf.get('ENVIRONMENT'),
            gnsEnableInlineGalleries: (nconf.get('GNS_ENABLE_INLINE_GALLERIES')) ? nconf.get('GNS_ENABLE_INLINE_GALLERIES') : false,
            gnsMonitoringTest: (nconf.get('GNS_MONITORING_TEST')) ? nconf.get('GNS_MONITORING_TEST') : false,
            gnsGenericThumbImage: (nconf.get('GNS_GENERIC_THUMB_IMAGE')) ? nconf.get('GNS_GENERIC_THUMB_IMAGE') : 'http://www.cnn.com/partners/google/gns/default-exlarge-169.png',
            hypatia: {
                timeout: (process.env.HYPATIA_TIMEOUT) ? parseInt(process.env.HYPATIA_TIMEOUT) : 1000 * 5,
                host: (process.env.HYPATIA_HOST) ? process.env.HYPATIA_HOST :  'https://hypatia.api.cnn.com/'
            },
            aws: {
                accessKeyId: nconf.get('ACCESS_KEY_ID'),
                secretAccessKey: nconf.get('SECRET_ACCESS_KEY'),
                region: 'us-east-1',
                bucket: 'registry.api.cnn.io'
            },
            logConfig: (typeof process.env.CUSTOMER === 'undefined') ? null : {logzio: {tag: `cnn-google-newsstand-${nconf.get('ENVIRONMENT').toLowerCase()}`}},
            sections: {
                business: nconf.get('BUSINESS_SECTIONS') ? nconf.get('BUSINESS_SECTIONS') : '\/business|success|india|media|perspectives|investing|cars|economy|energy|homes\/'
            }
        },
        prod: {
            cloudamqpConnectionString: `amqp://${nconf.get('CLOUDAMQP_AUTH')}@red-rhino.rmq.cloudamqp.com/cnn-towncrier`,
            exchangeName: 'cnn-town-crier-prod',
            queueNameArticles: 'cnn-google-newsstand-articles-prod',
            queueNameVideos: 'cnn-google-newsstand-videos-prod',
            adbpTrackingURL: 'https://smetrics.cnn.com/b/ss/cnn-adbp-offsite-domestic'
        }
    };


// load the correct config based on environment
switch (nconf.get('ENVIRONMENT').toLowerCase()) {
    case 'prod':
        nconf.defaults(config.prod);
        break;


    default:
        nconf.defaults(config.default);
}



// Load overrides that don't override anything, they fill in the blanks
nconf.overrides(config.default);



module.exports = nconf;
