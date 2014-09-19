'use strict';
///////////////////
// Base requires //
var util 		= require('util'),
	events 		= require('events'),
	url			= require('url'),
	http		= require('http'),
	querystring = require('querystring'),
	_			= require('underscore'),
	colors 		= require('colors');

var MM = module.parent,
	DerpLib = MM.parent,
	socket 	= MM.libary.load('socket'),
	weights = MM.libary.load('weights'),
	utils 	= MM.libary.load('utils'),
	frame 	= MM.libary.load('frame'),
	request = MM.libary.load('request'),
	eventModule = MM.libary.load('eventModule');

///////////////////
// Chatango Room //

function Room(options) {
    events.EventEmitter.call(this);
	
	options = options || {};
	// Available options: account, password, uid, host, reconnect
	if(!options.room) return;
	
	// Public vars
	this.name = options.room.toLowerCase();
	this.ispm = false;
	this.admin = false;
	this.mods = [];
	this.users = {};
	this.usercount = 0;
	// Private vars
	this._account = options.account || false;
	this._accountLC = this._account ? this._account.toLowerCase() : false;
	this._password = options.password || false;
	this._loggedIn = false;
	this._uid = options.uid || utils.genUid();
	this._user_id = String(this._uid).substr(0, 8);
	this._host = options.host || weights.getServerHost(this.name);
	this._writeLock = false;
	this._isAdmin = false;
	this._isModerator = false;
	this._messages = [];
	this._bans = {};
	this._bannedWordsPartly = [];
	this._bannedWordsExact = [];
	this._settings = {
		type: 'room',
		active: true,
		blocked: false,
		autoReconnect: options.reconnect || true,
		reconnectDelay: 5,
		consoleFilter: ['i', 'b', 'u', 'n', 'g_participants', 'participant', 'premium'],
		g_participants: true,
		maxConTime: 0,
		useBackground: true,
		useRecording: false,
		nameColor: '000',
		textSize: '11',
		textColor: 'F00',
		textFont: '8',
		htmlEntenyConert: true,
	};
	
	var self = this;
	
	eventModule.emit("event", "newRoom", this, function(){
		// May not be changed
		self._settings.type = 'room';
		
		if(self._settings.blocked){
			console.log('['+self.name+'] This room is blocked, aborting join.');
			return;
		}
		
		self._settings.active = true;
		
		self._sock = new socket.Instance( self._host );
		self._onAuth();
	});


}

util.inherits(Room, events.EventEmitter);

Room.prototype._onAuth = function(){
	
	var self = this;
	
	/////////////////////
	// Socket Handlers //
	
	this._sock.on('onconnect', function() {
		
		if(!self._settings.active){
			self.disconnect();
			return;
		}
		
		if(self._account)
			self.write(['bauth', self.name, self._uid, self._account, self._password]);
		else
			self.write(['bauth', self.name, self._uid, '', '']);
		
		self._sock.setWriteLock(true);
		
		if(self._settings.maxConTime){
			setTimeout(function(){
				self.reconnect();
			}, self._settings.maxConTime * 1000);
		}
		
	});
	
	this._sock.on('error', function(exception) {
		console.log(('['+self.name+'] Socket ERROR:').bold.red, exception);
	});
	
	this._sock.on('timeout', function(exception) {
		console.log(('['+self.name+'] Socket TIMEOUT:').bold.red, exception);
	});
	
	this._sock.on('close', function() {
		if(self._settings.autoReconnect){
			console.log(('['+self.name+'] Socket closed, reconnecting...').bold.red);
			setTimeout(function(){
				self._sock.connect();
			}, self._settings.reconnectDelay * 1000);
		}else{
			console.log(('['+self.name+'] Socket closed, reconnect is off').bold.red);
		}
	});
	
	this._sock.on('data', function(data) {
		
		data = data.replace(/[\r\n\0]+$/, "");
		
		var args = data.split(':');
		
		if(self._settings.consoleFilter.indexOf(args[0]) == -1 && self._settings.consoleFilter.indexOf('all') == -1)
			console.log('['+self.name+']', data);
		
		var _frame = frame.parseFrameRoom(data);
		
		if(_frame && self.listeners('frame_'+_frame.type).length > 0){
			try {
				self.emit('frame_'+_frame.type, _frame);
			}
			catch(e){
				console.log('['+self.name+'] Error:', e.stack.split('\n').slice(0,4).join(''));
			}
		}
	});
	
	this._sock.on('write', function(data){
		if(data) console.log('['+self.name+'][WRITE]', data);
	});
	
	///////////////////////
	// Chatango handlers //
	
	this.on('frame_denied', function(_frame){
		console.log(('['+this.name+'] Socket connection denied!').bold.red);
		this._settings.autoReconnect = false;
		this.disconnect();
	});
	
	this.on('frame_ok', function(_frame) {
		
		// M = logged in, C = bad login
		this._loggedIn = _frame.mystatus == 'M';
		
		if(this._account && !this._loggedIn){
			console.log(('['+this.name+'] Login Failed!').bold.red);
			this._settings.autoReconnect = false;
			this.disconnect();
			return;
		}
		self.bans = {};
		self.users = {};
		self.admin = _frame.owner;
		self.mods = _frame.mods;
		self.checkModStatus();
	});
	
	this.on('frame_pwdok', function(_frame) {
		self._loggedIn = true;
		self.write(['getpremium', '1']);
		self.checkModStatus();
		self.emit('loggedin');
	});
	
	this.on('frame_logoutok', function(_frame) {
		self._loggedIn = false;
		self.emit('logout');
	});
	
	this.on('frame_inited', function(args) {
		
		self._sock.setWriteLock(false);
		
		self.write(['getpremium', '1']);
		self.write(['g_participants','start']);
		self.getBannedWords();
		self.getBans();
		self.emit('joined');
	});
	
	/////////////////////
	// Data management //
	
	this.on('frame_i', function(_frame) {
		var req = new request.make(self);
		req.parseMessage(_frame);
		
		self._messages.push(req.message);
		if(self._messages.length > 100)
			self._messages.shift();
		
		var users = _.filter(self.users, function(user){ return user.id == req.user.id; });
		_.each(users, function(user){
			if(req.user.key) user.key = req.user.key;
			if(req.user.ip) user.ip = req.user.ip;
		});
		if(users.length === 0){
			self.users[req.user.id] = req.user;
		}
		
		eventModule.emit('event', 'RoomOffMsg', req);
	});
	
	this.on('frame_b', function(_frame) {
		
		// Parse Room
		var req = new request.make(self);
		// Parse Message
		req.parseMessage(_frame);
		
		self._messages.push(req.message);
		if(self._messages.length > 100)
			self._messages.shift();
			
		var users = _.filter(self.users, function(user){ return user.id == req.user.id; });
		_.each(users, function(user){
			user.name = req.user.name;
			if(req.user.key) user.key = req.user.key;
			if(req.user.ip) user.ip = req.user.ip;
		});
		if(users.length === 0){
			console.log('['+req.room.name+'] Error: could not find user id in user list for ', req.user.name);
		}
		
		// Don't reply to self
		if(req.room._user_id == req.user.id) return;
		
		eventModule.emit('beforeRequest', req);
		eventModule.emit('event', 'request', req);
	});
	
	this.on('frame_u', function(_frame) {
		var msg = _.find(self._messages, function(msg){ return msg.number == _frame.number; });
		if(msg) msg.id = _frame.msgid;
	});
	
	///////////////
	// Utilities //
	
	this.on('frame_n', function(_frame){
		self.usercount = _frame.count;
	});
	
	this.on('frame_g_participants', function(_frame) {
		_.each(_frame.users, function(user){
			if(_.has(self.users, user.id)){
				self.users[user.sess] = _.extend(user, self.users[user.id]);
				delete self.users[user.id];
			}else{
				self.users[user.sess] = user;
			}
		});
		if(!self._settings.g_participants)
			self.write(['g_participants', 'stop']);
	});
	
	this.on('frame_participant', function(_frame) {
		if(_frame.mode){
			if(['leave-anon', 'leave-temp', 'leave-user'].indexOf(_frame.mode) !== -1){
				if(_.has(self.users, _frame.user.sess))
					delete self.users[_frame.user.sess];
			}
			else if(['join-anon', 'join-temp', 'join-user'].indexOf(_frame.mode) !== -1){
				if(!_.has(self.users, _frame.user.sess))
					 self.users[_frame.user.sess] = _frame.user;
			}
			else if(['logout', 'temp', 'login'].indexOf(_frame.mode) !== -1){
				self.users[_frame.user.sess] = _frame.user;
			}
			eventModule.emit('participant', self, _frame);
		}
	});
	
	this.on('frame_premium', function(_frame) {
		if(_frame.expire > +new Date/1000){
			if(self._settings.useBackground)
				self.write(['msgbg', '1']);
			if(self._settings.useRecording)
				self.write(['msgmedia', '1']);
		}
	});
	
	this.on('frame_show_fw', function() {
		console.log(('['+self.name+'] Flood warning. Going in lockdown').bold.red);
		self._writeLock = true;
		self.emit('start_fw');
		setTimeout(function(){
			self._writeLock = false;
		}, 15000);
	});
	
	this.on('frame_end_fw', function() {
		self._writeLock = false;
		self.emit('end_fw');
	});
	
	this.on('frame_show_tb', function(_frame) {
		// 15 minutes, result of flooding
		self.emit('show_tempban', _frame.seconds);
	});
	
	this.on('frame_tb', function(_frame){
		self.emit('tempban', _frame.time);
	});
	
	this.on('frame_clearall', function(_frame){
		if(_frame.answer == 'ok'){
			_.each(self.messages, function(message){
				message.deleted = true;
			});
			self.emit('clearall');
		}
	});
	
	this.on('frame_delete', function(_frame){
		var msg = _.find(self._messages, function(x){ return (x.id == _frame.msgid); });
		if(msg){
			msg.deleted = true;
			eventModule.emit('event', 'messageDeleted', msg, this);
		}
	});
	
	this.on('frame_deleteall', function(_frame){
		_.each(_frame.msgids, function(msgid){
			var msg = _.find(self._messages, function(x){ return (x.id == _frame.msgid); });
			if(msg){
				msg.deleted = true;
			}
		});
	});
	
	this.on('frame_updateprofile', function(_frame) {
		self.emit('profileupdate', _frame.name);
	});
	
	this.on('frame_mods', function(_frame) {
		self.mods = _frame.mods;
		var added = _.find(Object.keys(self.mods), function(x){ return Object.keys(self.mods).indexOf(x) > -1; });
		var removed = _.find(Object.keys(self.mods), function(x){ return Object.keys(self.mods).indexOf(x) < 0; });
		
		if(added){
			self.emit('mod_added', added);
		}else if(removed){
			self.emit('mod_removed', removed);
		}
		self.checkModStatus();
	});
	
	this.on('frame_blocklist', function(_frame) {
		self._bans = _frame.bans;
	});
	
	this.on('frame_blocked', function(_frame) {
		self._bans[_frame.ban.name] = _frame.ban;
		eventModule.emit('event', 'ban', self, _frame.ban);
	});
	
	this.on('frame_unblocked', function(_frame) {
		delete self._bans[_frame.unban.name];
		self.emit('unban', _frame.unban);
	});
	
	this.on('frame_bansearchresult', function(_frame) {
		self.emit('banSearchResult', _frame.result);
	});
	
	this.on('frame_getbannedwords', function(_frame) {
		self._bannedWordsPartly = _frame.partly;
		self._bannedWordsExact = _frame.exact;
	});
	
	this.on('frame_bw', function(_frame) {
		self._bannedWordsPartly = _frame.partly;
		self._bannedWordsExact = _frame.exact;
	});
	
	this.on('frame_ubw', function() {
		self.getBannedWords();
	});
	
}

// Usable functions

Room.prototype.connect = function(){
	if(!this._sock._connected)
		this._sock.connect();
}

Room.prototype.disconnect = function() {
	this._settings.active = false;
	this._settings.autoReconnect = false;
	if(this._sock._connected){
		this._sock.disconnect();
	}
}

Room.prototype.reconnect = function(){
	if(this._sock._connected){
		this._settings.autoReconnect = true;
		this._sock.disconnect();
	}
}

Room.prototype.write = function(args) {
	if(!this._writeLock){
		this._sock.write(_.isArray(args) ? args : _.toArray(arguments));
	}
}

function stringConvertEnteties(string, all){
	all = all || false;
	return _.reduce(string, function(x,y,i){
		var code = string.charCodeAt(i);
		return x += code = (all || code > 127) ? '&#'+code+';' : string.charAt(i);
	},'');
}

Room.prototype.message = function(body, channel) {
	if(this._writeLock || !body) return;
	
	var self = this;
	
	if(_.isArray(body)){
		//Multi-line message
		var output = _.reduce(body, function(output, msg, i){
			return output += self.font() + String(msg) + self.fontEnd() + '</p>' + (i == body.length-1 ? '' : '<p>');
		}, '');
		
		output = output.replace(/(\n\r|\r\n|\n|\r|\0)/g, '<br/>');
		_.each(output.match(/.{1,2950}/gm), function(msg){
			self.write('bm', 'l33t', utils.choose_channel(utils.find_channel(channel)[0]), '<n'+self._settings.nameColor+'/>'+'<p>'+msg);
		});
	}
	else{
		body = String(body).replace(/(\n\r|\r\n|\n|\r|\0)/g, '<br/>');
		_.each(body.match(/.{1,2950}/gm), function(msg){
			self.write('bm', 'l33t', utils.choose_channel(utils.find_channel(channel)[0]), '<n'+self._settings.nameColor+'/>' + self.font() + msg + self.fontEnd());
		});
	}
};

Room.prototype.multiLine = function(array){
	if(_.isArray(array)) {
		return _.reduce(array, function(output, msg, i){
			return output += this.font() + String(msg) + this.fontEnd() + '</p>' + (i == array.length-1 ? '' : '<p>');
		}.bind(this), '');
	} else if(_.isString(array)) {
		return array;
	}
}

Room.prototype.font = function(color, size, face) {
	color = color || this._settings.textColor;
	size = size || this._settings.textSize;
	face = face || this._settings.textFont;
	return '<f x'+String(size)+String(color)+'="'+String(face)+'">';
}

Room.prototype.fontEnd = function() {
	return '</f>';
}


// Chatango functions

Room.prototype.login = function(account){
	if(!account) return;
	this._account = account;
	this._accountLC = account.toLowerCase();
	this._password = MM.parent._data.accounts[this._accountLC];
	if(!this._loggedIn)
		this.write(['blogin', this._account, this._password]);
}

Room.prototype.logout = function(){
	if(this._loggedIn)
		this.write(['blogout']);
}

Room.prototype.checkModStatus = function(){
	this._isAdmin = (this.admin == this._accountLC);
	this._isModerator = (Object.keys(this.mods).indexOf(this._accountLC) != -1 || this._isAdmin);
}

Room.prototype.addMod = function(name) {
	if(this._isAdmin){
		this.write(['addmod', name]);
		return true;
	}
	return false;
}

Room.prototype.removeMod = function(name) {
	if(this.isAdmin){
		this.write(['removemod', name]);
		return true;
	}
	return false;
}

Room.prototype.flag = function(message) {
	if(message.id){
		this.write(['g_flag', message.id]);
	}
}

Room.prototype.userTime = function(user, cb){
	var pm = _.find(MM.parent._data.pms, function(pm){
		return pm._sock && pm._sock._connected;
	});
	if(pm){
		pm.userTime(user, function(contact){
			cb(contact);
		});
	}else{
		cb(false);
	}
}

Room.prototype.del = function(message) {
	if(this._isModerator){
		if(message.id){
			this.write(['delmsg', message.id]);
		}else{
			var self = this;
			var count = 0;
			var inter = setInterval(function(){
				if(count > 200){
					clearInterval(inter);
				}
				if(message.id){
					self.write(['delmsg', message.id]);
					clearInterval(inter);
				}
				count++;
			}, 50);
		}
	}
}

Room.prototype.delLast = function(amount) {
	if(this._isModerator){
		amount = Math.max(parseInt(amount), 1) || 1;
		_.each(this._messages.slice(-amount), function(message){
			this.del(message);
		}.bind(this));
	}
}

Room.prototype.delLastUser = function(name, amount) {
	if(this._isModerator){
		amount = Math.max(parseInt(amount), 1) || 1;
		var messages = _.filter(this._messages, function(msg){
			return !msg.deleted && msg.name == name.toLowerCase();
		});
		_.each(messages.slice(-amount), function(message){
			this.del(message);
		}.bind(this));
	}
}

Room.prototype.clearUser = function(name) {


	if(this._isModerator && name){
		_.each(this.users, function(user){
			if(user.name == name.toLowerCase() && user.key && user.ip)
				this.write(['delallmsg', user.key, user.ip, ['#', '_'].indexOf(user.name.charAt(0)) !== -1 ? '' : user.name]);

		}.bind(this));
	}
}

Room.prototype.modClearAll = function() {
	if(this._isModerator){
		var self = this;
		_.each(this.users, function(user){
			if(user.key && user.ip) self.write(['delallmsg', user.key, user.ip, ['#', '_'].indexOf(user.name.charAt(0)) !== -1 ? '' : user.name]);
		});
	}
}

Room.prototype.clearAll = function() {
	if(this._isAdmin){
		this.write(['clearall']);
	}
}

Room.prototype.ban = function(name) {
	if(this._isModerator) {
		var self = this;
		_.each(this.users, function(user){
			if(user.key && user.ip && user.name && user.name == name.toLowerCase())
				self.write(['block', user.key, user.ip, user.name]);
		});
	}
}

Room.prototype.unban = function(name) {
	if(this._isModerator) {
		var ban = this._bans[name.toLowerCase()];
		if(ban){
			this.write(['removeblock', ban.key, ban.ip, ban.name]); 
		}
	}
}

Room.prototype.getBans = function() {
	if(this._isModerator){
		// Suffix 'anons', '1' is default behaviour - use 'anons', '0' to hide anons
		// 3th argument is optional timestamp showing bans after that time used for pagination
		this.write(['blocklist', 'block', '',  'next', '500']);
	}
}

Room.prototype.getUnbans = function() {
	if(this._isModerator){
		// Suffix same as requestBanlist
		this.write(['blocklist', 'unblock', '',  'next', '500']);
	}
}

Room.prototype.searchBan = function(query) {
	if(this._isModerator){
		this.write(['searchban', query]);
	}
}

Room.prototype.getBannedWords = function() {
	this.write(['getbannedwords']);
}

Room.prototype.setBannedWords = function(partly, exact) {
	if(this._isAdmin){
		this.write(['setbannedwords', '431', partly.join(','), exact.join(',')]);
	}
}

Room.prototype.addPartlyBannedWord = function(word) {
	if(this._isAdmin){
		if(this._bannedWordsPartly.indexOf(word) < 0){
			this._bannedWordsPartly.push(word);
			this.write('setbannedwords', '431', this._bannedWordsPartly.join(','), this._bannedWordsExact.join(','));
		}
	}
}

Room.prototype.addExactBannedWord = function(word) {
	if(this._isAdmin){
		if(this._bannedWordsExact.indexOf(word) < 0){
			this._bannedWordsExact.push(word);
			this.write('setbannedwords', '431', this._bannedWordsPartly.join(','), this._bannedWordsExact.join(','));
		}
	}
}

Room.prototype.removePartlyBannedWord = function(word) {
	if(this._isAdmin){
		var index = this._bannedWordsPartly.indexOf(word);
		if(index >= 0){
			this._bannedWordsPartly.splice(index, 1);
			this.write('setbannedwords', '431', this._bannedWordsPartly.join(','), this._bannedWordsExact.join(','));
		}
	}
}

Room.prototype.removeExactBannedWord = function(word) {
	if(this._isAdmin){
		var index = this._bannedWordsExact.indexOf(word);
		if(index >= 0){
			this._bannedWordsExact.splice(index, 1);
			this.write('setbannedwords', '431', this._bannedWordsPartly.join(','), this._bannedWordsExact.join(','));
		}
	}
}

exports.Room = Room;
