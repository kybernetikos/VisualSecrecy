function Writer() {}
Writer.prototype.writeBytes = function(array) {
	for (var i = 0; i < array.length; ++i) {
		this.write(array[i]);
	}
};
Writer.prototype.writeString = function(string) {
	this.writeBytes(string.split("").map(function(a){return a.charCodeAt(0)}));
};
Writer.prototype.writeInt = function(int) {
	var bytes = [
		int >> 24,
		(int >> 16) & 0xff,
		(int >> 8) & 0xff,
		int & 0xff
	];
	this.writeBytes(bytes);
};

function BitWriter(imgdata, attachPixel) {
	this.pixel = attachPixel;
	this.byte = 0;
	this.data = imgdata;
}
BitWriter.prototype = Object.create(Writer.prototype);
BitWriter.prototype.write = function(byte) {
	var byteNo = this.pixel * 4 + this.byte;
	this.data[byteNo] = byte;
	if (++this.byte > 2) {
		// move to the next pixel;
		this.byte = 0;
		// clear alpha
		this.data[ ++this.pixel * 4 + 3] = 0xff;
	}
};

function ByteWriter(imgdata, attachPixel) {
	this.data = imgdata;
	this.pixel = attachPixel;
}
ByteWriter.prototype = Object.create(Writer.prototype);
ByteWriter.prototype.write = function(byte) {
	var byteNo = this.pixel * 4;
	this.data[byteNo] = (byte & parseInt("11100000", 2)) | parseInt("00010000", 2);
	this.data[byteNo + 1] = ((byte & parseInt("00011100", 2)) << 3) | parseInt("00010000", 2);
	this.data[byteNo + 2] = ((byte & parseInt("00000011", 2)) << 6) | parseInt("00010000", 2);
	this.data[byteNo + 3] = 0xff;
	this.pixel++;
};


function TBPPWriter(imgdata, attachPixel) {
	this.data = imgdata;
	this.pixel = attachPixel;
	this.byte = 0;
}
TBPPWriter.MOST_SIG_MASK = parseInt("11111100", 2);
TBPPWriter.LEAST_SIG_MASK = parseInt("00000011", 2);
TBPPWriter.prototype = Object.create(Writer.prototype);
TBPPWriter.prototype.write = function(byte) {
	var byteNo = this.pixel * 4 + this.byte;
	var firstPart = byte & TBPPWriter.MOST_SIG_MASK;
	var secondPart = byte & TBPPWriter.LEAST_SIG_MASK;
	this.data[byteNo] = firstPart | 1;
	var channel = this.byte % 4;
	if (channel == 0) {
		this.data[byteNo + 2] = secondPart << 6;
	} else if (channel == 1) {
		this.data[byteNo + 1] = this.data[byteNo + 1] | (secondPart << 4) | 1;
	}
	if (++this.byte > 1) {
		// move to the next pixel;
		this.byte = 0;
		// clear alpha, increment pixel
		this.data[ ++this.pixel * 4 + 3] = 0xff;
	}
};

function Reader() {}
Reader.prototype.readBytes = function(bytesToRead) {
	var result = new Array(bytesToRead);
	for (var i = 0; i < bytesToRead; ++i) {
		result[i] =this.read();
	}
	return result;
};
Reader.prototype.readInt = function() {
	var bytes = this.readBytes(4);
	return bytes[0] << 24
			| bytes[1] << 16
			| bytes[2] << 8
			| bytes[3]
};
Reader.prototype.readString = function(charsToRead) {
	var bytes = this.readBytes(charsToRead);
	return bytes.map(function(a) {return String.fromCharCode(a);}).join("");
};

function ByteReader(imgdata, attachPixel) {
	this.data = imgdata;
	this.pixel = attachPixel;
}
ByteReader.prototype = Object.create(Reader.prototype);
ByteReader.prototype.read = function() {
	var byteNo = this.pixel * 4;
	var result = 0;
	result = result | (this.data[byteNo] & parseInt("11100000", 2));
	result = result | ((this.data[byteNo + 1] & parseInt("11100000", 2)) >> 3);
	result = result | ((this.data[byteNo + 2] & parseInt("11000000", 2)) >> 6);
	this.pixel ++;
	return result;
};

function TBPPReader(imgdata, attachPixel) {
	this.data = imgdata;
	this.pixel = attachPixel;
	this.byte = 0;
}
TBPPReader.prototype = Object.create(Reader.prototype);
TBPPReader.prototype.read = function() {
	var byteNo = this.pixel * 4 + this.byte;
	var result = this.data[byteNo];
	var channel = this.byte % 4;
	if (channel == 0) {
		result = result | this.data[byteNo + 2] >> 6;
	} else if (channel == 1) {
		result = result | ((this.data[byteNo + 1] >> 4) &  TBPPWriter.LEAST_SIG_MASK);
	}
	if (++this.byte > 1) {
		// move to the next pixel;
		this.byte = 0;
		// clear alpha, increment pixel
		this.data[ ++this.pixel * 4 + 3] = 0xff;
	}
	return result;
};

function BitReader(imgdata, attachPixel) {
	this.pixel = attachPixel;
	this.data = imgdata;
	this.byte = 0;
}
BitReader.prototype = Object.create(Reader.prototype);
BitReader.prototype.read = function() {
	var byteNo = this.pixel * 4 + this.byte;
	var result = this.data[byteNo];
	if (++this.byte > 2) {
		// move to the next pixel;
		this.byte = 0;
		// clear alpha
		this.data[ ++this.pixel * 4 + 3] = 0xff;
	}
	return result;
};

function Party(curve, publicKey) {
	if (typeof publicKey === 'string') {
		publicKey = Crypto.util.hexToBytes(publicKey);
	}
	this.publicPt = ECPointFp.decodeFrom(curve, publicKey);
	this.bitcoinAddress = new Bitcoin.Address(Bitcoin.Util.sha256ripe160(this.publicPt.getEncoded(false)));
}

function Session(myemail, mypass) {
	Emitter.call(this);
	this.email = myemail;
	this.userHash = CryptoJS.MD5(myemail.trim().toLowerCase()).toString();
	this.passphrase = mypass;

	// start with a key based on the passphrase, as long as the passphrase isn't blank.
	if (!this.load()) {
		if (this.passphrase !== "") {
			this.key = new Bitcoin.ECKey(Crypto.SHA256(this.passphrase, { asBytes: true }));
			this.keySource = Session.PASSPHARSE;
		} else {
			this.key = new Bitcoin.ECKey();
			this.keySource = Session.RANDOM;
		}
	}
	this.save();
}
Session.prototype = Object.create(Emitter.prototype);

Session.PASSPHARSE = 'passphrase';
Session.RANDOM = 'random';
Session.IMPORT = 'import';

Session.prototype.save = function() {
	var serialized = JSON.stringify(this.key.priv.toByteArray(), null, 2);
	var key = Crypto.SHA256(this.passphrase, { asBytes: false });
	var encrypted = CryptoJS.AES.encrypt(serialized, key);
	localStorage.setItem(this.email, encrypted);
};

Session.prototype.load = function() {
	var encrypted = localStorage.getItem(this.email);
	if (encrypted == null) return false;
	var key = Crypto.SHA256(this.passphrase, { asBytes: false });
	var serialized = CryptoJS.AES.decrypt(encrypted, key).toString(CryptoJS.enc.Utf8);
	try {
		this.key = new Bitcoin.ECKey(JSON.parse(serialized));
		this.emit('keyChanged');
	} catch (e) {
		throw new Error("Unable to parse saved data, was your password correct?");
	}
	return true;
};

Session.prototype.useRandomKey = function() {
	this.key = new Bitcoin.ECKey();
	this.keySource = Session.RANDOM;
	this.save();
	this.emit('keyChanged');
};
Session.prototype.importPrivateKey = function(keyImport) {
	var res = Session.parseBase58Check(keyImport);
	var version = res[0];
	if (version != 128) throw new Error("Invalid private key version, was "+version+" only 128 is supported.");
	var payload = res[1];
	if (payload.length > 32) {
		payload.pop();
	}
	this.key = new Bitcoin.ECKey(payload);
	this.keySource = Session.IMPORT;
	this.save();
	this.emit('keyChanged');
};

Session.parseBase58Check = function(address) {
	var bytes = Bitcoin.Base58.decode(address);
	var end = bytes.length - 4;
	var hash = bytes.slice(0, end);
	var checksum = Crypto.SHA256(Crypto.SHA256(hash, {asBytes: true}), {asBytes: true});
	if (checksum[0] != bytes[end] ||
			checksum[1] != bytes[end+1] ||
			checksum[2] != bytes[end+2] ||
			checksum[3] != bytes[end+3])
		throw new Error("Wrong checksum");
	var version = hash.shift();
	return [version, hash];
};

Session.prototype.getParty = function(publicKey) {
	return new Party(this.key.getPubPoint().curve, publicKey);
};

Session.GRAVATAR_HAS_NO_VALID_DATA = 1;
Session.USER_HAS_NO_GRAVATAR = 2;

Session.prototype.getGravatarParty = function(userIdentifier) {
	var result = Q.defer();
	var img = new Image();
	img.setAttribute('crossOrigin','anonymous');
	img.onload = function() {
		var g = ImgUtils.loadedImgToContext(img);
		var publicKey = null;
		try {
			publicKey = ImgUtils.readBytesFromContext(g);
			var party = this.getParty(publicKey);
			party.img = img;
			result.resolve(party);
		} catch (e) {
			result.reject(Session.GRAVATAR_HAS_NO_VALID_DATA, userIdentifier);
		}
	}.bind(this);
	img.onerror = function() {
		result.reject(Session.USER_HAS_NO_GRAVATAR, userIdentifier);
	}.bind(this);

	if (userIdentifier.indexOf('@') > 0) {
		var userHash = CryptoJS.MD5(userIdentifier.trim().toLowerCase()).toString();
		img.src = "//www.gravatar.com/avatar/" + userHash + "?d=404&cachebuster="+Date.now();
	} else if (userIdentifier.indexOf('gravatar.com/avatar') >= 0) {
		img.src = userIdentifier + "?d=404&cachebuster="+Date.now();
	} else {
		img.src = "//www.gravatar.com/avatar/" + userIdentifier + "?d=404&cachebuster="+Date.now();
	}
	// img.src = "testimage.png";
	return result.promise;
};

Session.prototype.getSharedSecret = function(party) {
	var sharedPoint = party.publicPt.multiply(this.key.priv);
	var sharedBytes = sharedPoint.getX().toBigInteger().toByteArray();
	return Crypto.SHA256(sharedBytes, {asBytes: false});
};

Session.prototype.encrypt = function(party, message) {
	return CryptoJS.AES.encrypt(message, this.getSharedSecret(party));
};

Session.prototype.decrypt = function(party, message) {
	return CryptoJS.AES.decrypt(message, this.getSharedSecret(party)).toString(CryptoJS.enc.Utf8);
};