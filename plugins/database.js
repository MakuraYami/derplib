"use strict";
// Require modules
var colors 	= require('colors'),
	_		= require('underscore');
	
var MM = module.parent,
	utils = MM.libary.load('utils'),
	saving = MM.libary.load('saving');

var data = false;

// Loading
new saving.file('./data/db.json').load().unzip().get(function(_data){
	console.log("DATABASE LOADED");

	data = _.isObject(_data) ? _data : {};
	
	if(!_.has(data, 'users')) data.users = {};
	if(!_.has(data, 'rooms')) data.rooms = {};
	if(!_.has(data, 'commands')) data.commands = {};
	if(!_.has(data, 'permissions')) data.permissions = {};
	
	exports.done();
});

// Saving

setInterval(function(){
	exports.save();
}, 60 * 1000);

// Database commands

exports.get = function(key){
	return _.has(data, key) ? data[key] : false;
}

exports.save = function(cb){
	if(data) new saving.file('./data/db.json').put(data).zip().save(cb);
}

// Plugin events

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