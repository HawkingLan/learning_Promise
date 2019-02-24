/* 2.3 The Promise Resolution Procedure */
function resolvePromise(promise, x) {
    try {
        // 2.3.1 If promise and x refer to the same object, reject promise with a TypeError as the reason.
        if (promise === x) {
            throw new TypeError('promise cannot be resolved with itself.');
        }

        // 2.3.2 If x is promise
        // 2.3.3 If x is an object or function
        if (
            x &&
            (typeof x === 'object' || typeof x === 'function')
        ) {
            var then = x.then;
            // 2.3.3.3 If then is a function, call it with x as this, first argument resolvePromise, and second argument rejectPromise
            if (typeof then === 'function') {
                startResolve(promise, function (resolve, reject) {
                    then.call(x, resolve, reject);
                });
                return;
            }
        }

        // 2.3.3.4 If then is not a function, fulfill promise with x.
        // 2.3.4 If x is not an object or function, fulfill promise with x.
        doResolve(promise, x);
    } catch (e) {
        // 2.3.3.2 If retrieving the property x.then results in a thrown exception e, reject promise with e as the reason
        // 2.3.3.3.4.2 If calling then throws an exception e, reject promise with e as the reason.
        doReject(promise, e);
    }
}

function doResolve(promise, value) {
    promise._state = 'resolved';
    promise._value = value;

    _handleDeferreds(promise);
}

function doReject(promise, reason) {
    promise._state = 'rejected';
    promise._value = reason;

    _handleDeferreds(promise);
}

function startResolve(promise, fn) {
    var called = false;
    if (typeof fn !== 'function') {
        throw new Error('Promise procedure must be a function.');
    }

    try {
        fn(
            function (value) {
                // 2.2.2.3 onFulfilled must not be called more than once.
                if (called) return;

                if (promise._state === 'pending') {
                    called = true;
                    resolvePromise(promise, value);
                }
            },
            function (reason) {
                // 2.2.3.3 onRejected must not be called more than once.
                if (called) return;

                if (promise._state === 'pending') {
                    called = true;
                    doReject(promise, reason);
                }
            }
        );
    } catch (e) {
        // 2.3.3.3.4.1 If resolvePromise or rejectPromise have been called, ignore it.
        if (called) return;

        if (promise._state === 'pending') {
            called = true;
            doReject(promise, e);
        }
    }
}

function Promise(fn) {
    if (typeof fn !== 'function') {
        throw new Error('Promise resolver is not a function');
    }

    this._state = 'pending';
    this._value = null;
    this._deferreds = [];

    startResolve(this, fn);
}

/*
* 2.2.6 Then may be called multiple times on the same promise.
* All respective callbacks must execute in the order of their originating calls to then.
*/
function _handleDeferreds(promise) {
    // 2.2.4 onFulfilled or onRejected must not be called until the execution context stack contains only platform code.
    setTimeout(function () {
        var deferreds = promise._deferreds;
        var state = promise._state;
        while (deferreds.length) {
            var defer = deferreds.shift();
            try {
                resolvePromise(
                    defer.promise,
                    defer[state === 'resolved' ? 'onFulfilled' : 'onRejected'](promise._value)
                );
            } catch (e) {
                doReject(defer.promise, e);
            }
        }
    }, 0);
}

function _handleThen(promise, onFulfilled, onRejected) {
    var promise2;

    if (promise._state === 'pending') {
        promise2 = new Promise(function () {});
        promise._deferreds.push({
            onFulfilled: onFulfilled,
            onRejected: onRejected,
            promise: promise2
        });
    } else {
        promise2 = new Promise(function (resolve, reject) {
            setTimeout(function () {
                try {
                    // 2.2.7.1 If either onFulfilled or onRejected returns a value x, run the Promise Resolution Procedure [[Resolve]](promise2, x).
                    var fn = promise._state === 'resolved' ? onFulfilled : onRejected;
                    resolve(fn(promise._value));
                } catch (e) {
                    // 2.2.7.2 If either onFulfilled or onRejected throws an exception e, promise2 must be rejected with e as the reason.
                    reject(e);
                }
            }, 0);
        });
    }

    return promise2;
}

Promise.prototype.then = function (onFulfilled, onRejected) {
    // 2.2.7.3 If onFulfilled is not a function and promise1 is fulfilled, promise2 must be fulfilled with the same value as promise1.
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : function (value) {
        return value;
    };
    // 2.2.7.4 If onRejected is not a function and promise1 is rejected, promise2 must be rejected with the same reason as promise1.
    onRejected = typeof onRejected === 'function' ? onRejected : function (reason) {
        throw reason;
    };

    return _handleThen(this, onFulfilled, onRejected);
};

Promise.prototype.catch = function (onRejected) {
    return this.then(null, onRejected);
};

Promise.prototype.finally = function (fn) {
    return this.then(
        function (value) {
            return fn(value);
        },
        function (reason) {
            return fn(reason);
        }
    );
};

Promise.resolve = function (value) {
    return new Promise(function (resolve) {
        resolve(value);
    });
};

Promise.reject = function (reason) {
    return new Promise(function (resolve, reject) {
        reject(reason);
    });
};

Promise.all = function (defers) {
    if (!Array.isArray(defers)) {
        throw 'Promise.all only accepts Array.';
    }

    var results = [].concat(defers);
    var remain = defers.length;

    return new Promise(function (resolve, reject) {
        if (remain === 0) {
            resolve([]);
            return;
        }

        var getRes = function (x, i) {
            try {
                if (
                    x &&
                    (typeof x === 'object' || typeof x === 'function')
                ) {
                    var then = x.then;
                    if (typeof then === 'function') {
                        then.call(x, function (value) {
                            getRes(value, i);
                        }, reject);
                        return;
                    }
                }

                results[i] = x;

                if (--remain === 0) {
                    resolve(results);
                }
            } catch (e) {
                reject(e);
            }
        }

        defers.forEach(function (defer, idx) {
            getRes(defer, idx);
        });
    });
};

Promise.race = function (defers) {
    if (!Array.isArray(defers)) {
        throw 'Promise.race only accepts Array.';
    }

    return new Promise(function (resolve, reject) {
        var getRes = function (x) {
            try {
                if (
                    x &&
                    (typeof x === 'object' || typeof x === 'function')
                ) {
                    var then = x.then;
                    if (typeof then === 'function') {
                        then.call(x, resolve, reject);
                        return;
                    }
                }

                resolve(x);
            } catch (e) {
                reject(e);
            }
        };

        defers.forEach(function (defer) {
            getRes(defer);
        });
    });
};

module.exports = Promise;