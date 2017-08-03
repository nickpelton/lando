/**
 * This does the tooling
 *
 * @name tooling
 */

'use strict';

module.exports = function(lando) {

  // Modules
  var _ = lando.node._;
  var path = require('path');
  var format = require('util').format;

  /*
   * Helper to process args
   */
  var largs = function(config) {

    // We assume pass through commands so let's use argv directly and strip out
    // the first three assuming they are [node, lando.js, options.name]
    var argopts = process.argv.slice(3);

    // Shift on our command
    argopts.unshift(config.cmd || config.name);

    // Check to see if we have global lando opts and remove them if we do
    if (_.indexOf(argopts, '--') > 0) {
      argopts = _.slice(argopts, 0, _.indexOf(argopts, '--'));
    }

    // Return
    return _.flatten(argopts);

  };

  /*
   * The task builder
   */
  var build = function(config) {

    /*
     * Get the run handler
     */
    var run = function(answers) {

      // Let's check to see if the app has been started
      return lando.app.isRunning(config.app)

      // If not let's make sure we start it
      .then(function(isRunning) {
        if (!isRunning) {
          return lando.app.start(config.app);
        }
      })

      // Run the command
      .then(function() {

        // Build the command
        var cmd = largs(config);

        // Break up our app root and cwd so we can get a diff
        var appRoot = config.app.root.split(path.sep);
        var cwd = process.cwd().split(path.sep);
        var dir = _.drop(cwd, appRoot.length);

        // Add our in-container app root
        dir.unshift('"$LANDO_MOUNT"');

        // Get the backup user
        var userPath = 'environment.LANDO_WEBROOT_USER';
        var user = _.get(config.app.services[config.service], userPath, 'root');
        var name = config.name;
        var eventName = name.split(' ')[0];

        // Build out our options
        var options = {
          id: [config.app.dockerName, config.service, '1'].join('_'),
          compose: config.app.compose,
          project: config.app.name,
          cmd: cmd,
          opts: {
            app: config.app,
            mode: 'attach',
            pre: ['cd', dir.join('/')].join(' '),
            user: config.user || user,
            services: [config.service]
          }
        };

        // If this is a specal "passthrough" command lets augment the cmd
        _.forEach(config.options, function(option) {
          if (option.passthrough && _.get(option, 'interactive.name')) {
            cmd.push('--' + _.get(option, 'interactive.name'));
            cmd.push(answers[_.get(option, 'interactive.name')]);
          }
        });

        // Run a pre-event
        return config.app.events.emit(['pre', eventName].join('-'), config)

        // Exec
        .then(function() {
          return lando.engine.run(options);
        })

        // Post event
        .then(function() {
          return config.app.events.emit(['post', eventName].join('-'), config);
        });

      });

    };

    // Return our tasks
    return {
      command: config.name,
      describe: config.description || format('Run %s commands', config.name),
      run: run,
      options: config.options || {}
    };

  };

  // Return things
  return {
    build: build
  };

};
