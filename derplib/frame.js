//
// All credits to WIC by lumirayz
// deserialization of frames.
//

//
// Requires
//
var _ = require("underscore");

//
// Utility
//
function makePremium(num) {
	return {
		media: (num & 16) == 16,
		bg: (num & 8) == 8};
}

function makeUser(name, alias, id, key, ip) {
	return {
		name: 	name  != "" ? name  : undefined,
		alias: 	alias != "" ? alias : undefined,
		id: 	id 	  != "" ? id    : undefined,
		key: 	key   != "" ? key   : undefined,
		ip: 	ip    != "" ? ip    : undefined};
}


//
// Frame parsing
//
var frameTypesRoom = {
	ok: function(owner, myuid, mystatus, myname, jointime, myip, mods) {
		return {
			type: "ok",
			owner: owner,
			myuid: myuid,
			mystatus: mystatus,
			myname: myname,
			jointime: jointime,
			myip: myip,
			mods: mods.split(";")};
	},
	
	inited: function() {
		return {type: "inited"};
	},
	
	premium: function(_noidea, expire) {
		return {type: "premium", expire: expire};
	},
	
	pwdok: function() {
		return {type: "pwdok"};
	},
	
	badlogin: function() {
		return {type: "badlogin"};
	},
	
	tb: function(seconds) {
		return {type: "tb", time: seconds};
	},
	
	show_fw: function() {
		return {type: "show_fw"};
	},
	
	show_tb: function(seconds) {
		return {type: "show_tb", time: seconds};
	},
	
	delete: function(msgid) {
		return {type: "delete", msgid: msgid};
	},
	
	deleteall: function() {
		return {type: "deleteall", msgids: _.toArray(arguments)};
	},
	
	clearall: function() {
		return {type: "clearall"};
	},
	
	mods: function(mods) {
		return {type: "mods", mods: _.toArray(arguments)};
	},
	
	i: function(time, name, alias, user_id, user_key, msgid, ip, prem, _noidea) {
		return {
			time: parseFloat(time),
			type: "i",
			user: makeUser(name, alias, user_id, user_key, ip),
			msgid: msgid,
			premium: makePremium(parseInt(prem, 10)),
			body: _.toArray(arguments).slice(9).join(":")};
	},
	
	b: function(time, name, alias, user_id, user_key, number, ip, prem) {
		return {
			time: parseFloat(time),
			type: "b",
			user: makeUser(name, alias, user_id, user_key, ip),
			number: number,
			premium: makePremium(parseInt(prem, 10)),
			body: _.toArray(arguments).slice(9).join(":")};
	},
	
	u: function(msgnum, msgid) {
		return {type: "u", number: msgnum, msgid: msgid};
	},
	
	n: function(num) {
		return {type: "n", count: parseInt(num, 16)};
	},

	g_participants: function(){
		var args = _.toArray(arguments),
			participants = [];
		for(var i=0; i<args.length; i+= 5){
			if(args[i+1] != NaN && args[i+2] != undefined && args[i+3] != undefined){
				var name = args[i+3],
					user_id = args[i+2];
				participants.push({
					time: parseFloat(args[i+1]),
					user: makeUser(name, '', user_id, '', '')
				});
			}
		}
		return {type: "g_participants", participants: participants};
	},

	participant: function(number, _noidea, user_id, name, _noidea, _noidea, time){
		return {
			number: number,
			type: "participant",
			user: makeUser(name, '', user_id, '', ''),
			time: parseFloat(time)};
	},

	bansearchresult: function(_noidea, name, ip, unid, bansrc, timep1, timep2, timep3){
		var time = new Date(Date.parse(String(String(timep1.split(' ').join('T'))+':'+String(timep2)+':'+String(timep3)+'.000')));
		return {
			type: "bansearchresult",
			name: name,
			ip: ip,
			unid: unid,
			bansrc: bansrc,
			time: String(time)};
	},

	blocklist: function() {
		var args = _.toArray(arguments),
			banlist = [];
		for(var i=0; i<args.length; i+= 4){
			if(args[i+1] != undefined && args[i+2] != undefined && args[i+3] != undefined && args[i+4] != undefined){ 
				if(args[i].match(/;/)){
					var unid = args[i].split(';')[1];
				}else{
					var unid = args[i];
				}
				if(args[i+4].match(/;/)){
					var bansrc = args[i+4].split(';')[0];
				}else{
					var bansrc = args[i+4];
				}
				banlist.push({
					unid: unid,
					ip: args[i+1],
					name: args[i+2],
					time: args[i+3],
					bansrc: bansrc
				});
			}
		}
		return {type: "blocklist", banlist: banlist};
	},
	
	blocked: function(unid, ip, name, bansrc, time) {
		return {
			type: "blocked",
			unid: unid,
			ip: ip,
			name: name,
			bansrc: bansrc,
			time: time};
	},
	
	unblocked: function(unid, ip, name, unbansrc, time) {
		return {
			type: "unblocked",
			unid: unid,
			ip: ip,
			name: name,
			unbansrc: unbansrc,
			time: time};
	}
};

var frameTypesPM = {
	OK: function() {
		return {type: "ok"};
	},
	settings: function(a, disabe_idle_time, b, allow_anon, c, email_offline_msg) {
		return {
			type: "settings",
			disabe_idle_time: disabe_idle_time == "on",
			allow_anon: allow_anon == "on",
			email_offline_msg: email_offline_msg  == "on"};
	},
	wl: function() {
		var args = _.toArray(arguments),
			contacts = [];
		for(var i=0; i<args.length; i+= 4){
			contacts.push({
				name: args[i],
				time: args[i+1],
				state: args[i+2],
				idle: args[i+3]
			});
		}
		return {type: "wl", contacts: contacts};
	},
	premium: function(prem, time) {
		return {
			type: "premium",
			premium: makePremium(parseInt(prem, 10)),
			time: parseFloat(time)};
	},
	idleupdate: function(name, state) {
		return {
			type: "idleupdate",
			name: name,
			state: state == "1" ? 'on' : 'idle'};
	},
	msg: function(name, alias, prem, time) {
		return {
			type: "msg",
			time: parseFloat(time),
			user: makeUser(name, alias, '', '', ''),
			premium: makePremium(parseInt(prem, 10)),
			body: _.toArray(arguments).slice(5).join(":")};
	},
	msgoff: function (name, alias, prem, time) {
		return {
			type: "msgoff",
			time: parseFloat(time),
			user: makeUser(name, alias, '', '', ''),
			premium: makePremium(parseInt(prem, 10)),
			body: _.toArray(arguments).slice(5).join(":")};
	},
	status: function(name, time, state) {
		return {
			type: "status",
			name: name,
			time: parseFloat(time),
			state: state};
	},
	wloffline: function(name, time) {
		return {
			type: "wloffline",
			name: name,
			time: parseFloat(time)};
	},
	wlonline: function(name, time) {
		return {
			type: "wlonline",
			name: name,
			time: parseFloat(time)};
	},
	reload_profile: function(name) {
		return {
			type: "reload_profile",
			name: name};
	},
	wladd: function(name, state, time) {
		return {
			type: "wladd",
			name: name,
			state: state,
			time: parseFloat(time)};
	},
	connect: function(name, time, state) {
		return {
			type: "connect",
			name: name};
	},
	show_fw: function() {
		return {type: "show_fw"};
	}
};

function parseFramePM(data) {
	data = data.replace(/[\r\n\0]+$/, "");
	var
		tmp = data.split(":"),
		cmd = tmp[0],
		args = tmp.slice(1);
	if(frameTypesPM.hasOwnProperty(cmd)) {
		return frameTypesPM[cmd].apply(null, args);
	}
	else {
		return null;
	}
};


function parseFrameRoom(data) {
	data = data.replace(/[\r\n\0]+$/, "");
	var
		tmp = data.split(":"),
		cmd = tmp[0],
		args = tmp.slice(1);
	if(frameTypesRoom.hasOwnProperty(cmd)) {
		return frameTypesRoom[cmd].apply(null, args);
	}
	else {
		return null;
	}
};

//
// Exports
//

exports.parseFramePM = parseFramePM;
exports.parseFrameRoom = parseFrameRoom;
