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

 /*
  * This is a debugging task to post specific articles to a specific endpoint.
  *
  * $ ENVIRONMENT=local PORT=5000 CLOUDAMQP_AUTH=foo node tasks/generate-static-feed.js
  *
  * You can also manually capture the feed and push it with:
  *
  * $ for dc in cop 56m; do curl -H "Content-Type: application/rss+xml" --data @test.ig.test/test9.xml lsd-prod-pub-${dc}.turner.com/cnn/content/google-newsstand/test6.xml; done
  */

'use strict';

const  request = require('request'),
    AWS = require('aws-sdk'),
    _ = require('underscore'),
    maxKeys = 1000,
    FeedGenerator = require('../lib/feed-generator.js'),
    debugLog = require('debug')('cnn-google-newsstand:Task:generate-static-feed'),
    config = require('../config.js'),
    fg = new FeedGenerator(),
    enableElectionStory = config.get('gnsTurnOnElectionModule'),
    logConfig = config.get('logConfig'),
    log = require('cnn-logger')(logConfig),
    POST_TO_LSD = false; // <---- TODO - SET THIS TO THE PROPER VALUE BASED ON WHAT YOU ARE WANTING TO DO

let s3Images = undefined;

function postToLSD(data) {

    let suffix = (config.get('ENVIRONMENT') === 'prod') ? '' : `-${config.get('ENVIRONMENT')}`,
        endpoint = `/cnn/content/google-newsstand/test-not-public-inline-gallery${suffix}.xml`,  // <---- TODO - SET THIS TO THE CORRECT ENDPOINT BEFORE RUNNING
        hosts = config.get('lsdHosts');

    debugLog('postToLSD() called');
    log.debug('postToLSD() called');

    // debugLog(data);

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
                // debugLog(body);
            }
        });
    });
}

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
                log.error(`Error retrieving images from s3': ${error}`);
                fulfill({error: 'Error retrieving images from s3'});
            }

            console.log('Successfully retrieved images from s3, about to fulfill.. keys.length: ', keys.length);
            log.debug(`Successfully retrieved images from s3, about to fulfill.. keys.length: ' ${keys.length}`);
            fulfill(filterImages(keys));
        });
    });
}

function isConstantPublishedAlreadyThere(urls, electionStoryUrl) {
    let isStoryThere = false;

    urls.some((url) => {
        if (electionStoryUrl === url) {
            isStoryThere = true;
        }
    });

    return isStoryThere;
}

if (enableElectionStory === true || enableElectionStory === 'true') {
    s3Images = getImagesFromAWS();
}

// put URLs you want to test against here
fg.urls = [
    // 'http://www.cnn.com/2017/06/09/design/gallery/thom-browne/index.html'
    // 'http://www.cnn.com/travel/article/frank-lloyd-wright-turns-150-architecture-tour-us-midwest/index.html'//  page top gallery
    // 'http://www.cnn.com/2017/06/16/entertainment/tupac-all-eyez-on-me/index.html' // page top gallery
    // 'http://www.cnn.com/2014/01/25/showbiz/gallery/bachelor-where-are-they-now/index.html' // stand alone gallery
    // 'http://www.cnn.com/2016/08/08/opinions/mcmullin-mormon-hope-for-conservatives-stanley/index.html'
    // 'http://www.cnn.com/2016/08/08/sport/aly-raisman-parents-olympics-trnd/index.html' // page top image
    // 'http://www.cnn.com/2016/08/08/sport/office-olympics-for-the-rest-of-us-trnd/index.html' // page top video
    // 'http://www.cnn.com/2016/08/08/sport/aly-raisman-parents-olympics-trnd/index.html' // page top image
    // 'http://www.cnn.com/2016/08/08/sport/office-olympics-for-the-rest-of-us-trnd/index.html', // page top video
    // 'http://www.cnn.com/2016/08/09/health/parent-acts-teaching-kids-empathy/index.html' // page top video collection
    // 'http://www.cnn.com/2016/07/27/us/freddie-gray-verdict-baltimore-officers/index.html' // page top video collection / inline video / inline images
    // 'http://www.cnn.com/2016/08/15/opinions/is-trump-getting-ready-to-lose-stanley/index.html'
    // 'http://www.cnn.com/2016/08/15/health/parents-life-expectancy-heart-health/index.html' //
    // 'http://www.cnn.com/2016/08/10/politics/trump-second-amendment/index.html'//
    // 'http://www.cnn.com/2016/07/22/architecture/leaning-house-jakarta-architecture/index.html',
    // 'http://www.cnn.com/2016/07/19/sport/jockey-horse-diets/index.html',
    // 'http://www.cnn.com/2016/07/18/travel/national-seashore-lakeshore-towns-nps100/index.html'
    // 'http://www.cnn.com/2016/08/15/us/gabby-douglas-natalie-hawkins-new-day/index.html', // twitter embeds
    // 'http://www.cnn.com/2015/10/13/politics/democratic-debate-2016-instagram/index.html' // ig embeds
    // 'http://www.cnn.com/2016/09/05/hotels/presidential-hotel-suites/index.html' // page top gallery
    // 'http://www.cnn.com/2016/08/16/opinions/larry-wilmore-cancellation-obeidallah/index.html' // editors note  / image / video
    // 'http://www.cnn.com/2016/08/19/entertainment/amy-schumer-charlie-rose/index.html', // youtube
    // 'http://www.cnn.com/2015/10/14/politics/democratic-debate-in-gifs-vines-clinton-sanders-reaction/index.html' // vine
    // 'http://www.cnn.com/2016/01/05/politics/primary-conflicts-2016/index.html' // vimeo
    // videos
    // 'http://www.cnn.com/videos/politics/2016/09/20/who-stole-naked-trump-moos-pkg-erin.cnn'
    // 'http://www.cnn.com/videos/us/2016/09/01/midway-atoll-plastic-island-obama-visits-wildlife-refuge-marine-reserve-orig.cnn'
    // 'http://www.cnn.com/videos/entertainment/2016/08/30/chance-the-rapper-beyonce-mtv-vma-orig-vstan.cnn',
    // 'http://www.cnn.com/videos/us/2016/09/01/houston-crosswalks-vandalized-pkg.ktrk'
    // 'http://www.cnn.com/2016/09/20/politics/gun-control-law-court/index.html'
    // 'http://www.cnn.com/2016/09/26/opinions/clinton-needs-obama-bernstein-opinion/index.html'
    // 'http://www.cnn.com/2014/06/09/world/boko-haram-fast-facts/index.html'
    // 'http://www.cnn.com/videos/us/2016/09/01/houston-crosswalks-vandalized-pkg.ktrk'
    // 'http://www.cnn.com/2016/09/20/politics/gun-control-law-court/index.html',
    // 'http://ref.next.cnn.com/2016/10/12/politics/test-election-day-2016-highlights/index.html'
    // 'http://www.cnn.com/2016/09/26/opinions/clinton-needs-obama-bernstein-opinion/index.html',
    // 'http://www.cnn.com/2016/10/28/politics/donald-trump-election-2016/index.html'
];

if (fg.urls && fg.urls.length > 0) {


    if (s3Images) {

        console.log('s3images = true');
        log.debug('s3images = true');

        s3Images.then(function (data) {

            let constantElectionStoryUpdate = config.get('gnsElectionStoryConstantUpdate'),
                constantElectionStoryUpdateURL = config.get('gnsElectionStoryConstantUpdateURL');

            if ((constantElectionStoryUpdate === 'true' || constantElectionStoryUpdate === true) && constantElectionStoryUpdateURL) {
                if (!isConstantPublishedAlreadyThere(fg.urls, constantElectionStoryUpdateURL)) {
                    fg.urls.unshift(constantElectionStoryUpdateURL);
                }
            }

            fg.processContent({s3Data: data}).then(
                // success
                (rssFeed) => {
                    console.log(rssFeed);

                    if (POST_TO_LSD) {
                        postToLSD(rssFeed);
                    }

                    // post to LSD endpoint
                    fg.urls = 'clear';
                },

                // failure
                (error) => {
                    console.log(`Error: ${error}`);
                    log.error(error);
                }
            );
        });
    } else {

        console.log('s3images = false');
        log.debug('s3images = false');

        fg.processContent().then(
            // success
            (rssFeed) => {
                console.log(rssFeed);

                if (POST_TO_LSD) {
                    postToLSD(rssFeed);
                }

                // post to LSD endpoint
                fg.urls = 'clear';
            },

            // failure
            (error) => {
                console.log(`Error: ${error}`);
                log.error(error);
            }
        );
    }
} else {
    debugLog('no updates');
    log.debug('no updates');
}
