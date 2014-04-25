"use strict";
// Require modules
var fs 		= require('fs'),
	colors 	= require('colors'),
	_		= require('underscore');
	
var MM = module.parent,
	utils = MM.libary.load('utils'),
	saving = MM.libary.load('saving');

var data = false;

if(!fs.existsSync('./data')){
	fs.mkdirSync('./data');
}

// Loading
new saving.file('./data/db.json').load().unzip().get(function(_data){
	console.log("[DB] Loaded");

	data = _.isObject(_data) ? _data : {};
	
	if(!_.has(data, 'accounts')) data.accounts = {};
	if(!_.has(data, 'users')) data.users = {};
	if(!_.has(data, 'rooms')) data.rooms = {};
	if(!_.has(data, 'commands')) data.commands = {};
	if(!_.has(data, 'permissions')) data.permissions = {};
	
	_.each(data.rooms, function(room, name){
		if(room.settings.active && room.settings.type == 'room'){
			MM.parent.Room({room: name});
		}
	});
	
	exports.done();
});

// Saving

setInterval(function(){
	exports.save();
}, 60 * 1000);

// Database commands

exports.get = function(query, _default){
	if(~_.indexOf(query, '.')){
		var path = query.split('.');
		var result = data;
		_.each(path, function(part){
			if(result && _.has(result, part)) result = result[part];
			else result = _default || false;
		});
		return result;
	}else{
		return _.has(data, query) ? data[query] : _default || false;
	}
}

exports.set = function(query, value){
	if(~_.indexOf(query, '.')){
		var path = query.split('.');
		var result = data;
		_.each(path, function(part){
			if(result && _.has(result, part)) result = result[part];
			else result = _default || undefined;
		});
		if(result) result = value;
		return result;
	}else{
		var result = _.has(data, query) ? data[query] : _default || undefined;
		if(result) result = value;
		return result;
	}
}

exports.save = function(cb){
	if(data) new saving.file('./data/db.json').put(data).zip().save(cb);
}

// Plugin events

exports.newRoom = function(args){
	var room = args[0];
	if(!_.has(data.rooms, room.name)){
		data.rooms[room.name] = {settings:{}};
	}
	data.rooms[room.name].settings = _.extend(room._settings, data.rooms[room.name].settings);
	room._settings = data.rooms[room.name].settings;
	room.data = data.rooms[room.name];
}

exports.request = function(args){
	var req = args[0];
	
	// Create user data
	if(req.user.type == 'user'){
		if(!_.has(data.users, req.user.name)) data.users[req.user.name] = {};
		req.user.data = data.users[req.user.name];
	}
	
	if(!_.has(data.rooms, req.room.name)) data.rooms[req.room.name] = {};
	req.room.data = data.rooms[req.room.name];
}

exports.registerCommand = function(args){
	var key = args[0];
	var command = args[1];
	// Edit command.settings
	if(_.has(data.commands, key))
		command.settings = data.commands[key];
}