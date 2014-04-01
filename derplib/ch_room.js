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
	this.users = [];
	this.usercount = 0;
	// Private vars
	this._account = options.account || false;
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
	this._bansearch = {};
	this._bannedWordsPartly = []
	this._bannedWordsExact = [];
	this._autoReconnect = options.reconnect || true;
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
		if(Object.prototype.toString.call(settings) === "[object Object]")
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
			console.log(('['+self.name+'] Socket closed, reconnecting').bold.red);
			self._sock.connect();
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
		
		if(self.admin == self._account.toLowerCase()) {
			self._isAdmin = true;
		}
		
		if(self.mods.indexOf(self._account.toLowerCase()) != -1 || self._isAdmin) {
			self._isModerator = true;
		}
	});
	
	this.on('frame_pwdok', function(_frame) {
		self._loggedIn = true;
		self.write(['getpremium', '1']);
		if(self.admin == self._account.toLowerCase()) {
			self._isAdmin = true;
		}else{
			self._isAdmin = false;
		}
		if((self.mods.indexOf(self._account.toLowerCase()) != -1) || self._isAdmin) {
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
		if(!self._loggedIn) return;
		
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
		for(var k in _frame.participants){
			if(_frame.participants[k].name != 'None' && self.users.indexOf(_frame.participants[k].name.toLowerCase()) == -1)
				self.users.push(_frame.participants[k].name.toLowerCase());
		}
		if(!self._g_participants)
			self.write(['g_participants', 'stop']);
	});
	
	this.on('frame_participant', function(_frame) {	
		if(_frame.number == '0' && _frame.name.toLowerCase() != 'none'){ //leave
			var index = self.users.indexOf(_frame.name.toLowerCase());
			if(index != -1) self.users.splice(index, 1);
			
			self.emit('userleave', _frame.name.toLowerCase());
		}
		else if(_frame.number == '1'){ //join
			if(_frame.name.toLowerCase() != 'none' && self.users.indexOf(_frame.name.toLowerCase()) == -1){
				self.users.push(_frame.name.toLowerCase());
				
				self.emit('userjoin', _frame.name.toLowerCase());
			}
		}
		else if(_frame.number == '2'){ //log in or out
			if(_frame.name.toLowerCase() == 'none'){
				var index = self.users.indexOf(_frame.name.toLowerCase());
				if(index != -1) self.users.splice(index, 1);
				
				self.emit('userlogout', _frame.name.toLowerCase());
			}else{
				if(self.users.indexOf(_frame.name.toLowerCase()) == -1) 
					self.users.push(_frame.name.toLowerCase());
				
				self.emit('userlogin', _frame.name.toLowerCase());
			}
			
		}
	});
	
	this.on('frame_premium', function(_frame) {
		var premium_time = parseFloat(_frame.expire);
		if(premium_time > Math.floor(Date.now()/ 1000)){
			if(self._settings.useBackground && self._settings.useRecording){
				self.write(['msgbg', '1']);
				self.write(['msgmedia', '1']);
			}else if(self._settings.useRecording && !self._settings.useBackground){
				self.write(['msgmedia', '1']);
			}else if(self._settings.useBackground && !self._settings.useRecording){
				self.write(['msgbg', '1']);
			}
		}
	});
	
	this.on('frame_show_fw', function(_frame) {
		console.log(('['+self.name+'] Flood warning. Going in lockdown').bold.red);
		self._writeLock = true;
		self.emit('start_fw');
		/*
		setTimeout(function(){
			//raw write to bypass lock
			self._writeLock = false;
			self.write(['bmsg', 'l33t', '<n'+self._settings.nameColor+'/>' + self._fontf() + 'Going in pause for flood warning.']);
			self._writeLock = true;
		}, 5000);*/
	});
	
	this.on('frame_end_fw', function(args) {
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
	
	this.on('frame_clearall', function(){
		if(args[0] == 'ok'){
			for(var i=0; i<self.messages.length; i++){
				self.messages[i].deleted = true;
			}
			self.emit('clearall', args);
		}
	});
	
	this.on('frame_bansearchresult', function(_frame) {
		var bansearch = {
			name: _frame.name,
			ip: _frame.ip,
			unid: _frame.unid,
			bansrc: _frame.bansrc,
			time: _frame.time
		};
		self._bansearch[bansearch.name] = bansearch;
	});

	this.on('frame_delete', function(_frame){
		var msg = _.find(self.messages, function(x){ 
			if(x.id == _frame.msgid){
				return x; 
			}
		});
		msg.deleted = true
		self.emit('message_delete', msg);
	});
	
	this.on('frame_updateprofile', function(args) {
		self.emit('profileupdate', args[0]);
	});
	
	this.on('frame_mods', function(args) {
		self.mods = args;
		var added = _.find(args, function(x){ return self.mods.indexOf(x) >= 0; });
		var removed = _.find(self.mods, function(x){ return args.indexOf(x) < 0; });
		
		if(added){
			self.emit('mod_added', added);
		}else if(removed){
			self.emit('mod_removed', added);
		}
	});
	
	this.on('frame_blocklist', function(_frame) {
		for(var b in _frame.banlist){
			if(b != undefined){
				var ban = {
					id: _frame.banlist[b].unid,
					ip: _frame.banlist[b].ip,
					username: _frame.banlist[b].name.toLowerCase(),
					time: _frame.banlist[b].time,
					by: _frame.banlist[b].bansrc.toLowerCase()
				};
				self._bans[ban.username] = ban;
			}
		}
	});
	
	this.on('frame_blocked', function(_frame) {
		var ban = {
			id: _frame.unid,
			ip: _frame.ip,
			username: _frame.name,
			by: _frame.bansrc,
			time: _frame.time
		};
		self._bans[ban.username] = ban;
		self.emit('ban', ban);
	});
	
	this.on('frame_unblocked', function(_frame) {
		var unban = {
			id: _frame.unid,
			ip: _frame.ip,
			username: _frame.name,
			banner: _frame.unbansrc,
			time: _frame.time
		};
		delete self._bans[unban.username];
		self.emit('unban', unban);
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

Room.prototype._fontf = function(size, color, face) {
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
	
	if(Object.prototype.toString.call(body) == '[object Array]'){
		//Multi-line message
		var output = '';
		for(var i=0; i<body.length; i++){
			output += this._fontf() + body[i] + '</f></p>' + (i == body.length-1 ? '' : '<p>');
		}
		
		_.each(output.toString().match(/(.|[\r\n]){1,2950}/gm), function(msg){
			
			self.write(['bmsg', 'derp', '<n'+self._settings.nameColor+'/>'+msg]);
			
		});
	}
	else{
		_.each(body.toString().match(/(.|[\r\n]){1,2950}/gm), function(msg){
			
			self.write(['bmsg', 'derp', '<n'+self._settings.nameColor+'/>' + self._fontf() + msg]);
			
		});
	}
};

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
	if(message.id){
		this.write(['g_flag', message.id]);
	}
}

Room.prototype.delmsg = function(message) {
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
					this.write(['delmsg', message.id]);
					clearInterval(inter);
				}
				count++;
			}, 50);
		}
	}
}

Room.prototype.clearUser = function(message) {
	if(this._isModerator){
		this.write(['delallmsg', message.uid]);
	}
}

Room.prototype.clearall = function() {
	if(this._isAdmin){
		this.write(['clearall']);
	}
}

Room.prototype.ban = function(user) {
	if(this._isModerator) {
		if(user.key && user.ip && user.name)
			this.write(['block', user.key, user.ip, user.name]);
	}
}

Room.prototype.unban = function(user) {
	if(this._isModerator) {
		if(this._bans[user.name]){
			this.write(['removeblock', this._bans[user.name].id, this._bans[user.name].ip]); 
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
		return this._bansearch
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
