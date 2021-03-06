

const request = require('request');
const utilities = require('./utilities');
const settings = require('../../settings');

/*
 * This variant of APIClient uses callbacks rather than promises, to satisfy the needs of the setup command, which
 * also uses callbacks. Login alters global state, setting the access token on the settings instance, but otheriwse
 * the commands do not introduce side effects (e.g. no console output.)
 */

class APIClient2 {
	constructor(baseUrl, token) {
		this.__token = token || settings.access_token;
		this.request = request.defaults({
			baseUrl: baseUrl || settings.apiUrl,
			proxy: settings.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy
		});
	}

	updateToken(token) {
		this.__token = token;
	}

	clearToken() {
		this.__token = null;
	}

	/**
	 * Used in setup command.
	 */
	login(clientId, user, pass, cb) {
		this.createAccessToken(clientId, user, pass, (err, dat) => {
			if (err) {
				return cb(err);
			}

			cb(null, dat);
		});
	}

// used in setup process to create a new account
	createUser(user, pass, cb) {
		if (!user || (user === '')
			|| (!utilities.contains(user, '@'))
			|| (!utilities.contains(user, '.'))) {
			return cb('Username must be an email address.');
		}

		this.request({
			uri: '/v1/users',
			method: 'POST',
			form: {
				username: user,
				password: pass
			},
			json: true
		}, (error, response, body) => {
			if (error) {
				return cb(error);
			}

			if (body && !body.ok && body.errors) {
				return cb(body.errors);
			}

			return cb(null, body);
		});
	}

	/**
	 * Creates an access token, updates the global settings with the new token, and the token in this instance.
	 * Used only by login above.
	 * todo - updating the token should probably be moved to login()
	 */
	createAccessToken(clientId, user, pass, cb) {

		let self = this;
		this.request({

			uri: '/oauth/token',
			method: 'POST',
			form: {

				username: user,
				password: pass,
				grant_type: 'password',
				client_id: clientId,
				client_secret: 'client_secret_here'

			},
			json: true

		}, (err, res, body) => {

			if (err || body.error) {

				cb(new Error(err || body.error));

			} else {
				// todo factor this out creating and updating should be separate
				// update the token
				if (body.access_token) {

					settings.override(
						settings.profile,
						'access_token',
						body.access_token
					);

					self.__token = body.access_token;
				}

				// console.log(arrow, 'DEBUG');
				// console.log(body);
				// console.log();

				cb(null, body);
			}
		});
	}

	getClaimCode(data, cb) {

		let self = this;

		this.request({

			uri: '/v1/device_claims',
			method: 'POST',
			auth: {
				'bearer': self.__token
			},
			json: true,
			body: data
		}, (err, res, body) => {

			if (err) {
				return cb(err);
			}
			if ((!body) || !body.claim_code) {

				return cb(new Error('Unable to obtain claim code'));
			}
			cb(null, body);
		});
	}

	listDevices(cb) {

		let self = this;

		this.request({

			uri: '/v1/devices',
			method: 'GET',
			auth: {
				'bearer': self.__token
			},
			json: true
		}, (err, res, body) => {

			if (err) {
				return cb(err);
			}
			if (!body) {

				return cb(new Error('Unable to list devices'));
			}
			cb(null, body);
		});
	}
}

module.exports = APIClient2;
