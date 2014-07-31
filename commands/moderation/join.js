var MM 		 = module.parent,
	DerpLib  = MM.parent,
	commands = MM.plugin.load('commands');
	
commands.register({
	key: 'join',
	access: 2,
	run: function(req){
		if(req.message.args.length > 0){
			DerpLib.Room({room: req.message.args[0]});
		}
	},
});

commands.register({
	key: 'leave',
	access: 2,
	run: function(req){
		if(req.message.args.length > 0){
			var room = DerpLib.getRoom(req.message.args[0]);
			if(room) room.disconnect();
		} else {
			req.room.disconnect();
		}
	},
});