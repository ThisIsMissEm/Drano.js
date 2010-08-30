;(function(root, undefined){
  var Drain, Evan;
  
  
  /*-----------------------------------------------
    Utilities:
  -----------------------------------------------*/
  var isArray = Array.isArray || function(obj) {
    return !!(obj && obj.concat && obj.unshift && !obj.callee);
  };

  function async_call(func, args, thisArg){
    setTimeout(function(){
      func.apply(thisArg, args || []);
    }, 1);
  };
  
  var mixin = function mixin(source, target){
    for (var key in (target || {})) source[key] = target[key];
  }

  /*-----------------------------------------------
    The actual Emitter
  -----------------------------------------------*/
  function Emitter(){
    this._events = {};
  };

  Emitter.prototype.bind = function(evt, listener) {
    if ('function' !== typeof listener) {
      throw new Error('addListener only takes instances of Function');
    }

    if (!this._events) this._events = {};
    if (!this._events[evt]) {
      // Optimize the case of one listener. Don't need the extra array object.
      this._events[evt] = listener;
    } else if (isArray(this._events[evt])) {
      // If we've already got an array, just append.
      this._events[evt].push(listener);
    } else {
      // Adding the second element, need to change to array.
      this._events[evt] = [this._events[evt], listener];
    }
    return this;
  };

  Emitter.prototype.unbind = function(evt, listener){
    if (!this._events || !this._events[evt])
      return this;

    if(listener === undefined || this._events[evt] === listener) {
      delete this._events[evt];
    } else {
      if ('function' !== typeof listener) {
        throw new Error('unbind only takes instances of Function');
      }

      var list = this._events[evt];

      if (isArray(list)) {
        var i = list.indexOf(listener);
        if (i > -1) {
          list.splice(i, 1);
          if (list.length == 0){
            delete this._events[evt];
          }
        }
      }
    }

    return this;
  };

  Emitter.prototype.emit = function(evt){
    if (!this._events || !this._events[evt]) return false;

    if (typeof this._events[evt] == 'function') {
      if (arguments.length < 3) { // fast case
        async_call(this._events[evt], [arguments[1], arguments[2]], this);
      } else { // slower
        async_call(this._events[evt], Array.prototype.slice.call(arguments, 1), this);
      }
      return true;
    } else if (isArray(this._events[evt])) {
      for (var i = 0
        , args = Array.prototype.slice.call(arguments, 1)
        , listeners = this._events[evt].slice(0), l = listeners.length
        ; i < l; ++i
      ) {
        async_call(listeners[i], args, this);
      }
      return true;
    } else {
      return false;
    }
  };

  /*-----------------------------------------------
    The Sir Evan
  -----------------------------------------------*/
  var Evan = function(klass){
    if(klass === undefined){
      return new Emitter;
    } else {
      Emitter.call(klass);

      // Let's extend!
      var kp = (klass.prototype ? klass.prototype : klass)
        , ep = Emitter.prototype;

      for(var p in ep) if(Object.prototype.hasOwnProperty.call(ep, p)) {
        kp[p] = ep[p];
      }

      return klass;
    }
  };
  
  /*-----------------------------------------------
    Enter Draino!
  -----------------------------------------------*/
  root.drano = function(options){
    return new Drain(options || {});
  };
  
  /*
   * States:
   *   0 - not connected
   *   1 - error
   *   2 - connecting
   *   3 - closing
   *   4 - connected
   *
   */
  Drain = Evan(function(options){
    this.options = mixin({
      server: document.location.host,
      secure: false,
      subprotocol: "",
      autoreconnect: true,
      max_retries: 3,
      retry_delay: 1000
    }, options);
    
    this._state = 0;
    this._events = {};
    this._socket = undefined;
    this.connected = false;
  });
  
  Drain.prototype.connect = function(path){
    if("WebSocket" in root){
      var drain = this
        , location = (this.options.secure ? "wss" : "ws") + "://" 
          + this.options.host + (path ? "/" + path : "/");
    
      this.state(1);
      this._socket = new WebSocket(location, options.subprotocol);
      this._socket.addEventListener("open", function(){
        drain.state(4);
        drain.connected = true;
        drain.emit("connect", this._socket);
      });
      
      this._socket.addEventListener("close", function(){
        if(drain._state != 3 && drain.options.autoreconnect
           && drain.retries =< drain.options.max_retries
        ){
          drain.retries++;
          setTimeout(function(){
            drain.state(2);
            drain.connect.call(drain, path);
          }, drain.options.retry_delay);
        } else {
          drain.connected = false;
          drain.state(0);
          drain.emit("disconnect", false);
        }
      });
      
      this._socket.addEventListener("message", function(evt){
        drain.emit("message", evt.data, evt);
      });
    } else {
      this.connected = false;
      this.state(3);
      this.emit("error", new Error("WebSockets Unavailable"));
    }
  };
  
  Drain.prototype.disconnect = function(){
    if(this.connected){
      this.socket.close();
    }
  };
  
  Drain.prototype.state = function(state){
    var oldstate = this._state;
    this._state = state;
    this.emit("stateChange", state, oldstate);
  };
  
  Drain.prototype.send = function(data){
    if(this.connected){
      this._socket.send(isArray(data) ? data.join(this.options.seperator))
    }
  };
})(this);