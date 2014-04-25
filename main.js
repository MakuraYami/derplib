// DerpLib
var DerpLib = require('./derplib');

DerpLib.addAccount('user', 'pass');

console.log('[DB] Loading...');
var db = DerpLib.MM.plugin.load('database').setOrder(1).done(function(){
	console.log('[BOT] Starting.');
	var permissions = DerpLib.MM.plugin.load('permissions').setOrder(2);
	var commands = DerpLib.MM.plugin.load('commands').setOrder(3).autoLoad();
	
	permissions.addRole('user', {access: 1});
	permissions.setDefaultRole('user');
	
	// After making it join once the bot will auto-join the rooms on startup and you can remove this.
	new DerpLib.Room({room: 'exampleroom', account: 'user'});
});

DerpLib.events.on("request",function(req){
	console.log('['+req.room.name+']['+req.user.name+'] '+req.message.text);
});

