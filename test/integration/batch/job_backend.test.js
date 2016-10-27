'use strict';

require('../../helper');

var BATCH_SOURCE = '../../../batch/';

var assert = require('../../support/assert');
var redisUtils = require('../../support/redis_utils');

var JobQueue = require(BATCH_SOURCE + 'job_queue');
var JobBackend = require(BATCH_SOURCE + 'job_backend');
var JobPublisher = require(BATCH_SOURCE + 'pubsub/job-publisher');
var JobFactory = require(BATCH_SOURCE + 'models/job_factory');
var jobStatus = require(BATCH_SOURCE + 'job_status');

var metadataBackend = require('cartodb-redis')({ pool: redisUtils.getPool() });
var jobPublisher = new JobPublisher(redisUtils.getPool());
var jobQueue =  new JobQueue(metadataBackend, jobPublisher);

var USER = 'vizzuality';
var QUERY = 'select pg_sleep(0)';
var HOST = 'localhost';
var JOB = {
    user: USER,
    query: QUERY,
    host: HOST
};

function createWadusJob() {
    return JobFactory.create(JSON.parse(JSON.stringify(JOB)));
}

describe('job backend', function() {
    var jobBackend = new JobBackend(metadataBackend, jobQueue);

    after(function (done) {
        redisUtils.clean('batch:*', done);
    });

    it('.create() should persist a job', function (done) {
        var job = createWadusJob();

        jobBackend.create(job.data, function (err, jobCreated) {
            if (err) {
                return done(err);
            }

            assert.ok(jobCreated.job_id);
            assert.equal(jobCreated.status, jobStatus.PENDING);
            done();
        });
    });

    it('.create() should return error', function (done) {
        var job = createWadusJob();

        delete job.data.job_id;

        jobBackend.create(job, function (err) {
            assert.ok(err);
            assert.equal(err.name, 'NotFoundError');
            assert.equal(err.message, 'Job with id undefined not found');
            done();
        });
    });

    it('.update() should update an existent job', function (done) {
        var job = createWadusJob();

        jobBackend.create(job.data, function (err, jobCreated) {
            if (err) {
                return done(err);
            }

            jobCreated.query = 'select pg_sleep(1)';

            var job = JobFactory.create(jobCreated);

            jobBackend.update(job.data, function (err, jobUpdated) {
                if (err) {
                    return done(err);
                }

                assert.equal(jobUpdated.query, 'select pg_sleep(1)');
                done();
            });
        });
    });

    it('.update() should return error when updates a nonexistent job', function (done) {
        var job = createWadusJob();

        jobBackend.update(job.data, function (err) {
            assert.ok(err, err);
            assert.equal(err.name, 'NotFoundError');
            assert.equal(err.message, 'Job with id ' + job.data.job_id + ' not found');
            done();
        });
    });

    it('.addWorkInProgressJob() should add current job to user and host lists', function (done) {
        var job = createWadusJob();

        jobBackend.addWorkInProgressJob(job.data.user, job.data.job_id, function (err) {
            if (err) {
                return done(err);
            }
            done();
        });
    });

    it('.listWorkInProgressJobByUser() should retrieve WIP jobs of given user', function (done) {
        jobBackend.listWorkInProgressJobByUser('vizzuality', function (err, jobs) {
            if (err) {
                return done(err);
            }
            assert.ok(jobs.length);
            done();
        });
    });
});
