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
	
	// Check for required keys
	_.each(['accounts', 'users', 'rooms', 'commands', 'permissions', 'files'], function(key){
		if(!_.has(memory.data, key)) memory.data[key] = {};
	});
	
	// Load all files
	_.each(memory.data.files, function(file){
		new saving.file('./data/'+file+'.json').load().unzip().get(function(_data){
			memory[file] = _data;
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

exports.get = function(query, db, _default){
	db = db || 'data';
	if(~_.indexOf(query, '.')){
		var path = query.split('.');
		var result = memory[db];
		_.each(path, function(part){
			if(result && _.has(result, part)) result = result[part];
			else result = _default || undefined;
		});
		return result;
	}else if(query === ''){
		return memory[db] ? memory[db] : _default || undefined;
	}else{
		return _.has(memory[db], query) ? memory[db][query] : _default || undefined;
	}
}

exports.set = function(query, value, db){
	db = db || 'data';
	if(~_.indexOf(query, '.')){
		var path = query.split('.');
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
	}else{
		if(_.has(memory[db], query)){
			memory[db][query] = value;
			return memory[db][query];
		}
		else return undefined;
	}
}

exports.create = function(query, value, db){
	db = db || 'data';
	value = value || {};
	if(~_.indexOf(query, '.')){
		var path = query.split('.');
		var last = path.pop();
		var result = memory[db];
		_.each(path, function(part){
			if(!_.has(result, part)) result[part] = {};
			result = result[part];
		});
		if(!_.has(result, last)){
			result[last] = value;
			return result[last];
		}
		else return undefined;
	} else {
		if(query === ''){
			memory[db] = value;
			return memory[db];
		}if(!_.has(memory[db], query)){
			memory[db][query] = value;
			return memory[db][query];
		}
		else return undefined;
	}
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
	
	if(!_.has(memory.data.rooms, req.room.name) && !req.room.ispm) memory.data.rooms[req.room.name] = {};
	if(!req.room.ispm) req.room.data = memory.data.rooms[req.room.name];
	
	if(!_.has(memory.data.pms, req.room._accountLC) && req.room.ispm) memory.data.pms[req.room._accountLC] = {};
	if(req.room.ispm) req.room.data = memory.data.pms[req.room._accountLC];
	
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

exports.addFile = function(file){
	if(!_.has(memory, file)){
		new saving.file('./data/'+file+'.json').load().unzip().get(function(_data){
			if(_data){
				memory[file] = _data;
			}else{
				memory[file] = {};
			}
		});
	}
	if(!_.has(memory.data, 'files')){exports.create('files', []);}
	if(-1 === memory.data.files.indexOf(file)){ memory.data.files.push(file);}
}
