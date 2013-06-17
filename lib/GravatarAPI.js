function getGrav(userEmail) {
	var userHash = CryptoJS.MD5(userEmail.trim().toLowerCase()).toString();

	var xr = new XMLRPC("https://secure.gravatar.com/xmlrpc?user="+userHash);
	xr.proxy = "https://cors-anywhere.herokuapp.com/";
	xr.setHeader('x-requested-with', 'gravjs');

	var grav = xr.interface(
			'grav.exists',
			'grav.addresses',
			'grav.userimages',
			'grav.saveData',
			'grav.saveUrl',
			'grav.useUserimage',
			'grav.removeImage',
			'grav.deleteUserimage',
			'grav.test'
	);

	function setGravMethod(grav, methodName) {
		var actualMethod = grav[methodName];
		grav[methodName] = function(args) {
			console.log('grav method', methodName, args);
			if (args.password == null) {
				if (grav.password == null) {
					grav.password = grav.passwordProvider();
				}
				args.password = grav.password;
			}
			return actualMethod(args);
		};
	}

	for (var method in grav) {
		setGravMethod(grav, method);
	}

	grav.passwordProvider = function() {
		return prompt("Please Enter Gravatar Password.");
	};
	grav.password = null;
	grav.email = userEmail;
	grav.userHash = userHash;
	grav.imgUrl = "//www.gravatar.com/avatar/" + userHash;
	grav.profileUrl = "//www.gravatar.com/" + userHash;

	grav.upload = function(canvas) {
		var base64Data = canvas.toDataURL('image/png').replace(/^data:image\/(png|jpg);base64,/, "");
		return grav.saveData({
			rating: 0,
			data: base64Data
		});
	};

	grav.useImgForPrimary = function(userImg) {
		return grav.useUserimage({
			userimage: userImg,
			addresses: [userEmail]
		});
	};

	grav.getUrl = function(email) {
		return "//www.gravatar.com/avatar/" + CryptoJS.MD5(email.trim().toLowerCase()).toString();
	};

	return grav;
}