var ImgUtils = {
	loadImg: function(url) {
		var result = Q.defer();
		var img = new Image();
		img.setAttribute('crossOrigin', 'anonymous');
		img.onload = function() {
			result.resolve(img);
		};
		img.onerror = function() {
			result.reject();
		};
		img.src = url;
		// img.src = "old/stored-key.png";
		return result.promise;
	},
	loadedImageToPixelData: function(img) {
		var g = this.loadedImgToContext(img);
		return g.getImageData(0, 0, img.width, img.height).data;
	},
	loadedImageToBase64: function(img) {
		var g = this.loadedImgToContext(img);
		return this.contextToBase64(g);
	},
	contextToBase64: function(g) {
		return g.canvas.toDataURL('image/png').replace(/^data:image\/(png|jpg);base64,/, "");
	},
	loadedImgToContext: function(img) {
		var canvas = document.createElement('canvas');
		canvas.width = img.width;
		canvas.height = img.height;
		var g = canvas.getContext('2d');
		g.drawImage(img, 0, 0);
		return g;
	},
	drawLoadedImgTo: function(g) {
		return function(img) {
			g.drawImage(img, 0, 0);
			return g;
		}
	},
	writeBytesToContext: function(bytes, g) {
		var pixelData = g.getImageData(0, 0, g.canvas.width, g.canvas.height);
		var writer = new ByteWriter(pixelData.data, 0);
		writer.writeString("KEYv1");
		writer.writeInt(bytes.length);
		writer.writeBytes(bytes);
		var checksum = crc32(bytes);
		writer.writeInt(checksum);
		g.putImageData(pixelData, 0, 0);
		return g;
	},
	readBytesFromContext: function(g) {
		var pixelData = g.getImageData(0, 0, g.canvas.width, g.canvas.height);
		var reader = new ByteReader(pixelData.data, 0);
		var header = reader.readString(5);
		if (header != "KEYv1") throw new Error("Bad Header. Was "+header+" should have been KEYv1");
		var length = reader.readInt();
		var result = reader.readBytes(length);
		var check = reader.readInt();
		if (check !== crc32(result)) throw new Error("Checksum failed.");
		return result;
	},
	checkContextForHeader: function(g) {
		var pixelData = g.getImageData(0, 0, g.canvas.width, g.canvas.height);
		var reader = new ByteReader(pixelData.data, 0);
		var header = reader.readString(5);
		if (header != "KEYv1") return false;
		return true;
	}
};