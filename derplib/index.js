"use strict";
// DerpLib main file
var _ = require('underscore');


var data = {
	rooms: {},
	pms: {},
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
	if(_.intersection(['room', 'account', 'password'], _.keys(options)).length === 3){
		if(_.has(data.rooms, options.room)) data.rooms[options.room].disconnect();
		return data.rooms[options.room] = new room(options);
	}
}
function newPM(options){
	if(_.intersection(['account', 'password'], _.keys(options)).length === 2){
		if(_.has(data.pms, options.account)) data.pms[options.account].disconnect();
		return data.pms[options.account] = new pm(options);
	}
}

//
// Exports
//

exports._data = data;
exports.events = events;
exports.Room = newRoom;
exports.PM = newPM;
exports.request = requests;
exports.MM = MM;