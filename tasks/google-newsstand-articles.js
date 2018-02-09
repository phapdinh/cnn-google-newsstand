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

/* global gnsHealthStatus*/
'use strict';

const request = require('request'),
    AWS = require('aws-sdk'),
    _ = require('underscore'),
    moment = require('moment'),
    maxKeys = 1000,
    FeedGenerator = require('../lib/feed-generator.js'),
    amqp = require('amqplib/callback_api'),
    debugLog = require('debug')('cnn-google-newsstand:Task:google-newsstand-latest'),
    config = require('../config.js'),
    cloudamqpConnectionString = config.get('cloudamqpConnectionString'),
    latestFG = new FeedGenerator(),
    electionsFG = new FeedGenerator(),
    entertainmentFG = new FeedGenerator(),
    healthFG = new FeedGenerator(),
    moneyFG = new FeedGenerator(),
    opinionsFG = new FeedGenerator(),
    politicsFG = new FeedGenerator(),
    styleFG = new FeedGenerator(),
    techFG = new FeedGenerator(),
    travelFG = new FeedGenerator(),
    usFG = new FeedGenerator(),
    worldFG = new FeedGenerator(),
    winterOlympics2018FG = new FeedGenerator(),
    enableElectionStory = config.get('gnsTurnOnElectionModule'),
    logConfig = config.get('logConfig'),
    log = require('cnn-logger')(logConfig);

function processCNNMessage(message) {
    let mappedToASection = false;

    debugLog(`AMQP Message: ${message.fields.routingKey}: ${message.content.toString()}`);
    debugLog(`Adding url to latest feed: ${JSON.parse(message.content.toString()).url}`);
    latestFG.urls = JSON.parse(message.content.toString()).url;

    if (/\/entertainment\//.test(JSON.parse(message.content.toString()).url)) {
        debugLog(`Adding url to entertainment feed: ${JSON.parse(message.content.toString()).url}`);
        entertainmentFG.urls = JSON.parse(message.content.toString()).url;
        mappedToASection = true;
    }

    if (/\/politics\//.test(JSON.parse(message.content.toString()).url)) {
        debugLog(`Adding url to politics feed: ${JSON.parse(message.content.toString()).url}`);
        politicsFG.urls = JSON.parse(message.content.toString()).url;
        mappedToASection = true;
    }

    if (/\/health\//.test(JSON.parse(message.content.toString()).url)) {
        debugLog(`Adding url to health feed: ${JSON.parse(message.content.toString()).url}`);
        healthFG.urls = JSON.parse(message.content.toString()).url;
        mappedToASection = true;
    }

    if (/\/opinions|opinion\//.test(JSON.parse(message.content.toString()).url)) {
        debugLog(`Adding url to opinions feed: ${JSON.parse(message.content.toString()).url}`);
        opinionsFG.urls = JSON.parse(message.content.toString()).url;
        mappedToASection = true;
    }

    // https://regex101.com/r/mpdbJ2/1
    if (/\/architecture|arts|autos|design|fashion|luxury|style\//.test(JSON.parse(message.content.toString()).url)) {
        debugLog(`Adding url to style feed: ${JSON.parse(message.content.toString()).url}`);
        styleFG.urls = JSON.parse(message.content.toString()).url;
        mappedToASection = true;
    }

    if (/\/travel|aviation|hotels\//.test(JSON.parse(message.content.toString()).url)) {
        debugLog(`Adding url to travel feed: ${JSON.parse(message.content.toString()).url}`);
        travelFG.urls = JSON.parse(message.content.toString()).url;
        mappedToASection = true;
    }

    if (/\/tech\//.test(JSON.parse(message.content.toString()).url)) {
        debugLog(`Adding url to tech feed: ${JSON.parse(message.content.toString()).url}`);
        techFG.urls = JSON.parse(message.content.toString()).url;
        mappedToASection = true;
    }

    if (/\/us|crime|justice\//.test(JSON.parse(message.content.toString()).url)) {
        debugLog(`Adding url to us feed: ${JSON.parse(message.content.toString()).url}`);
        usFG.urls = JSON.parse(message.content.toString()).url;
        mappedToASection = true;
    }

    if (/\/world\//.test(JSON.parse(message.content.toString()).url)) {
        debugLog(`Adding url to world feed: ${JSON.parse(message.content.toString()).url}`);
        worldFG.urls = JSON.parse(message.content.toString()).url;
        mappedToASection = true;
    }

    if (JSON.parse(message.content.toString()).branding && JSON.parse(message.content.toString()).branding === '2016-elections') {
        debugLog(`Adding url to election feed: ${JSON.parse(message.content.toString()).url}`);
        electionsFG.urls = JSON.parse(message.content.toString()).url;
        mappedToASection = true;
    }

    if (JSON.parse(message.content.toString()).branding && JSON.parse(message.content.toString()).branding === 'winter-olympics') {
        debugLog(`Adding url to winter Olympics 2018 feed: ${JSON.parse(message.content.toString()).url}`);
        winterOlympics2018FG.urls = JSON.parse(message.content.toString()).url;
        mappedToASection = true;
    }

    if (!mappedToASection) {
        debugLog(`${JSON.parse(message.content.toString()).url} - DEFAULTING to world feed`);
        worldFG.urls = JSON.parse(message.content.toString()).url;
    }

}

function processCNNMoneyMessage(message)  {

    let theURL = JSON.parse(message.content.toString()).url;

    if (/\/technology\//.test(JSON.parse(message.content.toString()).url)) {
        debugLog(`Adding url to tech feed: ${theURL}`);
        techFG.urls = theURL;
    }
    debugLog(`Adding url to money feed: ${theURL}`);
    moneyFG.urls = theURL;
}

// connect to CloudAMQP and use/create the queue to subscribe to
amqp.connect(cloudamqpConnectionString, (error, connection) => {
    connection.createChannel((error, channel) => {
        const exchangeName = config.get('exchangeName');

        channel.assertExchange(exchangeName, 'topic', {durable: true});

        channel.assertQueue(config.get('queueNameArticles'), {durable: true}, (error, queueName) => {
            const routingKeys = config.get('routingKeysArticles');

            routingKeys.forEach((routingKey) => {
                channel.bindQueue(queueName.queue, exchangeName, routingKey);
            });

            channel.prefetch(1);

            channel.consume(
                queueName.queue,
                (message) => {

                    switch (message.fields.routingKey) {
                        // CNN CONTENT
                        case 'cnn.article':
                        case 'cnn.video':
                        case 'cnn.gallery':
                            processCNNMessage(message);
                            break;
                        // MONEY CONTENT
                        case 'money.article':
                            processCNNMoneyMessage(message);
                            break;

                        default:
                            debugLog(`Message routing key ${message.fields.routingKey}`);
                    }

                    channel.ack(message);
                },
                {noAck: false, exclusive: true}
            );
        });
    });
});

let s3Images = undefined;

function filterImages(data) {
    let filteredImages = [],
        contents = data,
        image,
        i;
    for (i in contents) {
        image = contents[i];
        if (image.Key.includes('.png')) {
            filteredImages.push({
                time: image.LastModified,
                url: `http://registry.api.cnn.io/${image.Key}`
            });
        }
    }

    filteredImages = _.sortBy(filteredImages, function (o) {
        return new Date(o.time).getTime();
    });

    return filteredImages;
}

/**
 * List keys from the specified bucket.
 *
 * If providing a prefix, only keys matching the prefix will be returned.
 *
 * If providing a delimiter, then a set of distinct path segments will be
 * returned from the keys to be listed. This is a way of listing "folders"
 * present given the keys that are there.
 *
 * @param {Object} options
 * @param {String} options.bucket - The bucket name.
 * @param {String} [options.prefix] - If set only return keys beginning with
 *   the prefix value.
 * @param {String} [options.delimiter] - If set return a list of distinct
 *   folders based on splitting keys by the delimiter.
 * @param {Function} callback - Callback of the form function (error, string[]).
 */
function listKeys(options, callback) {
    var keys = [];

    /**
    * Recursively list keys.
    *
    * @param {String|undefined} marker - A value provided by the S3 API
    *   to enable paging of large lists of keys. The result set requested
    *   starts from the marker. If not provided, then the list starts
    *   from the first key.
    */
    function listKeysRecusively(marker) {

        options.marker = marker;

        listKeyPage(options, function (error, nextMarker, keyset) {
            if (error) {
                return callback(error, keys);
            }

            keys = keys.concat(keyset);

            if (nextMarker) {
                listKeysRecusively(nextMarker);
            } else {
                callback(null, keys);
            }
        });
    }

    // Start the recursive listing at the beginning, with no marker.
    listKeysRecusively();
}

/**
 * List one page of a set of keys from the specified bucket.
 *
 * If providing a prefix, only keys matching the prefix will be returned.
 *
 * If providing a delimiter, then a set of distinct path segments will be
 * returned from the keys to be listed. This is a way of listing "folders"
 * present given the keys that are there.
 *
 * If providing a marker, list a page of keys starting from the marker
 * position. Otherwise return the first page of keys.
 *
 * @param {Object} options
 * @param {String} options.bucket - The bucket name.
 * @param {String} [options.prefix] - If set only return keys beginning with
 *   the prefix value.
 * @param {String} [options.delimiter] - If set return a list of distinct
 *   folders based on splitting keys by the delimiter.
 * @param {String} [options.marker] - If set the list only a paged set of keys
 *   starting from the marker.
 * @param {Function} callback - Callback of the form
    function (error, nextMarker, keys).
 */
function listKeyPage(options, callback) {
    let params = {
            Bucket: options.bucket,
            Delimiter: options.delimiter,
            Marker: options.marker,
            MaxKeys: maxKeys,
            Prefix: options.prefix
        },
        s3Client,
        awsConfig = {accessKeyId: config.get('aws').accessKeyId, secretAccessKey: config.get('aws').secretAccessKey, region: 'us-east-1'};


    AWS.config.update(awsConfig);
    s3Client = new AWS.S3();

    s3Client.listObjects(params, function (error, response) {
        if (error) {
            return callback(error);
        } else if (response.err) {
            return callback(new Error(response.err));
        }

        // Convert the results into an array of key strings, or
        // common prefixes if we're using a delimiter.
        var keys, nextMarker, lastKey;
        if (options.delimiter) {
          // Note that if you set MaxKeys to 1 you can see some interesting
          // behavior in which the first response has no response.CommonPrefix
          // values, and so we have to skip over that and move on to the
          // next page.
            keys = _.map(response.CommonPrefixes, function (item) {
                return item.Prefix;
            });
        } else {
            keys = _.map(response.Contents, function (item) {
                return item;
            });
        }

        // Check to see if there are yet more keys to be obtained, and if so
        // return the marker for use in the next request.
        if (response.IsTruncated) {
            if (options.delimiter) {
                // If specifying a delimiter, the response.NextMarker field exists.
                nextMarker = response.NextMarker;
            } else {
                // For normal listing, there is no response.NextMarker
                // and we must use the last key instead.
                lastKey = keys[keys.length - 1];


                nextMarker = lastKey.Key;
            }
        }

        callback(null, nextMarker, keys);
    });
}


function getImagesFromAWS() {
    return new Promise(function (fulfill) {

        listKeys({
            bucket: config.get('aws').bucket,
            prefix: `assets/img/opp/ksa/${config.get('gnsElectiomImgEnv')}/gns/`
        }, function (error, keys) {
            if (error) {
                console.log('Error retrieving images from s3', error);
                log.error(`Error retrieving images from s3: ${error}`);
                fulfill({error: 'Error retrieving images from s3'});
            }

            console.log('Successfully retrieved images from s3, about to fulfill... keys.length: ', keys.length);
            log.debug(`Successfully retrieved images from s3, about to fulfill... keys.length: ${keys.length}`);
            fulfill(filterImages(keys));
        });
    });
}

function isConstantPublishedAlreadyThere(urls, electionStoryUrl) {
    let isStoryThere = false;

    if (urls && urls.length && urls.length > 0) {
        urls.some((url) => {
            if (electionStoryUrl === url) {
                isStoryThere = true;
            }
        });
    }

    return isStoryThere;
}


if ((enableElectionStory === true || enableElectionStory === 'true')
    || (config.get('gnsElectionModuleTest') === true || config.get('gnsElectionModuleTest') === 'true')) {
    s3Images = getImagesFromAWS();
}

function postToLSD(data, feedName) {
    let suffix = (config.get('ENVIRONMENT') === 'prod') ? '' : `-${config.get('ENVIRONMENT')}`,
        endpoint = `/cnn/content/google-newsstand/${feedName}${suffix}.xml`,
        hosts = config.get('lsdHosts');

    debugLog('postToLSD() called');
    log.debug('postToLSD() called');


    hosts.split(',').forEach((host) => {
        request.post({
            url: `http://${host}${endpoint}`,
            body: data,
            headers: {'Content-Type': 'application/rss+xml'}
        },
        (error/* , response, body*/) => {
            if (error) {
                debugLog(error.stack);
                log.error(error.stack);
            } else {
                debugLog(`Successfully uploaded data to ${hosts} at ${endpoint}`);
                log.debug(`Successfully uploaded data to ${hosts} at ${endpoint}`);

            }
        });
    });
}


// brute force.  This is not the final solution, but it works just fine
setInterval(() => {
    debugLog('Generate latest Feed interval fired');
    log.debug('Generate latest Feed interval fired');
    gnsHealthStatus.sectionFeeds.latest = {status: 201, valid: false, generateFeed: {status: 'processing'}};
    console.log('inside latest: ', gnsHealthStatus.sectionFeeds.latest);

    if ((enableElectionStory === true || enableElectionStory === 'true')  && s3Images) {
        let constantElectionStoryUpdate = config.get('gnsElectionStoryConstantUpdate'),
            constantElectionStoryUpdateURL = config.get('gnsElectionStoryConstantUpdateURL');

        if ((constantElectionStoryUpdate === 'true' || constantElectionStoryUpdate === true)
            && constantElectionStoryUpdateURL) {
            if (!isConstantPublishedAlreadyThere(latestFG.urls, constantElectionStoryUpdateURL)) {
                latestFG.urls = constantElectionStoryUpdateURL;
            }
        }
    }

    if (latestFG.urls && latestFG.urls.length > 0) {

        if (config.get('gnsTurnOnElectionModule') === true || config.get('gnsTurnOnElectionModule') === 'true') {
            s3Images = getImagesFromAWS();
            s3Images.then(function (data) {

                let electionData = {
                    s3Data: data
                };

                latestFG.processContent(electionData).then(
                    // success
                    (rssFeed) => {
                        console.log(rssFeed);

                        postToLSD(rssFeed, 'latest');

                        // post to LSD endpoint
                        latestFG.urls = 'clear';
                        debugLog(latestFG.urls);
                    },

                    // failure
                    (error) => {
                        console.log(error);
                        log.error(error);
                    }
                );
            });
        } else {

            latestFG.processContent().then(
                // success
                (rssFeed) => {
                    console.log(rssFeed);

                    postToLSD(rssFeed, 'latest');

                    // update health check status
                    gnsHealthStatus.sectionFeeds.latest.status = 200;
                    gnsHealthStatus.sectionFeeds.latest.valid = true;
                    gnsHealthStatus.sectionFeeds.latest.generateFeed.status = 'success';
                    gnsHealthStatus.sectionFeeds.latest.generateFeed.lastUpdate = moment().toISOString();

                    // post to LSD endpoint
                    latestFG.urls = 'clear';
                    debugLog(latestFG.urls);
                },

                // failure
                (error) => {
                    gnsHealthStatus.sectionFeeds.latest.status = 500;
                    gnsHealthStatus.sectionFeeds.latest.valid = false;
                    gnsHealthStatus.sectionFeeds.latest.generateFeed.status = 'failed';
                    gnsHealthStatus.sectionFeeds.latest.generateFeed.failedAt = moment().toISOString();

                    console.log(error);
                    log.error(error);
                }
            );
        }
    } else {
        gnsHealthStatus.sectionFeeds.latest.status = 200;
        gnsHealthStatus.sectionFeeds.latest.valid = true;
        gnsHealthStatus.sectionFeeds.latest.generateFeed.status = 'No updates';
        debugLog('no updates');
        log.debug('Generate latest Feed: no updates');
    }
}, config.get('gnsTaskIntervalMS'));

setInterval(() => {
    debugLog('Generate entertainment Feed interval fired');
    log.debug('Generate entertainment Feed interval fired');
    gnsHealthStatus.sectionFeeds.entertainment = {status: 201, valid: false, generateFeed: {status: 'processing'}};

    if (entertainmentFG.urls && entertainmentFG.urls.length > 0) {
        entertainmentFG.processContent().then(
            // success
            (rssFeed) => {
                console.log(rssFeed);

                postToLSD(rssFeed, 'entertainment');

                // update health check status
                gnsHealthStatus.sectionFeeds.entertainment.status = 200;
                gnsHealthStatus.sectionFeeds.entertainment.valid = true;
                gnsHealthStatus.sectionFeeds.entertainment.generateFeed.status = 'success';
                gnsHealthStatus.sectionFeeds.entertainment.generateFeed.lastUpdate = moment().toISOString();

                // post to LSD endpoint
                entertainmentFG.urls = 'clear';
                debugLog(entertainmentFG.urls);
            },

            // failure
            (error) => {
                gnsHealthStatus.sectionFeeds.entertainment.status = 500;
                gnsHealthStatus.sectionFeeds.entertainment.valid = false;
                gnsHealthStatus.sectionFeeds.entertainment.generateFeed.status = 'failed';
                gnsHealthStatus.sectionFeeds.entertainment.generateFeed.failedAt = moment().toISOString();
                console.log(error);
                log.error(error);
            }
        );
    } else {
        gnsHealthStatus.sectionFeeds.entertainment.status = 200;
        gnsHealthStatus.sectionFeeds.entertainment.valid = false;
        gnsHealthStatus.sectionFeeds.entertainment.generateFeed.status = 'No updates';
        debugLog('no updates');
        log.debug('Generate entertainment Feed: no updates');
    }
}, config.get('gnsTaskIntervalMS'));

setInterval(() => {
    debugLog('Generate health Feed interval fired');
    log.debug('Generate health Feed interval fired');
    gnsHealthStatus.sectionFeeds.health = {status: 201, valid: false, generateFeed: {status: 'processing'}};

    if (healthFG.urls && healthFG.urls.length > 0) {
        healthFG.processContent().then(
            // success
            (rssFeed) => {
                console.log(rssFeed);

                postToLSD(rssFeed, 'health');

                // update health check status
                gnsHealthStatus.sectionFeeds.health.status = 200;
                gnsHealthStatus.sectionFeeds.health.valid = true;
                gnsHealthStatus.sectionFeeds.health.generateFeed.status = 'success';
                gnsHealthStatus.sectionFeeds.health.generateFeed.lastUpdate = moment().toISOString();

                // post to LSD endpoint
                healthFG.urls = 'clear';
                debugLog(healthFG.urls);
            },

            // failure
            (error) => {
                gnsHealthStatus.sectionFeeds.health.status = 500;
                gnsHealthStatus.sectionFeeds.health.valid = false;
                gnsHealthStatus.sectionFeeds.health.generateFeed.status = 'failed';
                gnsHealthStatus.sectionFeeds.health.generateFeed.failedAt = moment().toISOString();
                console.log(error);
                log.error(error);
            }
        );
    } else {
        gnsHealthStatus.sectionFeeds.health.status = 200;
        gnsHealthStatus.sectionFeeds.health.valid = true;
        gnsHealthStatus.sectionFeeds.health.generateFeed.status = 'No updates';
        debugLog('no updates');
        log.debug('Generate health Feed: no updates');
    }
}, config.get('gnsTaskIntervalMS'));

setInterval(() => {
    debugLog('Generate opinions Feed interval fired');
    log.debug('Generate opinions Feed interval fired');
    gnsHealthStatus.sectionFeeds.opinions = {status: 201, valid: false, generateFeed: {status: 'processing'}};

    if (opinionsFG.urls && opinionsFG.urls.length > 0) {
        opinionsFG.processContent().then(
            // success
            (rssFeed) => {
                console.log(rssFeed);

                postToLSD(rssFeed, 'opinions');

                // update health check status
                gnsHealthStatus.sectionFeeds.opinions.status = 200;
                gnsHealthStatus.sectionFeeds.opinions.valid = true;
                gnsHealthStatus.sectionFeeds.opinions.generateFeed.status = 'success';
                gnsHealthStatus.sectionFeeds.opinions.generateFeed.lastUpdate = moment().toISOString();

                // post to LSD endpoint
                opinionsFG.urls = 'clear';
                debugLog(opinionsFG.urls);
            },

            // failure
            (error) => {
                gnsHealthStatus.sectionFeeds.opinions.status = 500;
                gnsHealthStatus.sectionFeeds.opinions.valid = false;
                gnsHealthStatus.sectionFeeds.opinions.generateFeed.status = 'failed';
                gnsHealthStatus.sectionFeeds.opinions.generateFeed.failedAt = moment().toISOString();
                console.log(error);
                log.error(error);
            }
        );
    } else {
        gnsHealthStatus.sectionFeeds.opinions.status = 200;
        gnsHealthStatus.sectionFeeds.opinions.valid = true;
        gnsHealthStatus.sectionFeeds.opinions.generateFeed.status = 'No updates';
        debugLog('no updates');
        log.debug('Generate opinions Feed: no updates');
    }
}, config.get('gnsTaskIntervalMS'));

setInterval(() => {
    debugLog('Generate politics Feed interval fired');
    log.debug('Generate politics Feed interval fired');
    gnsHealthStatus.sectionFeeds.politics = {status: 201, valid: false, generateFeed: {status: 'processing'}};

    if ((enableElectionStory === true || enableElectionStory === 'true')  && s3Images) {
        let constantElectionStoryUpdate = config.get('gnsElectionStoryConstantUpdate'),
            constantElectionStoryUpdateURL = config.get('gnsElectionStoryConstantUpdateURL');


        if ((constantElectionStoryUpdate === 'true' || constantElectionStoryUpdate === true)
            && constantElectionStoryUpdateURL) {
            if (!isConstantPublishedAlreadyThere(politicsFG.urls, constantElectionStoryUpdateURL)) {
                politicsFG.urls = constantElectionStoryUpdateURL;
            }
        }
    }

    if (politicsFG.urls && politicsFG.urls.length > 0) {

        if (config.get('gnsTurnOnElectionModule') === true || config.get('gnsTurnOnElectionModule') === 'true') {
            s3Images = getImagesFromAWS();
            s3Images.then(function (data) {

                let electionData = {
                    s3Data: data
                };

                politicsFG.processContent(electionData).then(
                    // success
                    (rssFeed) => {
                        console.log(rssFeed);

                        postToLSD(rssFeed, 'politics');

                        // update health check status
                        gnsHealthStatus.sectionFeeds.politics.status = 200;
                        gnsHealthStatus.sectionFeeds.politics.valid = true;
                        gnsHealthStatus.sectionFeeds.politics.generateFeed.status = 'success';
                        gnsHealthStatus.sectionFeeds.politics.generateFeed.lastUpdate = moment().toISOString();

                        // post to LSD endpoint
                        politicsFG.urls = 'clear';
                        debugLog(politicsFG.urls);
                    },

                    // failure
                    (error) => {
                        gnsHealthStatus.sectionFeeds.politics.status = 500;
                        gnsHealthStatus.sectionFeeds.politics.valid = false;
                        gnsHealthStatus.sectionFeeds.politics.generateFeed.status = 'failed';
                        gnsHealthStatus.sectionFeeds.politics.generateFeed.failedAt = moment().toISOString();
                        console.log(error);
                        log.error(error);
                    }
                );
            });
        } else {
            politicsFG.processContent().then(
                // success
                (rssFeed) => {
                    console.log(rssFeed);

                    postToLSD(rssFeed, 'politics');

                    // update health check status
                    gnsHealthStatus.sectionFeeds.politics.status = 200;
                    gnsHealthStatus.sectionFeeds.politics.valid = true;
                    gnsHealthStatus.sectionFeeds.politics.generateFeed.status = 'success';
                    gnsHealthStatus.sectionFeeds.politics.generateFeed.lastUpdate = moment().toISOString();

                    // post to LSD endpoint
                    politicsFG.urls = 'clear';
                    debugLog(politicsFG.urls);
                },

                // failure
                (error) => {
                    gnsHealthStatus.sectionFeeds.politics.status = 500;
                    gnsHealthStatus.sectionFeeds.politics.valid = false;
                    gnsHealthStatus.sectionFeeds.politics.generateFeed.status = 'failed';
                    gnsHealthStatus.sectionFeeds.politics.generateFeed.failedAt = moment().toISOString();
                    console.log(error);
                    log.error(error);
                }
            );
        }
    } else {
        // update health check status
        gnsHealthStatus.sectionFeeds.politics.status = 200;
        gnsHealthStatus.sectionFeeds.politics.valid = true;
        gnsHealthStatus.sectionFeeds.politics.generateFeed.status = 'No updates';
        debugLog('no updates');
        log.debug('Generate politics Feed: no updates');
    }
}, config.get('gnsTaskIntervalMS'));

setInterval(() => {
    debugLog('Generate tech Feed interval fired');
    log.debug('Generate tech Feed interval fired');
    gnsHealthStatus.sectionFeeds.tech = {status: 201, valid: false, generateFeed: {status: 'processing'}};

    if (techFG.urls && techFG.urls.length > 0) {
        techFG.processContent().then(
            // success
            (rssFeed) => {
                console.log(rssFeed);

                postToLSD(rssFeed, 'tech');

                // update health check status
                gnsHealthStatus.sectionFeeds.tech.status = 200;
                gnsHealthStatus.sectionFeeds.tech.valid = true;
                gnsHealthStatus.sectionFeeds.tech.generateFeed.status = 'success';
                gnsHealthStatus.sectionFeeds.tech.generateFeed.lastUpdate = moment().toISOString();

                // post to LSD endpoint
                techFG.urls = 'clear';
                debugLog(techFG.urls);
            },

            // failure
            (error) => {
                gnsHealthStatus.sectionFeeds.tech.status = 500;
                gnsHealthStatus.sectionFeeds.tech.valid = false;
                gnsHealthStatus.sectionFeeds.tech.generateFeed.status = 'failed';
                gnsHealthStatus.sectionFeeds.tech.generateFeed.failedAt = moment().toISOString();
                console.log(error);
                log.error(error);
            }
        );
    } else {
        gnsHealthStatus.sectionFeeds.tech.status = 200;
        gnsHealthStatus.sectionFeeds.tech.valid = true;
        gnsHealthStatus.sectionFeeds.tech.generateFeed.status = 'No updates';
        debugLog('no updates');
        log.debug('Generate tech Feed: no updates');
    }
}, config.get('gnsTaskIntervalMS'));

setInterval(() => {
    debugLog('Generate us Feed interval fired');
    log.debug('Generate us Feed interval fired');
    gnsHealthStatus.sectionFeeds.us = {status: 201, valid: false, generateFeed: {status: 'processing'}};

    if (usFG.urls && usFG.urls.length > 0) {
        usFG.processContent().then(
            // success
            (rssFeed) => {
                console.log(rssFeed);

                postToLSD(rssFeed, 'us');

                // update health check status
                gnsHealthStatus.sectionFeeds.us.status = 200;
                gnsHealthStatus.sectionFeeds.us.valid = true;
                gnsHealthStatus.sectionFeeds.us.generateFeed.status = 'success';
                gnsHealthStatus.sectionFeeds.us.generateFeed.lastUpdate = moment().toISOString();

                // post to LSD endpoint
                usFG.urls = 'clear';
                debugLog(usFG.urls);
            },

            // failure
            (error) => {
                gnsHealthStatus.sectionFeeds.us.status = 500;
                gnsHealthStatus.sectionFeeds.us.valid = false;
                gnsHealthStatus.sectionFeeds.us.generateFeed.status = 'failed';
                gnsHealthStatus.sectionFeeds.us.generateFeed.failedAt = moment().toISOString();
                console.log(error);
                log.error(error);
            }
        );
    } else {
        gnsHealthStatus.sectionFeeds.us.status = 200;
        gnsHealthStatus.sectionFeeds.us.valid = true;
        gnsHealthStatus.sectionFeeds.us.generateFeed.status = 'No updates';
        debugLog('no updates');
        log.debug('Generate us Feed: no updates');
    }
}, config.get('gnsTaskIntervalMS'));

setInterval(() => {
    debugLog('Generate world Feed interval fired');
    log.debug('Generate world Feed interval fired');
    gnsHealthStatus.sectionFeeds.world = {status: 201, valid: false, generateFeed: {status: 'processing'}};

    if (worldFG.urls && worldFG.urls.length > 0) {
        worldFG.processContent().then(
            // success
            (rssFeed) => {
                console.log(rssFeed);

                postToLSD(rssFeed, 'world');

                 // update health check status
                gnsHealthStatus.sectionFeeds.world.status = 200;
                gnsHealthStatus.sectionFeeds.world.valid = true;
                gnsHealthStatus.sectionFeeds.world.generateFeed.status = 'success';
                gnsHealthStatus.sectionFeeds.world.generateFeed.lastUpdate = moment().toISOString();

                // post to LSD endpoint
                worldFG.urls = 'clear';
                debugLog(worldFG.urls);
            },

            // failure
            (error) => {
                gnsHealthStatus.sectionFeeds.world.status = 500;
                gnsHealthStatus.sectionFeeds.world.valid = false;
                gnsHealthStatus.sectionFeeds.world.generateFeed.status = 'failed';
                gnsHealthStatus.sectionFeeds.world.generateFeed.failedAt = moment().toISOString();
                console.log(error);
                log.error(error);
            }
        );
    } else {
        gnsHealthStatus.sectionFeeds.world.status = 200;
        gnsHealthStatus.sectionFeeds.world.valid = true;
        gnsHealthStatus.sectionFeeds.world.generateFeed.status = 'No updates';
        debugLog('no updates');
        log.debug('Generate world Feed: no updates');
    }
}, config.get('gnsTaskIntervalMS'));

setInterval(() => {
    debugLog('Generate money Feed interval fired');
    gnsHealthStatus.sectionFeeds.money = {status: 201, valid: false, generateFeed: {status: 'processing'}};

    if (moneyFG.urls && moneyFG.urls.length > 0) {
        moneyFG.processContent().then(
            // success
            (rssFeed) => {
                console.log(rssFeed);

                postToLSD(rssFeed, 'money');

                // update health check status
                gnsHealthStatus.sectionFeeds.money.status = 200;
                gnsHealthStatus.sectionFeeds.money.valid = true;
                gnsHealthStatus.sectionFeeds.money.generateFeed.status = 'success';
                gnsHealthStatus.sectionFeeds.money.generateFeed.lastUpdate = moment().toISOString();

                // post to LSD endpoint
                moneyFG.urls = 'clear';
                debugLog(moneyFG.urls);
            },

            // failure
            (error) => {
                gnsHealthStatus.sectionFeeds.money.status = 500;
                gnsHealthStatus.sectionFeeds.money.valid = false;
                gnsHealthStatus.sectionFeeds.money.generateFeed.status = 'failed';
                gnsHealthStatus.sectionFeeds.money.generateFeed.failedAt = moment().toISOString();
                console.log(error);
            }
        );
    } else {
        // update health check status
        gnsHealthStatus.sectionFeeds.money.status = 200;
        gnsHealthStatus.sectionFeeds.money.valid = true;
        gnsHealthStatus.sectionFeeds.money.generateFeed.status = 'No updates';
        debugLog('no updates');
    }
}, config.get('gnsTaskIntervalMS'));

setInterval(() => {
    debugLog('Generate election Feed interval fired');
    log.debug('Generate election Feed interval fired');
    gnsHealthStatus.sectionFeeds.elections = {status: 201, valid: false, generateFeed: {status: 'processing'}};

    if ((enableElectionStory === true || enableElectionStory === 'true')
        || (config.get('gnsElectionModuleTest') === true || config.get('gnsElectionModuleTest') === 'true')
        && s3Images) {
        let constantElectionStoryUpdate = config.get('gnsElectionStoryConstantUpdate'),
            constantElectionStoryUpdateURL = config.get('gnsElectionStoryConstantUpdateURL');


        if ((constantElectionStoryUpdate === 'true' || constantElectionStoryUpdate === true) ||
            (config.get('gnsElectionModuleTest') === true || config.get('gnsElectionModuleTest') === 'true')
            && constantElectionStoryUpdateURL) {
            if (!isConstantPublishedAlreadyThere(electionsFG.urls, constantElectionStoryUpdateURL)) {
                electionsFG.urls = constantElectionStoryUpdateURL;
                console.log('Constant election story update added for: ', constantElectionStoryUpdateURL, 'election URL array: ', electionsFG.urls);
                log.debug(`Constant election story update added for: ${constantElectionStoryUpdateURL} | election URL array: ${electionsFG.urls}`);
            }
        }
    }

    if (electionsFG.urls && electionsFG.urls.length > 0) {
        if ((enableElectionStory === true || enableElectionStory === 'true') || (config.get('gnsElectionModuleTest') === true || config.get('gnsElectionModuleTest') === 'true') && s3Images) {
            s3Images = getImagesFromAWS();
            s3Images.then(function (data) {

                let electionData = {
                    s3Data: data,
                    electionTest: config.get('gnsElectionModuleTest')
                };

                electionsFG.processContent(electionData).then(
                    // success
                    (rssFeed) => {
                        console.log(rssFeed);

                        postToLSD(rssFeed, '2016-elections');

                        // update health check status
                        gnsHealthStatus.sectionFeeds.elections.status = 200;
                        gnsHealthStatus.sectionFeeds.elections.valid = true;
                        gnsHealthStatus.sectionFeeds.elections.generateFeed.status = 'success';
                        gnsHealthStatus.sectionFeeds.elections.generateFeed.lastUpdate = moment().toISOString();

                        // post to LSD endpoint
                        electionsFG.urls = 'clear';
                        debugLog(electionsFG.urls);
                    },

                    // failure
                    (error) => {
                        gnsHealthStatus.sectionFeeds.elections.status = 500;
                        gnsHealthStatus.sectionFeeds.elections.valid = false;
                        gnsHealthStatus.sectionFeeds.elections.generateFeed.status = 'failed';
                        gnsHealthStatus.sectionFeeds.elections.generateFeed.failedAt = moment().toISOString();
                        console.log(error);
                        log.error(error);
                    }
                );
            });
        } else {
            electionsFG.processContent().then(
                // success
                (rssFeed) => {
                    console.log(rssFeed);

                    postToLSD(rssFeed, '2016-elections');

                    // update health check status
                    gnsHealthStatus.sectionFeeds.elections.status = 200;
                    gnsHealthStatus.sectionFeeds.elections.valid = true;
                    gnsHealthStatus.sectionFeeds.elections.generateFeed.status = 'success';
                    gnsHealthStatus.sectionFeeds.elections.generateFeed.lastUpdate = moment().toISOString();

                    // post to LSD endpoint
                    electionsFG.urls = 'clear';
                    debugLog(electionsFG.urls);
                },

                // failure
                (error) => {
                    gnsHealthStatus.sectionFeeds.elections.status = 500;
                    gnsHealthStatus.sectionFeeds.elections.valid = false;
                    gnsHealthStatus.sectionFeeds.elections.generateFeed.status = 'failed';
                    gnsHealthStatus.sectionFeeds.elections.generateFeed.failedAt = moment().toISOString();
                    console.log(error);
                    log.error(error);
                }
            );
        }
    } else {
        // update health check status
        gnsHealthStatus.sectionFeeds.elections.status = 200;
        gnsHealthStatus.sectionFeeds.elections.valid = true;
        gnsHealthStatus.sectionFeeds.elections.generateFeed.status = 'No updates';
        debugLog('no updates');
        log.debug('Generate election Feed: no updates');
    }
}, config.get('gnsTaskIntervalMS'));

setInterval(() => {
    debugLog('Generate Style Feed interval fired');
    gnsHealthStatus.sectionFeeds.style = {status: 201, valid: false, generateFeed: {status: 'processing'}};

    if (styleFG.urls && styleFG.urls.length > 0) {
        styleFG.processContent().then(
            // success
            (rssFeed) => {
                console.log(rssFeed);

                postToLSD(rssFeed, 'style');

                // update health check status
                gnsHealthStatus.sectionFeeds.style.status = 200;
                gnsHealthStatus.sectionFeeds.style.valid = true;
                gnsHealthStatus.sectionFeeds.style.generateFeed.status = 'success';
                gnsHealthStatus.sectionFeeds.style.generateFeed.lastUpdate = moment().toISOString();

                // post to LSD endpoint
                styleFG.urls = 'clear';
                debugLog(styleFG.urls);
            },

            // failure
            (error) => {
                gnsHealthStatus.sectionFeeds.style.status = 500;
                gnsHealthStatus.sectionFeeds.style.valid = false;
                gnsHealthStatus.sectionFeeds.style.generateFeed.status = 'failed';
                gnsHealthStatus.sectionFeeds.style.generateFeed.failedAt = moment().toISOString();
                console.log(error);
            }
        );
    } else {
        // update health check status
        gnsHealthStatus.sectionFeeds.style.status = 200;
        gnsHealthStatus.sectionFeeds.style.valid = true;
        gnsHealthStatus.sectionFeeds.style.generateFeed.status = 'No updates';
        debugLog('no updates');
    }
}, config.get('gnsTaskIntervalMS'));

setInterval(() => {
    debugLog('Generate travel Feed interval fired');
    gnsHealthStatus.sectionFeeds.travel = {status: 201, valid: false, generateFeed: {status: 'processing'}};

    if (travelFG.urls && travelFG.urls.length > 0) {
        travelFG.processContent().then(
            // success
            (rssFeed) => {
                console.log(rssFeed);

                postToLSD(rssFeed, 'travel');

                // update health check status
                gnsHealthStatus.sectionFeeds.travel.status = 200;
                gnsHealthStatus.sectionFeeds.travel.valid = true;
                gnsHealthStatus.sectionFeeds.travel.generateFeed.status = 'success';
                gnsHealthStatus.sectionFeeds.travel.generateFeed.lastUpdate = moment().toISOString();

                // post to LSD endpoint
                travelFG.urls = 'clear';
                debugLog(travelFG.urls);
            },

            // failure
            (error) => {
                gnsHealthStatus.sectionFeeds.travel.status = 500;
                gnsHealthStatus.sectionFeeds.travel.valid = false;
                gnsHealthStatus.sectionFeeds.travel.generateFeed.status = 'failed';
                gnsHealthStatus.sectionFeeds.travel.generateFeed.failedAt = moment().toISOString();
                console.log(error);
            }
        );
    } else {
        // update health check status
        gnsHealthStatus.sectionFeeds.travel.status = 200;
        gnsHealthStatus.sectionFeeds.travel.valid = true;
        gnsHealthStatus.sectionFeeds.travel.generateFeed.status = 'No updates';
        debugLog('no updates');
    }
}, config.get('gnsTaskIntervalMS'));

setInterval(() => {
    debugLog('Generate winter olympics Feed interval fired');
    gnsHealthStatus.sectionFeeds.winterOlympics2018FG = {status: 201, valid: false, generateFeed: {status: 'processing'}};

    if (winterOlympics2018FG.urls && winterOlympics2018FG.urls.length > 0) {
        winterOlympics2018FG.processContent().then(
            // success
            (rssFeed) => {
                console.log(rssFeed);

                postToLSD(rssFeed, 'winter-olympics-2018');

                // update health check status
                gnsHealthStatus.sectionFeeds.winterOlympics2018FG.status = 200;
                gnsHealthStatus.sectionFeeds.winterOlympics2018FG.valid = true;
                gnsHealthStatus.sectionFeeds.winterOlympics2018FG.generateFeed.status = 'success';
                gnsHealthStatus.sectionFeeds.winterOlympics2018FG.generateFeed.lastUpdate = moment().toISOString();

                // post to LSD endpoint
                winterOlympics2018FG.urls = 'clear';
                debugLog(winterOlympics2018FG.urls);
            },

            // failure
            (error) => {
                gnsHealthStatus.sectionFeeds.winterOlympics2018FG.status = 500;
                gnsHealthStatus.sectionFeeds.winterOlympics2018FG.valid = false;
                gnsHealthStatus.sectionFeeds.winterOlympics2018FG.generateFeed.status = 'failed';
                gnsHealthStatus.sectionFeeds.winterOlympics2018FG.generateFeed.failedAt = moment().toISOString();
                console.log(error);
            }
        );
    } else {
        // update health check status
        gnsHealthStatus.sectionFeeds.winterOlympics2018FG.status = 200;
        gnsHealthStatus.sectionFeeds.winterOlympics2018FG.valid = true;
        gnsHealthStatus.sectionFeeds.winterOlympics2018FG.generateFeed.status = 'No updates';
        debugLog('no updates');
    }
}, config.get('gnsTaskIntervalMS'));
