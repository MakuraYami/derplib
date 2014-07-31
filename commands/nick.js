
// Derplib command file

var MM 		   = module.parent,
	commands = MM.plugin.load('commands'),
	db		 = MM.plugin.load('database');
 
commands.register({
	key: 'nick',
	access: 0,
	run: function(req){
		// Sets nickname if it doesnt exist.
		db.create('users.'+req.user.name+'.nickname', req.user.name);
		
		if(req.message.args.length > 0){
			req.user.data.nickname = req.message.args.join(' ');
			req.write("Your nickname is now "+req.user.data.nickname);
		}else{
			req.write('Your nickname is '+req.user.data.nickname);
		}
	}
});