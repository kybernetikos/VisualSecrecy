function XMLRPC(url, user, password) {
	this.url = url;
	this.user = user;
	this.password = password;
	this.proxy = '';
	this.headers = {};
}

XMLRPC.prototype.setHeader = function(headerName, headerValue) {
	this.headers[headerName] = headerValue;
};

XMLRPC.prototype.fromXML = function fromXML(node) {
	var tagName = node.tagName;
	if (tagName === 'nil') {
		return null;
	} else if (tagName === 'value') {
		var i = 0;
		while (i < node.childNodes.length && node.childNodes[i].nodeType != 1) {
			++i;
		}
		return fromXML(node.childNodes[i]);
	} else if (tagName === 'string') {
		return node.textContent;
	} else if (tagName === 'boolean') {
		return node.textContent === '0' ? false : true;
	} else if (tagName === 'int') {
		return parseInt(node.textContent, 10);
	} else if (tagName === 'double') {
		return parseFloat(node.textContent, 10);
	} else if (tagName === 'date.iso8601') {
		return Date.parse(node.textContent);
	} else if (tagName === 'array' || tagName === 'params') {
		var result = [];
		var dataElement = node.firstElementChild;
		for (var i = 0; i < dataElement.childNodes.length; ++i) {
			var valueElement = dataElement.childNodes[i];
			if (valueElement.nodeType == 1) {
				result.push(fromXML(valueElement.firstElementChild));
			}
		}
		return result;
	} else if (tagName === 'struct') {
		var result = {};
		for (var i = 0; i < node.childNodes.length; ++i) {
			var member = node.childNodes[i];
			if (member.nodeType !== 1) continue;
			var name = null;
			for (var j = 0; j < member.childNodes.length; ++j) {
				var thisNode = member.childNodes[j];
				if (thisNode.nodeType === 1) {
					if (thisNode.tagName === 'name') {
						name = thisNode.textContent;
					} else if (thisNode.tagName == 'value') {
						result[name] = fromXML(thisNode);
						break;
					}
				}
			}
		}
		return result;
	}
	var serializer = new XMLSerializer();
	throw new Error('unable to parse ' + serializer.serializeToString(node) );
};

XMLRPC.prototype.toXML = function toXML(doc, value) {
	var element;
	var type = typeof value;
	var node = doc.createElement.bind(doc), text = doc.createTextNode.bind(doc);
	function tag(tagName, content) {
		var element = node(tagName);
		element.appendChild(text(content));
		return element;
	}

	if (value == null) {
		element = node('nil');
	} else if (value.toXML) {
		element = value.toXML(doc);
	} else if (type === 'string') {
		element = tag('string', value);
	} else if (type === 'boolean') {
		element = tag('boolean', value ? '1' : '0');
	} else if (type === 'number') {
		if (value|0 === value) {
			element = tag('int', value.toString(10));
		} else {
			element = tag('double', value.toString(10));
		}
	} else if (type === 'object') {
		if (value instanceof Date) {
			element = tag('dateTime.iso8601', value.toISOString());
		} else if (Object.prototype.toString.call(value) === '[object Array]') {
			element = node('array');
			var data = node('data');
			element.appendChild(data);
			for (var i = 0; i < value.length; ++i) {
				var valueElement = node('value');
				valueElement.appendChild(toXML(doc, value[i]));
				data.appendChild(valueElement);
			}
		} else {
			element = node('struct');
			for (var name in value) {
				var member = node('member');
				member.appendChild(tag('name', name));
				var valueElement = node('value');
				valueElement.appendChild(toXML(doc, value[name]));
				member.appendChild(valueElement);
				element.appendChild(member);
			}
		}
	}
	return element;
};

XMLRPC.prototype.bind = function(methodName) {
	var apply = this.apply.bind(this);
	return function() {
		return apply(methodName, arguments);
	}
};

XMLRPC.prototype.interface = function() {
	var result = {};
	for (var i = 0; i < arguments.length; ++i) {
		var methodName = arguments[i].split(".").pop();
		result[methodName] = this.bind(arguments[i]);
	}
	return result;
};

XMLRPC.prototype.apply = function(methodName, args) {
	var doc = document.implementation.createDocument(null, "methodCall", null);
	var url = this.proxy + this.url;
	var root = doc.documentElement;
	var node = doc.createElement.bind(doc), text = doc.createTextNode.bind(doc);
	function tag(tagName, content) {
		var element = node(tagName);
		element.appendChild(text(content));
		return element;
	}

	root.appendChild(tag('methodName', methodName));
	var params = node('params');
	root.appendChild(params);
	for (var i = 0; i < args.length; ++i) {
		var paramElement = node('param');
		var valueElement = node('value');
		paramElement.appendChild(valueElement);
		valueElement.appendChild(this.toXML(doc, args[i]));
		params.appendChild(paramElement);
	}

	var response = Q.defer();
	var request = new XMLHttpRequest();
	request.open("POST", url, true);
	for (var key in this.headers) {
		request.setRequestHeader(key, this.headers[key]);
	}
	request.responseType = 'document';
	request.onreadystatechange = function () {
		if (request.readyState === 4) {
			if (request.status === 200) {
				var doc = request.response;
				var root = doc.documentElement;
				if (root.firstElementChild.tagName === 'fault') {
					response.reject(this.fromXML(root.firstElementChild.firstElementChild.firstElementChild));
				} else {
					var responseValue = this.fromXML(root.firstElementChild);
					if (responseValue.length == 1) {
						response.resolve(responseValue[0]);
					} else {
						response.resolve(responseValue);
					}
				}
			} else {
				response.reject({faultCode: request.status, faultString: request.statusText, url: this.url});
			}
		}
	}.bind(this);
	request.send(doc);

	return response.promise;
};