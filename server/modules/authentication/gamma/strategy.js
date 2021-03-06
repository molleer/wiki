// Load modules.
const request = require('request')
const qs = require('querystring')
var Base64 = require('js-base64').Base64

/**
 * `Strategy` constructor.
 *
 * Options:
 *   - `clientID`      the application's App ID
 *   - `clientSecret`  the application's App Secret
 *   - `callbackURL`   URL to which Gamma will redirect the user after granting authorization
 *
 *
 * @constructor
 * @param {object} options
 * @param {function} verify
 * @access public
 */
function Strategy(options, verify) {
  options = options || {}

  options.authorizationURL =
        options.authorizationURL ||
        'https://gamma.chalmers.it/api/oauth/authorize'
  options.tokenURL =
        options.tokenURL || 'https://gamma.chalmers.it/api/oauth/token'
  options.scopeSeparator = options.scopeSeparator || ' '

  this._verify = verify
  this._options = options
  this.name = 'gamma'
  this._profileURL =
        options.profileURL || 'https://gamma.chalmers.it/api/users/me'
  this._clientID = options.clientID
  this._clientSecret = options.clientSecret
  this._callbackURL = options.callbackURL
}

/**
 * Authenticate request by delegating to Gamma using OAuth 2.0.
 *
 * @param {http.IncomingMessage} req
 * @param {object} options
 * @access protected
 */
Strategy.prototype.authenticate = function (req, options) {
  if (req.query && req.query.error) {
    return this.error(req.query.error_description)
  }

  if (req.query && req.query.code) {
    this._exchange(req.query.code, (err, res, body) => {
      if (err) {
        this.error(err)
        return
      }

      this._loadProfile(JSON.parse(body).access_token)
    })
    return
  }

  this._redirectToLogin()
}

Strategy.prototype._loadProfile = function (accessToken) {
  var done = (err, profile) => {
    if (err) {
      this.fail(err)
      return
    }
    this.success(profile, null)
  }

  var verify = (err, user) => {
    if (err) {
      this.error(err)
      return
    }
    this._verify(accessToken, user, done)
  }

  this.userProfile(accessToken, verify)
}

Strategy.prototype._redirectToLogin = function () {
  var uri = new URL(this._options.authorizationURL)
  uri.searchParams.append('response_type', 'code')
  uri.searchParams.append('client_id', this._clientID)
  uri.searchParams.append('redirect_uri', this._callbackURL)
  this.redirect(uri.href)
}

Strategy.prototype._exchange = function (code, callback) {
  return request.post(
    this._options.tokenURL + '?' + qs.stringify({
      grant_type: 'authorization_code',
      redirect_uri: this._callbackURL,
      code: code
    }),
    {
      headers: {
        Authorization:
                    'Basic ' +
                    Base64.encode(this._clientID + ':' + this._clientSecret)
      }
    }, callback
  )
}

Strategy.prototype.userProfile = function (accessToken, done) {
  request
    .get(this._profileURL, {
      headers: {
        Authorization: 'Bearer ' + accessToken
      }
    }, (err, res, body) => {
      if (err) {
        done(err, null)
        return
      }
      done(null, JSON.parse(body))
    })
}

// Expose constructor
module.exports = {Strategy}
