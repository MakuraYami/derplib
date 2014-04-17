"use strict";
// Base modules
var _ 	= require('underscore');

// Derplib modules
var MM = module.parent,
	utils = MM.libary.load('utils'),
	eventModule = MM.libary.load('eventModule'),
	permissions = MM.plugin.load('permissions');

// Register commands
MM._data.command = {
	dir: './commands/',
	loaded: {},
	prot: [],
};

MM.command = {
	load: function(x){ return MM._load(x, 'command') },
	unload: function(x){ return MM._unload(x, 'command') },
	reload: function(x){ return MM._reload(x, 'command') },
	all: function(){ return self._data.command.loaded; },
};

var prefixes = ['>'];

exports.setPrefix = function(arr){
	prefixes = _.isArray(arr) ? arr : [arr];
}

// Load all commands
exports.autoLoad = function(){
	
	var loadedCommands = [];
	
	utils.walkdir('./commands', function(err, result){
		if(err) throw err;
		_.each(_.filter(result, function(x){ return x.substr(-3) == ".js"; }), function(cmd){
			loadedCommands.push(cmd);
			MM.command.load(cmd);
		});
	});
	
	console.log("Loaded commands: ", loadedCommands.join(', '));
	
	return exports;
}

// Raw command object
function newCommand(args){
	var commandObject = {
		key: '',			// Handle key and command word
		nodes: ['run'],			// For permissions
		description: '',	// Text shown for commands in !help (leave empty to not show)
		// Settings
		active: true,		// Disable command
		user_timeout: 0,	// Interval in between the function can be used per user
		room_timeout: 0,	// Interval in between the function can be used in whole room
		room_only: false,	// Command can't be used in pm
		pm_only: false,		// Command can't be used in rooms
		abbreviations: [],	// Alternate command words
		available: function(req){ return true; },	// Check if the user is allowed to execute command, aside from access level
		
		subcommands: [],	// If first argument equals subcommand key, execute that.
		cache: {
			users: {},		// User cache, dissapears on reboot - includes 'lastused'
			rooms: {},		// Room cache, dissapears on reboot - includes 'lastused'
			global: {},		// Global cache for the command
		},
		run: function(req){}, //Execution function
	};
	return _.extend(commandObject, args);
}

// Register commands
var commands = {};

exports.findCommand = function(args){
	if(args.length === 0) return false;
	var cmd = _.first(args).toLowerCase();
	var command = _.find(commands, function(x){ return x.key == cmd || _.contains(x.abbreviations, cmd); });
	
	if(command){ // Found a command to run
		args.shift();
		
		if(args.length > 0){ // Check for sub command
			var subcmd =_.first(args).toLowerCase();
			var subcommand = _.find(command.subcommands, function(x){ return x.key == subcmd || _.contains(x.abbreviations, subcmd); });
			if(subcommand){
				command = subcommand;
				args.shift();
			}
		}
		
		return command;
	}
	
	return false;
}

exports.register = function(command){
	if(!_.has(command, 'key') || !_.has(command, 'run')) return false;
	
	eventModule.emit('event', 'registerCommand', command, function(command){
		// Register command
		commands[command.key] = newCommand(command);
		console.log("Registered command", command.key);
		// Register nodes
		permissions.register(command.key, commands[command.key].nodes);
	});
}

exports.registerSubCmd = function(key, command){
	if(!_.find(commands[key].subcommands, function(x){ return x.key == key; })){
		command.key = key;
		commands[key].subcommands.push(newCommand(command));
	}
	console.log("register subcommand", key);
}

// Handle requests

exports.request = function(args, cb){
	var req = args[0];
	
	var command_regex = new RegExp('^\\s*('+prefixes.join('|')+')([a-z].*)','i');
	var match = command_regex.exec(req.message.text);
	
	if(match){ // Prefix matches
		var parts = match[2].split(' ');
		parts = parts.filter(function(e) {return e}); //remove empty
		if(parts.length == 0) return false; //nothing left
		// Find a command
		var command = exports.findCommand(parts);
		if(command){
			if(req.perm && !req.perm('cmd.'+command.key+'.run')){
				console.log('User '+req.user.name+' does not have perm for cmd.'+command.key+'.run');
				return;
			}
			req.message.args = parts;
			eventModule.emit('event', 'command', command, req, function(){
				execute(command, req);
			});
		}
	}
	
}

function execute(command, req){
	console.log("EXECUTE", command.key, req.message.text);
	
	if(!command.active){
		console.log('['+req.room.name+']['+req.user.name+']['+command.key+'] DENIED, COMMAND INACTIVE');
		return;
	}
	
	if(!command.available(req)){
		console.log('['+req.room.name+']['+req.user.name+']['+command.key+'] DENIED, COMMAND AVAILABLE FALSE');
		return;
	}
	
	if(req.room.ispm && command.room_only){
		console.log('['+req.room.name+']['+req.user.name+']['+command.key+'] DENIED, COMMAND ROOM ONLY');
		return;
	}
	
	if(!req.room.ispm && command.pm_only){
		console.log('['+req.room.name+']['+req.user.name+']['+command.key+'] DENIED, COMMAND PM ONLY');
		return;
	}
	
	if(!command.cache.users.hasOwnProperty(req.user.name)) command.cache.users = {lastused:0};
	if(!command.cache.rooms.hasOwnProperty(req.room.name)) command.cache.rooms = {lastused:0};
	
	var now = +new Date/1000;
	
	if(!req.room.ispm && command.room_timeout > 0){
		if(now < (command.cache.rooms[req.room.name].lastused + command.room_timeout)){
			var room_timeout = (command.cache.rooms[req.room.name].lastused + command.room_timeout - now);
			console.log('['+req.room.name+']['+req.user.name+']['+command.key+'] DENIED, ROOM TIMEOUT: '+utils.secondsToString(room_timeout));
			return;
		}
	}
	
	if(command.user_timeout > 0){
		if(now < (command.cache.users[req.room.name].lastused + command.user_timeout)){
			var user_timeout = (command.cache.users[req.room.name].lastused + command.user_timeout - now);
			console.log('['+req.room.name+']['+req.user.name+']['+command.key+'] DENIED, USER TIMEOUT: '+utils.secondsToString(user_timeout));
			return;
		}
	}
	
	command.run(req);
	
	// Finish command
}
