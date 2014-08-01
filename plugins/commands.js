"use strict";
// Base modules
var _ 	= require('underscore');

// Derplib modules
var MM 			= module.parent,
	utils 		= MM.libary.load('utils'),
	eventModule = MM.libary.load('eventModule'),
	db 			= MM.plugin.load('database'),
	permissions = MM.plugin.load('permissions');

// data
var commands = {};

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
	all: function(){ return MM._data.command.loaded; },
};

// Load all commands
exports.autoLoad = function(){
	
	utils.walkdir('./commands', function(err, result){
		if(err) throw err;
		_.each(_.filter(result, function(x){ return x.substr(-3) == ".js"; }), function(cmd){
			MM.command.load(cmd);
		});
	});
	
	return exports;
}

exports.get = function(cmd){
	if(undefined == cmd)
		return commands;
	else if(_.has(commands, cmd))
		return commands[cmd];
	else if(~cmd.indexOf('-')){
		
	} else
		return false;
}

// Raw command object
function newCommand(args){
	var commandObject = {
		key: '',			// Handle key and command word
		access: false,		// Required access level
		nodes: ['run'],		// For permissions
		prefixes: [],		// If not empty over-writes default prefixes
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
		// Register nodes
		//permissions.register(command.key, commands[command.key].nodes);
	});
}

exports.registerSubCmd = function(key, command){
	if(!key || !command || !_.has(command, 'key') || !_.has(command, 'run')) return false;
	if(!_.find(commands[key].subcommands, function(x){ return x.key == command.key; })){
		commands[key].subcommands.push(newCommand(command));
	}
}

// Handle requests

exports.request = function(args, cb){
	var req = args[0];
	
	var data = db.get('commands');
	
	if(!_.has(data, 'prefixes') || data.prefixes.length == 0) data.prefixes = ['-'];
	
	var prefixList = _.reduce(data.prefixes, function(list, prefix){
		if(prefix) list.push('\\'+prefix);
		return list;
	}, []);
	
	var command_regex = new RegExp('^\\s*('+prefixList.join('|')+')([a-z].*)','i');
	var match = command_regex.exec(req.message.text);
	
	if(match){ // Prefix matches
		var parts = match[2].split(' ');
		parts = parts.filter(function(e) {return e}); //remove empty
		if(parts.length == 0) return false; //nothing left
		// Find a command
		var command = exports.findCommand(parts);
		if(command){
			// Add the command 
			req.command = command;
			if(req.perm){
				if(req.perm('cmd.'+command.key+'.run')){
					// Execute command
					req.message.args = parts;
					eventModule.emit('event', 'command', command, req, function(){
						execute(command, req);
					});
				}else{
					console.log('User '+req.user.name+' does not have permission for cmd.'+command.key+'.run');
				}
			}else{
				console.log('Request for '+req.user.name+' did not have perm function');
			}
		}
	}
	
}

function execute(command, req){
	console.log("["+req.room.name+"]["+req.user.name+"]["+command.key+']', req.message.args.join(' '));
	
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
	
	if(!_.has(command.cache.users, req.user.name)) command.cache.users = {lastused:0};
	if(!_.has(command.cache.rooms, req.room.name)) command.cache.rooms = {lastused:0};
	
	var now = new Date/1000;
	
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
	
	eventModule.emit('beforeCommand', req);
	command.run(req);
	
	// Finish command
}
