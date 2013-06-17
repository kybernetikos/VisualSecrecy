var Emitter = (function() {
	// Minimal event emitter.
	// Listeners can register with .on and removed with .remove
	// Events can be emitted with .emit
	function Emitter() {
		this._listeners = {};
		this._forwards = [];
		this._last = {};
	}

	Emitter.prototype = {
		on: function on(evtName, callee) {
			if (typeof evtName !== 'string') throw new Error("on: Illegal Argument: Event name must be a string, was " + evtName);
			if (typeof callee !== 'function') throw new Error("on: Illegal Argument: callee must be a function, was " + callee);
			var listeners = this._listeners[evtName] || (this._listeners[evtName] = []);
			listeners.push(callee);
		},
		once: function(evtName, callee) {
			if (evtName in this._last) {
				callee.apply(null, this._last[evtName]);
			} else {
				var tmpCallee = function() {
					var removed = this.remove(evtName, tmpCallee);
					console.log('removed', removed);
					callee.apply(null, arguments);
				}.bind(this);
				this.on(evtName, tmpCallee);
			}
		},
		forward: function(emitter) {
			this._forwards.push(emitter);
		},
		remove: function remove(evtName, callee) {
			if (typeof evtName !== 'string') throw new Error("remove: Illegal Argument: Event name must be a string, was " + evtName);
			if (typeof callee !== 'function') throw new Error("remove: Illegal Argument: callee must be a function, was " + callee);
			var listeners = this._listeners[evtName] || [];
			var idx = listeners.indexOf(callee);
			if (idx >= 0) listeners.splice(idx, 1);
			return (idx >= 0);
		},
		emit: function emit(evtName) {
			if (typeof evtName !== 'string') throw new Error("emit: Illegal Argument: Event name must be a string, was " + evtName);
			var args = arguments;
			var eventArgs = Array.prototype.slice.call(args, 1);
			(this._listeners[evtName] || []).forEach(function(callee) {
				callee.apply(this, eventArgs);
			}.bind(this));
			this._forwards.forEach(function(emitter) {
				emitter.emit.apply(emitter, args);
			});
			this._last[evtName] = eventArgs;
		},
		doEmit: function doEmit(evtName) {
			return this.emit.bind(this, evtName);
		}
	};

	return Emitter;
})();