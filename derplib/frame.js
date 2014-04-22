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
	
	premium: function(premium, expire) {
		return {
			type: "premium",
			premium: makePremium(premium),
			expire: parseInt(expire)};
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
	
	end_fw: function() {
		return {type: "end_fw"};
	},
	
	show_tb: function(seconds) {
		return {type: "show_tb", time: seconds};
	},
	
	"delete": function(msgid) {
		return {type: "delete", msgid: msgid};
	},
	
	deleteall: function() {
		return {type: "deleteall", msgids: _.toArray(arguments)};
	},
	
	clearall: function(answer) {
		return {type: "clearall", answer: answer};
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
	
	blocked: function(unid, ip, name, by, time) {
		return {
			type: "blocked",
			unid: unid,
			ip: ip,
			name: name,
			by: by,
			time: time};
	},
	
	unblocked: function(unid, ip, name, banner, time) {
		return {
			type: "unblocked",
			unid: unid,
			ip: ip,
			name: name,
			banner: banner,
			time: time};
	},
	
	// Test this
	blocklist: function() {
		var bans = _.reduce(_.toArray(arguments).join(':').split(';'), function(bans, args){
			if(args){
				args = args.split(':');
				if(args[0].match(/;/)){
					var key = args[0].split(';')[1];
				}else{
					var key = args[0];
				}
				var ban = makeUser(args[2], "", "", key, args[1]);
				ban.time = parseFloat(args[3]);
				if(args[4].match(/;/)){
					ban.by = args[4].split(';')[0];
				}else{
					ban.by = args[4];
				}
				bans[ban.name] = ban;
				return bans;
			}else{
				bans = {};
				return bans;
			}
		},{});
		return {
			type: "blocklist",
			bans: bans};
	},
	
	unblocklist: function() {
		var unbans = _.reduce(_.toArray(arguments).join(':').split(';'), function(unbans, args){
			if(args){
				args = args.split(':');
				if(args[0].match(/;/)){
					var key = args[0].split(';')[1];
				}else{
					var key = args[0];
				}
				var unban = makeUser(args[2], "", "", key, args[1]);
				unban.time = parseFloat(args[3]);
				if(args[4].match(/;/)){
					unban.by = args[4].split(';')[0];
				}else{
					unban.by = args[4];
				}
				unbans[unban.name] = unban;
				return unbans;
			}else{
				unbans = {};
				return unbans;
			}
		},{});
		return {
			type: "unblocklist",
			unbans: unbans};
	},
	
	bansearchresult: function(_noidea, name, ip, key, by, date){
		if(undefined === name){
			return {type: "bansearchresult", result: false};
		}
		var result = makeUser(name, "", "", key, ip);
		result.time = Math.round(new Date(date)/1000);
		result.by = by;
		return {type: "bansearchresult",result: result};
	},
	
	g_participants: function(){
		var users = _.reduce(_.toArray(arguments).join(':').split(';'), function(users, args){
			args = args.split(':');
			if(args[3] === "None") args[3] = "";
			if(args[4] === "None") args[4] = "";
			var user = { 
				user: makeUser(args[3], args[4], args[2], "", ""),
				sess: args[0],
				time: parseFloat(args[1])
			};
			users[user.sess] = user;
			return users;
		},{});
		return {
			type: "g_participants",
			users: users};
	},
	
	participant: function(mode, sess, user_id, name, alias, ip, time) {
		if(name === "None") name = "";
		if(alias === "None") alias = "";
		return {
			type: "participant",
			time: parseFloat(time),
			sess: sess,
			mode: ( mode == "0" ? "leave" : mode == "1" ? "join" : mode == "2" ? "change" : undefined ),
			user: makeUser(name, alias, user_id, "", "")
		};
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
			state: state == "1" ? 'online' : 'idle'};
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
			name: name,
			time: parseInt(time),
			state: state};
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
