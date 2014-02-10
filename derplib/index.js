"use strict";
// DerpLib main file

//
// Requires
//

var MM = require(__dirname+'/moduleManager').instance,
	room		= MM.libary.load('ch_room').Room,
	pm			= MM.libary.load('ch_pm').PM,
	requests	= MM.libary.load('ch_requests'),
	events		= MM.libary.load('eventModule');
	

//
// Exports
//

exports.events = events;
exports.Room = room;
exports.request = requests;
exports.PM = pm;
exports.MM = MM;