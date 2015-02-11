/**
 * Commands Plugin for Unibot
 * @param  {Object} options [description]
 *   db: {mongoose} the mongodb connection
 *   bot: {irc} the irc bot
 *   web: {connect} a connect + connect-rest webserver
 *   config: {object}
 * @return {Function}         init function to access shared resources
 */
module.exports = function init(options){

  var mongoose = options.db;
  var bot = options.bot;
  var webserver = options.web;
  var config = options.config;

  var Karma = new mongoose.Schema({
    channel : {
      type  : String, // channel._id
      index : {
        unique   : true,
        dropDups : false
      }
    },
    karma : {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  });

  var model = mongoose.model('Karma', Karma);


  webserver.get('/karma', function(req, res, next){
    res.sendFile(__dirname + '/index.html');
  });

  webserver.get('/karma/:channel', function(req, res, next) {
    model.findOne({ channel: req.params.channel }, function(err, karma){
      res.send(err || karma);
    });
  });

  function cleanName(input) {
    var out = input;
    return out.replace(/\$/g, String.fromCharCode(0xFF04)).replace(/\./g, '．').toLowerCase();
  }

  return function plugin(channel){

    var karma = { karma: {} },
        cooldown = {};

    model.findOne({ channel: channel.id }, function(err, _karma_){
      if (err || !_karma_) {
        karma = new model({
          channel: channel.id
        });
        karma.save();
      } else {
        karma = _karma_;
      }
    });

    function checkKarma(name) {
      if (!karma.karma[name])
        karma.karma[name] = 0;
    }

    function saveKarma(from, name) {
      cooldown[from] = setTimeout(function(){
        delete cooldown[from];
      }, 3600000); // 1 hour

      karma.markModified('karma');
      karma.save(function(err){
        if (!err)
          sayKarma(name);
      });
    }
    function sayKarma(name) {
      channel.say(name + ' Karma: ' + karma.karma[name]);
    }

    return {
      "^(\\S+)\\+\\+$": function(from, matches) {
        if (bot.chans[channel.name].users[matches[1]] === undefined) return;
        matches[1] = cleanName(matches[1]);
        if (from.toLowerCase() == matches[1]) return;
        if (cooldown[from]) return channel.say(from + ': you must wait an hour between giving karma');
        checkKarma(matches[1]);
        karma.karma[matches[1]]++;
        saveKarma(from, matches[1]);
      },
      "^(\\S+)\\-\\-$": function(from, matches) {
        if (bot.chans[channel.name].users[matches[1]] === undefined) return;
        matches[1] = cleanName(matches[1]);
        if (from.toLowerCase() == matches[1]) return;
        if (cooldown[from]) return channel.say(from + ': you must wait an hour between giving karma');
        checkKarma(matches[1]);
        karma.karma[matches[1]]--;
        saveKarma(from, matches[1]);
      },
      "^!karma(?: (\\S+))?$": function(from, matches) {
        nick = matches[1] ? matches[1] : from;
        nick = cleanName(nick);
        if (bot.chans[channel.name].users[nick] === undefined) return channel.say(from + ': no nick matching that was found');
        checkKarma(nick);
        sayKarma(nick);
      }
    };
  };
};
