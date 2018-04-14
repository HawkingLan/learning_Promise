function _Promise(executor) {
    let _this = this;
    _this.status = 'pending';
    _this.value = undefined;
    _this.reaseon = undefined;
    _this.onFulFilledCallbacks = [];
    _this.onRejectedCallbacks = [];

    function resolve(value) {
        if (_this.status === 'pending') {
            _this.status = 'resolved';
            _this.value = value;
            _this.onFulFilledCallbacks.forEach(cb => cb());
        }
    }

    function reject(reaseon) {
        if (_this.status === 'pending') {
            _this.status = 'rejected';
            _this.reaseon = reaseon;
            _this.onRejectedCallbacks.forEach(cb => cb());
        }
    }

    try {
        executor(resolve, reject);
    } catch (e) {
        reject(e);
    }
}

function resolvePromise(promise2, x, resolve, reject) {
    if (promise2 === x) {
        return reject(new TypeError('circular reference of promise'));
    }

    let called;
    if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
        try {
            let then = x.then;
            if (typeof then === 'function') {
                then.call(x, function(y) {
                    if (called) return;
                    called = true;
                    resolvePromise(promise2, y, resolve, reject);
                }, function(err) {
                    if (called) reutrn;
                    called = true;
                    reject(err);
                });
            } else {
                resolve(x);
            }
        } catch (e) {
            if (called) return;
            called = true;
            reject(e);
        }
    } else {
        resolve(x);
    }
}

_Promise.prototype.then = function(onFulFilled, onRejected) {
    onFulFilled = typeof onFulFilled === 'function' ? onFulFilled : function(val) { return val; };
    onRejected = typeof onRejected === 'function' ? onRejected : function(err) { throw err; };
    
    let _this = this;
    let promise2;
    if (_this.status === 'resolved') {
        promise2 = new _Promise(function(resolve, reject) {
            setTimeout(function() {
                try {
                    let x = onFulFilled(_this.value);
                    resolvePromise(promise2, x, resolve, reject);
                } catch (e) {
                    reject(e);
                }
            });
        });
    } else if (_this.status === 'rejected') {
        promise2 = new _Promise(function(resolve, reject) {
            setTimeout(function() {
                try {
                    let x = onRejected(_this.reaseon);
                    resolvePromise(promise2, x, resolve, reject);
                } catch (e) {
                    reject(e);
                }
            });
        });
    } else if (_this.status === 'pending') {
        promise2 = new _Promise(function(resolve, reject) {
            _this.onFulFilledCallbacks.push(function() {
                setTimeout(function() {
                    try {
                        let x = onFulFilled(_this.value);
                        resolvePromise(promise2, x, resolve, reject);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
            _this.onRejectedCallbacks.push(function() {
                setTimeout(function() {
                    try {
                        let x = onRejected(_this.reaseon);
                        resolvePromise(promise2, x, resolve, reject);
                    } catch (e) {
                        reject(e);
                    }
                });
            });
        });
    }

    return promise2;
};

_Promise.prototype.catch = function(callback) {
    return this.then(null, callback);  
};

_Promise.all = function(promises) {
    return new _Promise(function(resolve, reject) {
        try {
            let ret = [];
            promises.forEach((promise, i) => {
                promise.then(function(y) {
                    ret[i] = y;
                    if (i === promises.length - 1) {
                        resolve(ret);
                    }
                }, reject);
            });
        } catch (e) {
            reject(e);
        }
    });
};

_Promise.race = function(promises) {
    return new _Promise(function(resolve, reject) {
        try {
            promises.forEach(promise => promise.then(resolve, reject));
        } catch (e) {
            reject(e);
        }
    });
};

_Promise.resolve = function(value) {
    return new _Promise(function(resolve, reject) {
        resolve(value);
    });
};

_Promise.reject = function(reaseon) {
    return new _Promise(function(resolve, reject) {
        reject(reaseon);
    });
};

module.exports = _Promise;