"use strict";
// DerpLib main file
var _ = require('underscore');


var data = {
	rooms: {},
	pms: {},
	accounts: {},
	defaultAccount: false,
}

//
// Requires
//

var MM = require(__dirname+'/moduleManager').instance,
	room		= MM.libary.load('ch_room').Room,
	pm			= MM.libary.load('ch_pm').PM,
	requests	= MM.libary.load('ch_requests'),
	events		= MM.libary.load('eventModule');

// Make DerpLib Available everywhere via Module Manager
MM.setParent(exports);

// Functions
function newRoom(options){
	if(_.has(options, 'room') && (_.has(options, 'account') || data.defaultAccount) ){
		options.account = options.account || data.defaultAccount;
		options.password = options.password || data.accounts[options.account.toLowerCase()];
		options.room = options.room.toLowerCase();
		if(_.has(data.rooms, options.room)){
			data.rooms[options.room].disconnect();
		}
		return data.rooms[options.room] = new room(options);
	}
}
function newPM(options){
	if(_.has(options, 'account') || data.defaultAccount){
		options.account = options.account || data.defaultAccount;
		options.password = options.password || data.accounts[options.account.toLowerCase()];
		if(_.has(data.pms, options.account)){
			data.pms[options.account].disconnect();
		}
		return data.pms[options.account] = new pm(options);
	}
}
function getRoom(name){
	return _.has(data.rooms, name.toLowerCase()) ? data.rooms[name.toLowerCase()] : false;
}
function getPM(name){
	return _.has(data.pms, name.toLowerCase()) ? data.pms[name.toLowerCase()] : false;
}
function addAccount(username, password){
	if(data.defaultAccount === false) data.defaultAccount = username;
	data.accounts[username] = password;
}

//
// Exports
//

exports._data = data;
exports.events = events;
exports.Room = newRoom;
exports.getRoom = getRoom;
exports.PM = newPM;
exports.getPM = getPM;
exports.request = requests;
exports.MM = MM;
exports.addAccount = addAccount;
