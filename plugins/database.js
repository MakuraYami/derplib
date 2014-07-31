"use strict";
// Require modules
var fs 		= require('fs'),
	colors 	= require('colors'),
	_		= require('underscore');
	
var MM = module.parent,
	utils = MM.libary.load('utils'),
	saving = MM.libary.load('saving');

// Data storage
var memory = {data: false};
var cache = {users: {}, rooms: {}, commands: {}};

// Check if the data directory exists, if not make it
if(!fs.existsSync('./data')){
	fs.mkdirSync('./data');
}

// Loading
new saving.file('./data/data.json').load().unzip().get(function(_data){
	console.log("[DB] Loaded");
	
	// Set loaded data in memory
	memory.data = _.isObject(_data) ? _data : {};
	
	// Check for required keys for objects
	_.each(['accounts', 'users', 'rooms', 'commands', 'permissions', 'files'], function(key){
		if(!_.has(memory.data, key)){
			if(key == 'files')
				memory.data[key] = [];
			else
				memory.data[key] = {};
		}
	});
	
	// Load all files
	console.log('[DB] Files to load: ', memory.data.files);
	_.each(memory.data.files, function(file){
		new saving.file('./data/'+file+'.json').load().unzip().get(function(_data){
			console.log('[DB] Loaded file', file);
			memory[file] = _data || {};
		});
	});
	
	// Join active rooms
	_.each(memory.data.rooms, function(room, name){
		if(room.settings.active && room.settings.type == 'room'){
			MM.parent.Room({room: name});
		}
	});
	
	// Saving
	setInterval(function(){
		exports.save();
	}, 60 * 1000);
	
	// Finished
	exports.done();
});

// Database commands

exports.addFile = function(file){
	if(!_.has(memory, file)) {
		memory[file] = {};
	}
	exports.create('files', []);
	if(!~_.indexOf(memory.data.files, file)) {
		memory.data.files.push(file);
	}
}

exports.all = function(){
	return memory;
}

exports.get = function(query, db, _default){
	db = db || 'data';
	if(~_.indexOf(query, '.') || _.isArray(query)){
		var path = _.isArray(query) ? query : query.split('.');
		var result = memory[db];
		_.each(path, function(part){
			if(result && _.has(result, part)) result = result[part];
			else result = _default || undefined;
		});
		return result;
	} else if(query) {
		return _.has(memory[db], query) ? memory[db][query] : _default || undefined;
	}
}

exports.getat = function(query, key, db, _default){
	return exports.get(query+'.'+key, db, _default);
}

exports.set = function(query, value, db){
	db = db || 'data';
	if(~_.indexOf(query, '.') || _.isArray(query)){
		var path = _.isArray(query) ? query : query.split('.');
		var last = path.pop();
		var result = memory[db];
		_.each(path, function(part){
			if(result && _.has(result, part)) result = result[part];
			else result = undefined;
		});
		if(result && (_.has(result, last) || _.isObject(result))){
			result[last] = value;
			return result[last];
		}
		else return undefined;
	} else if(query) {
		if(_.has(memory[db], query)){
			memory[db][query] = value;
			return memory[db][query];
		}
		else return undefined;
	}
}

exports.setat = function(query, key, value, db){
	return exports.set(query+'.'+key, value, db);
}

exports.create = function(query, value, db){
	if(value === undefined) value = {};
	var source = db ? memory[db] : memory.data;
	/*if(_.isObject(query) && undefined !== db){
		if(!_.has(source, value)){
			return query[value] = db;
		};
		return undefined;
	};*/
	if(~_.indexOf(query, '.') || _.isArray(query)){
		var path = _.isArray(query) ? query : query.split('.');
		var last = path.pop();
		var result = source;
		_.each(path, function(part){
			if(!_.has(result, part)) result[part] = {};
			result = result[part];
		});
		if(!_.has(result, last)){
			return result[last] = value;
		}
		else return undefined;
	} else if(query) {
		if(!_.has(source, query)){
			return source[query] = value;
		}
		else return undefined;
	}
}

exports.createat = function(query, key, value, db){
	return exports.create(query+'.'+key, value, db);
}

exports.save = function(cb){
	var complete = 0;
	_.each(memory, function(_data, key){
		if(_data){
			new saving.file('./data/'+key+'.json').put(_data).zip().save(function(){
				complete++;
				checkComplete();
			});
		}
	});
	function checkComplete(){
		if(cb && complete == _.size(memory)) cb();
	}
}

// Plugin events

exports.newRoom = function(args){
	var room = args[0];
	if(!_.has(memory.data.rooms, room.name)){
		memory.data.rooms[room.name] = {settings:{}};
	}
	memory.data.rooms[room.name].settings = _.extend(room._settings, memory.data.rooms[room.name].settings);
	room._settings = memory.data.rooms[room.name].settings;
	room.data = memory.data.rooms[room.name];
	
	if(!_.has(cache.rooms, room.name)) cache.rooms[room.name] = {};
	room.cache = cache.rooms[room.name];
}

exports.request = function(args){
	var req = args[0];
	
	// Create user data
	if(req.user.type == 'user'){
		if(!_.has(memory.data.users, req.user.name)) memory.data.users[req.user.name] = {};
		req.user.data = memory.data.users[req.user.name];
	}
	
	if(!_.has(memory.data.rooms, req.room.name)) memory.data.rooms[req.room.name] = {};
	req.room.data = memory.data.rooms[req.room.name];
	
	if(!_.has(cache.users, req.user.name)) cache.users[req.user.name] = {};
	req.user.cache = cache.users[req.user.name];
}

exports.registerCommand = function(args){
	var command = args[0];
	if(!_.has(cache.commands, command.key)) cache.commands[command.key] = {users: {},rooms: {},global: {}};
	command.cache = cache.commands[command.key];
	// Edit command.settings
	if(_.has(memory.data.commands, command.key)){
		command = _.extend(command, memory.data.commands[command.key]);
	}
}