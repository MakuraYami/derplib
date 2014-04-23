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
	this.name = options.room;
	this.ispm = false;
	this.admin = false;
	this.mods = [];
	this.users = {};
	this.usercount = 0;
	// Private vars
	this._account = options.account || false;
	this._accountLC = this._account ? this._account.toLowerCase() : false;
	this._password = options.password || false;
	this._maxConTime = 0;
	this._loggedIn = false;
	this._uid = options.uid || utils.genUid();
	this._user_id = String(this._uid).substr(0, 8);
	this._host = options.host || weights.getServerHost(this.name);
	this._writeLock = false;
	this._g_participants = true;
	this._isAdmin = false;
	this._isModerator = false;
	this._consoleFilter = ['i', 'b', 'u', 'n', 'g_participants', 'participant', 'premium'];
	this._messages = [];
	this._bans = {};
	this._bannedWordsPartly = []
	this._bannedWordsExact = [];
	this._autoReconnect = options.reconnect || true;
	this._reconnectDelay = 5;
	this._settings = {
		useBackground: true,
		useRecording: false,
		nameColor: '000',
		textSize: '13',
		textColor: '000',
		textFont: '8',
	};
	
	var self = this;
	
	eventModule.emit("event", "newroom", this.name, function(settings){
		if(_.isObject(settings))
			self._settings = _.extend(self._settings, settings);
			
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
		
		if(self._account)
			self.write(['bauth', self.name, self._uid, self._account, self._password]);
		else
			self.write(['bauth', self.name, self._uid, '', '']);
		
		self._sock.setWriteLock(true);
		
		if(this._maxConTime){
			setTimeout(function(){
				self.reconnect();
			}, this._maxConTime * 1000);
		}
		
	});
	
	this._sock.on('error', function(exception) {
		console.log(('['+self.name+'] Socket ERROR:').bold.red, exception);
	});
	
	this._sock.on('timeout', function(exception) {
		console.log(('['+self.name+'] Socket TIMEOUT:').bold.red, exception);
	});
	
	this._sock.on('close', function() {
		if(self._autoReconnect){
			console.log(('['+self.name+'] Socket closed, reconnecting...').bold.red);
			setTimeout(function(){
				self._sock.connect();
			}, self._reconnectDelay * 1000);
		}else{
			console.log(('['+self.name+'] Socket closed, reconnect is off').bold.red);
		}
	});
	
	this._sock.on('data', function(data) {
		
		data = data.replace(/[\r\n\0]+$/, "");
		
		var args = data.split(':');
		
		if(self._consoleFilter.indexOf(args[0]) == -1 && self._consoleFilter.indexOf('all') == -1)
			console.log('['+self.name+']', data);
		
		var _frame = frame.parseFrameRoom(data);
		
		if(_frame && self.listeners('frame_'+_frame.type).length > 0){
			try {
				self.emit('frame_'+_frame.type, _frame);
			}
			catch(e){
				console.log(e.stack);
				//console.log(e.stack.split('\n').slice(0,4).join(''));
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
		this._autoReconnect = false;
		this.disconnect();
	});
	
	this.on('frame_ok', function(_frame) {
		
		// M = logged in, C = bad login
		this._loggedIn = _frame.mystatus == 'M';
		
		if(this._account && !this._loggedIn){
			console.log(('['+this.name+'] Login Failed!').bold.red);
			this._autoReconnect = false;
			this.disconnect();
			return;
		}
		
		self.admin = _frame.owner;
		self.mods = _frame.mods;
		
		if(self.admin == self._accountLC) {
			self._isAdmin = true;
		}
		
		if(self.mods.indexOf(self._accountLC) != -1 || self._isAdmin) {
			self._isModerator = true;
		}
	});
	
	this.on('frame_pwdok', function(_frame) {
		self._loggedIn = true;
		self.write(['getpremium', '1']);
		if(self.admin == self._accountLC) {
			self._isAdmin = true;
		}else{
			self._isAdmin = false;
		}
		if(self.mods.indexOf(self._accountLC) != -1 || self._isAdmin) {
			self._isModerator = true;
		}else{
			self._isModerator = false;
		}
		self.emit('loggedin');
	});
	
	this.on('frame_logoutok', function(_frame) {
		self._loggedIn = false;
		self._account = false;
		self.emit('logout');
	});
	
	this.on('frame_inited', function(args) {
		
		self._sock.setWriteLock(false);
		
		self.write(['getpremium', '1']);
		self.write(['g_participants','start']);
		self.getBannedWords();
		self.requestBanlist();
		self.emit('joined');
	});
	
	/////////////////////
	// Data management //
	
	this.on('frame_i', function(_frame) {
	
		var req = new request.make(self);
		req.parseMessage(_frame);
		
		eventModule.emit('event', 'RoomOffMsg', req);
		
		self._messages.push(req.message);
		if(self._messages.length > 100)
			self._messages.shift();
		var type,
			nameColor = /<n([0-9a-f]*)\/>/gi.exec(_frame.body);
		if(_frame.user.name && _frame.user.alias === undefined) type = 'user';
		else if(_frame.user.name === undefined && _frame.user.alias) type = 'temp';
		else type = 'anon';
		if(type == 'anon') {
			_frame.user.name = '_anon' + utils.getAnonId(nameColor, _frame.user.id);
		}
		else if(type == 'temp') {
			_frame.user.name = '#' + _frame.user.alias;
		}
		_.each(this.users, function(frame){
			if((type == 'temp' || type == 'anon') && frame.user.id == _frame.user.id){
				frame.user.name = _frame.user.name;
				frame.user.key = _frame.user.key;
				frame.user.ip = _frame.user.ip;
			}else if(type == 'user'){
				if(frame.user.name){
					if(frame.user.name.toLowerCase() == _frame.user.name.toLowerCase() && frame.user.id == _frame.user.id){
						frame.user.key = _frame.user.key;
						frame.user.ip = _frame.user.ip;
					}
				}else if(frame.user.id == _frame.user.id){
					frame.user.name = _frame.user.name;
					frame.user.key = _frame.user.key;
					frame.user.ip = _frame.user.ip;
				}	
			}
		});
	});
	
	this.on('frame_b', function(_frame) {
		
		// Parse Room
		var req = new request.make(self);
		// Parse Message
		req.parseMessage(_frame);
		
		// Don't reply to self
		if(req.room._user_id == req.user.id) return;
		
		eventModule.emit('event', 'request', req);
		
		self._messages.push(req.message);
		if(self._messages.length > 100)
			self._messages.shift();
		var type,
			nameColor = /<n([0-9a-f]*)\/>/gi.exec(_frame.body);
		if(_frame.user.name && _frame.user.alias === undefined) type = 'user';
		else if(_frame.user.name === undefined && _frame.user.alias) type = 'temp';
		else type = 'anon';
		if(type == 'anon') {
			_frame.user.name = '_anon' + utils.getAnonId(nameColor, _frame.user.id);
		}
		else if(type == 'temp') {
			_frame.user.name = '#' + _frame.user.alias;
		}
		_.each(this.users, function(frame){
			if((type == 'temp' || type == 'anon') && frame.user.id == _frame.user.id){
				frame.user.name = _frame.user.name;
				frame.user.key = _frame.user.key;
				frame.user.ip = _frame.user.ip;
			}else if(type == 'user'){
				if(frame.user.name){
					if(frame.user.name.toLowerCase() == _frame.user.name.toLowerCase() && frame.user.id == _frame.user.id){
						frame.user.key = _frame.user.key;
						frame.user.ip = _frame.user.ip;
					}
				}else if(frame.user.id == _frame.user.id){
					frame.user.name = _frame.user.name;
					frame.user.key = _frame.user.key;
					frame.user.ip = _frame.user.ip;
				}	
			}
		});
	});
	
	this.on('frame_u', function(_frame) {
		for(var i=self._messages.length-1; i>=0; i--){
			if(self._messages[i].number == _frame.number){
				if(_frame.msgid.length == 16)
					self._messages[i].id = _frame.msgid;
				break;
			}
		}
	});
	
	///////////////
	// Utilities //
	
	this.on('frame_n', function(_frame){
		self.usercount = _frame.count;
	});
	
	this.on('frame_g_participants', function(_frame) {
		self.users = _frame.users;
		if(!self._g_participants)
			self.write(['g_participants', 'stop']);
	});
	
	this.on('frame_participant', function(_frame) {
		if(_frame.mode == 'leave'){
			if(_.has(self.users, _frame.sess))
				delete self.users[_frame.sess];
		}
		else if(_frame.mode == 'join'){
			if(!_.has(self.users, _frame.sess))
				 self.users[_frame.sess] = _frame;
		}
		else if(_frame.mode == 'change'){
			//log in or out
			self.users[_frame.sess] = _frame;
			if(undefined === _frame.user.name){
				eventModule.emit('event', 'userLogout', _frame);
			}else{
				eventModule.emit('event', 'userLogin', _frame);
			}
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
	
	this.on('frame_show_fw', function(_frame) {
		console.log(('['+self.name+'] Flood warning. Going in lockdown').bold.red);
		self._writeLock = true;
		self.emit('start_fw');
		setTimeout(function(){
			self._writeLock = false;
			self.emit('end_fw');
		}, 10000);
		/*
		setTimeout(function(){
			//raw write to bypass lock
			self._writeLock = false;
			self.write(['bmsg', 'l33t', '<n'+self._settings.nameColor+'/>' + self._fontf() + 'Going in pause for flood warning.']);
			self._writeLock = true;
		}, 5000);*/
	});
	
	this.on('frame_end_fw', function(_frame) {
		self._writeLock = false;
		self.emit('end_fw');
	});
	
	this.on('frame_show_tb', function(_frame) {
		// 15 minutes, result of flooding
		console.log(('['+self.name+'] Tempbanned for '+_frame.time+' seconds').bold.red);
		self.emit('start_tempban');
	});
	
	this.on('frame_tb', function(_frame){
		console.log(('['+self.name+'] still Tempbanned you have '+_frame.time+' more seconds').bold.red);
		self.emit('tempban', _frame.time);
	});
	
	this.on('frame_clearall', function(_frame){
		if(_frame.answer == 'ok'){
			for(var i=0; i<self._messages.length; i++){
				self._messages[i].deleted = true;
			}
			self.emit('clearall', _frame.answer);
		}
	});
	
	this.on('frame_delete', function(_frame){
		var msg = _.find(self._messages, function(x){ return (x.id == _frame.msgid); });
		msg.deleted = true
		self.emit('message_delete', msg);
	});
	
	this.on('frame_updateprofile', function(args) {
		self.emit('profileupdate', args[0]);
	});
	
	this.on('frame_mods', function(_frame) {
		self.mods = _frame.mods;
		var added = _.find(_frame.mods, function(x){ return self.mods.indexOf(x) >= 0; });
		var removed = _.find(self.mods, function(x){ return _frame.mods.indexOf(x) < 0; });
		
		if(added){
			self.emit('mod_added', added);
		}else if(removed){
			self.emit('mod_removed', added);
		}
	});
	
	this.on('frame_blocklist', function(_frame) {
		self._bans = _frame.bans;
	});
	
	this.on('frame_blocked', function(_frame) {
		var ban = {
			key: _frame.unid,
			ip: _frame.ip,
			name: _frame.name,
			by: _frame.by,
			time: _frame.time
		};
		self._bans[ban.name] = ban;
		self.emit('ban', ban);
	});
	
	this.on('frame_unblocked', function(_frame) {
		var unban = {
			key: _frame.unid,
			ip: _frame.ip,
			name: _frame.name,
			banner: _frame.banner,
			time: _frame.time
		};
		delete self._bans[unban.name];
		self.emit('unban', unban);
	});
	
	this.on('frame_bansearchresult', function(_frame) {
	});
	
	this.on('frame_getbannedwords', function(args) {
		self._bannedWordsPartly = _.filter(decodeURIComponent(args[1]).split(','), function(x){ return x; });
		self._bannedWordsExact = _.filter(decodeURIComponent(args[2]).split(','), function(x){ return x; });
	});
	
	this.on('frame_bw', function(args) {
		self._bannedWordsPartly = _.filter(decodeURIComponent(args[1]).split(','), function(x){ return x; });
		self._bannedWordsExact = _.filter(decodeURIComponent(args[2]).split(','), function(x){ return x; });
		self.emit('bannedwords');
	});
	
	this.on('frame_ubw', function(args) {
		self.getBannedWords();
	});
	
}

Room.prototype.font = function(size, color, face) {
	size = size || this._settings.textSize;
	color = color || this._settings.textColor;
	face = face || this._settings.textFont;
	return '<f x'+size+color+'="'+face+'">';
}

// Usable functions

Room.prototype.connect = function(){
	if(!this._sock._connected)
		this._sock.connect();
}

Room.prototype.disconnect = function() {
	if(this._sock._connected)
		this._sock.disconnect();
}

Room.prototype.reconnect = function(){
	if(this._sock._connected)
		this._sock.reconnect();
}

Room.prototype.write = function(args) {
	if(!this._writeLock)
		this._sock.write(args);
}

Room.prototype.message = function(body) {
	
	if(this._writeLock || !body) return;
	
	var self = this;
	
	body = String(body).replace(/[\n\r]/, '');
	
	if(_.isArray(body)){
		//Multi-line message
		var output = _.reduce(body, function(output, msg, i){
			return output += self.font() + msg + '</f></p>' + (i == body.length-1 ? '' : '<p>');
		}, '');
		
		_.each(output.match(/(.|[\r\n]){1,2950}/gm), function(msg){
			self.write(['bmsg', 'l33t', '<n'+self._settings.nameColor+'/>'+msg]);
		});
	}
	else{
		_.each(body.match(/(.|[\r\n]){1,2950}/gm), function(msg){
			self.write(['bmsg', 'l33t', '<n'+self._settings.nameColor+'/>' + self.font() + msg]);
		});
	}
};

// Chatango functions

Room.prototype.login = function(){
	if(!this._loggedIn)
		this.write(['blogin', this._account, this._password]);
}

Room.prototype.logout = function(){
	if(this._loggedIn)
		this.write(['blogout']);
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
	if(this._isModerator){
		var msg = _.find(this._messages.reverse(), function(msg){
			return !msg.deleted && msg.text == message;
		});
		if(msg) this.write(['g_flag', msg.id]);
	}
}

Room.prototype.flagUser = function(name) {
	if(this._isModerator){
		var msg = _.find(this._messages.reverse(), function(msg){
			return !msg.deleted && msg.name.toLowerCase() == name.toLowerCase();
		});
		if(msg) this.flag(msg.text);
	}
}

Room.prototype.del = function(message) {
	if(this._isModerator){
		var msg = _.find(this._messages.reverse(), function(msg){
			return !msg.deleted && msg.text == message;
		});
		if(msg) this.write(['delmsg', msg.id]);
	}
}

Room.prototype.delUser = function(name) {
	if(this._isModerator){
		var msg = _.find(this._messages.reverse(), function(msg){
			return !msg.deleted && msg.name.toLowerCase() == name.toLowerCase();
		});
		if(msg) this.del(msg.text);
	}
}

Room.prototype.clearUser = function(name) {
	if(this._isModerator){
		var self = this;
		_.each(this.users, function(frame){
			if(frame.user.name.toLowerCase() == name.toLowerCase() && frame.user.key){
				self.write(['delallmsg', frame.user.key]);
			}
		});
	}
}

Room.prototype.clearall = function() {
	if(this._isAdmin){
		this.write(['clearall']);
	}
}

Room.prototype.ban = function(user) {
	var self = this;
	if(this._isModerator) {
		_.each(this.users, function(frame){
			if(frame.user.name.toLowerCase() == user.toLowerCase() && frame.user.key && frame.user.ip){
				self.write(['block', frame.user.key, frame.user.ip, frame.user.name]);
			}
		});
	}
}

Room.prototype.unban = function(user) {
	if(this._isModerator) {
		if(this._bans[user].name){
			this.write(['removeblock', this._bans[user].key, this._bans[user].ip, this._bans[user].name]); 
		}
	}
}

Room.prototype.requestBanlist = function() {
	if(this._isModerator){
		this.write(['blocklist', 'block', '',  'next', '500', 'anons', '1']);
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
		if(this.bannedWordsPartly.indexOf(word) < 0){
			this.bannedWordsPartly.push(word);
			this.command('setbannedwords', '431', this.bannedWordsPartly.join(','), this.bannedWordsExact.join(','));
		}
	}
}

Room.prototype.addExactBannedWord = function(word) {
	if(this._isAdmin){
		if(this.bannedWordsExact.indexOf(word) < 0){
			this.bannedWordsExact.push(word);
			this.command('setbannedwords', '431', this.bannedWordsPartly.join(','), this.bannedWordsExact.join(','));
		}
	}
}

Room.prototype.removePartlyBannedWord = function(word) {
	if(this._isAdmin){
		var index = this.bannedWordsPartly.indexOf(word);
		if(index >= 0){
			this.bannedWordsPartly.splice(index, 1);
			this.command('setbannedwords', '431', this.bannedWordsPartly.join(','), this.bannedWordsExact.join(','));
		}
	}
}

Room.prototype.removeExactBannedWord = function(word) {
	if(this._isAdmin){
		var index = this.bannedWordsExact.indexOf(word);
		if(index >= 0){
			this.bannedWordsExact.splice(index, 1);
			this.command('setbannedwords', '431', this.bannedWordsPartly.join(','), this.bannedWordsExact.join(','));
		}
	}
}

exports.Room = Room;
