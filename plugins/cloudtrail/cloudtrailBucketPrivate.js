var async = require('async');
var helpers = require('../../helpers');

module.exports = {
	title: 'CloudTrail Bucket Private',
	category: 'CloudTrail',
	description: 'Ensures CloudTrail logging bucket is not publicly accessible',
	more_info: 'CloudTrail buckets contain large amounts of sensitive account data and should only be accessible by logged in users.',
	recommended_action: 'Set the S3 bucket access policy for all CloudTrail buckets to only allow known users to access its files.',
	link: 'http://docs.aws.amazon.com/AmazonS3/latest/dev/example-bucket-policies.html',

	run: function(cache, includeSource, callback) {
		var results = [];
		var source = {};

		async.each(helpers.regions.cloudtrail, function(region, rcb){

			var describeTrails = (cache.cloudtrail &&
								  cache.cloudtrail.describeTrails &&
								  cache.cloudtrail.describeTrails[region]) ?
								  cache.cloudtrail.describeTrails[region] : null;

			if (!describeTrails) return rcb();

			if (describeTrails.err || !describeTrails.data) {
				helpers.addResult(results, 3, 'Unable to query for CloudTrail policy', region);
				return rcb();
			}

			if (!describeTrails.data.length) {
				helpers.addResult(results, 0, 'No S3 buckets to check', region);
				return rcb();
			}

			async.each(describeTrails.data, function(trail, cb){
				var getBucketAcl = (cache.s3 &&
								    cache.s3.getBucketAcl &&
								    cache.s3.getBucketAcl['us-east-1'] &&
								    cache.s3.getBucketAcl['us-east-1'][trail.S3BucketName]) ?
								    cache.s3.getBucketAcl['us-east-1'][trail.S3BucketName] : null;

				if (!getBucketAcl || getBucketAcl.err || !getBucketAcl.data) {
					helpers.addResult(results, 3,
						'Error querying for bucket policy for bucket: ' + trail.S3BucketName,
						region, 'arn:aws:s3:::' + trail.S3BucketName)

					return cb();
				}

				var allowsAllUsersTypes = [];

				for (i in getBucketAcl.data.Grants) {
					if (getBucketAcl.data.Grants[i].Grantee.Type &&
						getBucketAcl.data.Grants[i].Grantee.Type === 'Group' &&
						getBucketAcl.data.Grants[i].Grantee.URI &&
						getBucketAcl.data.Grants[i].Grantee.URI.indexOf('AllUsers') > -1
					) {
						allowsAllUsersTypes.push(getBucketAcl.data.Grants[i].Permission);
					}
				}

				if (allowsAllUsersTypes.length) {
					helpers.addResult(results, 2,
						'Bucket: ' + trail.S3BucketName + ' allows global access to: ' + allowsAllUsersTypes.concat(', '),
						region, 'arn:aws:s3:::' + trail.S3BucketName);
				} else {
					helpers.addResult(results, 0,
						'Bucket: ' + trail.S3BucketName + ' does not allow public access',
						region, 'arn:aws:s3:::' + trail.S3BucketName);
				}

				cb();
			}, function(){
				rcb();
			});
		}, function(){
			if (includeSource) {
				source = {
					getBucketAcl: (cache.s3 && cache.s3.getBucketAcl) ?
								   cache.s3.getBucketAcl : null,
					describeTrails: (cache.cloudtrail && cache.cloudtrail.describeTrails) ?
									 cache.cloudtrail.describeTrails : null
				}
			}

			callback(null, results, source);
		});
	}
};