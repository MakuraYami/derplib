// DerpLib
var DerpLib = require('./derplib');

var db = DerpLib.MM.plugin.load('database').setOrder(1).done(function(){
	var permissions = DerpLib.MM.plugin.load('permissions').setOrder(2);
	var commands = DerpLib.MM.plugin.load('commands').setOrder(3).autoLoad();
	
	commands.setPrefix('-');
	
	permissions.addRole('user', {
		nodes: [
			{ node: '*' }, // All permissions
			{ node: 'cmd.e.*', grant: false }, // Except for eval
		],
	});
	permissions.setDefaultRole('user');
});

DerpLib.events.on("request",function(req){
	console.log('['+req.room.name+']['+req.user.name+'] '+req.message.text);
	
});

console.log('[BOT] Starting.');
new DerpLib.PM({account: 'user', password: 'pass'});
new DerpLib.Room({room: 'exampleroom', account: 'user', password: 'pass'});

