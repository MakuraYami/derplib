'use strict';
///////////////////
// Base requires //
var util 		= require('util'),
	events 		= require('events'),
	url			= require('url'),
	_			= require('underscore'),
	colors 		= require('colors');

var MM 		= module.parent,
	utils 	= MM.libary.load('utils');
	
function Request(room) {
	this.room = room;
	this.user = false;
	this.message = false;
}

util.inherits(Request, events.EventEmitter);

Request.prototype.parseMessage = function(frame) {
	var message = {
		room:		this.room.name,
		stime:		frame.time, // Server time
		name: 		frame.user.name,
		alias: 		frame.user.alias,
		user_id: 	frame.user.user_id,
		user_key: 	frame.user.user_key, //mod only
		number: 	frame.number,
		ip: 		frame.ip, //mod only
		user_number: frame.user.id,
		body: 		frame.body,
		id: false, 	//is filled in later
		
		time: (+new Date),
		deleted: false,
	};
	
	if(message.name && message.alias === undefined) message.type = 'user';
	else if(message.name === undefined && message.alias) message.type = 'temp';
	else message.type = 'anon';
	
	//CONTINUE
	message.text = utils.html_decode(utils.html_remove(message.body));
	message.nameColor = /<n([0-9a-f]*)\/>/gi.exec(message.body);
	message.nameColor = message.nameColor ? message.nameColor[1] : false;
	var fontMatches = /<f x([0-9]{2})([0-9a-f]{3,6})?="([0-9]*?)">/gi.exec(message.body);
	if(fontMatches){
		message.fontSize = fontMatches[1];
		message.fontColor = fontMatches[2];
		message.fontFace = fontMatches[3];
	}
	if(message.type == 'anon') {
		message.name = '_anon' + utils.getAnonId(message.nameColor, message.user_id);
	}
	else if(message.type == 'user'){
		if(this.room.mods.indexOf(message.name) != -1) message.access = 1;
		if(this.room.admin == message.name) message.access = 2;
	}
	
	//Extra
	var self = this;
	message.links = [];
	var links = message.text.match(/(\b(http:\/\/|www.)[^\s]*)/gi);
	_.each(links, function(link){
		link = url.parse(link);
		if(!link.host) return;
		link.isImage = /(.gif|.jpeg|.jpg|.png)$/i.test(link.pathname);
		link.isYoutube = (link.host.indexOf('youtube.com') != -1 && link.search);
		if(link.isYoutube){
			var youtubeId = link.search.split('v=')[1];
			if(youtubeId){
				var ampersandPosition = youtubeId.indexOf('&');
				if(ampersandPosition != -1){
				  link.youtubeId = youtubeId.substring(0, ampersandPosition);
				}else{
					link.youtubeId = youtubeId;
				}
			}else{
				link.isYoutube = false;
			}
		}
		message.links.push(link);
	});
	this.message = message;
	this.user = frame.user;
}

Request.prototype.parsePMMessage = function(frame) {
	var message = {
		//room:		this.room.name,
		stime:		frame.time, // Server time
		//name: 		frame.user.name.toLowerCase(),
		//alias: 		frame.user.alias,
		number: 	undefined,
		premium: 	frame.premium,
		body: 		frame.body,
		id: 		undefined,
		
		time: +new Date,
		deleted: false,
	};
	
	//message.type = 'user'; // parse this properly
	
	message.text = utils.html_decode(utils.html_remove(message.body));

	this.message = message;
	this.user = frame.user;
}

Request.prototype.write = function(body){
	this.room.message(body, this.user.name);
}

// Database format

Request.prototype.messageObject = function(){
	return {
		room: this.room.name,
		name: this.user.name,
		alias: this.user.alias,
		user_id: this.user.id,
		user_key: this.user.key,
		number: this.message.number,
		ip: this.message.ip,
		user_number: this.user.number,
		id: this.message.id,
		body: this.message.body,
	};
}

Request.prototype.debug = function(){
	console.log('----------------- REQUEST DEBUG --------------');
	console.log('PRINT: request.room');
	console.log(_.reduce(this.room, function(x,y,z){ if(z.substr(0,1) != '_') x[z] = y; return x; }, {}));
	console.log('PRINT: request.user');
	console.log(_.reduce(this.user, function(x,y,z){ if(z.substr(0,1) != '_') x[z] = y; return x; }, {}));
	console.log('PRINT: request.message');
	console.log(_.reduce(this.message, function(x,y,z){ if(z.substr(0,1) != '_') x[z] = y; return x; }, {}));
	console.log('----------------- END REQUEST DEBUG ----------');
}

//
// Exports
//
exports.make = Request;
