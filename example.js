// DerpLib
var DerpLib = require('./derplib');

DerpLib.addAccount('USERNAME', 'PASSWORD');

console.log('[DB] Loading...');
var db = DerpLib.MM.plugin.load('database').setOrder(1).done(function(){
	console.log('[BOT] Starting.');
	var permissions = DerpLib.MM.plugin.load('permissions').setOrder(2);
	var commands = DerpLib.MM.plugin.load('commands').setOrder(3).autoLoad();
	
	permissions.addRole('user', {access: 1});
	permissions.setDefaultRole('user');
	
	// Join a room here - after it's joined use join and leave commands
	if(!DerpLib.getRoom('exampleroom'))
		new DerpLib.Room({room: 'exampleroom', account: 'USERNAME'});
});

DerpLib.events.on("request", function(req){
	console.log('['+req.room.name+']['+req.user.name+'] '+req.message.text);
});

DerpLib.events.on('messageDeleted', function(message, room){
	console.log('['+room.name+'][DELETED]['+message.name+']', message.text);
});
