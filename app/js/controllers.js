'use strict';

// XXX have modal controllers inherit from a base class to be more DRY?

// XXX use data-loading-text instead of submitButtonLabelKey below?
// see http://twitter.github.com/bootstrap/javascript.html#buttons

function RootCtrl(dev, sanity, $scope, logFactory, modelSrvc, cometdSrvc, langSrvc, $http, apiSrvc, ENUMS, $window) {
  var log = logFactory('RootCtrl'),
      model = $scope.model = modelSrvc.model,
      MODE = ENUMS.MODE,
      CONNECTIVITY = ENUMS.CONNECTIVITY,
      EXTERNAL_URL = ENUMS.EXTERNAL_URL;
  $scope.modelSrvc = modelSrvc;
  $scope.cometdSrvc = cometdSrvc;
  $scope.dev = dev;

  angular.forEach(ENUMS, function(val, key) {
    $scope[key] = val;
  });

  // XXX better place for these?
  $scope.lang = langSrvc.lang;
  $scope.direction = langSrvc.direction;

  $scope.$watch('model.settings.mode', function(val) {
    $scope.inGiveMode = val == MODE.give;
    $scope.inGetMode = val == MODE.get;
  });

  $scope.$watch('model.location.country', function(val) {
    if (val) $scope.inCensoringCountry = model.countries[val].censors;
  });

  $scope.$watch('model.connectivity.gtalk', function(val) {
    $scope.gtalkNotConnected = val == CONNECTIVITY.notConnected;
    $scope.gtalkConnecting = val == CONNECTIVITY.connecting;
    $scope.gtalkConnected = val == CONNECTIVITY.connected;
  });

  $scope.notifyLanternDevs = true;
  $scope.$watch('model.settings.autoReport', function(val) {
    if (typeof val == 'boolean') {
      $scope.notifyLanternDevs = val;
    }
  });
  $scope.maybeNotify = function() {
    if ($scope.notifyLanternDevs) {
      log.warn('Notify Lantern developers not yet implemented');
    }
  };

  $scope.refresh = function() {
    location.reload(true); // true to bypass cache and force request to server
  };

  $scope.doOauth = function() {
    var url = modelSrvc.get('version.current.api.mock') ?
              EXTERNAL_URL.fakeOauth : googOauthUrl;
    $window.open(url);
  };

  $scope.interaction = function(interaction, extra) {
    var params = angular.extend({interaction: interaction}, extra || {});
    $http.post(apiSrvc.urlfor('interaction', params))
      .success(function(data, status, headers, config) {
        log.debug('interaction');
      })
      .error(function(data, status, headers, config) {
        log.debug('interaction failed'); // XXX
      });
  };

  $scope.changeSetting = function(key, val) {
    var params = {};
    params[key] = val;
    $http.post(apiSrvc.urlfor('settings/', params))
      .success(function(data, status, headers, config) {
        log.debug('Changed setting', key, 'to', val);
      })
      .error(function(data, status, headers, config) {
        log.debug('Changed setting', key, 'to', val, 'failed');
      });
  };
}

function WaitingForLanternCtrl($scope, logFactory) {
  var log = logFactory('WaitingForLanternCtrl');
  $scope.show = true;
  $scope.$on('cometdConnected', function() {
    log.debug('cometdConnected');
    $scope.show = false;
    $scope.$apply();
  });
  $scope.$on('cometdDisconnected', function () {
    log.debug('cometdDisconnected');
    $scope.show = true;
    $scope.$apply();
  });
}

function SanityCtrl($scope, sanity, modelSrvc, cometdSrvc, APIVER_REQUIRED, MODAL, apiVerLabel, logFactory) {
  var log = logFactory('SanityCtrl');
  $scope.sanity = sanity;

  $scope.show = false;
  $scope.$watch('sanity.value', function(val) {
    if (!val) {
      log.warn('sanity false, disconnecting');
      modelSrvc.disconnect();
      modelSrvc.model.modal = MODAL.none;
      $scope.show = true;
    }
  });

  $scope.$watch('model.version.current.api', function(val) {
    if (typeof val == 'undefined') return;
    if (val.major != APIVER_REQUIRED.major ||
        val.minor != APIVER_REQUIRED.minor) {
      sanity.value = false;
      log.error('Available API version', val,
        'incompatible with required version', APIVER_REQUIRED);
    }
    // XXX required by apiSrvc. Better place for this?
    apiVerLabel.value = val.major+'.'+val.minor+'.'+val.patch;
  }, true);
}

function SettingsLoadFailureCtrl($scope, MODAL) {
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.settingsLoadFailure;
  });
}

function SettingsUnlockCtrl($scope, $http, apiSrvc, logFactory, MODAL) {
  var log = logFactory('SettingsUnlockCtrl');

  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.settingsUnlock;
  });

  $scope.password = '';

  $scope.settingsUnlock = function() {
    $scope.error = false;
    $http.post(apiSrvc.urlfor('settings/unlock', {password: $scope.password}))
      .success(function(data, status, headers, config) {
        log.debug('password valid');
      })
      .error(function(data, status, headers, config) {
        $scope.error = true;
        $scope.unlockForm.password.$pristine = true;
      });
  };
}

function PasswordCreateCtrl($scope, $http, apiSrvc, logFactory, MODAL) {
  var log = logFactory('PasswordCreateCtrl');

  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.passwordCreate;
  });

  $scope.password1 = '';
  $scope.password2 = '';
  // XXX don't allow weak passwords?
  function validate() {
    // XXX Angular way of doing this?
    var pw1ctrl = $scope.passwordCreateForm.password1,
        pw2ctrl = $scope.passwordCreateForm.password2,
        valid = $scope.password1 == $scope.password2;
    $scope.passwordCreateForm.$valid = pw2ctrl.$valid = valid;
    $scope.passwordCreateForm.$invalid = pw2ctrl.$invalid = !valid;
  }
  $scope.$watch('password1', validate);
  $scope.$watch('password2', validate);

  $scope.passwordCreate = function() {
    $http.post(apiSrvc.urlfor('passwordCreate',
        {password1: $scope.password1, password2: $scope.password2}))
      .success(function(data, status, headers, config) {
        log.debug('Password create');
      })
      .error(function(data, status, headers, config) {
        log.debug('Password create failed'); // XXX
      });
  };
}

function WelcomeCtrl($scope, modelSrvc, logFactory, MODAL) {
  var log = logFactory('WelcomeCtrl'),
      model = $scope.model = modelSrvc.model;
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.welcome;
  });
}

function AuthorizeCtrl($scope, logFactory, MODAL) {
  var log = logFactory('AuthorizeCtrl');

  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.authorize;
  });
}

function GtalkConnectingCtrl($scope, logFactory, MODAL) {
  var log = logFactory('GtalkConnectingCtrl');
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.gtalkConnecting;
  });
}

function GtalkUnreachableCtrl($scope, apiSrvc, $http, logFactory, MODAL) {
  var log = logFactory('GtalkUnreachableCtrl');
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.gtalkUnreachable;
  });
}

function NotInvitedCtrl($scope, apiSrvc, $http, logFactory, MODAL) {
  var log = logFactory('NotInvitedCtrl');
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.notInvited;
  });
}

function RequestInviteCtrl($scope, apiSrvc, $http, logFactory, MODAL) {
  var log = logFactory('RequestInviteCtrl');
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.requestInvite;
  });

  $scope.sendToLanternDevs = false;
  $scope.disableForm = false;
  $scope.submitButtonLabelKey = 'SEND_REQUEST';

  function resetForm() {
    $scope.disableForm = false;
    $scope.submitButtonLabelKey = 'SEND_REQUEST';
  }

  $scope.requestInvite = function() {
    $scope.disableForm = true;
    $scope.requestError = false;
    $scope.submitButtonLabelKey = 'SENDING_REQUEST';
    var params = {lanternDevs: $scope.sendToLanternDevs};
    $http.post(apiSrvc.urlfor('requestInvite', params))
      .success(function(data, status, headers, config) {
        log.debug('sent invite request');
        resetForm();
      })
      .error(function(data, status, headers, config) {
        log.debug('send invite request failed');
        $scope.requestError = true;
        resetForm();
      });
  };
}

function RequestSentCtrl($scope, apiSrvc, $http, logFactory, MODAL) {
  var log = logFactory('RequestSentCtrl');
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.requestSent;
  });
}

function FirstInviteReceivedCtrl($scope, apiSrvc, $http, logFactory, MODAL) {
  var log = logFactory('FirstInviteReceivedCtrl');
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.firstInviteReceived;
  });
}

function SystemProxyCtrl($scope, $http, apiSrvc, logFactory, MODAL, SETTING, INTERACTION) {
  var log = logFactory('SystemProxyCtrl');

  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.systemProxy;
  });

  $scope.systemProxy = true;
  $scope.disableForm = false;
  $scope.submitButtonLabelKey = 'CONTINUE';

  function resetForm() {
    $scope.disableForm = false;
    $scope.submitButtonLabelKey = 'CONTINUE';
  }

  $scope.continue = function() {
    $scope.sysproxyError = false;
    $scope.disableForm = true;
    $scope.submitButtonLabelKey = 'CONFIGURING';
    var params = {systemProxy: $scope.systemProxy};
    $scope.interaction(INTERACTION.continue, params);
    resetForm(); // XXX pass in a callback to be called when $scope.interaction(..) completes
    /*
    $http.post(apiSrvc.urlfor('settings/', params))
      .success(function(data, status, headers, config) {
        log.debug('set systemProxy to', $scope.systemProxy);
        resetForm();
      })
      .error(function(data, status, headers, config) {
        log.debug('set systemProxy failed');
        $scope.sysproxyError = true;
        resetForm();
      });
    */
  };
}

function FinishedCtrl($scope, MODAL) {
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.finished;
  });
}

function ContactDevsCtrl($scope, MODAL) {
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.contactDevs;
  });
}

function SettingsCtrl($scope, modelSrvc, logFactory, MODAL) {
  var log = logFactory('SettingsCtrl');

  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.settings;
  });

  $scope.$watch('model.settings.autoStart', function(val) {
    $scope.autoStart = val;
  });

  $scope.$watch('model.settings.systemProxy', function(val) {
    $scope.systemProxy = val;
  });

  $scope.$watch('model.settings.autoReport', function(val) {
    $scope.autoReport = val;
  });
}

function ProxiedSitesCtrl($scope, $timeout, logFactory, MODAL, SETTING, NPROXIEDSITES_MAX, INPUT_PATS) {
  var log = logFactory('ProxiedSitesCtrl'),
      DOMAIN = INPUT_PATS.DOMAIN,
      IPV4 = INPUT_PATS.IPV4,
      IPV6 = INPUT_PATS.IPV6,
      original,
      filtered;

  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.proxiedSites;
  });

  $scope.$watch('model.settings.proxiedSites', function(val) {
    if (val) {
      original = val;
      $scope.input = val.join('\n');
    }
  });

  $scope.validate = function(value) {
    var split = value.split('\n');
    filtered = [];
    for (var i=0, line=split[i], l=split.length; i<l; line=split[++i]) {
      if (!(line = line.trim())) continue;
      if (!(DOMAIN.test(line) ||
            IPV4.test(line) /*||
            IPV6.test(line) XXX not yet supported*/)) {
        log.debug('invalid line:', line);
        $scope.errorLabelKey = 'ERROR_INVALID_LINE';
        $scope.errorCause = line;
        return false;
      }
      filtered.push(line);
      if (filtered.length > NPROXIEDSITES_MAX) {
        log.debug('maximum number of proxied sites exceeded:', filtered.length, '>', NPROXIEDSITES_MAX);
        $scope.errorLabelKey = 'ERROR_MAX_PROXIED_SITES_EXCEEDED';
        $scope.errorCause = '';
        return false;
      }
    }
    log.debug('all lines valid');
    $scope.errorLabelKey = '';
    $scope.errorCause = '';
    return true;
  };

  $scope.handleUpdate = function() {
    if ($scope.proxiedSitesForm.$invalid) {
      log.debug('invalid input, not sending update');
      return;
    }
    if (angular.equals(original, filtered)) {
      log.debug('input matches original, not sending update');
      return;
    }
    $scope.changeSetting(SETTING.proxiedSites, filtered);
  };
}

function InviteFriendsCtrl($scope, modelSrvc, logFactory, MODE, MODAL) {
  var log = logFactory('InviteFriendsCtrl'),
      model = modelSrvc.model;

  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.inviteFriends;
  });

  $scope.$watch('model.roster', function(val) {
    if (typeof val == 'undefined') return;
    log.debug('got roster', val);
    $scope.lanternContacts = _.filter(
      val,
      function(contact) {
        if (!(contact.peers || []).length) return false;
        return _.intersection(contact.peers,
          _.map(model.connectivity.peers.lifetime, function(peer) {
            return peer.peerid;
          })).length;
      }
    );
  });
}

function AuthorizeLaterCtrl($scope, logFactory, MODAL) {
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.authorizeLater;
  });
}

function AboutCtrl($scope, logFactory, MODAL) {
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.about;
  });
}

function UpdateAvailableCtrl($scope, logFactory, MODAL) {
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.updateAvailable;
  });
}

function ConfirmResetCtrl($scope, logFactory, MODAL) {
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.confirmReset;
  });
}

function GiveModeForbiddenCtrl($scope, logFactory, MODAL) {
  $scope.show = false;
  $scope.$watch('model.modal', function(val) {
    $scope.show = val == MODAL.giveModeForbidden;
  });
}

function DevCtrl($scope, dev, logFactory, MODEL_SYNC_CHANNEL, cometdSrvc, modelSrvc) {
  var log = logFactory('DevCtrl'),
      model = modelSrvc.model;

  $scope.$watch('model', function() {
    if (typeof 'model' != 'undefined' && dev.value) {
      $scope.editableModel = angular.toJson(model, true);
    }
  }, true);

  $scope.handleUpdate = function() {
    cometdSrvc.batch(function() {
      syncObject('', angular.fromJson($scope.editableModel), model);
    });
  };

  function syncObject(parent, src, dst) {
    for (var name in src) {
      var path = (parent ? parent + '.' : '') + name;
      if (src[name] === dst[name]) {
        // do nothing we are in sync
      } else if (typeof src[name] == 'object') {
        // we are an object, so we need to recurse
        if (!(name in dst)) dst[name] = {};
        syncObject(path, src[name], dst[name]);
      } else {
        log.debug('publishing: path:', path, 'value:', src[name]);
        // propagate local model changes to other clients
        cometdSrvc.publish(MODEL_SYNC_CHANNEL, {path: path, value: src[name]});
        dst[name] = angular.copy(src[name]);
      }
    }
  }
}
