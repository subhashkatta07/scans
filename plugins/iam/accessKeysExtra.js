var async = require('async');
var helpers = require('../../helpers');

module.exports = {
	title: 'Access Keys Extra',
	category: 'IAM',
	description: 'Detects the use of more than one access key by any single user',
	more_info: 'Having more than one access key for a single user increases the chance of accidental exposure. Each account should only have one key that defines the users permissions.',
	link: 'http://docs.aws.amazon.com/IAM/latest/UserGuide/ManagingCredentials.html',
	recommended_action: 'Remove the extra access key for the specified user.',

	run: function(cache, includeSource, callback) {

		var results = [];
		var source = {};

		var region = 'us-east-1';

		var generateCredentialReport = (cache.iam &&
									    cache.iam.generateCredentialReport &&
									    cache.iam.generateCredentialReport[region]) ?
									    cache.iam.generateCredentialReport[region] : null;

		if (!generateCredentialReport) return callback();

		if (generateCredentialReport.err || !generateCredentialReport.data) {
			helpers.addResult(results, 3, 'Unable to query for users');
			return callback();
		}

		if (generateCredentialReport.data.length <= 2) {
			helpers.addResult(results, 0, 'No users using access keys found');
			return callback();
		}

		var found = false;

		async.each(generateCredentialReport.data, function(obj, cb){
			// The root account security is handled in a different plugin
			if (obj.user === '<root_account>') return cb();

			if (obj.access_key_1_active === 'true' && obj.access_key_2_active === 'true') {
				helpers.addResult(results, 2, 'User is using both access keys', 'global', obj.arn);
			} else {
				helpers.addResult(results, 0, 'User is not using both access keys', 'global', obj.arn);
			}

			found = true;

			cb();
		}, function(){
			if (!found) {
				helpers.addResult(results, 0, 'No users using both access keys found');
			}

			if (includeSource) {
				source = {
					generateCredentialReport: (cache.iam && cache.iam.generateCredentialReport) ?
									 		   cache.iam.generateCredentialReport : null
				}
			}

			callback(null, results, source);
		});
	}
};